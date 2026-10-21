import {
  Direction,
  DIRECTION_MASKS,
  OPPOSITE_DIRECTIONS,
  DIRECTION_DELTAS,
  PieceType,
  CellState,
  BoardState,
} from './types';

/**
 * Rota una máscara de bits en sentido horario (CW).
 * @param mask Máscara de 4 bits (N, E, S, W)
 * @param steps Cantidad de giros de 90° en sentido horario (por defecto 1)
 */
export function rotateMaskCW(mask: number, steps = 1): number {
  const normalizedSteps = ((steps % 4) + 4) % 4;
  let m = mask & 0x0f;
  for (let i = 0; i < normalizedSteps; i++) {
    m = ((m << 1) & 0x0e) | ((m & 0x08) ? 0x01 : 0);
  }
  return m;
}

/**
 * Obtiene la máscara activa actual de una celda aplicando su rotación acumulada.
 */
export function getCurrentMask(cell: CellState): number {
  return rotateMaskCW(cell.baseMask, cell.rotation);
}

/**
 * Verifica si una máscara contiene una dirección específica activa.
 */
export function hasDirection(mask: number, dir: Direction): boolean {
  return (mask & DIRECTION_MASKS[dir]) !== 0;
}

/**
 * Determina el tipo de pieza según las direcciones de su máscara base.
 */
export function determinePieceType(mask: number): PieceType {
  const count =
    ((mask & 1) ? 1 : 0) +
    ((mask & 2) ? 1 : 0) +
    ((mask & 4) ? 1 : 0) +
    ((mask & 8) ? 1 : 0);

  if (count === 1) return PieceType.END;
  if (count === 4) return PieceType.CROSS;
  if (count === 3) return PieceType.TEE;

  if (count === 2) {
    // Si tiene Norte + Sur (1 + 4 = 5) o Este + Oeste (2 + 8 = 10) es LINE
    if (mask === 5 || mask === 10) {
      return PieceType.LINE;
    }
    return PieceType.CORNER;
  }

  return PieceType.END;
}

/**
 * Rota una celda del tablero 90° en sentido horario e incrementa su rotación.
 */
export function rotateCell(board: BoardState, row: number, col: number): void {
  const cell = board.grid[row][col];
  cell.rotation = (cell.rotation + 1) % 4;
}

/**
 * Calcula el flujo de energía mediante BFS desde la celda fuente.
 * Retorna una matriz booleana indicando cuáles celdas reciben energía.
 */
export function computePowerFlow(board: BoardState): boolean[][] {
  const { rows, cols, grid, source } = board;
  const powered: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));

  const queue: Array<{ r: number; c: number }> = [];
  powered[source.row][source.col] = true;
  queue.push({ r: source.row, c: source.col });

  while (queue.length > 0) {
    const { r, c } = queue.shift()!;
    const currentMask = getCurrentMask(grid[r][c]);

    for (let d = 0; d < 4; d++) {
      const dir = d as Direction;
      if (!hasDirection(currentMask, dir)) continue;

      const delta = DIRECTION_DELTAS[dir];
      const nr = r + delta.dr;
      const nc = c + delta.dc;

      // Fuera de los límites del tablero
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

      if (!powered[nr][nc]) {
        const neighborMask = getCurrentMask(grid[nr][nc]);
        const oppositeDir = OPPOSITE_DIRECTIONS[dir];
        // Conexión bilateral: ambos puertos deben mirarse mutuamente
        if (hasDirection(neighborMask, oppositeDir)) {
          powered[nr][nc] = true;
          queue.push({ r: nr, c: nc });
        }
      }
    }
  }

  return powered;
}

/**
 * Comprueba si el estado actual del tablero cumple la condición de victoria:
 * 1. Todas las celdas del tablero están alimentadas desde la fuente.
 * 2. Cero cables abiertos/fugas: cada terminal abierto conecta a un vecino con puerto opuesto.
 */
export function checkVictory(board: BoardState): boolean {
  const { rows, cols, grid } = board;
  const powered = computePowerFlow(board);

  // 1. Todas las celdas deben estar encendidas
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!powered[r][c]) {
        return false;
      }
    }
  }

  // 2. No debe haber cables sueltos que apunten al vacío o a celdas no conectadas
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const mask = getCurrentMask(grid[r][c]);
      for (let d = 0; d < 4; d++) {
        const dir = d as Direction;
        if (hasDirection(mask, dir)) {
          const delta = DIRECTION_DELTAS[dir];
          const nr = r + delta.dr;
          const nc = c + delta.dc;

          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
            return false; // Cable apuntando fuera de la pared
          }

          const neighborMask = getCurrentMask(grid[nr][nc]);
          const oppositeDir = OPPOSITE_DIRECTIONS[dir];
          if (!hasDirection(neighborMask, oppositeDir)) {
            return false; // Cable apuntando a un vecino sin puerto receptor
          }
        }
      }
    }
  }

  return true;
}
