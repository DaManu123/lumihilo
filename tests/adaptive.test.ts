import { describe, it, expect } from 'vitest';
import {
  createDefaultProfile,
  getLevelParamsForProfile,
  evaluateAndAdapt,
  AdaptiveProfile,
} from '../src/core/adaptive';

describe('Sistema de Dificultad Adaptativa (Fase 3)', () => {
  it('inicializa el perfil por defecto según el modo de juego', () => {
    const normal = createDefaultProfile('normal');
    expect(normal.mode).toBe('normal');
    expect(normal.currentTier).toBe(2);
    expect(normal.rating).toBe(1000);

    const relaxed = createDefaultProfile('relaxed');
    expect(relaxed.mode).toBe('relaxed');
    expect(relaxed.currentTier).toBe(1);

    const challenge = createDefaultProfile('challenge');
    expect(challenge.mode).toBe('challenge');
    expect(challenge.currentTier).toBe(5);
  });

  it('devuelve parámetros de nivel acordes al modo', () => {
    const relaxed = createDefaultProfile('relaxed');
    const paramsRelaxed = getLevelParamsForProfile(relaxed);
    expect(paramsRelaxed.width).toBe(4);
    expect(paramsRelaxed.height).toBe(4);

    const challenge = createDefaultProfile('challenge');
    const paramsChallenge = getLevelParamsForProfile(challenge);
    expect(paramsChallenge.width).toBeGreaterThanOrEqual(5);
    expect(paramsChallenge.extraLoops).toBeGreaterThanOrEqual(2);
  });

  it('criterio de salida: 5 victorias seguidas sin atasco suben la dificultad', () => {
    let profile = createDefaultProfile('normal');
    const initialTier = profile.currentTier; // Tier 2

    // 5 victorias consecutivas estándar
    for (let i = 0; i < 5; i++) {
      const res = evaluateAndAdapt(profile, {
        minTaps: 10,
        actualTaps: 12, // Rendimiento normal
        elapsedSeconds: 20,
      });
      profile = res.updatedProfile;
    }

    // Debe haber subido de Tier
    expect(profile.currentTier).toBe(initialTier + 1);
    expect(profile.gamesWon).toBe(5);
  });

  it('criterio de salida: 3 partidas atorado bajan la dificultad para evitar frustración', () => {
    let profile: AdaptiveProfile = {
      ...createDefaultProfile('normal'),
      currentTier: 4, // Empezamos en tier 4
    };

    // 3 partidas consecutivas donde el usuario se atascó
    for (let i = 0; i < 3; i++) {
      const res = evaluateAndAdapt(profile, {
        minTaps: 8,
        actualTaps: 35, // Muchos toques excesivos
        elapsedSeconds: 90, // Mucho tiempo
      });
      expect(res.evaluation.isStruggle).toBe(true);
      profile = res.updatedProfile;
    }

    // El tier debe haber descendido a 3
    expect(profile.currentTier).toBe(3);
  });

  it('el abandono de partida cuenta como dificultad excesiva y reduce rating', () => {
    const profile = createDefaultProfile('normal');
    const initialRating = profile.rating;

    const res = evaluateAndAdapt(profile, {
      minTaps: 10,
      actualTaps: 5,
      elapsedSeconds: 40,
      abandoned: true,
    });

    expect(res.evaluation.isStruggle).toBe(true);
    expect(res.updatedProfile.rating).toBeLessThan(initialRating);
    expect(res.updatedProfile.consecutiveStruggles).toBe(1);
  });

  it('abandonos consecutivos bajan el tier solo al llegar a 3 (igual que los atascos)', () => {
    let profile: AdaptiveProfile = { ...createDefaultProfile('normal'), currentTier: 4 };
    const abandon = { minTaps: 10, actualTaps: 5, elapsedSeconds: 40, abandoned: true };

    for (let i = 0; i < 2; i++) {
      profile = evaluateAndAdapt(profile, abandon).updatedProfile;
      expect(profile.currentTier).toBe(4);
    }
    profile = evaluateAndAdapt(profile, abandon).updatedProfile;
    expect(profile.currentTier).toBe(3);
  });

  it('modo relajado no penaliza lentitud, reintentos ni abandono', () => {
    let profile: AdaptiveProfile = { ...createDefaultProfile('relaxed'), currentTier: 2 };
    const startRating = profile.rating;

    for (let i = 0; i < 5; i++) {
      const res = evaluateAndAdapt(profile, { minTaps: 10, actualTaps: 80, elapsedSeconds: 300 });
      expect(res.evaluation.isStruggle).toBe(false);
      profile = res.updatedProfile;
    }
    for (let i = 0; i < 5; i++) {
      const res = evaluateAndAdapt(profile, { minTaps: 10, actualTaps: 5, elapsedSeconds: 40, abandoned: true });
      expect(res.evaluation.isStruggle).toBe(false);
      profile = res.updatedProfile;
    }

    expect(profile.rating).toBeGreaterThanOrEqual(startRating);
    expect(profile.consecutiveStruggles).toBe(0);
    expect(profile.currentTier).toBeGreaterThanOrEqual(2);
  });

  it('maestría excepcional incrementa rating y acelera la progresión', () => {
    let profile = createDefaultProfile('normal');
    const initialRating = profile.rating;

    const res = evaluateAndAdapt(profile, {
      minTaps: 12,
      actualTaps: 12, // 100% óptimo
      elapsedSeconds: 15, // Rápido
    });

    expect(res.evaluation.isMastery).toBe(true);
    expect(res.evaluation.tapEfficiency).toBe(1.0);
    expect(res.updatedProfile.rating).toBeGreaterThan(initialRating);
  });

  it('respeta los límites mínimo (Tier 1) y máximo (Tier 10)', () => {
    let lowProfile: AdaptiveProfile = {
      ...createDefaultProfile('normal'),
      currentTier: 1,
    };
    for (let i = 0; i < 6; i++) {
      lowProfile = evaluateAndAdapt(lowProfile, { minTaps: 10, actualTaps: 50, elapsedSeconds: 100 }).updatedProfile;
    }
    expect(lowProfile.currentTier).toBeGreaterThanOrEqual(1);

    let highProfile: AdaptiveProfile = {
      ...createDefaultProfile('challenge'),
      currentTier: 10,
    };
    for (let i = 0; i < 10; i++) {
      highProfile = evaluateAndAdapt(highProfile, { minTaps: 10, actualTaps: 10, elapsedSeconds: 10 }).updatedProfile;
    }
    expect(highProfile.currentTier).toBeLessThanOrEqual(10);
  });
});
