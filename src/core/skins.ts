import { PlayerProgress, spendSparks } from './progress';

/**
 * Aspectos (paletas) que se compran con Chispas. Es solo estética: no cambian ninguna regla ni dificultad.
 * Los colores de cada aspecto viven en `src/game/theme.ts`; aquí está el catálogo, los precios y las compras.
 */
export type SkinId = 'filamento' | 'cyberpunk' | 'matrix' | 'oceano' | 'solar';

export interface SkinInfo {
  id: SkinId;
  /** Nombre en español (fuente de las traducciones). */
  name: string;
  /** Precio en Chispas; el aspecto inicial es gratis. */
  price: number;
}

export const DEFAULT_SKIN: SkinId = 'filamento';

export const SKINS: readonly SkinInfo[] = [
  { id: 'filamento', name: 'Filamento', price: 0 },
  { id: 'cyberpunk', name: 'Cyberpunk', price: 150 },
  { id: 'matrix', name: 'Matrix', price: 350 },
  { id: 'oceano', name: 'Océano', price: 550 },
  { id: 'solar', name: 'Solar', price: 800 },
];

export function isSkinId(value: unknown): value is SkinId {
  return SKINS.some((s) => s.id === value);
}

export function skinInfo(id: SkinId): SkinInfo {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

/** El aspecto inicial siempre está disponible; el resto, si se compró. */
export function isSkinUnlocked(progress: Pick<PlayerProgress, 'unlockedSkins'>, id: SkinId): boolean {
  return id === DEFAULT_SKIN || progress.unlockedSkins.includes(id);
}

/** Quita ids desconocidos o repetidos y el aspecto inicial (que no hace falta guardar). */
export function sanitizeUnlockedSkins(raw: unknown): SkinId[] {
  if (!Array.isArray(raw)) return [];
  const result: SkinId[] = [];
  for (const value of raw) {
    if (isSkinId(value) && value !== DEFAULT_SKIN && !result.includes(value)) result.push(value);
  }
  return result;
}

/** Si el aspecto elegido no existe o no se ha comprado, vuelve al inicial. */
export function usableSkin(progress: Pick<PlayerProgress, 'unlockedSkins'>, wanted: unknown): SkinId {
  return isSkinId(wanted) && isSkinUnlocked(progress, wanted) ? wanted : DEFAULT_SKIN;
}

/** Compra un aspecto. Devuelve null si ya lo tienes o no alcanzan las Chispas. */
export function buySkin(progress: PlayerProgress, id: SkinId): PlayerProgress | null {
  if (isSkinUnlocked(progress, id)) return null;
  const paid = spendSparks(progress, skinInfo(id).price);
  if (!paid) return null;
  return { ...paid, unlockedSkins: [...paid.unlockedSkins, id] };
}
