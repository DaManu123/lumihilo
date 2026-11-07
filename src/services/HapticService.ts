import { Haptics } from '@capacitor/haptics';
import { HAPTIC_PROFILES, HapticLevel, patternPulses } from '../core/haptics';

export interface HapticService {
  lightTap(): Promise<void>;
  mediumTap(): Promise<void>;
  success(): Promise<void>;
  /** Cambia la intensidad de todas las vibraciones. */
  setLevel(level: HapticLevel): void;
}

export class NoopHapticService implements HapticService {
  async lightTap(): Promise<void> {}
  async mediumTap(): Promise<void> {}
  async success(): Promise<void> {}
  setLevel(): void {}
}

/**
 * Vibración real: en Android usa el motor del teléfono (Capacitor) y en el navegador cae a la API de
 * vibración si existe. Usa pulsos de potencia plena y regula la intensidad por duración, porque los
 * efectos predefinidos "ligero" y "medio" de Android (43 % y 70 % de potencia) apenas se notan en
 * muchos teléfonos. Si el dispositivo no vibra, no pasa nada (nunca lanza errores).
 */
export class CapacitorHapticService implements HapticService {
  private level: HapticLevel = 'normal';

  setLevel(level: HapticLevel): void {
    this.level = level;
  }

  private async pulse(duration: number): Promise<void> {
    try {
      await Haptics.vibrate({ duration });
    } catch {
      // Sin motor háptico o sin permiso: se ignora
    }
  }

  lightTap(): Promise<void> {
    return this.pulse(HAPTIC_PROFILES[this.level].tap);
  }

  mediumTap(): Promise<void> {
    return this.pulse(HAPTIC_PROFILES[this.level].connect);
  }

  async success(): Promise<void> {
    // Un patrón de pulsos: el plugin solo ofrece pulsos sueltos, así que se encadenan con temporizadores
    for (const { delay, duration } of patternPulses(HAPTIC_PROFILES[this.level].win)) {
      setTimeout(() => void this.pulse(duration), delay);
    }
  }
}
