import { describe, it, expect } from 'vitest';
import {
  FlowCell, FlowLevel, adjacentCells, applySolutionPath, beginStroke, cloneFlowState, connectedCount, createFlowState, endpointPair,
  extendStroke, emptyCount, filledCount, flowCellCount, flowHint, flowParamsForTier, generateFlow, isFlowComplete,
  isFlowFull, isFlowJoinedButNotFull, isFlowSolved, ownerGrid, pairComplete, sameCell,
} from '../src/core/flow';

const cell = (row: number, col: number): FlowCell => ({ row, col });

/** Traza un hilo entero de una pareja con la solución del nivel, como lo haría un dedo. */
function drawSolution(level: FlowLevel, state: ReturnType<typeof createFlowState>, pair: number): void {
  const path = level.solution[pair];
  beginStroke(state, level, path[0]);
  for (let i = 1; i < path.length; i++) extendStroke(state, level, pair, path[i]);
}

describe('Hilos: dificultad', () => {
  it('el tamaño y el número de hilos crecen con el nivel de habilidad', () => {
    let last = flowParamsForTier(1);
    expect(last.size).toBe(4);
    for (let tier = 2; tier <= 10; tier++) {
      const p = flowParamsForTier(tier);
      expect(p.size).toBeGreaterThanOrEqual(last.size);
      expect(p.pairs).toBeGreaterThanOrEqual(last.pairs);
      expect(p.pairs).toBeLessThanOrEqual(8); // ocho colores y símbolos distintos
      last = p;
    }
    expect(last.size).toBe(8);
    expect(flowParamsForTier(99)).toEqual(flowParamsForTier(10));
    expect(flowParamsForTier(-4)).toEqual(flowParamsForTier(1));
  });
});

describe('Hilos: generador', () => {
  it('todo nivel recorre el tablero entero con trazados contiguos y sin solaparse, y se resuelve con su solución', () => {
    for (let tier = 1; tier <= 10; tier++) {
      const params = flowParamsForTier(tier);
      for (let seed = 1; seed <= 60; seed++) {
        const level = generateFlow(params, seed * 7919);
        const label = `tier ${tier} seed ${seed}`;
        expect(level.pairs.length, label).toBe(params.pairs);
        expect(level.minTaps).toBe(params.pairs);
        const seen = new Set<string>();
        level.solution.forEach((path, i) => {
          expect(path.length, label).toBeGreaterThanOrEqual(3);
          for (let k = 1; k < path.length; k++) expect(adjacentCells(path[k - 1], path[k]), `${label}: salto`).toBe(true);
          expect(sameCell(path[0], level.pairs[i].a)).toBe(true);
          expect(sameCell(path[path.length - 1], level.pairs[i].b)).toBe(true);
          for (const c of path) {
            expect(c.row >= 0 && c.row < params.size && c.col >= 0 && c.col < params.size).toBe(true);
            const key = `${c.row},${c.col}`;
            expect(seen.has(key), `${label}: casilla repetida`).toBe(false);
            seen.add(key);
          }
        });
        expect(seen.size, `${label}: no cubre el tablero`).toBe(params.size * params.size);

        const state = createFlowState(level);
        expect(isFlowSolved(state, level)).toBe(false);
        for (let i = 0; i < level.pairs.length; i++) drawSolution(level, state, i);
        expect(isFlowSolved(state, level), `${label}: la solución no resuelve`).toBe(true);
        expect(isFlowComplete(state, level), `${label}: la solución no llena el tablero`).toBe(true);
      }
    }
  }, 30000); // 10 peldaños × 60 niveles, con muchas comprobaciones cada uno

  it('es determinista y semillas distintas dan niveles distintos', () => {
    const params = flowParamsForTier(5);
    expect(generateFlow(params, 42)).toEqual(generateFlow(params, 42));
    const distinct = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(generateFlow(params, i + 1).pairs)));
    expect(distinct.size).toBeGreaterThan(25);
  });

  it('los trazados son variados: no siempre la misma serpiente', () => {
    const level = generateFlow(flowParamsForTier(6), 3);
    const rowsOnly = level.solution.every((path) => path.every((c, i) => i === 0 || c.row === path[i - 1].row || path[i - 1].col === c.col));
    expect(rowsOnly).toBe(true); // contiguos siempre
    const turns = level.solution.flat().filter((c, i, all) => i > 1 && (all[i - 2].row !== c.row) !== (all[i - 1].row !== c.row)).length;
    expect(turns).toBeGreaterThan(6);
  });
});

