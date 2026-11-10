import { describe, it, expect } from 'vitest';
import {
  DIFFICULTY_TIERS, MAX_TIER, RISE_POINTS, STRUGGLES_TO_DROP, WINS_TO_RISE, AdaptiveProfile, createDefaultProfile, effectiveTier,
  evaluateAndAdapt, expectedSecondsFor, getLevelParamsForProfile, profileFromShared,
} from '../src/core/adaptive';
import type { MatchResult } from '../src/core/adaptive';
import { computeSparksReward } from '../src/core/progress';
import { HybridStorageService } from '../src/services/StorageService';

describe('Dificultad: peldaños de Circuitos', () => {
  it('los peldaños 1 a 3 son 4x4 (el modo Relajado no pasa de ahí) y el tablero y los bucles no bajan al subir', () => {
    for (const tier of [1, 2, 3]) expect(DIFFICULTY_TIERS[tier].width).toBe(4);
    for (let tier = 2; tier <= MAX_TIER; tier++) {
      const prev = DIFFICULTY_TIERS[tier - 1];
      const cur = DIFFICULTY_TIERS[tier];
      expect(cur.width).toBeGreaterThanOrEqual(prev.width);
      expect(cur.extraLoops + cur.width * 2).toBeGreaterThan(prev.extraLoops + prev.width * 2);
    }
    expect(DIFFICULTY_TIERS[10].width).toBe(7);
    expect(DIFFICULTY_TIERS[10].extraLoops).toBeGreaterThanOrEqual(6);
  });

  it('effectiveTier respeta el modo: Relajado hasta 3, Reto desde 5', () => {
    expect(effectiveTier({ mode: 'relaxed', currentTier: 8 })).toBe(3);
    expect(effectiveTier({ mode: 'challenge', currentTier: 2 })).toBe(5);
    expect(effectiveTier({ mode: 'normal', currentTier: 7 })).toBe(7);
    expect(effectiveTier({ mode: 'normal', currentTier: 99 })).toBe(MAX_TIER);
    expect(getLevelParamsForProfile({ ...createDefaultProfile('relaxed'), currentTier: 9 }).width).toBe(4);
  });
});

describe('Dificultad: la subida es más rápida', () => {
  const win = (profile: ReturnType<typeof createDefaultProfile>, taps: number, seconds: number) =>
    evaluateAndAdapt(profile, { minTaps: 10, actualTaps: taps, elapsedSeconds: seconds }).updatedProfile;

  it(`${WINS_TO_RISE} victorias normales seguidas suben un peldaño, no dos`, () => {
    let p = createDefaultProfile('normal');
    p = win(p, 12, 25);
    p = win(p, 12, 25);
    expect(p.currentTier).toBe(2);
    p = win(p, 12, 25);
    expect(p.currentTier).toBe(3);
  });

  it('una victoria dominante tras otra victoria salta dos peldaños; la primera sola no salta', () => {
    let p = createDefaultProfile('normal');
    p = win(p, 10, 5); // dominante pero sin victoria previa: no salta
    expect(p.currentTier).toBe(2);
    p = win(p, 10, 5);
    expect(p.currentTier).toBe(4);
  });

  it('una victoria con pistas o lenta nunca es dominante', () => {
    let p = createDefaultProfile('normal');
    p = win(p, 12, 25);
    const slow = evaluateAndAdapt(p, { minTaps: 10, actualTaps: 10, elapsedSeconds: 5, hintsUsed: 1 }).updatedProfile;
    expect(slow.currentTier).toBe(2);
  });
});

describe('Dificultad: un perfil por puzzle', () => {
  it('un puzzle sin perfil hereda modo y peldaño del de Circuitos, sin racha ni puntuación', () => {
    const shared = { ...createDefaultProfile('challenge'), currentTier: 7, rating: 1800, consecutiveWinsWithoutStruggle: 2 };
    const own = profileFromShared(shared);
    expect(own.mode).toBe('challenge');
    expect(own.currentTier).toBe(7);
    expect(own.rating).toBe(1000);
    expect(own.consecutiveWinsWithoutStruggle).toBe(0);
  });

  it('cada puzzle guarda y lee el suyo, y Circuitos conserva la clave de siempre', () => {
    const storage = new HybridStorageService();
    storage.saveProfile({ ...createDefaultProfile('normal'), currentTier: 6 }); // Circuitos
    expect(storage.get('profile_adaptive')).toContain('"currentTier":6');
    // Luces aún no tiene perfil: hereda el peldaño 6
    expect(storage.loadProfile('lights').currentTier).toBe(6);
    storage.saveProfile({ ...createDefaultProfile('normal'), currentTier: 3 }, 'lights');
    // Cambiar Luces no mueve Circuitos ni Hilos
    expect(storage.loadProfile('circuits').currentTier).toBe(6);
    expect(storage.loadProfile('lights').currentTier).toBe(3);
    expect(storage.loadProfile('flow').currentTier).toBe(6);
  });

  it('un perfil guardado corrupto no rompe la carga', () => {
    const storage = new HybridStorageService();
    storage.set('profile_adaptive_flow', '{no es json');
    storage.set('profile_adaptive', '???');
    expect(storage.loadProfile('flow').currentTier).toBe(2);
    expect(storage.loadProfile('circuits').currentTier).toBe(2);
  });
});

