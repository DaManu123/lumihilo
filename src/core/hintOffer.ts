import { HINT_COST } from './progress';

/**
 * Qué cuesta la siguiente pista (lógica pura).
 *
 * - **La primera pista de cada nivel es gratis.** Sigue contando como pista: quita los bonos de Chispas y una estrella,
 *   así que resolverlo solo siempre paga más.
 * - Las siguientes cuestan `HINT_COST` Chispas.
 * - **Nadie se queda atascado sin salida:** si no alcanzan las Chispas, la pista se recarga sola y sale gratis cada
 *   `HINT_RECHARGE_SECONDS` segundos de juego.
 */
export const HINT_RECHARGE_SECONDS = 30;

export interface HintOfferInput {
  /** Pistas usadas ya en este nivel. */
  hintsUsed: number;
  sparks: number;
  /** Segundos de juego desde la última pista de este nivel (da igual si aún no se usó ninguna). */
  secondsSinceLastHint: number;
}

export interface HintOffer {
  /** Chispas que cuesta (0 = gratis). */
  cost: number;
  /** Segundos que faltan para poder usarla (0 = disponible ya). */
  waitSeconds: number;
}

export function hintOffer(input: HintOfferInput): HintOffer {
  if (input.hintsUsed <= 0) return { cost: 0, waitSeconds: 0 };
  if (input.sparks >= HINT_COST) return { cost: HINT_COST, waitSeconds: 0 };
  const since = Number.isFinite(input.secondsSinceLastHint) ? Math.max(0, Math.floor(input.secondsSinceLastHint)) : 0;
  return { cost: 0, waitSeconds: Math.max(0, HINT_RECHARGE_SECONDS - since) };
}

/** Segundos sin jugadas tras los que se le recuerda al jugador que existe la pista (una vez por nivel). */
export const IDLE_NUDGE_SECONDS = 30;

/** ¿Toca recordarle la pista? Solo una vez por nivel, tras un rato sin mover nada y con la partida en marcha. */
export function shouldNudgeHint(input: { secondsIdle: number; alreadyNudged: boolean; isWon: boolean; hintsUsed: number }): boolean {
  return !input.alreadyNudged && !input.isWon && input.hintsUsed === 0 && input.secondsIdle >= IDLE_NUDGE_SECONDS;
}
