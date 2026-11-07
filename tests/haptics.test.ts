import { describe, it, expect } from 'vitest';
import { HAPTIC_LEVELS, HAPTIC_PROFILES, HAPTIC_LABELS, isHapticLevel, patternPulses } from '../src/core/haptics';

describe('Perfiles de vibración (src/core/haptics.ts)', () => {
  it('cada intensidad es más larga que la anterior en todos los eventos', () => {
    const [soft, normal, strong] = HAPTIC_LEVELS.map((l) => HAPTIC_PROFILES[l]);
    expect(soft.tap).toBeLessThan(normal.tap);
    expect(normal.tap).toBeLessThan(strong.tap);
    expect(soft.connect).toBeLessThan(normal.connect);
    expect(normal.connect).toBeLessThan(strong.connect);
  });

  it('conectar siempre se siente más que un simple giro', () => {
    for (const level of HAPTIC_LEVELS) {
      expect(HAPTIC_PROFILES[level].connect).toBeGreaterThan(HAPTIC_PROFILES[level].tap);
    }
  });

  it('los pulsos son lo bastante largos para que el motor los reproduzca y lo bastante cortos para sentirse como un toque', () => {
    for (const level of HAPTIC_LEVELS) {
      const { tap, connect, win } = HAPTIC_PROFILES[level];
      for (const ms of [tap, connect, ...win]) {
        expect(ms).toBeGreaterThanOrEqual(15);
        expect(ms).toBeLessThanOrEqual(200);
      }
    }
  });

  it('el patrón de victoria empieza y termina con un pulso (longitud impar)', () => {
    for (const level of HAPTIC_LEVELS) {
      expect(HAPTIC_PROFILES[level].win.length % 2).toBe(1);
    }
  });

  it('la victoria dura menos de un segundo en total', () => {
    for (const level of HAPTIC_LEVELS) {
      expect(HAPTIC_PROFILES[level].win.reduce((a, b) => a + b, 0)).toBeLessThan(1000);
    }
  });

  it('patternPulses calcula el retraso acumulado de cada pulso e ignora las pausas', () => {
    expect(patternPulses([45, 70, 45, 70, 90])).toEqual([
      { delay: 0, duration: 45 },
      { delay: 115, duration: 45 },
      { delay: 230, duration: 90 },
    ]);
    expect(patternPulses([])).toEqual([]);
    expect(patternPulses([30])).toEqual([{ delay: 0, duration: 30 }]);
  });

  it('reconoce solo las intensidades válidas', () => {
    expect(isHapticLevel('soft')).toBe(true);
    expect(isHapticLevel('strong')).toBe(true);
    for (const bad of ['medium', '', null, undefined, 3, {}]) expect(isHapticLevel(bad)).toBe(false);
  });

  it('cada intensidad tiene su etiqueta en español', () => {
    expect(HAPTIC_LEVELS.map((l) => HAPTIC_LABELS[l])).toEqual(['Suave', 'Normal', 'Fuerte']);
  });
});
