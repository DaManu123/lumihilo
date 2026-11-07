import { describe, it, expect } from 'vitest';
import { THEME_DARK, THEME_LIGHT, THEME_DARK_HC, THEME_LIGHT_HC, GameTheme, getTheme } from '../src/game/theme';
import { contrastRatio, mixColors, toCss, luminance } from '../src/game/color';

const cssToNumber = (css: string) => parseInt(css.replace('#', ''), 16);

describe('Utilidades de color (src/game/color.ts)', () => {
  it('calcula la relación de contraste WCAG', () => {
    expect(contrastRatio(0x000000, 0xffffff)).toBeCloseTo(21, 0);
    expect(contrastRatio(0xffffff, 0xffffff)).toBeCloseTo(1, 5);
    // Es simétrica
    expect(contrastRatio(0x336699, 0xffcc00)).toBeCloseTo(contrastRatio(0xffcc00, 0x336699), 10);
  });

  it('la luminancia va de 0 (negro) a 1 (blanco)', () => {
    expect(luminance(0x000000)).toBe(0);
    expect(luminance(0xffffff)).toBeCloseTo(1, 5);
  });

  it('mezcla colores y limita t entre 0 y 1', () => {
    expect(mixColors(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixColors(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mixColors(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mixColors(0x102030, 0xffffff, -3)).toBe(0x102030);
    expect(mixColors(0x102030, 0xffffff, 9)).toBe(0xffffff);
  });

  it('convierte a CSS con ceros a la izquierda', () => {
    expect(toCss(0x0b1026)).toBe('#0b1026');
    expect(toCss(0x000fff)).toBe('#000fff');
  });
});

describe('Accesibilidad de los temas', () => {
  const themes: Array<[string, GameTheme]> = [
    ['Noche (dark)', THEME_DARK],
    ['Papel (light)', THEME_LIGHT],
  ];

  for (const [name, t] of themes) {
    describe(name, () => {
      const text = cssToNumber(t.text);
      const muted = cssToNumber(t.mutedText);
      const onPrimary = cssToNumber(t.onPrimary);

      it('el texto principal es legible sobre el fondo y el vidrio (≥ 7:1)', () => {
        expect(contrastRatio(text, t.background)).toBeGreaterThanOrEqual(7);
        expect(contrastRatio(text, t.surface)).toBeGreaterThanOrEqual(7);
      });

      it('el texto atenuado cumple AA (≥ 4,5:1) sobre fondo y vidrio', () => {
        expect(contrastRatio(muted, t.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(muted, t.surface)).toBeGreaterThanOrEqual(4.5);
      });

      it('las formas de interfaz importantes superan 3:1 contra el vidrio', () => {
        expect(contrastRatio(t.wireOff, t.surface), 'traza apagada').toBeGreaterThanOrEqual(3);
        expect(contrastRatio(t.primary, t.surface), 'filamento').toBeGreaterThanOrEqual(3);
        expect(contrastRatio(t.accent, t.surface), 'fuente').toBeGreaterThanOrEqual(3);
        expect(contrastRatio(t.clockwise, t.surface), 'horario').toBeGreaterThanOrEqual(3);
        expect(contrastRatio(t.counterClockwise, t.surface), 'antihorario').toBeGreaterThanOrEqual(3);
      });

      it('el texto sobre botones rellenos de filamento cumple AA (≥ 4,5:1)', () => {
        expect(contrastRatio(onPrimary, t.primary)).toBeGreaterThanOrEqual(4.5);
      });

      it('el cable encendido se distingue del apagado también por luminancia', () => {
        // Además hay pistas que no dependen del color: grosor, halo y núcleo brillante
        expect(contrastRatio(t.primary, t.wireOff)).toBeGreaterThanOrEqual(1.6);
      });

      it('los dos sentidos de giro y la fuente tienen colores distintos', () => {
        const colors = new Set([t.clockwise, t.counterClockwise, t.accent, t.primary]);
        expect(colors.size).toBe(4);
      });

      it('los colores CSS coinciden con sus equivalentes numéricos', () => {
        expect(cssToNumber(t.primaryCss)).toBe(t.primary);
        expect(cssToNumber(t.accentCss)).toBe(t.accent);
        expect(cssToNumber(t.clockwiseCss)).toBe(t.clockwise);
        expect(cssToNumber(t.counterClockwiseCss)).toBe(t.counterClockwise);
        expect(cssToNumber(t.surfaceCss)).toBe(t.surface);
        expect(cssToNumber(t.backgroundCss)).toBe(t.background);
      });
    });
  }
});

describe('Temas de alto contraste', () => {
  const pairs: Array<[string, GameTheme, GameTheme]> = [
    ['Noche', THEME_DARK, THEME_DARK_HC],
    ['Papel', THEME_LIGHT, THEME_LIGHT_HC],
  ];

  for (const [name, normal, hc] of pairs) {
    describe(name, () => {
      it('getTheme devuelve la variante de alto contraste solo si se pide', () => {
        expect(getTheme(normal.name, true)).toBe(hc);
        expect(getTheme(normal.name, false)).toBe(normal);
        expect(getTheme(normal.name)).toBe(normal);
      });

      it('conserva la identidad del tema (nombre, fondo, filamento y fuente)', () => {
        expect(hc.name).toBe(normal.name);
        expect(hc.background).toBe(normal.background);
        expect(hc.primary).toBe(normal.primary);
        expect(hc.accent).toBe(normal.accent);
      });

      it('texto y texto atenuado superan 7:1 sobre fondo y vidrio', () => {
        for (const css of [hc.text, hc.mutedText]) {
          expect(contrastRatio(cssToNumber(css), hc.background)).toBeGreaterThanOrEqual(7);
          expect(contrastRatio(cssToNumber(css), hc.surface)).toBeGreaterThanOrEqual(7);
        }
      });

      it('las trazas apagadas y los bordes se ven mejor que en el tema normal', () => {
        expect(contrastRatio(hc.wireOff, hc.surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(hc.wireOff, hc.surface)).toBeGreaterThan(contrastRatio(normal.wireOff, normal.surface));
        expect(contrastRatio(hc.cardBorder, hc.surface)).toBeGreaterThan(contrastRatio(normal.cardBorder, normal.surface));
        expect(contrastRatio(hc.borderOff, hc.surface)).toBeGreaterThan(contrastRatio(normal.borderOff, normal.surface));
      });

      it('el cable apagado sigue distinguiéndose del encendido', () => {
        expect(contrastRatio(hc.primary, hc.wireOff)).toBeGreaterThanOrEqual(1.6);
      });
    });
  }
});
