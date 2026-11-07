/**
 * Perfiles de vibración (lógica pura). Cada intensidad define cuánto dura cada pulso.
 *
 * Los pulsos usan la potencia por defecto del motor del teléfono (la máxima que ofrece). Los
 * efectos predefinidos de Android "ligero" y "medio" usan solo el 43 % y el 70 % de potencia, y en
 * muchos teléfonos apenas se notan; con pulsos de potencia plena la intensidad se regula por duración.
 */

export type HapticLevel = 'soft' | 'normal' | 'strong';

export interface HapticProfile {
  /** Duración (ms) del pulso al girar una casilla. */
  tap: number;
  /** Duración (ms) del pulso al conectar o usar una pista. */
  connect: number;
  /** Patrón de la victoria: alterna pulso y pausa, empezando y terminando con pulso (ms). */
  win: readonly number[];
}

export const HAPTIC_LEVELS: readonly HapticLevel[] = ['soft', 'normal', 'strong'];

export const HAPTIC_PROFILES: Record<HapticLevel, HapticProfile> = {
  soft: { tap: 15, connect: 28, win: [30, 70, 30] },
  normal: { tap: 25, connect: 45, win: [45, 70, 45, 70, 90] },
  strong: { tap: 40, connect: 70, win: [70, 80, 70, 80, 130] },
};

export const HAPTIC_LABELS: Record<HapticLevel, string> = {
  soft: 'Suave',
  normal: 'Normal',
  strong: 'Fuerte',
};

export function isHapticLevel(value: unknown): value is HapticLevel {
  return typeof value === 'string' && (HAPTIC_LEVELS as readonly string[]).includes(value);
}

export interface Pulse {
  /** Milisegundos desde el inicio del patrón hasta este pulso. */
  delay: number;
  /** Duración del pulso en ms. */
  duration: number;
}

/** Convierte un patrón [pulso, pausa, pulso, ...] en pulsos con su retraso acumulado. */
export function patternPulses(pattern: readonly number[]): Pulse[] {
  const pulses: Pulse[] = [];
  let elapsed = 0;
  pattern.forEach((ms, i) => {
    if (i % 2 === 0) pulses.push({ delay: elapsed, duration: ms });
    elapsed += ms;
  });
  return pulses;
}
