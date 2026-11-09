import { describe, it, expect } from 'vitest';
import { createDefaultProgress, sanitizeProgress } from '../src/core/progress';
import { DEFAULT_SKIN, SKINS, buySkin, skinInfo, isSkinUnlocked, sanitizeUnlockedSkins, usableSkin } from '../src/core/skins';

const rich = (sparks: number) => ({ ...createDefaultProgress(1), sparks });

describe('Aspectos', () => {
  it('el aspecto inicial es gratis y los demás cuestan Chispas', () => {
    expect(SKINS[0].id).toBe(DEFAULT_SKIN);
    expect(SKINS[0].price).toBe(0);
    for (const s of SKINS.slice(1)) expect(s.price).toBeGreaterThan(0);
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(SKINS.length);
  });

  it('el aspecto inicial siempre está desbloqueado', () => {
    expect(isSkinUnlocked(createDefaultProgress(1), DEFAULT_SKIN)).toBe(true);
    expect(isSkinUnlocked(createDefaultProgress(1), 'matrix')).toBe(false);
  });

  it('comprar descuenta las Chispas y desbloquea el aspecto', () => {
    const price = skinInfo('cyberpunk').price;
    const result = buySkin(rich(price + 150), 'cyberpunk');
    expect(result).not.toBeNull();
    expect(result!.sparks).toBe(150);
    expect(isSkinUnlocked(result!, 'cyberpunk')).toBe(true);
    expect(isSkinUnlocked(result!, 'matrix')).toBe(false);
  });

  it('no deja comprar sin Chispas suficientes ni dos veces el mismo', () => {
    expect(buySkin(rich(skinInfo('cyberpunk').price - 1), 'cyberpunk')).toBeNull();
    const once = buySkin(rich(5000), 'solar')!;
    expect(buySkin(once, 'solar')).toBeNull();
    expect(once.sparks).toBe(5000 - skinInfo('solar').price);
    expect(buySkin(rich(1000), DEFAULT_SKIN)).toBeNull();
  });

  it('un aspecto no comprado o desconocido vuelve al inicial', () => {
    const p = buySkin(rich(5000), 'matrix')!;
    expect(usableSkin(p, 'matrix')).toBe('matrix');
    expect(usableSkin(p, 'solar')).toBe(DEFAULT_SKIN);
    expect(usableSkin(p, 'inventado')).toBe(DEFAULT_SKIN);
    expect(usableSkin(p, undefined)).toBe(DEFAULT_SKIN);
  });

  it('los datos guardados se validan', () => {
    expect(sanitizeUnlockedSkins(['solar', 'solar', 'x', 'filamento', 3])).toEqual(['solar']);
    expect(sanitizeUnlockedSkins('mal')).toEqual([]);
    expect(sanitizeProgress({ unlockedSkins: ['matrix', 'basura'] }, 1).unlockedSkins).toEqual(['matrix']);
    // Un progreso de una versión anterior (sin aspectos) sigue siendo válido
    expect(sanitizeProgress({ sparks: 50 }, 1).unlockedSkins).toEqual([]);
  });
});
