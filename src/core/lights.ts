import { mulberry32 } from './rng';

/**
 * Segundo puzzle: **Luces**. Un tablero cuadrado de casillas; tocar una casilla cambia su luz y la de sus cuatro
 * vecinas (encendida ↔ apagada). Hay que dejar todo encendido.
 *
 * Es el clásico «Lights Out» planteado al revés (encender en vez de apagar). Cada nivel se genera partiendo del
 * tablero resuelto (todo encendido) y aplicando toques al azar, así que **siempre tiene solución**. El mínimo de toques y las
 * pistas salen de resolver el sistema de ecuaciones sobre GF(2) (cada casilla se toca 0 o 1 vez: tocar dos veces
 * se anula). 100 % TypeScript puro, igual que el resto de `src/core`.
 */

export type LightsGrid = boolean[][]; // true = encendida

export interface LightsParams {
  size: number;
  /** Cuántas casillas distintas se tocan al desordenar. */
  scrambles: number;
}

export interface LightsLevel {
  seed: number;
  params: LightsParams;
  initial: LightsGrid;
  /** Mínimo de toques para resolverlo. */
  minTaps: number;
}

/** Tamaño y desorden según el nivel de habilidad (1 a 8) del jugador. */
export function lightsParamsForTier(tier: number): LightsParams {
  const t = Math.max(1, Math.min(8, Math.floor(tier)));
  const size = t <= 2 ? 3 : t <= 4 ? 4 : t <= 6 ? 5 : 6;
  const scrambles = Math.min(size * size - 1, 2 + t + Math.floor(size / 2));
  return { size, scrambles };
}

export function createGrid(size: number, lit: boolean): LightsGrid {
  return Array.from({ length: size }, () => Array<boolean>(size).fill(lit));
}

export function cloneGrid(grid: LightsGrid): LightsGrid {
  return grid.map((row) => [...row]);
}

/** Toca una casilla: cambia ella y sus vecinas (arriba, abajo, izquierda y derecha). */
export function toggleLights(grid: LightsGrid, row: number, col: number): void {
  for (const [dr, dc] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < grid.length && c >= 0 && c < grid.length) grid[r][c] = !grid[r][c];
  }
}

export function isAllLit(grid: LightsGrid): boolean {
  return grid.every((row) => row.every(Boolean));
}

export function litCount(grid: LightsGrid): number {
  return grid.reduce((total, row) => total + row.filter(Boolean).length, 0);
}

/**
 * Casillas que hay que tocar (una vez cada una) para encenderlo todo con el menor número de toques.
 * Resuelve A·x = b sobre GF(2), con b = casillas apagadas, y entre todas las soluciones (la particular más
 * cualquier combinación del núcleo) elige la de menos casillas. Devuelve null si no tuviera solución
 * (no ocurre con tableros generados desde el estado resuelto).
 */
export function solveLights(grid: LightsGrid): Array<[number, number]> | null {
  const n = grid.length;
  const cells = n * n;
  const words = Math.ceil((cells + 1) / 31);
  // Fila i: ecuación de la casilla i (qué toques la afectan) + término independiente (¿está apagada?) en la columna `cells`
  const rows: number[][] = [];
  const setBit = (row: number[], bit: number) => { row[Math.floor(bit / 31)] ^= 1 << bit % 31; };
  const getBit = (row: number[], bit: number) => (row[Math.floor(bit / 31)] >>> bit % 31) & 1;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const eq = Array<number>(words).fill(0);
      for (const [dr, dc] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n) setBit(eq, rr * n + cc);
      }
      if (!grid[r][c]) setBit(eq, cells);
      rows.push(eq);
    }
  }

  // Eliminación gaussiana
  const pivotOfColumn: number[] = Array(cells).fill(-1);
  let rank = 0;
  for (let col = 0; col < cells && rank < cells; col++) {
    let pivot = -1;
    for (let r = rank; r < cells; r++) if (getBit(rows[r], col)) { pivot = r; break; }
    if (pivot < 0) continue;
    [rows[rank], rows[pivot]] = [rows[pivot], rows[rank]];
    for (let r = 0; r < cells; r++) {
      if (r !== rank && getBit(rows[r], col)) for (let w = 0; w < words; w++) rows[r][w] ^= rows[rank][w];
    }
    pivotOfColumn[col] = rank;
    rank++;
  }
  for (let r = rank; r < cells; r++) if (getBit(rows[r], cells)) return null; // 0 = 1: sin solución

  const freeColumns: number[] = [];
  for (let col = 0; col < cells; col++) if (pivotOfColumn[col] < 0) freeColumns.push(col);

  // Con las variables libres a 0 sale una solución; probar todas las combinaciones de libres da las demás
  let best: number[] | null = null;
  for (let mask = 0; mask < 1 << freeColumns.length; mask++) {
    const x = Array<number>(cells).fill(0);
    freeColumns.forEach((col, i) => { if ((mask >> i) & 1) x[col] = 1; });
    for (let col = 0; col < cells; col++) {
      const pr = pivotOfColumn[col];
      if (pr < 0) continue;
      let value = getBit(rows[pr], cells);
      for (const f of freeColumns) if (x[f] && getBit(rows[pr], f)) value ^= 1;
      x[col] = value;
    }
    const weight = x.reduce((a, b) => a + b, 0);
    if (!best || weight < best.reduce((a, b) => a + b, 0)) best = x;
  }
  if (!best) return null;
  const taps: Array<[number, number]> = [];
  best.forEach((v, i) => { if (v) taps.push([Math.floor(i / n), i % n]); });
  return taps;
}

/** Genera un nivel resoluble: parte de todo encendido y toca `scrambles` casillas distintas al azar. */
export function generateLights(params: LightsParams, seed: number): LightsLevel {
  const { size } = params;
  const cells = size * size;
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < 50; attempt++) {
    const grid = createGrid(size, true);
    const order = Array.from({ length: cells }, (_, i) => i);
    for (let i = cells - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const index of order.slice(0, Math.min(params.scrambles, cells))) toggleLights(grid, Math.floor(index / size), index % size);
    if (isAllLit(grid)) continue; // los toques se anularon entre sí: no puede nacer resuelto
    const solution = solveLights(grid);
    if (solution && solution.length > 0) return { seed, params, initial: grid, minTaps: solution.length };
  }
  // Camino seguro (no debería ocurrir): un solo toque en el centro
  const grid = createGrid(size, true);
  toggleLights(grid, Math.floor(size / 2), Math.floor(size / 2));
  return { seed, params, initial: grid, minTaps: 1 };
}

/** Siguiente casilla a tocar para acercarse a la solución más corta (la primera en orden de lectura). */
export function lightsHint(grid: LightsGrid): [number, number] | null {
  const solution = solveLights(grid);
  return solution && solution.length > 0 ? solution[0] : null;
}
