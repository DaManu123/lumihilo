import { LevelParams } from './types';
import type { PuzzleType } from './puzzles';

/**
 * Modos de juego elegibles por el usuario.
 * - relaxed: Puzzles accesibles (4x4, tiers 1-3), sin penalización por lentitud, reintentos ni abandono, ideal para jugar sin estrés.
 * - normal: Dificultad adaptativa automática que escala según el desempeño real del jugador.
 * - challenge: Puzzles de mayor tamaño (5x5 a 7x7) con más bucles y bifurcaciones complejas.
 */
export type GameMode = 'relaxed' | 'normal' | 'challenge';

/**
 * Parámetros de nivel asociados a cada peldaño (tier) de dificultad.
 * Va desde Tier 1 (4x4 simple sin bucles) hasta Tier 10 (7x7 con 4 bucles).
 */
export const DIFFICULTY_TIERS: Record<number, LevelParams> = {
  // Peldaños 1-3: 4x4 (el modo Relajado no pasa de aquí); solo suben los bucles
  1: { width: 4, height: 4, extraLoops: 1, branchBias: 0.5 },
  2: { width: 4, height: 4, extraLoops: 2, branchBias: 0.6 },
  3: { width: 4, height: 4, extraLoops: 3, branchBias: 0.65 },
  4: { width: 5, height: 5, extraLoops: 2, branchBias: 0.55 },
  5: { width: 5, height: 5, extraLoops: 3, branchBias: 0.65 },
  6: { width: 5, height: 5, extraLoops: 4, branchBias: 0.7 },
  7: { width: 6, height: 6, extraLoops: 3, branchBias: 0.65 },
  8: { width: 6, height: 6, extraLoops: 4, branchBias: 0.75 },
  9: { width: 6, height: 6, extraLoops: 6, branchBias: 0.8 },
  10: { width: 7, height: 7, extraLoops: 6, branchBias: 0.85 },
};

/** Eficiencia mínima de toques (minTaps / toques reales) para considerar maestría en Circuitos. */
export const MASTERY_MIN_EFFICIENCY = 0.6;

/**
 * Cómo se mide a un buen jugador en cada puzzle. Cada uno se juega distinto, así que no se le puede pedir lo mismo:
 * - **Circuitos:** cada giro es rápido; ≈ 2,5 s por giro mínimo. `minTaps` cuenta los giros en ambos sentidos, así que
 *   quien solo gira en un sentido sin desperdiciar ronda 0,67 de eficiencia: la maestría pide 0,6.
 * - **Luces:** cada toque cambia cinco casillas y hay que pensarlo; ≈ 3,5 s por toque mínimo más un rato para leer el
 *   tablero. Encontrar el mínimo exacto es difícil incluso jugando bien: la maestría pide 0,5 (el doble del mínimo).
 * - **Hilos:** el «toque» es un trazo y el mínimo es uno por pareja; lo que lleva tiempo es recorrer las casillas, así
 *   que el tiempo esperado crece con el tablero (≈ 0,8 s por casilla y 2 s por hilo). La maestría pide 0,6 (rehacer
 *   algún trazo está bien; rehacerlos todos, no).
 * `struggleEfficiency`: por debajo de esta eficiencia y tardando mucho, la partida cuenta como atasco.
 */
export interface PuzzleTuning {
  expectedSeconds(minTaps: number, cells: number): number;
  masteryEfficiency: number;
  struggleEfficiency: number;
}

export const PUZZLE_TUNING: Record<PuzzleType, PuzzleTuning> = {
  circuits: { expectedSeconds: (minTaps) => Math.max(12, minTaps * 2.5), masteryEfficiency: MASTERY_MIN_EFFICIENCY, struggleEfficiency: 0.32 },
  lights: { expectedSeconds: (minTaps) => Math.max(15, 10 + minTaps * 3.5), masteryEfficiency: 0.5, struggleEfficiency: 0.25 },
  flow: { expectedSeconds: (minTaps, cells) => Math.max(15, 6 + cells * 0.8 + minTaps * 2), masteryEfficiency: 0.6, struggleEfficiency: 0.3 },
};

