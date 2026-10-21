export interface AdService {
  showBanner(): Promise<void>;
  hideBanner(): Promise<void>;
  showInterstitial(): Promise<boolean>;
  showRewarded(): Promise<boolean>;
}

export class NoopAdService implements AdService {
  async showBanner(): Promise<void> {
    console.log('[NoopAdService] showBanner() llamado');
  }

  async hideBanner(): Promise<void> {
    console.log('[NoopAdService] hideBanner() llamado');
  }

  async showInterstitial(): Promise<boolean> {
    console.log('[NoopAdService] showInterstitial() llamado');
    return true;
  }

  async showRewarded(): Promise<boolean> {
    console.log('[NoopAdService] showRewarded() llamado');
    return true;
  }
}

// TODO(fase-5): Implementar NativeAdService con plugin oficial de AdMob para Capacitor
