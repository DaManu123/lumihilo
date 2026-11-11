import { describe, it, expect } from 'vitest';
import { createDefaultProfile, type AdaptiveProfile } from '../src/core/adaptive';
import { firstTierFor, switchGameMode, type ModeProfiles } from '../src/core/modes';
import { createDefaultProgress, levelOf, sanitizeProgress, withLevel } from '../src/core/progress';

const profiles = (tier: number): ModeProfiles => ({
  circuits: { ...createDefaultProfile('normal'), currentTier: tier },
  lights: { ...createDefaultProfile('normal'), currentTier: tier + 1 },
  flow: { ...createDefaultProfile('normal'), currentTier: tier + 2 },
});

describe('Cambio de modo', () => {
  it('cambiar de modo y volver retoma niveles y peldaños de cada puzzle (no reinicia nada)', () => {
    let progress = withLevel(withLevel(withLevel(createDefaultProgress(1), 'circuits', 12), 'lights', 7), 'flow', 4);
    let p = profiles(4);
    ({ progress, profiles: p } = switchGameMode(progress, p, 'relaxed'));
    expect(p.circuits.mode).toBe('relaxed');
    expect(levelOf(progress, 'circuits')).toBe(1);
    expect(p.circuits.currentTier).toBe(1);
    // En Relajado se avanza un poco
    progress = withLevel(progress, 'circuits', 3);
    ({ progress, profiles: p } = switchGameMode(progress, p, 'normal'));
    expect(p.circuits.mode).toBe('normal');
    expect([levelOf(progress, 'circuits'), levelOf(progress, 'lights'), levelOf(progress, 'flow')]).toEqual([12, 7, 4]);
    expect([p.circuits.currentTier, p.lights.currentTier, p.flow.currentTier]).toEqual([4, 5, 6]);
    // Y Relajado conserva lo suyo
    ({ progress, profiles: p } = switchGameMode(progress, p, 'relaxed'));
    expect(levelOf(progress, 'circuits')).toBe(3);
  });

  it('la primera vez en un modo empieza en el nivel 1 con el peldaño de ese modo', () => {
    expect(firstTierFor('relaxed', 8)).toBe(1);
    expect(firstTierFor('challenge', 2)).toBe(5);
    expect(firstTierFor('challenge', 8)).toBe(8);
    expect(firstTierFor('normal', 9)).toBe(6);
    expect(firstTierFor('normal', 1)).toBe(2);
    const { progress, profiles: p } = switchGameMode(withLevel(createDefaultProgress(1), 'lights', 9), profiles(3), 'challenge');
    expect(levelOf(progress, 'lights')).toBe(1);
    expect(p.circuits.currentTier).toBe(5);
  });

  it('elegir el modo en el que ya se está no cambia nada', () => {
    const progress = withLevel(createDefaultProgress(1), 'circuits', 5);
    const p = profiles(4);
    const res = switchGameMode(progress, p, 'normal');
    expect(res.progress).toBe(progress);
    expect(res.profiles).toBe(p);
  });

  it('las rachas empiezan de cero en el modo al que se llega', () => {
    const p = profiles(4);
    p.circuits = { ...p.circuits, consecutiveWinsWithoutStruggle: 4, consecutiveStruggles: 1 } as AdaptiveProfile;
    const res = switchGameMode(createDefaultProgress(1), p, 'challenge');
    expect(res.profiles.circuits.consecutiveWinsWithoutStruggle).toBe(0);
    expect(res.profiles.circuits.consecutiveStruggles).toBe(0);
  });

  it('lo guardado de cada modo sobrevive a guardar y cargar, y lo corrupto se descarta', () => {
    const { progress } = switchGameMode(withLevel(createDefaultProgress(1), 'flow', 6), profiles(4), 'relaxed');
    const loaded = sanitizeProgress(JSON.parse(JSON.stringify(progress)), 1);
    expect(loaded.modeProgress.normal?.levels.flow).toBe(6);
    expect(loaded.modeProgress.normal?.tiers.flow).toBe(6);
    const bad = sanitizeProgress({ ...progress, modeProgress: { normal: 'x', relaxed: { levels: {}, tiers: { circuits: 99 } }, otro: {} } }, 1);
    expect(bad.modeProgress.normal).toBeUndefined();
    expect(bad.modeProgress.relaxed?.levels.circuits).toBe(1);
    expect(bad.modeProgress.relaxed?.tiers.circuits).toBe(10);
    expect(sanitizeProgress({ ...progress, modeProgress: null }, 1).modeProgress).toEqual({});
  });
});