/** Tiempo que tarda un buen jugador en resolver un nivel (lo usan la dificultad y el bono de rapidez de Chispas). */
export function expectedSecondsFor(puzzle: PuzzleType, minTaps: number, cells: number): number {
  return PUZZLE_TUNING[puzzle].expectedSeconds(Math.max(1, minTaps), Math.max(1, cells));
}

export const MIN_TIER = 1;
export const MAX_TIER = 10;

/**
 * Subir de peldaño se gana con puntos: una victoria buena (maestría: eficiente y a buen ritmo, sin pistas) da 2 y una
 * victoria normal da 1. Con `RISE_POINTS` se sube. Así, quien juega muy bien sube cada 3 niveles y quien va justo, cada 6;
 * un atasco borra los puntos. Los puntos se guardan en `consecutiveWinsWithoutStruggle` (nombre heredado).
 */
export const MASTERY_POINTS = 2;
export const WIN_POINTS = 1;
export const RISE_POINTS = 6;
/** Victorias buenas seguidas que suben un peldaño (RISE_POINTS / MASTERY_POINTS). */
export const WINS_TO_RISE = RISE_POINTS / MASTERY_POINTS;
/** Atascos seguidos que bajan un peldaño. */
export const STRUGGLES_TO_DROP = 2;
/** Más de este múltiplo del tiempo esperado es atasco aunque se haya jugado sin desperdiciar toques. */
export const STRUGGLE_TIME_SHARE = 3.5;

/** Una victoria «dominante» (eficiencia ≥ 0,9 y en menos del 60 % del tiempo esperado) tras otra victoria seguida salta dos peldaños. */
export const DOMINANT_MIN_EFFICIENCY = 0.9;
export const DOMINANT_TIME_SHARE = 0.6;

/**
 * Peldaño con el que se genera de verdad el nivel según el modo: Relajado no pasa del 3 y Reto no baja del 5.
 * Luces e Hilos usan este mismo peldaño con sus propias tablas.
 */
export function effectiveTier(profile: Pick<AdaptiveProfile, 'mode' | 'currentTier'>): number {
  const tier = Math.max(MIN_TIER, Math.min(profile.currentTier, MAX_TIER));
  if (profile.mode === 'relaxed') return Math.min(tier, 3);
  if (profile.mode === 'challenge') return Math.max(5, tier);
  return tier;
}

/**
 * Perfil adaptativo del jugador guardado de forma persistente.
 */
export interface AdaptiveProfile {
  mode: GameMode;
  currentTier: number; // 1 a 10
  rating: number; // Elo/Skill score continuo (ej: 1000 base)
  gamesPlayed: number;
  gamesWon: number;
  consecutiveWinsWithoutStruggle: number;
  consecutiveStruggles: number;
  totalTimeSeconds: number;
  totalTaps: number;
}

/**
 * Métricas registradas tras completar un nivel.
 */
export interface MatchResult {
  /** Puzzle jugado (Circuitos si no se indica): cambia el tiempo esperado y la eficiencia que se pide. */
  puzzle?: PuzzleType;
  /** Casillas del tablero (Hilos mide el tiempo por casillas). */
  cells?: number;
  minTaps: number;
  actualTaps: number;
  elapsedSeconds: number;
  hintsUsed?: number;
  abandoned?: boolean;
}

/**
 * Evaluación del rendimiento en una partida.
 */
export interface PerformanceEvaluation {
  tapEfficiency: number; // minTaps / actualTaps (1.0 = perfecto)
  /** Tiempo que tarda un buen jugador en este nivel. */
  expectedSeconds: number;
  isStruggle: boolean; // ¿Se atascó el jugador?
  isMastery: boolean; // ¿Completó con alta maestría?
  performanceScore: number; // 0.0 a 2.0+
  deltaRating: number; // Cambio en rating numérico
  newTier: number;
}