describe('Dificultad: sube o baja según lo bien que se juega', () => {
  const play = (p: AdaptiveProfile, r: MatchResult) => evaluateAndAdapt(p, r).updatedProfile;
  const playMany = (p: AdaptiveProfile, r: MatchResult, n: number) => {
    for (let i = 0; i < n; i++) p = play(p, r);
    return p;
  };
  // Circuitos, 10 giros mínimos: tiempo esperado 25 s
  const good: MatchResult = { minTaps: 10, actualTaps: 13, elapsedSeconds: 24 };
  const average: MatchResult = { minTaps: 10, actualTaps: 20, elapsedSeconds: 40 };
  const poor: MatchResult = { minTaps: 10, actualTaps: 40, elapsedSeconds: 60 };

  it('quien juega bien sube cada 3 niveles; quien va justo, cada 6', () => {
    expect(playMany(createDefaultProfile('normal'), good, WINS_TO_RISE).currentTier).toBe(3);
    const avg = createDefaultProfile('normal');
    expect(playMany(avg, average, RISE_POINTS - 1).currentTier).toBe(2);
    expect(playMany(avg, average, RISE_POINTS).currentTier).toBe(3);
  });

  it('quien se atasca no sube nunca y baja con dos atascos seguidos', () => {
    let p: AdaptiveProfile = { ...createDefaultProfile('normal'), currentTier: 5 };
    expect(evaluateAndAdapt(p, poor).evaluation.isStruggle).toBe(true);
    p = playMany(p, poor, STRUGGLES_TO_DROP);
    expect(p.currentTier).toBe(4);
    p = playMany(p, poor, STRUGGLES_TO_DROP);
    expect(p.currentTier).toBe(3);
  });

  it('un atasco borra los puntos ganados: alternar bien y atascado no hace subir', () => {
    let p = createDefaultProfile('normal');
    for (let i = 0; i < 10; i++) p = play(p, i % 2 === 0 ? good : poor);
    expect(p.currentTier).toBe(2);
  });

  it('tardar muchísimo más de lo esperado cuenta como atasco aunque no sobren toques', () => {
    const res = evaluateAndAdapt(createDefaultProfile('normal'), { minTaps: 10, actualTaps: 10, elapsedSeconds: 25 * 3.6 });
    expect(res.evaluation.isStruggle).toBe(true);
  });

  it('cada puzzle tiene su tiempo esperado: Hilos crece con el tablero y Luces da tiempo para pensar', () => {
    expect(expectedSecondsFor('circuits', 20, 49)).toBe(50);
    expect(expectedSecondsFor('flow', 8, 64)).toBeGreaterThan(expectedSecondsFor('flow', 3, 16) * 2);
    expect(expectedSecondsFor('flow', 8, 64)).toBeGreaterThan(expectedSecondsFor('circuits', 8, 64) * 3);
    expect(expectedSecondsFor('lights', 20, 49)).toBeGreaterThan(expectedSecondsFor('circuits', 20, 49));
  });

  it('Hilos: un 8×8 bien jugado en poco más de un minuto es maestría (con la vara de Circuitos sería atasco)', () => {
    const flow = evaluateAndAdapt(createDefaultProfile('normal'), { puzzle: 'flow', cells: 64, minTaps: 8, actualTaps: 10, elapsedSeconds: 75 });
    expect(flow.evaluation.isMastery).toBe(true);
    const asCircuits = evaluateAndAdapt(createDefaultProfile('normal'), { minTaps: 8, actualTaps: 10, elapsedSeconds: 75 });
    expect(asCircuits.evaluation.isMastery).toBe(false);
    expect(asCircuits.evaluation.isStruggle).toBe(true);
  });

  it('Hilos: rehacer todos los trazos muchas veces y tardar no es maestría', () => {
    const res = evaluateAndAdapt(createDefaultProfile('normal'), { puzzle: 'flow', cells: 36, minTaps: 6, actualTaps: 30, elapsedSeconds: 120 });
    expect(res.evaluation.isMastery).toBe(false);
    expect(res.evaluation.isStruggle).toBe(true);
  });

  it('Luces: el doble del mínimo de toques a buen ritmo es maestría (encontrar el mínimo exacto es muy difícil)', () => {
    const lights = evaluateAndAdapt(createDefaultProfile('normal'), { puzzle: 'lights', cells: 36, minTaps: 12, actualTaps: 24, elapsedSeconds: 60 });
    expect(lights.evaluation.isMastery).toBe(true);
    const lost = evaluateAndAdapt(createDefaultProfile('normal'), { puzzle: 'lights', cells: 36, minTaps: 12, actualTaps: 60, elapsedSeconds: 150 });
    expect(lost.evaluation.isStruggle).toBe(true);
  });

  it('la recompensa de rapidez usa el mismo tiempo esperado del puzzle', () => {
    const base = { tier: 5, tapEfficiency: 0.8, elapsedSeconds: 60, minTaps: 8, hintsUsed: 0, isNewRecord: false, multiplier: 1 };
    expect(computeSparksReward(base).speedBonus).toBe(0); // vara de Circuitos: 20 s
    expect(computeSparksReward({ ...base, expectedSeconds: expectedSecondsFor('flow', 8, 64) }).speedBonus).toBe(5);
  });
});
