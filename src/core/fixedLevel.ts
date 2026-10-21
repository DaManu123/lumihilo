import { BoardState, CellState } from './types';

/**
 * Máscaras en estado solución (rotación = 0) para el nivel fijo 4x4 de la Fase 1.
 * Representa un árbol de expansión conexo de 15 aristas que une todas las 16 celdas
 * desde la fuente en (0, 0) sin ciclos ni fugas.
 *
 * Valores de máscara (N=1, E=2, S=4, W=8):
 * Fila 0: (0,0)=6 [E,S],   (0,1)=10 [W,E], (0,2)=10 [W,E], (0,3)=8 [W]
 * Fila 1: (1,0)=7 [N,E,S], (1,1)=10 [W,E], (1,2)=12 [S,W], (1,3)=4 [S]
 * Fila 2: (2,0)=5 [N,S],   (2,1)=2 [E],    (2,2)=9 [N,W],  (2,3)=5 [N,S]
 * Fila 3: (3,0)=3 [N,E],   (3,1)=10 [W,E], (3,2)=10 [W,E], (3,3)=9 [N,W]
 */
export const FIXED_4X4_SOLUTION_MASKS: number[][] = [
  [6, 10, 10, 8],
  [7, 10, 12, 4],
  [5, 2, 9, 5],
  [3, 10, 10, 9],
];

/**
 * Rotaciones iniciales desordenadas (0..3 cuartos de vuelta) para iniciar la partida.
 */
export const FIXED_4X4_INITIAL_SCRAMBLE: number[][] = [
  [1, 1, 1, 3],
  [2, 1, 3, 2],
  [1, 3, 2, 1],
  [2, 1, 1, 3],
];

/**
 * Crea una nueva instancia del tablero para el nivel fijo 4x4.
 * @param scrambled Si es true, inicia con las rotaciones desordenadas; si es false, en solución.
 */
export function createFixedLevel4x4(scrambled = true): BoardState {
  const rows = 4;
  const cols = 4;
  const grid: CellState[][] = [];

  for (let r = 0; r < rows; r++) {
    const rowCells: CellState[] = [];
    for (let c = 0; c < cols; c++) {
      rowCells.push({
        row: r,
        col: c,
        baseMask: FIXED_4X4_SOLUTION_MASKS[r][c],
        rotation: scrambled ? FIXED_4X4_INITIAL_SCRAMBLE[r][c] : 0,
        isSource: r === 0 && c === 0,
      });
    }
    grid.push(rowCells);
  }

  return {
    rows,
    cols,
    grid,
    source: { row: 0, col: 0 },
  };
}
