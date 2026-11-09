import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { AdaptiveProfile, createDefaultProfile } from '../core/adaptive';
import { PlayerProgress, sanitizeProgress } from '../core/progress';
import type { HapticLevel, HapticMode } from '../core/haptics';
import type { MusicStyle } from '../core/music';
import type { AnimationSpeed } from '../core/accessibility';
import type { LanguageSetting } from '../core/i18n';
import { DEFAULT_SKIN, SkinId } from '../core/skins';
import type { PuzzleType } from '../core/puzzles';

/** Sentido en que giran las piezas al tocarlas: horario (cw) o antihorario (ccw). */
export type RotationDirection = 'cw' | 'ccw';

export interface UserSettings {
  theme: 'dark' | 'light';
  rotationDirection: RotationDirection;
  soundEnabled: boolean;
  musicEnabled: boolean;
  musicStyle: MusicStyle;
  /** Volumen de la música en porcentaje (0 a 200): 100 es el estándar. */
  musicVolume: number;
  hapticsEnabled: boolean;
  hapticsLevel: HapticLevel;
  hapticsMode: HapticMode;
  hasSeenTutorial: boolean;
  /** Trazas, bordes y textos más marcados. */
  highContrast: boolean;
  /** Marcas en las esquinas de las piezas encendidas (no depender solo del color). */
  litMarks: boolean;
  animationSpeed: AnimationSpeed;
  /** Idioma de la interfaz: el del dispositivo (auto), español o inglés. */
  language: LanguageSetting;
  /** Aspecto (paleta) equipado; solo se usa si está comprado. */
  skin: SkinId;
  /** Última versión nueva por la que ya se le preguntó al jugador (el aviso sale una sola vez por versión). */
  updatePromptedVersion: string;
  /** Puzzle al que se juega: Circuitos o Luces. */
  puzzle: PuzzleType;
  /** Ya se le explicó cómo se juega Luces. */
  hasSeenLightsTip: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  rotationDirection: 'cw',
  soundEnabled: true,
  musicEnabled: true,
  musicStyle: 'swing',
  musicVolume: 100,
  hapticsEnabled: true,
  hapticsLevel: 'normal',
  hapticsMode: 'all',
  hasSeenTutorial: false,
  highContrast: false,
  litMarks: false,
  animationSpeed: 'normal',
  language: 'auto',
  skin: DEFAULT_SKIN,
  updatePromptedVersion: '',
  puzzle: 'circuits',
  hasSeenLightsTip: false,
};

export interface StorageService {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  getAsync(key: string): Promise<string | null>;
  setAsync(key: string, value: string): Promise<void>;
}

/**
 * Servicio unificado de persistencia.
 * Utiliza memoria + localStorage para acceso síncrono rápido sin latencia en el bucle del juego,
 * y replica en segundo plano en @capacitor/preferences en entornos móviles nativos.
 */
export class HybridStorageService implements StorageService {
  private cache = new Map<string, string>();
  private isNative = Capacitor.isNativePlatform();

  constructor() {
    this.hydrateFromWeb();
  }

  private hydrateFromWeb(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            const val = localStorage.getItem(key);
            if (val !== null) {
              this.cache.set(key, val);
            }
          }
        }
      } catch (e) {
        console.warn('[StorageService] Error hidratando localStorage:', e);
      }
    }
  }

  /**
   * Sincroniza desde Preferences al iniciar en dispositivo móvil nativo.
   */
  async initNative(): Promise<void> {
    if (!this.isNative) return;
    try {
      const { keys } = await Preferences.keys();
      for (const key of keys) {
        const { value } = await Preferences.get({ key });
        if (value !== null) {
          this.cache.set(key, value);
          if (typeof localStorage !== 'undefined') {
            try {
              localStorage.setItem(key, value);
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (e) {
      console.warn('[StorageService] Error sincronizando Preferences nativo:', e);
    }
  }

  get(key: string): string | null {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const val = localStorage.getItem(key);
        if (val !== null) {
          this.cache.set(key, val);
          return val;
        }
      } catch {
        // ignore
      }
    }
    return null;
  }

  set(key: string, value: string): void {
    this.cache.set(key, value);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.warn(`[StorageService] Error escribiendo localStorage [${key}]:`, e);
      }
    }
    if (this.isNative) {
      Preferences.set({ key, value }).catch((e) => {
        console.warn(`[StorageService] Error escribiendo Preferences [${key}]:`, e);
      });
    }
  }

  remove(key: string): void {
    this.cache.delete(key);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
    if (this.isNative) {
      Preferences.remove({ key }).catch((e) => {
        console.warn(`[StorageService] Error eliminando Preferences [${key}]:`, e);
      });
    }
  }

  async getAsync(key: string): Promise<string | null> {
    if (this.cache.has(key)) return this.cache.get(key)!;
    if (this.isNative) {
      try {
        const { value } = await Preferences.get({ key });
        if (value !== null) {
          this.cache.set(key, value);
          return value;
        }
      } catch {
        // fallback
      }
    }
    return this.get(key);
  }

  async setAsync(key: string, value: string): Promise<void> {
    this.set(key, value);
    if (this.isNative) {
      await Preferences.set({ key, value });
    }
  }

  // --- Métodos tipados para el juego ---

  loadProfile(): AdaptiveProfile {
    const raw = this.get('profile_adaptive');
    if (!raw) return createDefaultProfile('normal');
    try {
      return { ...createDefaultProfile('normal'), ...JSON.parse(raw) };
    } catch {
      return createDefaultProfile('normal');
    }
  }

  saveProfile(profile: AdaptiveProfile): void {
    this.set('profile_adaptive', JSON.stringify(profile));
  }

  /** Progreso del jugador (nivel, Chispas, estadísticas, racha). Se valida al leerlo. */
  loadProgress(): PlayerProgress {
    const raw = this.get('player_progress');
    // La semilla base se genera una sola vez y se guarda, para que cada jugador tenga niveles propios
    const freshSeed = Math.floor(Math.random() * 0x7fffffff);
    let parsed: unknown = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }
    const progress = sanitizeProgress(parsed, freshSeed);
    if (!raw) this.saveProgress(progress);
    return progress;
  }

  saveProgress(progress: PlayerProgress): void {
    this.set('player_progress', JSON.stringify(progress));
  }

  loadSettings(): UserSettings {
    const raw = this.get('user_settings');
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(settings: UserSettings): void {
    this.set('user_settings', JSON.stringify(settings));
  }
}

export const storage = new HybridStorageService();
