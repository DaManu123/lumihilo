/**
 * Cambio de modo de juego (lógica pura, sin Phaser).
 *
 * Cada modo (Relajado, Normal, Reto) guarda por dónde iba el jugador en cada puzzle: su nivel y su peldaño de
 * dificultad. Al cambiar de modo se guarda el del modo que se deja y se retoma el del modo al que se vuelve; la primera
 * vez que se entra en un modo, empieza en el nivel 1 con el peldaño propio de ese modo. Así, cambiar de modo y volver
 * ya no reinicia nada.
 */

import { AdaptiveProfile, GameMode, MAX_TIER, MIN_TIER } from './adaptive';
import { PUZZLES, PuzzleType } from './puzzles';
import { ModeSnapshot, PlayerProgress, levelOf, withLevel } from './progress';

export type ModeProfiles = Record<PuzzleType, AdaptiveProfile>;

/** Peldaño con el que se empieza un modo la primera vez (a partir del que se llevaba en otro modo). */
export function firstTierFor(mode: GameMode, currentTier: number): number {
  const tier = Math.max(MIN_TIER, Math.min(MAX_TIER, currentTier));
  if (mode === 'relaxed') return 1;
  if (mode === 'challenge') return Math.max(5, tier);
  return Math.max(2, Math.min(tier, 6));
}

/** Nivel y peldaño de cada puzzle ahora mismo. */
export function snapshotOf(progress: PlayerProgress, profiles: ModeProfiles): ModeSnapshot {
  const levels = { circuits: 1, lights: 1, flow: 1 } as Record<PuzzleType, number>;
  const tiers = { circuits: 1, lights: 1, flow: 1 } as Record<PuzzleType, number>;
  for (const puzzle of PUZZLES) {
    levels[puzzle] = levelOf(progress, puzzle);
    tiers[puzzle] = profiles[puzzle].currentTier;
  }
  return { levels, tiers };
}

/**
 * Cambia al modo `to`: guarda lo del modo actual (el de los perfiles) y retoma lo del nuevo. No cambia nada si ya se
 * está en ese modo. Las rachas de victorias y atascos empiezan de cero en el modo al que se llega.
 */
export function switchGameMode(
  progress: PlayerProgress,
  profiles: ModeProfiles,
  to: GameMode
): { progress: PlayerProgress; profiles: ModeProfiles } {
  const from = profiles.circuits.mode;
  if (from === to) return { progress, profiles };
  const saved = progress.modeProgress[to];
  let next: PlayerProgress = { ...progress, modeProgress: { ...progress.modeProgress, [from]: snapshotOf(progress, profiles) } };
  const nextProfiles = { ...profiles };
  for (const puzzle of PUZZLES) {
    const profile = profiles[puzzle];
    nextProfiles[puzzle] = {
      ...profile,
      mode: to,
      currentTier: saved ? saved.tiers[puzzle] : firstTierFor(to, profile.currentTier),
      consecutiveWinsWithoutStruggle: 0,
      consecutiveStruggles: 0,
    };
    next = withLevel(next, puzzle, saved ? saved.levels[puzzle] : 1);
  }
  return { progress: next, profiles: nextProfiles };
}
