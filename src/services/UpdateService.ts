import { Capacitor } from '@capacitor/core';
import { RELEASES_FEEDS, UPDATE_SOURCE } from '../config';
import { UpdateInfo, apkUrl, downloadPercent, pickLatest } from '../core/updates';
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
  /** ¿Se puede descargar e instalar la actualización sin salir de la app? (Solo el APK de Android descargado de GitHub.) */
  canInstallInApp(): Promise<boolean>;
  /**
   * Descarga el APK de esa versión y abre el instalador de Android (el jugador confirma). `onProgress` recibe el
   * porcentaje (o null si aún no se sabe). Resultado: 'started' (se abrió el instalador), 'needs-permission' (se abrió el
   * ajuste para permitir instalar desde Lumihilo; hay que volver a pulsar Actualizar) o 'failed'.
   */
  install(info: UpdateInfo, onProgress: (percent: number | null) => void): Promise<'started' | 'needs-permission' | 'failed'>;
}

export class NoUpdateService implements UpdateService {
  readonly supported = false;
  async check(): Promise<UpdateCheck> {
    return { supported: false, latest: null };
  }
  async open(): Promise<void> {}
  async canInstallInApp(): Promise<boolean> {
    return false;
  }
  async install(): Promise<'started' | 'needs-permission' | 'failed'> {
    return 'failed';
  }
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

  async canInstallInApp(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') return false;
    try {
      return (await GameHaptics.updateSupport()).supported === true;
    } catch {
      return false;
    }
  }

  async install(info: UpdateInfo, onProgress: (percent: number | null) => void): Promise<'started' | 'needs-permission' | 'failed'> {
    const url = apkUrl(info.version);
    if (!url) return 'failed';
    let handle: { remove(): Promise<void> } | undefined;
    try {
      handle = await GameHaptics.addListener('updateProgress', (data) => onProgress(downloadPercent(data.received, data.total)));
      await GameHaptics.downloadUpdate({ url, version: info.version });
      onProgress(100);
      return (await GameHaptics.installUpdate({ version: info.version })).status;
    } catch {
      return 'failed';
    } finally {
      await handle?.remove().catch(() => undefined);
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
