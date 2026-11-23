import type { GameMode } from './adaptive';
import type { CodeParams } from './code';
import type { FlowParams } from './flow';
import type { LightsParams } from './lights';
import type { PuzzleType } from './puzzles';
import type { LevelParams } from './types';

/**
 * Primeros niveles de cada puzzle (lógica pura).
 *
 * Quien abre el juego por primera vez no debe toparse con un tablero de 16 piezas: los primeros niveles de cada puzzle
 * son pequeños y crecen poco a poco hasta empalmar con la dificultad adaptativa. Así se aprende jugando:
 * - **Circuitos:** 3×3 sin bucles, 3×3 con un bucle y 4×4 sin bucles.
 * - **Luces:** 3×3 que se resuelve con 1, 2, 3 y 4 toques, y luego 4×4 con 3 y 5.
 * - **Hilos:** 3×3 con 2 y 3 hilos y 4×4 con 4 (hilos cortos: llenar el tablero sale casi solo).
 * - **Claves:** dos cifras del 1 al 4, dos del 1 al 6 y tres del 1 al 6, todas con cada cifra marcada.
 *
 * No aplican en el modo Reto (quien lo elige quiere tableros grandes) ni en el reto diario (igual para todos).
 * Estos niveles no mueven la dificultad adaptativa ni los récords de tiempo: son de práctica.
 */

const CIRCUITS_INTRO: ReadonlyArray<LevelParams> = [
  { width: 3, height: 3, extraLoops: 0, branchBias: 0.3 },
  { width: 3, height: 3, extraLoops: 1, branchBias: 0.4 },
  { width: 4, height: 4, extraLoops: 0, branchBias: 0.5 },
];

const LIGHTS_INTRO: ReadonlyArray<LightsParams> = [
  { size: 3, scrambles: 1, blocked: 0 },
  { size: 3, scrambles: 2, blocked: 0 },
  { size: 3, scrambles: 3, blocked: 0 },
  { size: 3, scrambles: 4, blocked: 0 },
  { size: 4, scrambles: 3, blocked: 0 },
  { size: 4, scrambles: 5, blocked: 0 },
];

const FLOW_INTRO: ReadonlyArray<FlowParams> = [
  { size: 3, pairs: 2 },
  { size: 3, pairs: 3 },
  { size: 4, pairs: 4 },
];

const CODE_INTRO: ReadonlyArray<CodeParams> = [
  { length: 2, low: 1, high: 4, repeats: false, colors: true, expected: 3 },
  { length: 2, low: 1, high: 6, repeats: false, colors: true, expected: 5 },
  { length: 3, low: 1, high: 6, repeats: false, colors: true, expected: 4 },
];

/** Cuántos niveles de entrada tiene cada puzzle. */
export const INTRO_LEVELS: Record<PuzzleType, number> = {
  circuits: CIRCUITS_INTRO.length,
  lights: LIGHTS_INTRO.length,
  flow: FLOW_INTRO.length,
  code: CODE_INTRO.length,
};

export interface IntroContext {
  puzzle: PuzzleType;
  /** Nivel (desde 1) por el que va el jugador en ese puzzle. */
  level: number;
  mode: GameMode;
  isDaily: boolean;
}

/** ¿Este nivel es uno de los de entrada? */
export function isIntroLevel(ctx: IntroContext): boolean {
  if (ctx.isDaily || ctx.mode === 'challenge') return false;
  return Number.isInteger(ctx.level) && ctx.level >= 1 && ctx.level <= INTRO_LEVELS[ctx.puzzle];
}

export function introCircuitsParams(level: number): LevelParams {
  return { ...CIRCUITS_INTRO[Math.max(1, Math.min(CIRCUITS_INTRO.length, level)) - 1] };
}

export function introLightsParams(level: number): LightsParams {
  return { ...LIGHTS_INTRO[Math.max(1, Math.min(LIGHTS_INTRO.length, level)) - 1] };
}

export function introFlowParams(level: number): FlowParams {
  return { ...FLOW_INTRO[Math.max(1, Math.min(FLOW_INTRO.length, level)) - 1] };
}

export function introCodeParams(level: number): CodeParams {
  return { ...CODE_INTRO[Math.max(1, Math.min(CODE_INTRO.length, level)) - 1] };
}

/** Clave del récord de tiempo de los niveles de entrada (aparte de los de cada nivel de habilidad). */
export function introRecordKey(puzzle: PuzzleType): string {
  return `intro-${puzzle}`;
}
