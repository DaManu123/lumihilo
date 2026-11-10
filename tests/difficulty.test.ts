import { describe, it, expect } from 'vitest';
import {
  DIFFICULTY_TIERS, MAX_TIER, WINS_TO_RISE, createDefaultProfile, effectiveTier, evaluateAndAdapt, getLevelParamsForProfile, profileFromShared,
} from '../src/core/adaptive';
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
