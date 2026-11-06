import { BoardState, GeneratedLevel } from './types';
import { checkVictory } from './grid';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validador independiente para un nivel generado.
 * Verifica formalmente que la solución garantizada es victoriosa y que el estado inicial no nace resuelto.
 */
export function validateLevel(level: GeneratedLevel): ValidationResult {
  const errors: string[] = [];
  const { board, solutionRotations, initialRotations, minTaps, difficulty } = level;
  const { rows, cols, grid } = board;

  if (minTaps <= 0) {
    errors.push(`minTaps debe ser mayor a 0, pero es ${minTaps}`);
  }

  if (difficulty <= 0) {
    errors.push(`La dificultad debe ser mayor a 0, pero es ${difficulty}`);
  }

  // 1. Probar el estado inicial (debe NO estar resuelto)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      grid[r][c].rotation = initialRotations[r][c];
    }
  }

  if (checkVictory(board)) {
    errors.push('El nivel nace resuelto en su estado inicial');
  }

  // 2. Probar el estado solución (debe ser victorioso sin fugas)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      grid[r][c].rotation = solutionRotations[r][c];
    }
  }

  if (!checkVictory(board)) {
    errors.push('La configuración solución no cumple la condición de victoria (fugas o piezas desconectadas)');
  }

  // Restaurar el estado inicial en el tablero
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      grid[r][c].rotation = initialRotations[r][c];
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Resuelve un tablero devolviendo la matriz de rotaciones solución conocidas.
 */
export function solveBoard(level: GeneratedLevel): BoardState {
  const { board, solutionRotations } = level;
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      board.grid[r][c].rotation = solutionRotations[r][c];
    }
  }
  return board;
}
