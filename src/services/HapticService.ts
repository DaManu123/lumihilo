import { Capacitor, registerPlugin } from '@capacitor/core';
import { Haptics } from '@capacitor/haptics';
import {
  HAPTIC_PROFILES,
  HapticDiagnostics,
  HapticKind,
  HapticLevel,
  HapticMode,
  TriggerOptions,
  patternPulses,
  triggerOptions,
} from '../core/haptics';

export interface HapticService {
  lightTap(): Promise<void>;
  mediumTap(): Promise<void>;
  success(): Promise<void>;
  /** Cambia la intensidad de todas las vibraciones. */
  setLevel(level: HapticLevel): void;
  /** Cambia la vía por la que se envía la vibración al teléfono. */
  setMode(mode: HapticMode): void;
  /** Ajustes del teléfono que afectan a la vibración (solo en el APK; en el navegador devuelve null). */
  diagnose(): Promise<HapticDiagnostics | null>;
  /** Prueba la vibración de victoria con la vía actual y cuenta qué pasó. */
  test(): Promise<string>;
  /** Motivo del último cierre inesperado de la app (solo APK); cadena vacía si no hubo. */
  lastCrash?(): Promise<string>;
}

export class NoopHapticService implements HapticService {
  async lightTap(): Promise<void> {}
  async mediumTap(): Promise<void> {}
  async success(): Promise<void> {}
  setLevel(): void {}
  setMode(): void {}
  async diagnose(): Promise<HapticDiagnostics | null> {
    return null;
  }
  async test(): Promise<string> {
    return 'Sin vibración en este dispositivo.';
  }
}

interface TriggerResult {
  hasMotor: boolean;
  performed: string;
  errors: string;
}

interface GameHapticsPlugin {
  trigger(options: TriggerOptions): Promise<TriggerResult>;
  diagnose(): Promise<HapticDiagnostics>;
  lastCrash(): Promise<{ text: string }>;
}

/** Plugin nativo propio (android/.../GameHapticsPlugin.java); en el navegador no existe. */
const GameHaptics = registerPlugin<GameHapticsPlugin>('GameHaptics');

/**
 * Vibración real. En el teléfono usa el plugin nativo `GameHaptics`, que prueba varias vías a la vez
 * porque Android (sobre todo la capa de Xiaomi) puede descartar un tipo de vibración según los ajustes
 * del usuario. Si el plugin no está o falla, y en el navegador, usa la vibración genérica de Capacitor.
 * Si el dispositivo no vibra, no pasa nada: nunca lanza errores.
 */
export class CapacitorHapticService implements HapticService {
  private level: HapticLevel = 'normal';
  private mode: HapticMode = 'all';

  setLevel(level: HapticLevel): void {
    this.level = level;
  }

  setMode(mode: HapticMode): void {
    this.mode = mode;
  }

  /** Vía nativa; devuelve null si no está disponible o falla. */
  private async native(kind: HapticKind): Promise<TriggerResult | null> {
    if (!Capacitor.isNativePlatform()) return null;
    try {
      return await GameHaptics.trigger(triggerOptions(kind, this.level, this.mode));
    } catch {
      return null;
    }
  }

  /** Vibración genérica de Capacitor (navegador y respaldo del teléfono). */
  private async generic(kind: HapticKind): Promise<void> {
    const profile = HAPTIC_PROFILES[this.level];
    try {
      if (kind === 'win') {
        for (const { delay, duration } of patternPulses(profile.win)) {
          setTimeout(() => void Haptics.vibrate({ duration }).catch(() => undefined), delay);
        }
      } else {
        await Haptics.vibrate({ duration: kind === 'tap' ? profile.tap : profile.connect });
      }
    } catch {
      // Sin motor háptico o sin permiso: se ignora
    }
  }

  private async fire(kind: HapticKind): Promise<TriggerResult | null> {
    const result = await this.native(kind);
    if (!result) await this.generic(kind);
    return result;
  }

  async lightTap(): Promise<void> {
    await this.fire('tap');
  }

  async mediumTap(): Promise<void> {
    await this.fire('connect');
  }

  async success(): Promise<void> {
    await this.fire('win');
  }

  async diagnose(): Promise<HapticDiagnostics | null> {
    if (!Capacitor.isNativePlatform()) return null;
    try {
      return await GameHaptics.diagnose();
    } catch {
      return null;
    }
  }

  async lastCrash(): Promise<string> {
    if (!Capacitor.isNativePlatform()) return '';
    try {
      return (await GameHaptics.lastCrash()).text ?? '';
    } catch {
      return '';
    }
  }

  async test(): Promise<string> {
    if (!Capacitor.isNativePlatform()) {
      await this.generic('win');
      return 'Estás en el navegador: la prueba real solo funciona en el teléfono (APK).';
    }
    const result = await this.fire('win');
    if (!result) return 'El plugin de vibración del teléfono no respondió; se usó la vibración genérica.';
    const done = result.performed ? `Enviada por: ${result.performed}.` : 'No se pudo enviar por ninguna vía.';
    const failed = result.errors ? ` Errores: ${result.errors}` : '';
    return done + failed;
  }
}
