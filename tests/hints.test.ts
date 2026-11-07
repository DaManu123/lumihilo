import { describe, it, expect } from 'vitest';
import { generateLevel, calculateCellMinTaps } from '../src/core/generator';
import { checkVictory, rotateCell } from '../src/core/grid';
import { findHintCell, hintRotationDelta } from '../src/core/hints';
import { DIFFICULTY_TIERS } from '../src/core/adaptive';

describe('Comodín de alineación (src/core/hints.ts)', () => {
  it('hintRotationDelta lleva la pieza a rotación 0 por el camino más corto', () => {
    expect(hintRotationDelta(0)).toBe(0);
    expect(hintRotationDelta(1)).toBe(-1);
    expect(hintRotationDelta(2)).toBe(2);
    expect(hintRotationDelta(3)).toBe(1);
    for (let rot = 0; rot < 4; rot++) {
      expect((rot + hintRotationDelta(rot) + 4) % 4).toBe(0);
    }
  });

  it('siempre señala una pieza realmente mal orientada', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const level = generateLevel(DIFFICULTY_TIERS[5], seed);
      const hint = findHintCell(level.board);
      expect(hint, `semilla ${seed}`).not.toBeNull();
      const cell = level.board.grid[hint!.row][hint!.col];
      expect(calculateCellMinTaps(cell.baseMask, cell.rotation)).toBeGreaterThan(0);
    }
  });

  it('aplicar la pista repetidamente resuelve el nivel en pocos pasos y nunca se atasca', () => {
    for (const tier of [1, 4, 7, 10]) {
      for (let seed = 1; seed <= 20; seed++) {
        const level = generateLevel(DIFFICULTY_TIERS[tier], seed * 31);
        const { board } = level;
        const maxSteps = board.rows * board.cols;

        let steps = 0;
        let hint = findHintCell(board);
        while (hint && steps <= maxSteps) {
          rotateCell(board, hint.row, hint.col, hintRotationDelta(board.grid[hint.row][hint.col].rotation));
          steps++;
          hint = findHintCell(board);
        }

        expect(hint, `tier ${tier}, semilla ${seed}`).toBeNull();
        expect(steps).toBeLessThanOrEqual(maxSteps);
        expect(checkVictory(board), `tier ${tier}, semilla ${seed}`).toBe(true);
      }
    }
  });

  it('devuelve null cuando el tablero ya está resuelto', () => {
    const level = generateLevel(DIFFICULTY_TIERS[2], 5);
    for (const row of level.board.grid) for (const cell of row) cell.rotation = 0;
    expect(findHintCell(level.board)).toBeNull();
  });

  it('prioriza la pieza más cercana a la fuente', () => {
    const level = generateLevel(DIFFICULTY_TIERS[3], 9);
    const { board } = level;
    // Dejar todo resuelto salvo la fuente y la lejana: la fuente debe señalarse primero
    for (const row of board.grid) for (const cell of row) cell.rotation = 0;
    const src = board.grid[board.source.row][board.source.col];
    const far = board.grid[board.rows - 1][board.cols - 1];
    src.rotation = src.baseMask === 15 ? 0 : 1;
    far.rotation = far.baseMask === 15 ? 0 : 1;
    if (calculateCellMinTaps(src.baseMask, src.rotation) > 0) {
      expect(findHintCell(board)).toEqual({ row: board.source.row, col: board.source.col });
    }
  });
});
