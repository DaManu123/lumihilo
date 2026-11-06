import { describe, it, expect } from 'vitest';
import {
  rotateMaskCW,
  determinePieceType,
  computePowerFlow,
  checkVictory,
  rotateCell,
} from '../src/core/grid';
import { PieceType } from '../src/core/types';
import { createFixedLevel4x4 } from '../src/core/fixedLevel';

describe('Lógica de Conexión y Grid (src/core/)', () => {
  describe('rotateMaskCW', () => {
    it('rota direcciones individuales 90° en sentido horario', () => {
      // NORTH (1) -> EAST (2) -> SOUTH (4) -> WEST (8) -> NORTH (1)
      expect(rotateMaskCW(1, 1)).toBe(2);
      expect(rotateMaskCW(2, 1)).toBe(4);
      expect(rotateMaskCW(4, 1)).toBe(8);
      expect(rotateMaskCW(8, 1)).toBe(1);
    });

    it('rota combinaciones de máscara correctamente', () => {
      // Esquina NORTH | EAST (1 | 2 = 3) -> EAST | SOUTH (2 | 4 = 6)
      expect(rotateMaskCW(3, 1)).toBe(6);
      expect(rotateMaskCW(3, 2)).toBe(12); // SOUTH | WEST
      expect(rotateMaskCW(3, 3)).toBe(9);  // WEST | NORTH
      expect(rotateMaskCW(3, 4)).toBe(3);  // Vuelta completa 360°
    });
  });

  describe('determinePieceType', () => {
    it('clasifica correctamente los tipos de piezas', () => {
      expect(determinePieceType(1)).toBe(PieceType.END);
      expect(determinePieceType(5)).toBe(PieceType.LINE);   // 1 + 4 (N-S)
      expect(determinePieceType(10)).toBe(PieceType.LINE);  // 2 + 8 (E-W)
      expect(determinePieceType(3)).toBe(PieceType.CORNER); // 1 + 2 (N-E)
      expect(determinePieceType(7)).toBe(PieceType.TEE);    // 1 + 2 + 4 (N-E-S)
      expect(determinePieceType(15)).toBe(PieceType.CROSS); // 1 + 2 + 4 + 8 (N-E-S-W)
    });
  });

  describe('Nivel Fijo 4x4 (createFixedLevel4x4)', () => {
    it('el estado resuelto (scrambled=false) otorga victoria inmediata', () => {
      const board = createFixedLevel4x4(false);
      const isWon = checkVictory(board);
      expect(isWon).toBe(true);

      const powered = computePowerFlow(board);
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          expect(powered[r][c]).toBe(true);
        }
      }
    });

    it('el estado inicial desordenado (scrambled=true) NO es victoria', () => {
      const board = createFixedLevel4x4(true);
      expect(checkVictory(board)).toBe(false);
    });

    it('rotar las celdas hasta su solución conduce a victoria', () => {
      const board = createFixedLevel4x4(true);

      // Rotar cada celda hasta llegar a rotation === 0
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          while (board.grid[r][c].rotation !== 0) {
            rotateCell(board, r, c);
          }
        }
      }

      expect(checkVictory(board)).toBe(true);
    });

    it('permite rotar en sentido antihorario con steps negativos', () => {
      const board = createFixedLevel4x4(false);
      expect(board.grid[0][0].rotation).toBe(0);

      rotateCell(board, 0, 0, -1);
      expect(board.grid[0][0].rotation).toBe(3); // 0 -> 3 (antihorario)

      rotateCell(board, 0, 0, 1);
      expect(board.grid[0][0].rotation).toBe(0); // 3 -> 0 (horario)
    });
  });
});
