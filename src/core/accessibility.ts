/**
 * Opciones de accesibilidad (lógica pura, sin Phaser, para poder probarla).
 *
 * - Velocidad de animación: normal, rápida o sin animaciones (para quien se marea con el movimiento
 *   o quiere jugar más deprisa). Respeta también la preferencia del sistema de reducir el movimiento.
 * - Alto contraste y marcas en las piezas encendidas se resuelven en el tema y en el dibujo de casillas.
 */

export type AnimationSpeed = 'normal' | 'fast' | 'off';

export const ANIMATION_SPEEDS: readonly AnimationSpeed[] = ['normal', 'fast', 'off'];

export const ANIMATION_LABELS: Record<AnimationSpeed, string> = {
  normal: 'Normal',
  fast: 'Rápida',
  off: 'Ninguna',
};

export function isAnimationSpeed(value: unknown): value is AnimationSpeed {
  return typeof value === 'string' && (ANIMATION_SPEEDS as readonly string[]).includes(value);
}

/**
 * Duración efectiva de una animación en milisegundos. Sin animaciones queda en 1 ms (Phaser necesita
 * una duración positiva); la rápida dura la mitad.
 */
export function animationDuration(ms: number, speed: AnimationSpeed, systemReducedMotion = false): number {
  if (speed === 'off' || systemReducedMotion) return 1;
  return speed === 'fast' ? Math.max(1, Math.round(ms / 2)) : ms;
}

/** Si no hay animaciones (por ajuste del juego o del sistema): se omiten efectos decorativos como el pulso de luz. */
export function motionDisabled(speed: AnimationSpeed, systemReducedMotion = false): boolean {
  return speed === 'off' || systemReducedMotion;
}
