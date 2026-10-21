import { Capacitor } from '@capacitor/core';
import { StorageService, WebStorageService } from './StorageService';
import { MonetizationService, NoopMonetizationService } from './MonetizationService';
import { HapticService, NoopHapticService } from './HapticService';

export interface ServiceContainer {
  storage: StorageService;
  ads: MonetizationService;
  haptics: HapticService;
}

export function createServices(): ServiceContainer {
  const isNative = Capacitor.isNativePlatform();
  console.log(`[Services] Plataforma detectada: ${isNative ? 'Nativa (Capacitor)' : 'Web'}`);

  return {
    storage: new WebStorageService(), // TODO(fase-3): usar NativeStorageService si isNative
    ads: new NoopMonetizationService(), // TODO(fase-5): usar NativeMonetizationService si isNative
    haptics: new NoopHapticService(), // TODO(fase-4): usar NativeHapticService si isNative
  };
}
