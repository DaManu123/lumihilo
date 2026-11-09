/** Puzzles del juego. Circuitos (girar piezas hasta conectar todo) es el original; Luces (encender el tablero) el segundo; Hilos (unir parejas de puntos con un hilo) el tercero. */
export type PuzzleType = 'circuits' | 'lights' | 'flow';

export const PUZZLES: readonly PuzzleType[] = ['circuits', 'lights', 'flow'];

/** Nombres en español (fuente de las traducciones). */
export const PUZZLE_LABELS: Record<PuzzleType, string> = {
  circuits: 'Circuitos',
  lights: 'Luces',
  flow: 'Hilos',
};

export function isPuzzleType(value: unknown): value is PuzzleType {
  return value === 'circuits' || value === 'lights' || value === 'flow';
}

/** Clave del récord de tiempo de Luces para un nivel de habilidad (aparte de los de Circuitos). */
export function lightsRecordKey(tier: number): string {
  return `L${Math.floor(tier)}`;
}

/** Clave del récord de tiempo de Hilos para un nivel de habilidad. */
export function flowRecordKey(tier: number): string {
  return `F${Math.floor(tier)}`;
}

/** Clave del récord de tiempo de un puzzle (Circuitos usa el nivel de habilidad tal cual). */
export function recordKeyFor(puzzle: PuzzleType, tier: number): string {
  return puzzle === 'lights' ? lightsRecordKey(tier) : puzzle === 'flow' ? flowRecordKey(tier) : String(Math.floor(tier));
}
