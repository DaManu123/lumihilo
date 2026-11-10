/**
 * Reintentos de la comprobación automática de versión. Lógica pura (sin red ni Phaser) para probarla en Node.
 *
 * En un móvil recién abierto la red puede tardar en responder, y un único intento fallido dejaba toda la sesión sin
 * aviso. Tras el primer intento fallido se reintenta a los 20 s y a los 60 s; si siguen fallando, se espera a que el
 * jugador vuelva a la app o recupere la conexión.
 */
export const RETRY_DELAYS_MS: readonly number[] = [20_000, 60_000];

/** Mínimo entre dos comprobaciones al volver a la app (evita consultar cada vez que cambia de pestaña). */
export const MIN_RECHECK_MS = 60_000;

/** Espera antes del siguiente reintento tras `failures` fallos seguidos, o null si ya no se reintenta. */
export function retryDelay(failures: number): number | null {
  return failures >= 1 && failures <= RETRY_DELAYS_MS.length ? RETRY_DELAYS_MS[failures - 1] : null;
}

/** ¿Toca comprobar al volver a la app o recuperar la conexión? */
export function shouldRecheck(now: number, lastAttemptAt: number | null, lastFailed: boolean): boolean {
  if (lastAttemptAt === null) return true;
  return lastFailed || now - lastAttemptAt >= MIN_RECHECK_MS;
}

export interface LastCheck {
  at: number;
  /** null si salió bien; si no, el motivo. */
  error: string | null;
}

export function serializeLastCheck(check: LastCheck): string {
  return JSON.stringify({ at: check.at, error: check.error });
}

export function parseLastCheck(raw: string | null): LastCheck | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { at?: unknown; error?: unknown };
    if (typeof data.at !== 'number' || !Number.isFinite(data.at)) return null;
    return { at: data.at, error: typeof data.error === 'string' ? data.error.slice(0, 60) : null };
  } catch {
    return null;
  }
}