describe('Hilos: reglas del trazo', () => {
  // Tablero de 4×4 con dos parejas a mano: A en (0,0)-(0,3) y B en (3,0)-(3,3)
  const level: FlowLevel = {
    seed: 0,
    params: { size: 4, pairs: 2 },
    pairs: [{ a: cell(0, 0), b: cell(0, 3) }, { a: cell(3, 0), b: cell(3, 3) }],
    solution: [
      [cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 3)],
      [cell(3, 0), cell(3, 1), cell(3, 2), cell(3, 3)],
    ],
    minTaps: 2,
  };

  it('un trazo solo empieza en un extremo o sobre un hilo ya trazado', () => {
    const s = createFlowState(level);
    expect(beginStroke(s, level, cell(1, 1))).toBe(-1);
    expect(beginStroke(s, level, cell(0, 3))).toBe(0);
    expect(s.paths[0]).toEqual([cell(0, 3)]);
  });

  it('avanza a casillas contiguas, no salta y completa al llegar al otro extremo', () => {
    const s = createFlowState(level);
    beginStroke(s, level, cell(0, 0));
    expect(extendStroke(s, level, 0, cell(0, 2))).toBe('blocked'); // no contigua
    expect(extendStroke(s, level, 0, cell(0, 1))).toBe('extended');
    expect(extendStroke(s, level, 0, cell(1, 1))).toBe('extended');
    expect(extendStroke(s, level, 0, cell(1, 1))).toBe('none');
    expect(pairComplete(s, level, 0)).toBe(false);
    expect(extendStroke(s, level, 0, cell(1, 2))).toBe('extended');
    expect(extendStroke(s, level, 0, cell(1, 3))).toBe('extended');
    expect(extendStroke(s, level, 0, cell(0, 3))).toBe('completed');
    expect(pairComplete(s, level, 0)).toBe(true);
    expect(extendStroke(s, level, 0, cell(0, 2))).toBe('blocked'); // ya completo: no se puede seguir por otro lado
    expect(extendStroke(s, level, 0, cell(1, 3))).toBe('backtracked'); // solo se puede retroceder
    expect(pairComplete(s, level, 0)).toBe(false);
  });

  it('volver sobre la casilla anterior recorta el hilo', () => {
    const s = createFlowState(level);
    beginStroke(s, level, cell(0, 0));
    extendStroke(s, level, 0, cell(0, 1));
    extendStroke(s, level, 0, cell(1, 1));
    expect(extendStroke(s, level, 0, cell(0, 1))).toBe('backtracked');
    expect(s.paths[0]).toEqual([cell(0, 0), cell(0, 1)]);
  });

  it('un extremo de otra pareja bloquea el paso', () => {
    const s = createFlowState(level);
    beginStroke(s, level, cell(0, 0));
    expect(endpointPair(level, cell(3, 0))).toBe(1);
    for (const c of [cell(1, 0), cell(2, 0)]) extendStroke(s, level, 0, c);
    expect(extendStroke(s, level, 0, cell(3, 0))).toBe('blocked');
    expect(s.paths[0]).toHaveLength(3);
  });

  it('pasar por el hilo de otra pareja lo corta por ahí', () => {
    const s = createFlowState(level);
    drawSolution(level, s, 1); // hilo B entero por la fila de abajo
    expect(pairComplete(s, level, 1)).toBe(true);
    beginStroke(s, level, cell(0, 0));
    for (const c of [cell(1, 0), cell(2, 0)]) extendStroke(s, level, 0, c);
    const t = createFlowState(level);
    drawSolution(level, t, 1);
    beginStroke(t, level, cell(0, 1)); // no es hilo ni extremo
    // A baja por la columna 1 hasta cruzar el hilo B en (3,1)
    beginStroke(t, level, cell(0, 0));
    extendStroke(t, level, 0, cell(0, 1));
    extendStroke(t, level, 0, cell(1, 1));
    extendStroke(t, level, 0, cell(2, 1));
    expect(extendStroke(t, level, 0, cell(3, 1))).toBe('cut');
    expect(t.paths[1]).toEqual([cell(3, 0)]); // solo queda el extremo de B
    expect(pairComplete(t, level, 1)).toBe(false);
    expect(ownerGrid(t, 4)[3][1]).toBe(0);
  });

  it('tocar un hilo ya trazado lo recorta hasta ahí y se sigue desde esa casilla', () => {
    const s = createFlowState(level);
    drawSolution(level, s, 0);
    expect(beginStroke(s, level, cell(0, 1))).toBe(0);
    expect(s.paths[0]).toEqual([cell(0, 0), cell(0, 1)]);
    expect(extendStroke(s, level, 0, cell(1, 1))).toBe('extended');
  });

  it('empezar de nuevo en un extremo borra el hilo de esa pareja', () => {
    const s = createFlowState(level);
    drawSolution(level, s, 0);
    beginStroke(s, level, cell(0, 3));
    expect(s.paths[0]).toEqual([cell(0, 3)]);
    // y se puede trazar desde el otro extremo hacia el primero
    for (const c of [cell(0, 2), cell(0, 1), cell(0, 0)]) extendStroke(s, level, 0, c);
    expect(pairComplete(s, level, 0)).toBe(true);
  });

  it('cuenta hilos unidos y casillas ocupadas, y clona sin compartir referencias', () => {
    const s = createFlowState(level);
    drawSolution(level, s, 0);
    expect(connectedCount(s, level)).toBe(1);
    expect(filledCount(s)).toBe(4);
    const copy = cloneFlowState(s);
    beginStroke(s, level, cell(0, 3));
    expect(copy.paths[0]).toHaveLength(4);
    expect(isFlowSolved(copy, level)).toBe(false);
  });
});

