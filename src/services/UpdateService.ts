import { Capacitor } from '@capacitor/core';
import { RELEASES_REPO, UPDATE_SOURCE } from '../config';
import { UpdateInfo, pickLatest } from '../core/updates';
import { GameHaptics } from './HapticService';

/**
 * Aviso de versión nueva.
 *
 * Hoy las betas se publican en GitHub, así que la app (APK de Android y escritorio) consulta la lista de
 * publicaciones y, si hay una más nueva, la escena le pregunta una sola vez al jugador. Es una consulta
 * anónima de solo lectura: no se envía nada del jugador (solo le llega a GitHub la dirección IP, como en
 * cualquier visita). La versión web siempre está al día y no consulta nada.
 *
 * Cuando el juego pase a Google Play, `UPDATE_SOURCE` (src/config.ts) se cambia a 'play' y este servicio deja de
 * consultar GitHub: ahí las actualizaciones las gestiona Play (por ejemplo con la API de actualizaciones dentro
 * de la app). Ver docs/08-publicar-versiones.md.
 */
export interface UpdateService {
  /** Busca una versión más nueva que la instalada; null si no hay, no se puede consultar o no aplica. */
  check(): Promise<UpdateInfo | null>;
  /** Abre la página de descarga de esa versión. */
  open(info: UpdateInfo): Promise<void>;
}

export class NoUpdateService implements UpdateService {
  async check(): Promise<UpdateInfo | null> {
    return null;
  }
  async open(): Promise<void> {}
}

const TIMEOUT_MS = 6000;

export class GitHubUpdateService implements UpdateService {
  async check(): Promise<UpdateInfo | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`https://api.github.com/repos/${RELEASES_REPO}/releases?per_page=10`, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller.signal,
      });
      if (!response.ok) return null;
      return pickLatest(await response.json());
    } catch {
      return null; // sin conexión o sin respuesta: se sigue jugando sin avisar
    } finally {
      clearTimeout(timer);
    }
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