/**
 * Crea un perfil adaptativo por defecto.
 */
export function createDefaultProfile(mode: GameMode = 'normal'): AdaptiveProfile {
  const initialTier = mode === 'relaxed' ? 1 : mode === 'challenge' ? 5 : 2;
  return {
    mode,
    currentTier: initialTier,
    rating: 1000,
    gamesPlayed: 0,
    gamesWon: 0,
    consecutiveWinsWithoutStruggle: 0,
    consecutiveStruggles: 0,
    totalTimeSeconds: 0,
    totalTaps: 0,
  };
}

/**
 * Perfil de un puzzle que aún no tiene el suyo (Luces e Hilos con jugadores de versiones anteriores, que compartían el
 * de Circuitos): hereda el modo y el peldaño actual, y empieza sin racha ni puntuación propias.
 */
export function profileFromShared(shared: AdaptiveProfile): AdaptiveProfile {
  return { ...createDefaultProfile(shared.mode), currentTier: shared.currentTier };
}

/**
 * Obtiene los parámetros de nivel apropiados según el modo y el nivel del perfil.
 */
export function getLevelParamsForProfile(profile: AdaptiveProfile): LevelParams {
  return DIFFICULTY_TIERS[effectiveTier(profile)] ?? DIFFICULTY_TIERS[MIN_TIER];
}

/**
 * Evalúa el resultado de una partida y actualiza el perfil adaptativo.
 * 
 * Reglas de salida verificables:
 * 1. Dos atascos seguidos (STRUGGLES_TO_DROP) bajan un peldaño.
 * 2. Las victorias suman puntos (buena = 2, normal = 1); con RISE_POINTS sube un peldaño: quien juega muy bien sube cada
 *    3 niveles, quien va justo cada 6, y un atasco borra los puntos.
 * 3. Una victoria dominante (muy eficiente y rápida) tras otra victoria seguida sube dos peldaños.
 * Lo que es «bueno» depende del puzzle (PUZZLE_TUNING).
 */
