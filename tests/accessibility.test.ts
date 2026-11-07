import { describe, it, expect } from 'vitest';
import {
  ANIMATION_LABELS,
  ANIMATION_SPEEDS,
  animationDuration,
  isAnimationSpeed,
  motionDisabled,
} from '../src/core/accessibility';

describe('Velocidad de animación (src/core/accessibility.ts)', () => {
  it('reconoce solo las velocidades válidas', () => {
    for (const speed of ANIMATION_SPEEDS) expect(isAnimationSpeed(speed)).toBe(true);
    for (const bad of ['', 'rapida', null, undefined, 1, {}]) expect(isAnimationSpeed(bad)).toBe(false);
  });

  it('tiene etiqueta en español para cada velocidad', () => {
    expect(ANIMATION_SPEEDS.map((s) => ANIMATION_LABELS[s])).toEqual(['Normal', 'Rápida', 'Ninguna']);
  });

  it('normal conserva la duración, rápida la reduce a la mitad y ninguna la deja en 1 ms', () => {
    expect(animationDuration(170, 'normal')).toBe(170);
    expect(animationDuration(170, 'fast')).toBe(85);
    expect(animationDuration(1, 'fast')).toBe(1);
    expect(animationDuration(170, 'off')).toBe(1);
  });

  it('la preferencia del sistema de reducir el movimiento gana a la velocidad elegida', () => {
    expect(animationDuration(170, 'normal', true)).toBe(1);
    expect(animationDuration(170, 'fast', true)).toBe(1);
    expect(motionDisabled('normal', true)).toBe(true);
  });

  it('solo se desactivan los efectos decorativos con "ninguna" o con la preferencia del sistema', () => {
    expect(motionDisabled('normal')).toBe(false);
    expect(motionDisabled('fast')).toBe(false);
    expect(motionDisabled('off')).toBe(true);
  });
});