describe('Hilos: pistas', () => {
  it('cada pista une una pareja más y al final todo queda resuelto', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const level = generateFlow(flowParamsForTier(6), seed * 104729);
      const s = createFlowState(level);
      let hints = 0;
      for (let guard = 0; guard < 20 && !isFlowSolved(s, level); guard++) {
        const pair = flowHint(s, level);
        expect(pair).not.toBeNull();
        applySolutionPath(s, level, pair!);
        hints++;
      }
      expect(isFlowSolved(s, level)).toBe(true);
      expect(hints).toBeLessThanOrEqual(level.pairs.length);
      expect(flowHint(s, level)).toBeNull();
    }
  });

  it('la pista prefiere la pareja que menos hilos ajenos estropea', () => {
    const level = generateFlow(flowParamsForTier(4), 11);
    const s = createFlowState(level);
    // Una pareja resuelta a mano y un hilo ajeno cruzando el trazado de otra
    drawSolution(level, s, 0);
    const pair = flowHint(s, level)!;
    expect(pair).not.toBe(0);
    applySolutionPath(s, level, pair);
    expect(pairComplete(s, level, 0)).toBe(true); // lo ya unido no se toca
  });
});

describe('Hilos: aspecto de las casillas (src/game/flowLooks.ts)', () => {
  it('cada tramo del hilo se dibuja hacia su vecina y los puntos son siempre de su pareja', async () => {
    const { flowLooks } = await import('../src/game/flowLooks');
    const level = generateFlow(flowParamsForTier(4), 5);
    const state = createFlowState(level);
    let looks = flowLooks(level, state, 20);
    // Sin trazar nada: solo los extremos tienen dueño y ninguna casilla tiene tramos
    looks.flat().forEach((l) => expect(l.legs).toHaveLength(0));
    expect(looks.flat().filter((l) => l.endpoint)).toHaveLength(level.pairs.length * 2);
    expect(looks.flat().filter((l) => l.owner >= 0)).toHaveLength(level.pairs.length * 2);

    drawSolution(level, state, 0);
    looks = flowLooks(level, state, 20);
    const path = level.solution[0];
    path.forEach((c, i) => {
      const look = looks[c.row][c.col];
      expect(look.owner).toBe(0);
      expect(look.complete).toBe(true);
      expect(look.legs).toHaveLength(i === 0 || i === path.length - 1 ? 1 : 2);
      // El tramo apunta a la casilla vecina del hilo y esa apunta de vuelta
      for (const leg of look.legs) {
        const back = looks[c.row + leg.dy][c.col + leg.dx].legs.find((l) => l.dx === -leg.dx && l.dy === -leg.dy);
        expect(back).toBeDefined();
      }
    });
    // Un hilo a medias deja su pareja sin completar
    beginStroke(state, level, level.pairs[1].a);
    extendStroke(state, level, 1, level.solution[1][1]);
    looks = flowLooks(level, state, 20);
    expect(looks[level.pairs[1].a.row][level.pairs[1].a.col].complete).toBe(false);
  });
});

