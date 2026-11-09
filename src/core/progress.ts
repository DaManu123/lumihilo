import { LevelParams } from './types';
import { DIFFICULTY_TIERS } from './adaptive';
import { SkinId, sanitizeUnlockedSkins } from './skins';

/**
 * Progreso persistente del jugador (Fase 4): nivel actual, Chispas, estadísticas, racha y reto diario.
 * 100 % TypeScript puro (sin Phaser ni DOM) para poder probarlo en Node.
 */

export const HINT_COST = 10;
export const STARTING_SPARKS = 30;

export interface PlayerStats {
  levelsSolved: number;
  perfectSolves: number;
  dailyCompleted: number;
  /** Mejor tiempo (segundos) por tier de dificultad; el tiempo solo es comparable dentro de un mismo tier. */
  bestTimeByTier: Record<string, number>;
}

export interface StreakState {
  current: number;
  best: number;
  /** Último día (YYYY-MM-DD, hora local) con al menos un nivel resuelto. */
  lastActiveDate: string | null;
}

export interface PlayerProgress {
  /** Semilla base aleatoria (se genera una vez por jugador) para que no repita los mismos niveles. */
  seedBase: number;
  currentLevel: number;
  /** Nivel por el que va en el puzzle Luces (el de Circuitos es `currentLevel`). */
  lightsLevel: number;
  sparks: number;
  stats: PlayerStats;
  streak: StreakState;
  /** Último día en que se completó el reto diario (solo cuenta la primera vez de cada día). */
  lastDailyCompleted: string | null;
  /** Último día en que se completó el reto diario de Luces (cada puzzle tiene el suyo). */
  lastLightsDailyCompleted: string | null;
  /** Aspectos comprados (el inicial siempre está disponible y no se guarda). */
  unlockedSkins: SkinId[];
}

export function createDefaultProgress(seedBase: number): PlayerProgress {
  return {
    seedBase: seedBase >>> 0,
    currentLevel: 1,
    lightsLevel: 1,
    sparks: STARTING_SPARKS,
    stats: { levelsSolved: 0, perfectSolves: 0, dailyCompleted: 0, bestTimeByTier: {} },
    streak: { current: 0, best: 0, lastActiveDate: null },
    lastDailyCompleted: null,
    lastLightsDailyCompleted: null,
    unlockedSkins: [],
  };
}

// ---------------------------------------------------------------------------
// Validación de datos guardados (el almacenamiento puede estar corrupto o ser de una versión antigua)
// ---------------------------------------------------------------------------

function toInt(value: unknown, fallback: number, min = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.floor(value))
    : fallback;
}

function toDateKey(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function sanitizeProgress(raw: unknown, fallbackSeedBase: number): PlayerProgress {
  const base = createDefaultProgress(fallbackSeedBase);
  if (typeof raw !== 'object' || raw === null) return base;
  const r = raw as Record<string, unknown>;
  const stats = (typeof r.stats === 'object' && r.stats !== null ? r.stats : {}) as Record<string, unknown>;
  const streak = (typeof r.streak === 'object' && r.streak !== null ? r.streak : {}) as Record<string, unknown>;

  const bestTimeByTier: Record<string, number> = {};
  if (typeof stats.bestTimeByTier === 'object' && stats.bestTimeByTier !== null) {
    for (const [tier, seconds] of Object.entries(stats.bestTimeByTier as Record<string, unknown>)) {
      if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0) {
        bestTimeByTier[tier] = Math.floor(seconds);
      }
    }
  }

  const current = toInt(streak.current, 0);
  return {
    seedBase: toInt(r.seedBase, base.seedBase) >>> 0,
    currentLevel: toInt(r.currentLevel, 1, 1),
    lightsLevel: toInt(r.lightsLevel, 1, 1),
    sparks: toInt(r.sparks, STARTING_SPARKS),
    stats: {
      levelsSolved: toInt(stats.levelsSolved, 0),
      perfectSolves: toInt(stats.perfectSolves, 0),
      dailyCompleted: toInt(stats.dailyCompleted, 0),
      bestTimeByTier,
    },
    streak: {
      current,
      best: Math.max(current, toInt(streak.best, 0)),
      lastActiveDate: toDateKey(streak.lastActiveDate),
    },
    lastDailyCompleted: toDateKey(r.lastDailyCompleted),
    lastLightsDailyCompleted: toDateKey(r.lastLightsDailyCompleted),
    unlockedSkins: sanitizeUnlockedSkins(r.unlockedSkins),
  };
}

