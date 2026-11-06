export interface HapticService {
  lightTap(): Promise<void>;
  mediumTap(): Promise<void>;
  success(): Promise<void>;
}

export class NoopHapticService implements HapticService {
  async lightTap(): Promise<void> {
    console.log('[NoopHapticService] lightTap() llamado');
  }

  async mediumTap(): Promise<void> {
    console.log('[NoopHapticService] mediumTap() llamado');
  }

  async success(): Promise<void> {
    console.log('[NoopHapticService] success() llamado');
  }
}

// TODO(fase-4): Implementar NativeHapticService con @capacitor/haptics