describe('Hilos: llenar todo el tablero', () => {
  // 3×3 con dos parejas: la roja va por el borde izquierdo e inferior; la azul puede dar la vuelta (llena todo) o ir directa
  const red = [cell(0, 0), cell(1, 0), cell(2, 0), cell(2, 1), cell(2, 2)];
  const blue = [cell(0, 1), cell(0, 2), cell(1, 2), cell(1, 1)];
  const level: FlowLevel = {
    seed: 0,
    params: { size: 3, pairs: 2 },
    pairs: [{ a: red[0], b: red[4] }, { a: blue[0], b: blue[3] }],
    solution: [red, blue],
    minTaps: 2,
  };
  const draw = (state: ReturnType<typeof createFlowState>, pair: number, path: FlowCell[]) => {
    beginStroke(state, level, path[0]);
    for (let i = 1; i < path.length; i++) extendStroke(state, level, pair, path[i]);
  };

  it('unir todas las parejas dejando casillas vacías no gana, en ningún modo', () => {
    const state = createFlowState(level);
    draw(state, 0, red);
    draw(state, 1, [blue[0], blue[3]]); // directa: deja (0,2) y (1,2) vacías
    expect(isFlowSolved(state, level)).toBe(true);
    expect(emptyCount(state, level)).toBe(2);
    expect(isFlowFull(state, level)).toBe(false);
    expect(isFlowJoinedButNotFull(state, level)).toBe(true);
    expect(isFlowComplete(state, level)).toBe(false);
  });

  it('el mismo tablero con la vuelta larga llena las nueve casillas y gana', () => {
    const state = createFlowState(level);
    draw(state, 0, red);
    draw(state, 1, blue);
    expect(flowCellCount(level)).toBe(9);
    expect(emptyCount(state, level)).toBe(0);
    expect(isFlowJoinedButNotFull(state, level)).toBe(false);
    expect(isFlowComplete(state, level)).toBe(true);
  });

  it('con todo unido pero sin llenar, la pista enseña el hilo que falta y el tablero acaba lleno', () => {
    const state = createFlowState(level);
    draw(state, 0, red);
    draw(state, 1, [blue[0], blue[3]]);
    const pair = flowHint(state, level);
    expect(pair).toBe(1);
    applySolutionPath(state, level, pair!);
    expect(isFlowComplete(state, level)).toBe(true);
    expect(flowHint(state, level)).toBeNull();
  });

  it('las casillas vacías se señalan solo cuando se pide (todo unido y falta llenar)', async () => {
    const { flowLooks } = await import('../src/game/flowLooks');
    const state = createFlowState(level);
    draw(state, 0, red);
    draw(state, 1, [blue[0], blue[3]]);
    expect(flowLooks(level, state, 20).flat().some((l) => l.missing)).toBe(false);
    const looks = flowLooks(level, state, 20, true);
    expect(looks.flat().filter((l) => l.missing)).toHaveLength(2);
    expect(looks[0][2].missing).toBe(true);
    expect(looks[1][2].missing).toBe(true);
    expect(looks[1][1].missing).toBe(false);
  });
});
