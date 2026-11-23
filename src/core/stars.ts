import { PUZZLE_TUNING } from './adaptive';
import type { PuzzleType } from './puzzles';

/**
 * Estrellas de un nivel resuelto (lógica pura). Todo nivel ganado da al menos una; el tiempo no cuenta (nadie pierde
 * estrellas por ir despacio):
 * - **3:** sin pistas y con pocos toques de más (la eficiencia que ese puzzle pide a un buen jugador).
 * - **2:** sin pistas, o con una sola (la gratis del nivel).
 * - **1:** con dos pistas o más.
 */
export type Stars = 1 | 2 | 3;

export const MAX_STARS = 3;

export function starsFor(input: { puzzle: PuzzleType; hintsUsed: number; tapEfficiency: number }): Stars {
  if (input.hintsUsed <= 0 && input.tapEfficiency >= PUZZLE_TUNING[input.puzzle].masteryEfficiency) return 3;
  return input.hintsUsed <= 1 ? 2 : 1;
}

/** Qué hacer para ganar más estrellas la próxima vez (clave de traducción), o null si ya son tres. */
export function starsAdvice(input: { stars: Stars; hintsUsed: number; puzzle?: PuzzleType }): string | null {
  if (input.stars === 3) return null;
  if (input.hintsUsed > 0) return 'Sin pistas ganas más estrellas.';
  return input.puzzle === 'code' ? 'Con menos intentos ganas las tres estrellas.' : 'Con menos toques ganas las tres estrellas.';
}