// ---------------------------------------------------------------------------
// Fechas, racha y reto diario
// ---------------------------------------------------------------------------

/** Clave de día "YYYY-MM-DD" en hora local. */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function keyToUtcMs(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Días de calendario entre dos claves (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((keyToUtcMs(b) - keyToUtcMs(a)) / 86_400_000);
}

/**
 * Registra actividad (un nivel resuelto) en el día indicado.
 * - Mismo día: no cambia. Día siguiente: +1. Hueco mayor a un día: vuelve a 1.
 * - Si el reloj del dispositivo retrocede, no se rompe la racha.
 */
export function registerActivity(streak: StreakState, today: string): StreakState {
  if (streak.lastActiveDate === null) {
    return { current: 1, best: Math.max(1, streak.best), lastActiveDate: today };
  }
  const diff = daysBetween(streak.lastActiveDate, today);
  if (diff <= 0) return streak;
  const current = diff === 1 ? streak.current + 1 : 1;
  return { current, best: Math.max(streak.best, current), lastActiveDate: today };
}

/**
 * Racha que se debe mostrar hoy: si ya pasó más de un día sin jugar, la racha está rota
 * (aunque el valor guardado solo se reinicie al volver a resolver un nivel).
 */
export function currentStreak(streak: StreakState, today: string): number {
  if (streak.lastActiveDate === null) return 0;
  return daysBetween(streak.lastActiveDate, today) > 1 ? 0 : streak.current;
}

/** Hash FNV-1a de 32 bits (determinista y estable entre plataformas). */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Semilla del reto diario: la misma para todos los jugadores que compartan la fecha. */
export function dailySeed(key: string): number {
  return fnv1a(`puzzle-adaptativo:daily:${key}`);
}

/** Semilla del reto diario de Luces (distinta de la de Circuitos para que no se parezcan). */
export function dailyLightsSeed(key: string): number {
  return fnv1a(`puzzle-adaptativo:daily-lights:${key}`);
}

/** Tier del reto diario según el día de la semana (0 = domingo): sube de lunes a sábado. */
const DAILY_TIER_BY_WEEKDAY = [6, 3, 4, 5, 6, 7, 8];

export function dailyTier(key: string): number {
  const weekday = new Date(keyToUtcMs(key)).getUTCDay();
  return DAILY_TIER_BY_WEEKDAY[weekday];
}

/** Parámetros del reto diario: no dependen del jugador, para que el puzzle sea idéntico para todos. */
export function dailyParams(key: string): LevelParams {
  return DIFFICULTY_TIERS[dailyTier(key)];
}

/** Semilla de un nivel normal: depende de la semilla base del jugador para no repetir niveles. */
export function levelSeed(seedBase: number, level: number): number {
  return (seedBase + level * 7919) >>> 0;
}

// ---------------------------------------------------------------------------
// Chispas de Energía
// ---------------------------------------------------------------------------

export interface RewardInput {
  tier: number;
  /** minTaps / toques reales (0 a 1). */
  tapEfficiency: number;
  elapsedSeconds: number;
  minTaps: number;
  hintsUsed: number;
  isNewRecord: boolean;
  /** 1 = normal, 2 = primera vez que se completa el reto diario de hoy, 0 = repetición sin recompensa. */
  multiplier: number;
}

export interface SparksReward {
  base: number;
  efficiencyBonus: number;
  speedBonus: number;
  recordBonus: number;
  multiplier: number;
  total: number;
}

/** Chispas ganadas por resolver un nivel, con bonos por eficiencia, rapidez y récord personal. */
export function computeSparksReward(input: RewardInput): SparksReward {
  const base = 5 + Math.max(1, Math.floor(input.tier));

  // Sin bonos de eficiencia ni rapidez si se usaron pistas: premian resolverlo uno mismo
  let efficiencyBonus = 0;
  if (input.hintsUsed === 0) {
    if (input.tapEfficiency >= 0.99) efficiencyBonus = 10;
    else if (input.tapEfficiency >= 0.8) efficiencyBonus = 5;
    else if (input.tapEfficiency >= 0.6) efficiencyBonus = 2;
  }

  const expectedSeconds = Math.max(12, input.minTaps * 2.5);
  // La rapidez también exige no haber usado pistas (con ayuda, un nivel sale en segundos)
  const speedBonus = input.hintsUsed === 0 && input.elapsedSeconds <= expectedSeconds ? 5 : 0;
  const recordBonus = input.isNewRecord ? 5 : 0;

  const multiplier = Math.max(0, input.multiplier);
  const total = Math.round((base + efficiencyBonus + speedBonus + recordBonus) * multiplier);
  return { base, efficiencyBonus, speedBonus, recordBonus, multiplier, total };
}

/** ¿Este tiempo mejora el mejor tiempo del jugador en ese tier? (el primer nivel del tier no cuenta como récord). */
export function isNewTimeRecord(progress: PlayerProgress, tier: number, elapsedSeconds: number, recordKey = String(tier)): boolean {
  const best = progress.stats.bestTimeByTier[recordKey];
  return best !== undefined && elapsedSeconds < best;
}

export interface LevelOutcome {
  tier: number;
  elapsedSeconds: number;
  tapEfficiency: number;
  sparksEarned: number;
  hintsUsed: number;
  isDaily: boolean;
  /** El reto diario completado es el de Luces (lleva su propia fecha de «hecho hoy»). */
  lightsDaily?: boolean;
  today: string;
  /** Clave del récord de tiempo; por defecto, el nivel de habilidad (el puzzle Luces usa la suya). */
  recordKey?: string;
}

/** Aplica el resultado de un nivel resuelto al progreso (estadísticas, Chispas, racha y reto diario). */
export function applyLevelOutcome(progress: PlayerProgress, outcome: LevelOutcome): PlayerProgress {
  const key = outcome.recordKey ?? String(outcome.tier);
  const best = progress.stats.bestTimeByTier[key];
  const bestTimeByTier = { ...progress.stats.bestTimeByTier };
  // Los récords y las resoluciones "perfectas" solo cuentan si se resolvió sin pistas
  const withoutHints = outcome.hintsUsed === 0;
  if (withoutHints && (best === undefined || outcome.elapsedSeconds < best)) {
    bestTimeByTier[key] = Math.max(1, Math.floor(outcome.elapsedSeconds));
  }

  const lastDaily = outcome.lightsDaily ? progress.lastLightsDailyCompleted : progress.lastDailyCompleted;
  const firstDailyToday = outcome.isDaily && lastDaily !== outcome.today;

  return {
    ...progress,
    sparks: progress.sparks + outcome.sparksEarned,
    stats: {
      levelsSolved: progress.stats.levelsSolved + 1,
      perfectSolves: progress.stats.perfectSolves + (withoutHints && outcome.tapEfficiency >= 0.99 ? 1 : 0),
      dailyCompleted: progress.stats.dailyCompleted + (firstDailyToday ? 1 : 0),
      bestTimeByTier,
    },
    streak: registerActivity(progress.streak, outcome.today),
    lastDailyCompleted: firstDailyToday && !outcome.lightsDaily ? outcome.today : progress.lastDailyCompleted,
    lastLightsDailyCompleted: firstDailyToday && outcome.lightsDaily ? outcome.today : progress.lastLightsDailyCompleted,
  };
}

/** Texto compacto del saldo para que quepa en el encabezado (p. ej. 12500 → "12k"). */
export function formatSparks(sparks: number): string {
  return sparks >= 10_000 ? `${Math.floor(sparks / 1000)}k` : String(sparks);
}

/** Gasta Chispas; devuelve null si no alcanzan. */
export function spendSparks(progress: PlayerProgress, cost: number): PlayerProgress | null {
  if (progress.sparks < cost) return null;
  return { ...progress, sparks: progress.sparks - cost };
}
