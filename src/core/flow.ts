import { mulberry32 } from './rng';

/**
 * Tercer puzzle: **Hilos**. Un tablero cuadrado con parejas de puntos del mismo color; hay que unir cada pareja
 * con un hilo de luz que se arrastra por las casillas, sin que dos hilos compartan casilla. Es el clásico
 * «Flow» / «Numberlink».
 *
 * Cada nivel se genera partiendo de la solución: se traza un camino que recorre todas las casillas (un camino
 * hamiltoniano aleatorio, con el algoritmo «backbite»), se corta en tramos y los extremos de cada tramo son una
 * pareja. Así **siempre tiene solución** y la pista puede enseñar el tramo exacto. Ganar es unir todas las parejas
 * (no hace falta llenar el tablero). 100 % TypeScript puro, igual que el resto de `src/core`.
 */

export interface FlowCell {
  row: number;
  col: number;
}

export interface FlowParams {
  size: number;
  /** Número de parejas (de hilos). */
  pairs: number;
}

export interface FlowPair {
  a: FlowCell;
  b: FlowCell;
}

export interface FlowLevel {
  seed: number;
  params: FlowParams;
  pairs: FlowPair[];
  /** Un hilo posible por pareja (de `a` a `b`): el trazado con el que se generó el nivel. Los hilos no se cruzan. */
  solution: FlowCell[][];
  /** Mínimo de trazos para resolverlo: uno por pareja. */
  minTaps: number;
}

/** Hilo de cada pareja (en el orden de `FlowLevel.pairs`): vacío, o una lista de casillas que empieza en un extremo de su pareja. */
export interface FlowState {
  paths: FlowCell[][];
}

/** Tamaño y número de hilos según el nivel de habilidad (1 a 8). */
export function flowParamsForTier(tier: number): FlowParams {
  const t = Math.max(1, Math.min(8, Math.floor(tier)));
  const size = t <= 2 ? 4 : t <= 4 ? 5 : t <= 6 ? 6 : 7;
  const pairs = [3, 4, 4, 5, 5, 6, 6, 7][t - 1];
  return { size, pairs };
}

export const sameCell = (a: FlowCell, b: FlowCell): boolean => a.row === b.row && a.col === b.col;

export const adjacentCells = (a: FlowCell, b: FlowCell): boolean => Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;

// ---------------------------------------------------------------------------
// Generación
// ---------------------------------------------------------------------------

/** Camino en serpiente que recorre todo el tablero (punto de partida del «backbite»). */
function snakePath(size: number): FlowCell[] {
  const path: FlowCell[] = [];
  for (let row = 0; row < size; row++) {
    for (let i = 0; i < size; i++) path.push({ row, col: row % 2 === 0 ? i : size - 1 - i });
  }
  return path;
}

/**
 * Camino hamiltoniano aleatorio: a un camino que ya recorre todo se le aplican «backbites» (el extremo se une con una
 * vecina del camino y se invierte el trozo que queda entre medias). Cada movimiento deja un camino válido.
 */
function randomHamiltonianPath(size: number, rng: () => number): FlowCell[] {
  let path = snakePath(size);
  const moves = size * size * 12;
  for (let i = 0; i < moves; i++) {
    if (rng() < 0.5) path = path.reverse();
    const head = path[0];
    const options: number[] = [];
    for (let j = 2; j < path.length; j++) if (adjacentCells(head, path[j])) options.push(j);
    if (options.length === 0) continue;
    const j = options[Math.floor(rng() * options.length)];
    path = [...path.slice(0, j).reverse(), ...path.slice(j)];
  }
  return path;
}

/** Genera un nivel resoluble: camino hamiltoniano cortado en `pairs` tramos de al menos 3 casillas. */
export function generateFlow(params: FlowParams, seed: number): FlowLevel {
  const { size } = params;
  const cells = size * size;
  const pairs = Math.max(1, Math.min(params.pairs, Math.floor(cells / 3)));
  const rng = mulberry32(seed);
  const path = randomHamiltonianPath(size, rng);

  const lengths = Array<number>(pairs).fill(3);
  for (let extra = cells - 3 * pairs; extra > 0; extra--) lengths[Math.floor(rng() * pairs)]++;

  const solution: FlowCell[][] = [];
  let at = 0;
  for (const length of lengths) {
    solution.push(path.slice(at, at + length));
    at += length;
  }
  return {
    seed,
    params: { size, pairs },
    pairs: solution.map((cellsOfPair) => ({ a: cellsOfPair[0], b: cellsOfPair[cellsOfPair.length - 1] })),
    solution,
    minTaps: pairs,
  };
}

// ---------------------------------------------------------------------------
// Estado y reglas del trazo
// ---------------------------------------------------------------------------

export function createFlowState(level: FlowLevel): FlowState {
  return { paths: level.pairs.map(() => []) };
}

export function cloneFlowState(state: FlowState): FlowState {
  return { paths: state.paths.map((path) => path.map((cell) => ({ ...cell }))) };
}

/** Pareja de la que la casilla es un extremo, o -1. */
export function endpointPair(level: FlowLevel, cell: FlowCell): number {
  return level.pairs.findIndex((pair) => sameCell(pair.a, cell) || sameCell(pair.b, cell));
}

