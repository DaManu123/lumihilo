import { Capacitor } from '@capacitor/core';
import { RELEASES_FEEDS, UPDATE_SOURCE } from '../config';
import { UpdateInfo, pickLatest } from '../core/updates';
import { GameHaptics } from './HapticService';

/**
 * Aviso de versión nueva.
 *
 * Hoy las betas se publican en GitHub, así que la app (APK de Android y escritorio) lee la lista de versiones
 * publicadas y, si hay una más nueva, la escena se lo ofrece al jugador cada vez que abre la app. Es una consulta
 * anónima de solo lectura: no se envía nada del jugador (a GitHub solo le llega la dirección IP, como en cualquier
 * visita). La versión web siempre está al día y no consulta nada.
 *
 * Cuando el juego pase a Google Play, `UPDATE_SOURCE` (src/config.ts) se cambia a 'play' y este servicio deja de
 * consultar GitHub: ahí las actualizaciones las gestiona Play (por ejemplo con la API de actualizaciones dentro de la
 * app). Ver docs/08-publicar-versiones.md.
 */
export interface UpdateCheck {
  /** Si este dispositivo consulta versiones (la web y las builds de Play, no). */
  supported: boolean;
  /** La versión más alta publicada, o null si no se pudo saber. */
  latest: UpdateInfo | null;
  /** Por qué falló la consulta (para mostrarlo al jugador cuando la lanza a mano). */
  error?: string;
}

export interface UpdateService {
  readonly supported: boolean;
  check(): Promise<UpdateCheck>;
  /** Abre la página de descarga de esa versión. */
  open(info: UpdateInfo): Promise<void>;
}

export class NoUpdateService implements UpdateService {
  readonly supported = false;
  async check(): Promise<UpdateCheck> {
    return { supported: false, latest: null };
  }
  async open(): Promise<void> {}
}

const TIMEOUT_MS = 7000;

export class GitHubUpdateService implements UpdateService {
  readonly supported = true;

  async check(): Promise<UpdateCheck> {
    let error = 'sin respuesta';
    for (const url of RELEASES_FEEDS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) {
          error = `HTTP ${response.status}`;
          continue;
        }
        const data: unknown = await response.json();
        if (Array.isArray(data)) return { supported: true, latest: pickLatest(data) };
        error = 'datos no válidos';
      } catch (e) {
        error = e instanceof Error && e.name === 'AbortError' ? 'tiempo agotado' : 'sin conexión';
      } finally {
        clearTimeout(timer);
      }
    }
    return { supported: true, latest: null, error };
  }

  async open(info: UpdateInfo): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) await GameHaptics.openUrl({ url: info.url });
      else window.open(info.url, '_blank', 'noopener');
    } catch {
      // si no se puede abrir, no pasa nada
    }
  }
}

/** ¿Es la app de escritorio (Electron)? */
function isDesktopApp(): boolean {
  return typeof navigator !== 'undefined' && /Electron\//.test(navigator.userAgent);
}

/** Para las pruebas de navegador: `?debug&update` activa la consulta también en la web. */
function forcedByDebug(): boolean {
  return typeof location !== 'undefined' && /[?&]debug\b/.test(location.search) && /[?&]update\b/.test(location.search);
}

export function createUpdateService(): UpdateService {
  if (UPDATE_SOURCE !== 'github') return new NoUpdateService();
  if (Capacitor.isNativePlatform() || isDesktopApp() || forcedByDebug()) return new GitHubUpdateService();
  return new NoUpdateService();
}
