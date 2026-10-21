export interface StorageService {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export class WebStorageService implements StorageService {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`[WebStorageService] Error reading key "${key}":`, e);
      return null;
    }
  }

  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[WebStorageService] Error writing key "${key}":`, e);
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[WebStorageService] Error removing key "${key}":`, e);
    }
  }
}

// TODO(fase-3): Implementar NativeStorageService con @capacitor/preferences