/** Pareja cuyo hilo pasa por la casilla (extremos incluidos si el hilo ya los toca), o -1. */
export function pathOwner(state: FlowState, cell: FlowCell): number {
  return state.paths.findIndex((path) => path.some((c) => sameCell(c, cell)));
}

/** Para cada casilla, la pareja dueña de su hilo (o -1). */
export function ownerGrid(state: FlowState, size: number): number[][] {
  const grid = Array.from({ length: size }, () => Array<number>(size).fill(-1));
  state.paths.forEach((path, i) => path.forEach((cell) => { grid[cell.row][cell.col] = i; }));
  return grid;
}

export function pairComplete(state: FlowState, level: FlowLevel, index: number): boolean {
  const path = state.paths[index];
  if (path.length < 2) return false;
  const { a, b } = level.pairs[index];
  const first = path[0];
  const last = path[path.length - 1];
  return (sameCell(first, a) && sameCell(last, b)) || (sameCell(first, b) && sameCell(last, a));
}

export function connectedCount(state: FlowState, level: FlowLevel): number {
  return level.pairs.reduce((total, _pair, i) => total + (pairComplete(state, level, i) ? 1 : 0), 0);
}

export function isFlowSolved(state: FlowState, level: FlowLevel): boolean {
  return level.pairs.length > 0 && connectedCount(state, level) === level.pairs.length;
}

/** Casillas ocupadas por algún hilo. */
export function filledCount(state: FlowState): number {
  return state.paths.reduce((total, path) => total + path.length, 0);
}

/**
 * Empieza un trazo en una casilla. Sobre un extremo, empieza de cero el hilo de su pareja; sobre un hilo ya trazado,
 * lo recorta hasta esa casilla para seguir desde ahí. Devuelve la pareja, o -1 si la casilla está vacía.
 */
export function beginStroke(state: FlowState, level: FlowLevel, cell: FlowCell): number {
  const endpoint = endpointPair(level, cell);
  if (endpoint >= 0) {
    state.paths[endpoint] = [{ ...cell }];
    return endpoint;
  }
  const owner = pathOwner(state, cell);
  if (owner < 0) return -1;
  const index = state.paths[owner].findIndex((c) => sameCell(c, cell));
  state.paths[owner] = state.paths[owner].slice(0, index + 1);
  return owner;
}

export type StrokeResult = 'none' | 'extended' | 'backtracked' | 'cut' | 'completed' | 'blocked';

/**
 * Prolonga el hilo de `pair` hasta una casilla contigua a su punta. Volver a la casilla anterior (o a una propia) lo
 * recorta; pasar por el hilo de otra pareja lo corta; un extremo de otra pareja bloquea; llegar al otro extremo de su
 * pareja lo completa (y ahí se queda: solo se puede retroceder).
 */
export function extendStroke(state: FlowState, level: FlowLevel, pair: number, cell: FlowCell): StrokeResult {
  const path = state.paths[pair];
  if (path.length === 0) return 'blocked';
  const tail = path[path.length - 1];
  if (sameCell(tail, cell)) return 'none';
  if (!adjacentCells(tail, cell)) return 'blocked';

  const own = path.findIndex((c) => sameCell(c, cell));
  if (own >= 0) {
    state.paths[pair] = path.slice(0, own + 1);
    return 'backtracked';
  }
  if (pairComplete(state, level, pair)) return 'blocked';

  const endpoint = endpointPair(level, cell);
  if (endpoint >= 0 && endpoint !== pair) return 'blocked';
  if (endpoint === pair) {
    path.push({ ...cell });
    return 'completed';
  }

  const owner = pathOwner(state, cell);
  let cut = false;
  if (owner >= 0) {
    const index = state.paths[owner].findIndex((c) => sameCell(c, cell));
    state.paths[owner] = state.paths[owner].slice(0, index);
    cut = true;
  }
  path.push({ ...cell });
  return cut ? 'cut' : 'extended';
}

/** Casillas de la pareja en cuyo trazado hay hilos de otras parejas (lo que costaría la pista). */
function conflicts(state: FlowState, pair: number, cells: FlowCell[]): number {
  return cells.filter((cell) => state.paths.some((path, i) => i !== pair && path.some((c) => sameCell(c, cell)))).length;
}

/** Coloca el trazado de la solución de una pareja, cortando los hilos de otras que pasen por él. */
export function applySolutionPath(state: FlowState, level: FlowLevel, pair: number): void {
  const solution = level.solution[pair];
  state.paths.forEach((path, i) => {
    if (i === pair) return;
    const cut = path.findIndex((c) => solution.some((s) => sameCell(s, c)));
    if (cut >= 0) state.paths[i] = path.slice(0, cut);
  });
  state.paths[pair] = solution.map((cell) => ({ ...cell }));
}

/**
 * Pista: completa la pareja sin unir que menos hilos ajenos estropea (y, a igualdad, la más corta). Devuelve su
 * índice, o null si todo está unido.
 */
export function flowHint(state: FlowState, level: FlowLevel): number | null {
  let best: { index: number; score: number } | null = null;
  level.pairs.forEach((_pair, i) => {
    if (pairComplete(state, level, i)) return;
    const score = conflicts(state, i, level.solution[i]) * 100 + level.solution[i].length;
    if (!best || score < best.score) best = { index: i, score };
  });
  return best ? (best as { index: number }).index : null;
}
