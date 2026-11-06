export interface MonetizationService {
  showBanner(): Promise<void>;
  hideBanner(): Promise<void>;
  showInterstitial(): Promise<boolean>;
  showRewarded(): Promise<boolean>;
}

// Alias de conveniencia para coincidir con la documentación técnica
export type AdService = MonetizationService;

export class NoopMonetizationService implements MonetizationService {
  async showBanner(): Promise<void> {
    console.log('[NoopMonetizationService] showBanner() llamado');
  }

  async hideBanner(): Promise<void> {
    console.log('[NoopMonetizationService] hideBanner() llamado');
  }

  async showInterstitial(): Promise<boolean> {
    console.log('[NoopMonetizationService] showInterstitial() llamado');
    return true;
  }

  async showRewarded(): Promise<boolean> {
    console.log('[NoopMonetizationService] showRewarded() llamado');
    return true;
  }
}

export { NoopMonetizationService as NoopAdService };

// TODO(fase-5): Implementar NativeMonetizationService con plugin oficial de AdMob para Capacitor
