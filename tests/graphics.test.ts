import { describe, expect, it } from 'vitest';
import { FxContext, GRAPHICS_LABELS, GRAPHICS_QUALITIES, SKIN_FX, activeSkinFx, fxLevel, isGraphicsQuality, shouldAnnounceGraphics } from '../src/core/graphics';
import { SKINS } from '../src/core/skins';

const base: FxContext = { quality: 'high', skin: 'cyberpunk', highContrast: false, webgl: true, reducedMotion: false };

describe('calidad gráfica', () => {
  it('reconoce solo las calidades válidas', () => {
    expect(GRAPHICS_QUALITIES).toEqual(['normal', 'high']);
    expect(isGraphicsQuality('high')).toBe(true);
    expect(isGraphicsQuality('normal')).toBe(true);
    expect(isGraphicsQuality('ultra')).toBe(false);
    expect(isGraphicsQuality(undefined)).toBe(false);
    for (const q of GRAPHICS_QUALITIES) expect(GRAPHICS_LABELS[q]).toBeTruthy();
  });

  it('Filamento (el aspecto base) no lleva efectos; todos los de la tienda sí', () => {
    expect(SKIN_FX.filamento).toBeNull();
    for (const skin of SKINS.filter((s) => s.price > 0)) {
      const fx = SKIN_FX[skin.id];
      expect(fx, skin.id).not.toBeNull();
      expect(fx!.bloom).toBeGreaterThan(0);
      expect(fx!.vignette).toBeGreaterThan(0);
      expect(fx!.vignette).toBeLessThan(0.6); // los bordes no se comen el tablero
      expect(fx!.ambientCount).toBeGreaterThan(0);
      expect(fx!.ambientCount).toBeLessThanOrEqual(40); // tope para teléfonos modestos
    }
  });

  it('cada aspecto de la tienda tiene su propio ambiente, destello y textura', () => {
    const paid = SKINS.filter((s) => s.price > 0).map((s) => SKIN_FX[s.id]!);
    expect(new Set(paid.map((f) => f.ambient)).size).toBe(paid.length);
    expect(new Set(paid.map((f) => f.sheen)).size).toBe(paid.length);
  });

  it('gráficos normales: el estilo de siempre, sin nada extra', () => {
    expect(fxLevel({ ...base, quality: 'normal' })).toBe('off');
    expect(activeSkinFx({ ...base, quality: 'normal' })).toBeNull();
  });

  it('gráficos altos con un aspecto de la tienda: todos los efectos', () => {
    expect(fxLevel(base)).toBe('full');
    expect(activeSkinFx(base)).toBe(SKIN_FX.cyberpunk);
  });

  it('con Filamento, alto contraste o sin WebGL no hay efectos', () => {
    expect(fxLevel({ ...base, skin: 'filamento' })).toBe('off');
    expect(fxLevel({ ...base, highContrast: true })).toBe('off');
    expect(fxLevel({ ...base, webgl: false })).toBe('off');
  });

  it('sin animaciones solo queda la luz quieta', () => {
    expect(fxLevel({ ...base, reducedMotion: true })).toBe('static');
    expect(activeSkinFx({ ...base, reducedMotion: true })).toBe(SKIN_FX.cyberpunk);
  });
});

describe('aviso de gráficos altos', () => {
  it('se enseña una vez a quien ya jugaba', () => {
    expect(shouldAnnounceGraphics({ hasSeenTutorial: true })).toBe(true);
    expect(shouldAnnounceGraphics({ hasSeenLightsTip: true })).toBe(true);
    expect(shouldAnnounceGraphics({ hasSeenFlowTip: true })).toBe(true);
    expect(shouldAnnounceGraphics({ hasSeenTutorial: true, hasSeenGraphicsNotice: true })).toBe(false);
  });

  it('no interrumpe a un jugador nuevo', () => {
    expect(shouldAnnounceGraphics({})).toBe(false);
    expect(shouldAnnounceGraphics({ hasSeenTutorial: false, hasSeenLightsTip: false, hasSeenFlowTip: false })).toBe(false);
  });
});
