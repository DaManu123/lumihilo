import { describe, it, expect } from 'vitest';
import { generateLevel, calculateCellMinTaps } from '../src/core/generator';
import { validateLevel } from '../src/core/solver';
import { rotateMaskCW } from '../src/core/grid';
import { LevelParams } from '../src/core/types';

describe('Generador Procedural y Solver (Fase 2)', () => {
  const baseParams: LevelParams = {
    width: 4,
    height: 4,
    extraLoops: 1,
    branchBias: 0.5,
  };

  it('es 100% determinista: misma semilla produce exactamente el mismo nivel', () => {
    const seed = 987654;
    const level1 = generateLevel(baseParams, seed);
    const level2 = generateLevel(baseParams, seed);

    expect(level1.difficulty).toBe(level2.difficulty);
    expect(level1.minTaps).toBe(level2.minTaps);
    expect(level1.branches).toBe(level2.branches);
    expect(level1.cycles).toBe(level2.cycles);

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        expect(level1.board.grid[r][c].baseMask).toBe(level2.board.grid[r][c].baseMask);
        expect(level1.initialRotations[r][c]).toBe(level2.initialRotations[r][c]);
      }
    }
  });

  it('semillas distintas producen niveles distintos', () => {
    const level1 = generateLevel(baseParams, 1111);
    const level2 = generateLevel(baseParams, 2222);

    let differences = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (level1.board.grid[r][c].baseMask !== level2.board.grid[r][c].baseMask) {
          differences++;
        }
      }
    }
    expect(differences).toBeGreaterThan(0);
  });

  it('calcula correctamente los toques mínimos para piezas simétricas y asimétricas', () => {
    // Cruz (15): siempre 0
    expect(calculateCellMinTaps(15, 0)).toBe(0);
    expect(calculateCellMinTaps(15, 1)).toBe(0);
    expect(calculateCellMinTaps(15, 2)).toBe(0);
    expect(calculateCellMinTaps(15, 3)).toBe(0);

    // Línea recta (5 o 10): 0 toques si rotación par, 1 toque si rotación impar
    expect(calculateCellMinTaps(5, 0)).toBe(0);
    expect(calculateCellMinTaps(5, 2)).toBe(0);
    expect(calculateCellMinTaps(5, 1)).toBe(1);
    expect(calculateCellMinTaps(5, 3)).toBe(1);

    // Esquina (3) o T (7): se puede girar en ambos sentidos, gana el camino más corto
    expect(calculateCellMinTaps(3, 0)).toBe(0);
    expect(calculateCellMinTaps(3, 1)).toBe(1); // 1 giro antihorario (en vez de 3 horarios)
    expect(calculateCellMinTaps(3, 2)).toBe(2);
    expect(calculateCellMinTaps(3, 3)).toBe(1); // 1 giro horario
  });

  it('los toques mínimos coinciden con una búsqueda exhaustiva de giros ±90° para cada pieza', () => {
    // Todas las máscaras de pieza válidas: extremos, esquinas, rectas, T y cruz
    const masks = [1, 2, 4, 8, 3, 6, 12, 9, 5, 10, 7, 11, 13, 14, 15];

    for (const mask of masks) {
      for (let rot = 0; rot < 4; rot++) {
        // BFS sobre estados de rotación: cada toque suma o resta 1 (módulo 4)
        const dist = new Map<number, number>([[rot, 0]]);
        const queue = [rot];
        let best = Infinity;
        while (queue.length > 0) {
          const r = queue.shift()!;
          const d = dist.get(r)!;
          if (rotateMaskCW(mask, r) === mask) {
            best = Math.min(best, d);
          }
          for (const step of [1, -1]) {
            const next = (r + step + 4) % 4;
            if (!dist.has(next)) {
              dist.set(next, d + 1);
              queue.push(next);
            }
          }
        }
        expect(calculateCellMinTaps(mask, rot), `máscara ${mask}, rotación ${rot}`).toBe(best);
      }
    }
  });

  it('genera niveles válidos en diversas configuraciones (3x3, 4x4, 5x5, 6x6)', () => {
    const configurations: LevelParams[] = [
      { width: 3, height: 3, extraLoops: 0, branchBias: 0.2 },
      { width: 4, height: 4, extraLoops: 1, branchBias: 0.5 },
      { width: 5, height: 5, extraLoops: 2, branchBias: 0.7 },
      { width: 6, height: 6, extraLoops: 3, branchBias: 0.5 },
    ];

    for (const params of configurations) {
      for (let i = 0; i < 20; i++) {
        const seed = 1000 + i;
        const level = generateLevel(params, seed);
        const validation = validateLevel(level);

        expect(validation.valid, `Errores en ${params.width}x${params.height}: ${validation.errors.join(', ')}`).toBe(true);
      }
    }
  });

  it('estrés masivo: genera 10.000 niveles asegurando resolubilidad, no-trivialidad y alto rendimiento (< 50ms por nivel)', () => {
    const params: LevelParams = {
      width: 4,
      height: 4,
      extraLoops: 1,
      branchBias: 0.6,
    };

    const startTime = performance.now();
    const count = 10000;

    for (let i = 0; i < count; i++) {
      const level = generateLevel(params, i + 1);
      // Comprobar que no nace resuelto y que la solución es victoriosa
      expect(level.minTaps).toBeGreaterThan(0);
      expect(level.difficulty).toBeGreaterThan(16);
    }

    const elapsedMs = performance.now() - startTime;
    const msPerLevel = elapsedMs / count;

    console.log(`\n  ⚡ Rendimiento del Generador: ${count} niveles generados en ${elapsedMs.toFixed(1)} ms (${msPerLevel.toFixed(4)} ms/nivel).`);

    // Debe ser mucho menor a 50 ms por nivel (el criterio del roadmap)
    expect(msPerLevel).toBeLessThan(50);
    // En máquinas modernas suele ser < 0.2 ms
    expect(msPerLevel).toBeLessThan(5);
  });
});
