import { describe, it, expect, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  EN,
  LANGUAGES,
  detectLanguage,
  isLanguageSetting,
  resolveLanguage,
  setLanguage,
  getLanguage,
  t,
} from '../src/core/i18n';
import { HAPTIC_LABELS, HAPTIC_MODE_LABELS, describeDiagnostics, vibrationBlockers } from '../src/core/haptics';
import { MUSIC_STYLE_LABELS } from '../src/core/music';
import { ANIMATION_LABELS } from '../src/core/accessibility';

afterEach(() => setLanguage('es'));

/** Todos los archivos .ts de src. */
function sources(dir = join(__dirname, '..', 'src')): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe('Idiomas (src/core/i18n.ts)', () => {
  it('detecta el inglés del dispositivo y usa español en cualquier otro caso', () => {
    expect(detectLanguage('en-US')).toBe('en');
    expect(detectLanguage('EN')).toBe('en');
    expect(detectLanguage('es-MX')).toBe('es');
    expect(detectLanguage('fr-FR')).toBe('es');
    expect(detectLanguage(undefined)).toBe('es');
    expect(detectLanguage(null)).toBe('es');
  });

  it('el ajuste manual manda sobre el idioma del dispositivo; "auto" lo sigue', () => {
    expect(resolveLanguage('auto', 'en-GB')).toBe('en');
    expect(resolveLanguage('auto', 'es-ES')).toBe('es');
    expect(resolveLanguage('es', 'en-US')).toBe('es');
    expect(resolveLanguage('en', 'es-ES')).toBe('en');
  });

  it('valida el ajuste guardado', () => {
    for (const l of LANGUAGES) expect(isLanguageSetting(l)).toBe(true);
    for (const bad of ['', 'fr', null, undefined, 3, {}]) expect(isLanguageSetting(bad)).toBe(false);
  });

  it('en español devuelve la frase tal cual y rellena los datos', () => {
    setLanguage('es');
    expect(t('Ajustes')).toBe('Ajustes');
    expect(t('Nivel {0}', 7)).toBe('Nivel 7');
    expect(t('{0}  (mínimo {1})', 12, 9)).toBe('12  (mínimo 9)');
  });

  it('en inglés traduce, rellena los datos y conserva el español si falta la frase', () => {
    setLanguage('en');
    expect(getLanguage()).toBe('en');
    expect(t('Ajustes')).toBe('Settings');
    expect(t('Nivel {0}', 7)).toBe('Level 7');
    expect(t('{0} toque', 1)).toBe('1 tap');
    expect(t('{0} toques', 3)).toBe('3 taps');
    expect(t('frase que no existe {0}', 1)).toBe('frase que no existe 1');
  });

  it('no deja marcadores sin rellenar ni traducciones vacías', () => {
    for (const [es, en] of Object.entries(EN)) {
      expect(en.length, es).toBeGreaterThan(0);
      const marks = (s: string) => [...s.matchAll(/\{(\d+)\}/g)].map((m) => m[1]).sort().join(',');
      expect(marks(en), `marcadores de "${es}"`).toBe(marks(es));
    }
  });

  it('cada frase del código escrita como t("…") tiene traducción al inglés', () => {
    const missing: string[] = [];
    const re = /\bt\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    for (const file of sources()) {
      if (file.endsWith('i18n.ts')) continue;
      const code = readFileSync(file, 'utf8');
      for (const m of code.matchAll(re)) {
        const phrase = m[2].replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');
        if (m[1] === '`' && phrase.includes('${')) {
          missing.push(`${file}: usa interpolación en t(): ${phrase}`);
        } else if (!(phrase in EN)) {
          missing.push(`${file}: "${phrase}"`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('las etiquetas de opciones (vibración, música, animación) tienen traducción', () => {
    const labels = [
      ...Object.values(HAPTIC_LABELS),
      ...Object.values(HAPTIC_MODE_LABELS),
      ...Object.values(MUSIC_STYLE_LABELS),
      ...Object.values(ANIMATION_LABELS),
    ];
    for (const label of labels) expect(label in EN, label).toBe(true);
  });

  it('el diagnóstico de vibración se traduce entero', () => {
    const d = {
      sdk: 36, manufacturer: 'Xiaomi', model: '24069PC21G', hasMotor: true, hasAmplitudeControl: true,
      hapticFeedbackEnabled: 0, touchIntensity: 2, mediaIntensity: 0, notificationIntensity: 1, ringIntensity: 3,
      ringerMode: 0, interruptionFilter: 3, powerSave: true,
    };
    setLanguage('en');
    const lines = describeDiagnostics(d);
    expect(lines[0]).toBe('Phone: Xiaomi 24069PC21G (Android API 36)');
    expect(lines[1]).toBe('Vibration motor: Yes (with strength control)');
    expect(lines[8]).toBe('Battery saver: Yes');
    const text = [...lines, ...vibrationBlockers(d)].join('\n');
    expect(/[áéíóúñ¿¡]/.test(text), text).toBe(false);
  });
});
