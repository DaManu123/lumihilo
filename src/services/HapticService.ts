import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export interface HapticService {
  lightTap(): Promise<void>;
  mediumTap(): Promise<void>;
  success(): Promise<void>;
}

export class NoopHapticService implements HapticService {
  async lightTap(): Promise<void> {}
  async mediumTap(): Promise<void> {}
  async success(): Promise<void> {}
}

/**
 * Vibración real: en Android usa el motor háptico del teléfono (Capacitor) y en el navegador cae a
 * la API de vibración si existe. Si el dispositivo no vibra, no pasa nada (nunca lanza errores).
 */
export class CapacitorHapticService implements HapticService {
  private async run(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch {
      // Sin motor háptico o sin permiso: se ignora
    }
  }

  lightTap(): Promise<void> {
    return this.run(() => Haptics.impact({ style: ImpactStyle.Light }));
  }

  mediumTap(): Promise<void> {
    return this.run(() => Haptics.impact({ style: ImpactStyle.Medium }));
  }

  success(): Promise<void> {
    return this.run(() => Haptics.notification({ type: NotificationType.Success }));
  }
}
