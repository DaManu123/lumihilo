import { Capacitor } from '@capacitor/core';
import { HybridStorageService, storage } from './StorageService';
import { MonetizationService, NoopMonetizationService } from './MonetizationService';
import { HapticService, NoopHapticService } from './HapticService';

export * from './StorageService';
export * from './MonetizationService';
export * from './HapticService';

export interface ServiceContainer {
  storage: HybridStorageService;
  ads: MonetizationService;
  haptics: HapticService;
}

export function createServices(): ServiceContainer {
  const isNative = Capacitor.isNativePlatform();
  console.log(`[Services] Plataforma detectada: ${isNative ? 'Nativa (Capacitor)' : 'Web'}`);

  if (isNative) {
    storage.initNative().catch((err) => {
      console.warn('[Services] Fallo al sincronizar almacenamiento nativo:', err);
    });
  }

  return {
    storage,
    ads: new NoopMonetizationService(),
    haptics: new NoopHapticService(),
  };
}
