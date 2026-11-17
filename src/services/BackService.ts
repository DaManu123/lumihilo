import { Capacitor } from '@capacitor/core';
import { GameHaptics } from './HapticService';

/**
 * «Atrás»: el botón (o gesto) de Android y la tecla Escape en computadora.
 *
 * El juego registra un único manejador que devuelve `true` si hizo algo (cerró una tarjeta o retrocedió una pantalla)
 * y `false` si ya no hay a dónde volver: en Android la app se va entonces a segundo plano, como espera cualquier
 * usuario; en web y escritorio no pasa nada.
 */
export type BackHandler = () => boolean;

/** Empieza a escuchar «atrás». Devuelve la función que deja de escuchar. */
export function listenBack(handler: BackHandler): () => void {
  const run = (): boolean => {
    try {
      return handler();
    } catch (err) {
      console.warn('[Back] Fallo al manejar «atrás»:', err);
      return true;
    }
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    run();
  };
  window.addEventListener('keydown', onKey);

  let removeNative: (() => void) | null = null;
  let stopped = false;
  if (Capacitor.isNativePlatform()) {
    GameHaptics.addListener('backButton', () => {
      if (!run()) void GameHaptics.exitApp().catch(() => undefined);
    })
      .then((handle) => {
        if (stopped) void handle.remove();
        else removeNative = () => void handle.remove();
      })
      .catch(() => undefined); // un APK viejo sin el evento: «atrás» se queda como estaba
  }

  return () => {
    stopped = true;
    window.removeEventListener('keydown', onKey);
    removeNative?.();
  };
}
