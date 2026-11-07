import { Capacitor } from '@capacitor/core';
import { HybridStorageService, storage } from './StorageService';
import { MonetizationService, NoopMonetizationService } from './MonetizationService';
import { CapacitorHapticService, HapticService } from './HapticService';
import { AudioService, WebAudioService } from './AudioService';
import { FeedbackService } from './FeedbackService';

export * from './StorageService';
export * from './MonetizationService';
export * from './HapticService';
export * from './AudioService';
export * from './FeedbackService';

/** Sonido y vibración compartidos por todo el juego. */
export const audio: AudioService = new WebAudioService();
export const haptics: HapticService = new CapacitorHapticService();
export const feedback = new FeedbackService(audio, haptics);

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
    haptics,
  };
}
