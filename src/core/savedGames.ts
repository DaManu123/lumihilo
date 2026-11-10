/**
 * Partidas en curso (lógica pura, sin Phaser).
 *
 * Cada puzzle conserva su partida a medias: al salir al menú, cambiar de puzzle o cerrar la app se guarda una
 * «foto» del tablero, y al volver a entrar se retoma donde se dejó. La foto no guarda el nivel entero, solo lo que el
 * jugador ha cambiado; el nivel se vuelve a generar con su semilla. Si al volver el nivel ya no es el mismo (cambió el
 * modo, la dificultad o el día del reto), la foto no sirve y se descarta.
 */

import type { PuzzleType } from './puzzles';
import { PUZZLES } from './puzzles';
import type { FlowCell } from './flow';

export interface SavedGame {
  level: number;
  /** Reto diario (y su fecha) en vez de un nivel normal. */
  daily: boolean;
  dailyKey: string;
  /** Datos con los que se generó el nivel, para reconocerlo al volver. */
  seed: number;
  width: number;
  height: number;
  minTaps: number;
  elapsed: number;
  taps: number;
  hints: number;
  /** Jugadas para deshacer: fila, columna y sentido. */
  moves: Array<[number, number, number]>;
  /** Circuitos: giro (0 a 3) de cada casilla, por filas. */
  rotations?: number[];
  /** Luces: casillas encendidas, por filas, y la última tocada. */
  lights?: boolean[];
  lastLightsTap?: [number, number] | null;
  /** Hilos: el hilo de cada pareja y los estados para deshacer. */
  paths?: FlowCell[][];
  flowUndo?: FlowCell[][][];
}

export type SavedGames = Partial<Record<PuzzleType, SavedGame>>;

/** Cuántos estados de «deshacer» de Hilos se guardan como máximo (cada uno son todos los hilos). */
export const MAX_SAVED_FLOW_UNDO = 20;
const MAX_MOVES = 400;

const int = (value: unknown, min = 0): number | null =>
  typeof value === 'number' && Number.isFinite(value) && Math.floor(value) >= min ? Math.floor(value) : null;

function cellOf(value: unknown): FlowCell | null {
  if (typeof value !== 'object' || value === null) return null;
  const r = int((value as Record<string, unknown>).row);
  const c = int((value as Record<string, unknown>).col);
  return r === null || c === null ? null : { row: r, col: c };
}

function pathsOf(value: unknown): FlowCell[][] | null {
  if (!Array.isArray(value) || value.length > 16) return null;
  const out: FlowCell[][] = [];
  for (const path of value) {
    if (!Array.isArray(path) || path.length > 100) return null;
    const cells: FlowCell[] = [];
    for (const raw of path) {
      const cell = cellOf(raw);
      if (!cell) return null;
      cells.push(cell);
    }
    out.push(cells);
  }
  return out;
}

/** Valida una partida guardada; devuelve null si está corrupta o es de otra forma de juego. */
export function sanitizeSavedGame(puzzle: PuzzleType, raw: unknown): SavedGame | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const level = int(r.level, 1);
  const seed = typeof r.seed === 'number' && Number.isFinite(r.seed) ? r.seed : null;
  const width = int(r.width, 1);
  const height = int(r.height, 1);
  if (level === null || seed === null || width === null || height === null || width > 16 || height > 16) return null;
  const daily = r.daily === true;
  const dailyKey = typeof r.dailyKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.dailyKey) ? r.dailyKey : '';
  if (daily && !dailyKey) return null;

  const moves: Array<[number, number, number]> = [];
  if (Array.isArray(r.moves)) {
    for (const m of r.moves.slice(-MAX_MOVES)) {
      if (!Array.isArray(m) || m.length !== 3) return null;
      const [row, col, step] = m as unknown[];
      if (int(row) === null || int(col) === null || (step !== 0 && step !== 1 && step !== -1)) return null;
      moves.push([row as number, col as number, step as number]);
    }
  }

  const game: SavedGame = {
    level,
    daily,
    dailyKey: daily ? dailyKey : '',
    seed,
    width,
    height,
    minTaps: int(r.minTaps) ?? 0,
    elapsed: int(r.elapsed) ?? 0,
    taps: int(r.taps) ?? 0,
    hints: int(r.hints) ?? 0,
    moves,
  };

  const cells = width * height;
  if (puzzle === 'circuits') {
    if (!Array.isArray(r.rotations) || r.rotations.length !== cells) return null;
    if (!r.rotations.every((v) => v === 0 || v === 1 || v === 2 || v === 3)) return null;
    game.rotations = r.rotations as number[];
  } else if (puzzle === 'lights') {
    if (!Array.isArray(r.lights) || r.lights.length !== cells || !r.lights.every((v) => typeof v === 'boolean')) return null;
    game.lights = r.lights as boolean[];
    const tap = r.lastLightsTap;
    game.lastLightsTap =
      Array.isArray(tap) && tap.length === 2 && int(tap[0]) !== null && int(tap[1]) !== null ? [tap[0] as number, tap[1] as number] : null;
  } else {
    const paths = pathsOf(r.paths);
    if (!paths) return null;
    game.paths = paths;
    const undo: FlowCell[][][] = [];
    if (Array.isArray(r.flowUndo)) {
      for (const state of r.flowUndo.slice(-MAX_SAVED_FLOW_UNDO)) {
        const p = pathsOf(state);
        if (!p) return null;
        undo.push(p);
      }
    }
    game.flowUndo = undo;
    // El deshacer de Hilos va emparejado con las jugadas: si no coinciden, se parte de cero
    if (game.moves.length !== undo.length) {
      game.moves = [];
      game.flowUndo = [];
    }
  }
  return game;
}

export function sanitizeSavedGames(raw: unknown): SavedGames {
  if (typeof raw !== 'object' || raw === null) return {};
  const out: SavedGames = {};
  for (const puzzle of PUZZLES) {
    const game = sanitizeSavedGame(puzzle, (raw as Record<string, unknown>)[puzzle]);
    if (game) out[puzzle] = game;
  }
  return out;
}

/** El nivel que hay que jugar ahora, para saber si la partida guardada es de él. */
export interface LevelIdentity {
  level: number;
  daily: boolean;
  dailyKey: string;
  seed: number;
  width: number;
  height: number;
  minTaps: number;
}

export function matchesLevel(game: SavedGame, level: LevelIdentity): boolean {
  return (
    game.level === level.level &&
    game.daily === level.daily &&
    game.dailyKey === (level.daily ? level.dailyKey : '') &&
    game.seed === level.seed &&
    game.width === level.width &&
    game.height === level.height &&
    game.minTaps === level.minTaps
  );
}

/** Una partida que ya tiene algo hecho (si no, no vale la pena guardarla ni mostrar «Continuar»). */
export function hasProgress(game: SavedGame): boolean {
  return game.taps > 0 || game.hints > 0;
}
