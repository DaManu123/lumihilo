import { LevelParams } from './types';

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
  1: { width: 4, height: 4, extraLoops: 0, branchBias: 0.5 },
  2: { width: 4, height: 4, extraLoops: 1, branchBias: 0.55 },
  3: { width: 4, height: 4, extraLoops: 2, branchBias: 0.6 },
  4: { width: 5, height: 5, extraLoops: 1, branchBias: 0.5 },
  5: { width: 5, height: 5, extraLoops: 2, branchBias: 0.6 },
  6: { width: 5, height: 5, extraLoops: 3, branchBias: 0.65 },
  7: { width: 6, height: 6, extraLoops: 2, branchBias: 0.6 },
  8: { width: 6, height: 6, extraLoops: 3, branchBias: 0.7 },
  9: { width: 6, height: 6, extraLoops: 4, branchBias: 0.75 },
  10: { width: 7, height: 7, extraLoops: 4, branchBias: 0.8 },
};

export const MIN_TIER = 1;
export const MAX_TIER = 10;

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
 * Obtiene los parámetros de nivel apropiados según el modo y el nivel del perfil.
 */
export function getLevelParamsForProfile(profile: AdaptiveProfile): LevelParams {
  if (profile.mode === 'relaxed') {
    // En modo relajado se mantiene en 4x4 (tiers 1 a 3, aumentando solo los bucles)
    const tier = Math.min(profile.currentTier, 3);
    return DIFFICULTY_TIERS[tier] || DIFFICULTY_TIERS[1];
  }

  if (profile.mode === 'challenge') {
    // En modo reto arranca mínimo en tier 5 y escala hasta 10
    const tier = Math.max(5, Math.min(profile.currentTier, MAX_TIER));
    return DIFFICULTY_TIERS[tier] || DIFFICULTY_TIERS[5];
  }

  // Modo normal: sigue el tier actual
  const tier = Math.max(MIN_TIER, Math.min(profile.currentTier, MAX_TIER));
  return DIFFICULTY_TIERS[tier] || DIFFICULTY_TIERS[2];
}

/**
 * Evalúa el resultado de una partida y actualiza el perfil adaptativo.
 * 
 * Reglas de salida verificables:
 * 1. "Nadie se atora más de 3 niveles seguidos sin que baje la dificultad":
 *    Si consecutiveStruggles >= 3, baja el tier automáticamente.
 * 2. "Nadie resuelve 5 seguidos sin que suba la dificultad":
 *    Si consecutiveWinsWithoutStruggle >= 5, sube el tier automáticamente.
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
    if (updated.consecutiveStruggles >= 3) {
      newTier = Math.max(MIN_TIER, updated.currentTier - 1);
      updated.currentTier = newTier;
      updated.consecutiveStruggles = 0;
    }

    return {
      updatedProfile: updated,
      evaluation: {
        tapEfficiency: 0,
        isStruggle: true,
        isMastery: false,
        performanceScore: 0,
        deltaRating: -50,
        newTier,
      },
    };
  }

  updated.gamesWon++;

  const safeActualTaps = Math.max(result.actualTaps, 1);
  const safeMinTaps = Math.max(result.minTaps, 1);
  const tapEfficiency = Math.min(1.0, safeMinTaps / safeActualTaps);

  // Tiempo esperado de referencia según toques mínimos (≈ 2.5 seg por toque óptimo)
  const expectedSeconds = Math.max(12, safeMinTaps * 2.5);
  const timeFactor = Math.min(2.0, expectedSeconds / Math.max(result.elapsedSeconds, 4));

  // Puntuación combinada de rendimiento
  const performanceScore = tapEfficiency * 0.6 + Math.min(timeFactor, 1.5) * 0.4;

  // Criterios de atasco (Struggle):
  // - Necesitó más de 3.2x los toques mínimos Y tardó más del doble del tiempo esperado.
  // - O usó más de 2 pistas.
  // En modo relajado nunca se considera atasco (sin penalización por lentitud ni reintentos).
  const isStruggle =
    updated.mode !== 'relaxed' &&
    ((safeActualTaps >= safeMinTaps * 3.2 && result.elapsedSeconds > expectedSeconds * 1.8) ||
    (result.hintsUsed !== undefined && result.hintsUsed >= 2));

  // Criterio de maestría:
  // - Eficiencia de toques >= 0.7 y tiempo dentro de lo esperado
  const isMastery = tapEfficiency >= 0.7 && result.elapsedSeconds <= expectedSeconds * 1.25;

  let deltaRating = 0;
  if (isMastery) {
    deltaRating = Math.round(25 * performanceScore);
    updated.consecutiveWinsWithoutStruggle++;
    updated.consecutiveStruggles = 0;
  } else if (isStruggle) {
    deltaRating = -20;
    updated.consecutiveStruggles++;
    updated.consecutiveWinsWithoutStruggle = 0;
  } else {
    deltaRating = 10;
    updated.consecutiveWinsWithoutStruggle++;
    updated.consecutiveStruggles = 0;
  }

  updated.rating = Math.max(500, Math.min(2500, updated.rating + deltaRating));

  // Ajuste de Tiers
  let newTier = updated.currentTier;

  // Regla 1: Invariante de atasco (3 partidas atorado forzan bajada)
  if (updated.consecutiveStruggles >= 3) {
    newTier = Math.max(MIN_TIER, updated.currentTier - 1);
    updated.consecutiveStruggles = 0;
  }
  // Regla 2: Invariante de racha (5 victorias seguidas sin atasco forzan subida)
  else if (updated.consecutiveWinsWithoutStruggle >= 5) {
    newTier = Math.min(MAX_TIER, updated.currentTier + 1);
    updated.consecutiveWinsWithoutStruggle = 0;
  }
  // Subida ágil por maestría excepcional consecutiva
  else if (isMastery && updated.consecutiveWinsWithoutStruggle >= 3 && updated.rating > 1050 + updated.currentTier * 50) {
    newTier = Math.min(MAX_TIER, updated.currentTier + 1);
    updated.consecutiveWinsWithoutStruggle = 0;
  }

  updated.currentTier = newTier;

  return {
    updatedProfile: updated,
    evaluation: {
      tapEfficiency,
      isStruggle,
      isMastery,
      performanceScore,
      deltaRating,
      newTier,
    },
  };
}
