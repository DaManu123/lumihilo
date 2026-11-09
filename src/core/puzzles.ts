/** Puzzles del juego. Circuitos (girar piezas hasta conectar todo) es el original; Luces (encender el tablero) el segundo. */
export type PuzzleType = 'circuits' | 'lights';

export const PUZZLES: readonly PuzzleType[] = ['circuits', 'lights'];

/** Nombres en español (fuente de las traducciones). */
export const PUZZLE_LABELS: Record<PuzzleType, string> = {
  circuits: 'Circuitos',
  lights: 'Luces',
};

export function isPuzzleType(value: unknown): value is PuzzleType {
  return value === 'circuits' || value === 'lights';
}

/** Clave del récord de tiempo de Luces para un nivel de habilidad (aparte de los de Circuitos). */
export function lightsRecordKey(tier: number): string {
  return `L${Math.floor(tier)}`;
}
