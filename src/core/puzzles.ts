/**
 * Puzzles del juego. Circuitos (girar piezas hasta conectar todo) es el original; Luces (encender el tablero) el
 * segundo; Hilos (unir parejas de puntos con un hilo) el tercero; Claves (adivinar un número secreto) el cuarto.
 */
export type PuzzleType = 'circuits' | 'lights' | 'flow' | 'code';

export const PUZZLES: readonly PuzzleType[] = ['circuits', 'lights', 'flow', 'code'];

/** Nombres en español (fuente de las traducciones). */
export const PUZZLE_LABELS: Record<PuzzleType, string> = {
  circuits: 'Circuitos',
  lights: 'Luces',
  flow: 'Hilos',
  code: 'Claves',
};

export function isPuzzleType(value: unknown): value is PuzzleType {
  return value === 'circuits' || value === 'lights' || value === 'flow' || value === 'code';
}

/** Clave del récord de tiempo de Luces para un nivel de habilidad (aparte de los de Circuitos). */
export function lightsRecordKey(tier: number): string {
  return `L${Math.floor(tier)}`;
}

/** Clave del récord de tiempo de Hilos para un nivel de habilidad. */
export function flowRecordKey(tier: number): string {
  return `F${Math.floor(tier)}`;
}

/** Clave del récord de tiempo de Claves para un nivel de habilidad. */
export function codeRecordKey(tier: number): string {
  return `K${Math.floor(tier)}`;
}

/** Clave del récord de tiempo de un puzzle (Circuitos usa el nivel de habilidad tal cual). */
export function recordKeyFor(puzzle: PuzzleType, tier: number): string {
  if (puzzle === 'lights') return lightsRecordKey(tier);
  if (puzzle === 'flow') return flowRecordKey(tier);
  if (puzzle === 'code') return codeRecordKey(tier);
  return String(Math.floor(tier));
}