export function evaluateAndAdapt(
  profile: AdaptiveProfile,
  result: MatchResult
): { updatedProfile: AdaptiveProfile; evaluation: PerformanceEvaluation } {
  const updated: AdaptiveProfile = { ...profile };
  updated.gamesPlayed++;
  updated.totalTaps += result.actualTaps;
  updated.totalTimeSeconds += result.elapsedSeconds;

  // Si fue abandono, cuenta como dificultad excesiva / atasco
  // En modo relajado no hay penalización: abandonar no cuenta como atasco ni baja el rating.
  if (result.abandoned && updated.mode === 'relaxed') {
    updated.consecutiveWinsWithoutStruggle = 0;
    return {
      updatedProfile: updated,
      evaluation: {
        tapEfficiency: 0,
        expectedSeconds: 0,
        isStruggle: false,
        isMastery: false,
        performanceScore: 0,
        deltaRating: 0,
        newTier: updated.currentTier,
      },
    };
  }

  if (result.abandoned) {
    updated.consecutiveStruggles++;
    updated.consecutiveWinsWithoutStruggle = 0;
    updated.rating = Math.max(500, updated.rating - 50);

    let newTier = updated.currentTier;
    if (updated.consecutiveStruggles >= STRUGGLES_TO_DROP) {
      newTier = Math.max(MIN_TIER, updated.currentTier - 1);
      updated.currentTier = newTier;
      updated.consecutiveStruggles = 0;
    }

    return {
      updatedProfile: updated,
      evaluation: {
        tapEfficiency: 0,
        expectedSeconds: 0,
        isStruggle: true,
        isMastery: false,
        performanceScore: 0,
        deltaRating: -50,
        newTier,
      },
    };
  }

  updated.gamesWon++;

  // Cada pista cuenta como un toque más: corrige una pieza sin que el jugador la gire
  const hintsUsed = result.hintsUsed ?? 0;
  const safeActualTaps = Math.max(result.actualTaps + hintsUsed, 1);
  const safeMinTaps = Math.max(result.minTaps, 1);
  const tapEfficiency = Math.min(1.0, safeMinTaps / safeActualTaps);

  // Tiempo esperado y exigencia según el puzzle (ver PUZZLE_TUNING)
  const tuning = PUZZLE_TUNING[result.puzzle ?? 'circuits'];
  const expectedSeconds = tuning.expectedSeconds(safeMinTaps, Math.max(1, result.cells ?? 1));
  const timeFactor = Math.min(2.0, expectedSeconds / Math.max(result.elapsedSeconds, 4));
  const timeShare = result.elapsedSeconds / expectedSeconds;

  // Puntuación combinada de rendimiento (eficiencia relativa a lo que se pide en ese puzzle)
  const relativeEfficiency = Math.min(1.5, tapEfficiency / tuning.masteryEfficiency);
  const performanceScore = Math.min(1, relativeEfficiency) * 0.6 + Math.min(timeFactor, 1.5) * 0.4;

  // Atasco (nunca en Relajado): 2 o más pistas, muchos toques de más y lento, o muchísimo más lento de lo esperado
  const isStruggle =
    updated.mode !== 'relaxed' &&
    (hintsUsed >= 2 ||
      (tapEfficiency < tuning.struggleEfficiency && timeShare > 1.8) ||
      timeShare > STRUGGLE_TIME_SHARE);

  // Maestría: sin pistas, con la eficiencia que pide el puzzle y a buen ritmo
  const isMastery = hintsUsed === 0 && tapEfficiency >= tuning.masteryEfficiency && timeShare <= 1.25;

  const isDominant =
    isMastery &&
    updated.consecutiveWinsWithoutStruggle >= 1 && // ya llevaba al menos una victoria seguida antes de esta
    tapEfficiency >= Math.max(DOMINANT_MIN_EFFICIENCY, tuning.masteryEfficiency + 0.3) &&
    timeShare <= DOMINANT_TIME_SHARE;

  let deltaRating = 0;
  if (isMastery) {
    deltaRating = Math.round(25 * performanceScore);
    updated.consecutiveWinsWithoutStruggle += MASTERY_POINTS;
    updated.consecutiveStruggles = 0;
  } else if (isStruggle) {
    deltaRating = -20;
    updated.consecutiveStruggles++;
    updated.consecutiveWinsWithoutStruggle = 0;
  } else {
    deltaRating = 10;
    updated.consecutiveWinsWithoutStruggle += WIN_POINTS;
    updated.consecutiveStruggles = 0;
  }

  updated.rating = Math.max(500, Math.min(2500, updated.rating + deltaRating));

  // Ajuste de peldaño
  let newTier = updated.currentTier;

  // Regla 1: dos atascos seguidos bajan un peldaño
  if (updated.consecutiveStruggles >= STRUGGLES_TO_DROP) {
    newTier = Math.max(MIN_TIER, updated.currentTier - 1);
    updated.consecutiveStruggles = 0;
  }
  // Regla 2: con RISE_POINTS (3 victorias buenas o 6 normales) se sube un peldaño
  // Regla 3: una victoria dominante, con otra victoria seguida detrás, salta dos peldaños
  else if (updated.consecutiveWinsWithoutStruggle >= RISE_POINTS || isDominant) {
    newTier = Math.min(MAX_TIER, updated.currentTier + (isDominant ? 2 : 1));
    updated.consecutiveWinsWithoutStruggle = 0;
  }

  updated.currentTier = newTier;

  return {
    updatedProfile: updated,
    evaluation: {
      tapEfficiency,
      expectedSeconds,
      isStruggle,
      isMastery,
      performanceScore,
      deltaRating,
      newTier,
    },
  };
}
