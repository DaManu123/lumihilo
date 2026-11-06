import { BoardState, DIRECTION_DELTAS, DIRECTION_MASKS, Direction } from './types';
import { calculateCellMinTaps } from './generator';

export interface CellPosition {
  row: number;
  col: number;
}

/**
 * Comodín de alineación: devuelve la pieza mal orientada más cercana a la fuente
 * (recorriendo el circuito solución en anchura), o null si todo está en su sitio.
 * Se elige la más cercana para que la pista sea la que más ayuda a "abrir camino".
 */
export function findHintCell(board: BoardState): CellPosition | null {
  const { rows, cols, grid, source } = board;
  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const queue: CellPosition[] = [{ row: source.row, col: source.col }];
  visited[source.row][source.col] = true;

  for (let head = 0; head < queue.length; head++) {
    const { row, col } = queue[head];
    const cell = grid[row][col];

    if (calculateCellMinTaps(cell.baseMask, cell.rotation) > 0) {
      return { row, col };
    }

    // El circuito solución es el definido por las máscaras base (rotación 0)
    for (let d = 0; d < 4; d++) {
      const dir = d as Direction;
      if ((cell.baseMask & DIRECTION_MASKS[dir]) === 0) continue;
      const nr = row + DIRECTION_DELTAS[dir].dr;
      const nc = col + DIRECTION_DELTAS[dir].dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || visited[nr][nc]) continue;
      visited[nr][nc] = true;
      queue.push({ row: nr, col: nc });
    }
  }

  return null;
}

/**
 * Giro (en pasos de 90°, positivo = horario) que lleva una pieza a su orientación correcta
 * por el camino más corto. Para una pieza con rotación r: 1 → -1, 2 → 2, 3 → +1.
 */
export function hintRotationDelta(currentRotation: number): number {
  const rot = ((currentRotation % 4) + 4) % 4;
  if (rot === 0) return 0;
  return rot === 1 ? -1 : rot === 2 ? 2 : 1;
}
