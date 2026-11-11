import type { SkinId } from './skins';

/**
 * Calidad gráfica (lógica pura, sin Phaser, para poder probarla).
 *
 * - **Normales**: el estilo de siempre, el más ligero. Es el de partida.
 * - **Altos**: con los aspectos de la tienda (desde Cyberpunk) suma iluminación (brillo de las piezas encendidas,
 *   luz detrás del tablero y viñeta), una textura animada propia de cada aspecto, partículas de ambiente y
 *   destellos al jugar y al ganar. Gasta más batería y procesador. Filamento, el aspecto base, se ve igual en los dos.
 *
 * Los efectos necesitan WebGL. El alto contraste los apaga (priman la claridad) y sin animaciones se quedan
 * solo los que no se mueven (el brillo, la luz y la viñeta).
 */

export type GraphicsQuality = 'normal' | 'high';

export const GRAPHICS_QUALITIES: readonly GraphicsQuality[] = ['normal', 'high'];

export const GRAPHICS_LABELS: Record<GraphicsQuality, string> = {
  normal: 'Normales',
  high: 'Altos',
};

export function isGraphicsQuality(value: unknown): value is GraphicsQuality {
  return typeof value === 'string' && (GRAPHICS_QUALITIES as readonly string[]).includes(value);
}

/** Partículas de ambiente que flotan sobre el fondo del aspecto. */
export type AmbientKind = 'neon' | 'glyphs' | 'motes' | 'embers' | 'stars';
/** Destello al tocar una pieza y al ganar. */
export type BurstKind = 'spark' | 'bits' | 'bubbles' | 'embers' | 'stars';
/** Textura animada a pantalla completa, sobre el fondo y bajo el tablero. */
export type SheenKind = 'scanlines' | 'crt' | 'caustics' | 'heat' | 'shimmer';

export interface SkinFx {
  /** Fuerza del brillo (bloom) del tablero: hace que lo encendido irradie luz. */
  bloom: number;
  /** Fuerza de la viñeta de la cámara (bordes más oscuros, la mirada va al centro). */
  vignette: number;
  /** Intensidad (0-1) de la luz que hay detrás del tablero, que late despacio. */
  backLight: number;
  ambient: AmbientKind;
  /** Partículas de ambiente vivas a la vez. */
  ambientCount: number;
  burst: BurstKind;
  sheen: SheenKind;
}

/** Efectos de cada aspecto con gráficos altos; Filamento (el aspecto base) no lleva. */
export const SKIN_FX: Record<SkinId, SkinFx | null> = {
  filamento: null,
  cyberpunk: { bloom: 0.9, vignette: 0.45, backLight: 0.55, ambient: 'neon', ambientCount: 22, burst: 'spark', sheen: 'scanlines' },
  matrix: { bloom: 0.75, vignette: 0.5, backLight: 0.4, ambient: 'glyphs', ambientCount: 18, burst: 'bits', sheen: 'crt' },
  oceano: { bloom: 0.7, vignette: 0.42, backLight: 0.5, ambient: 'motes', ambientCount: 26, burst: 'bubbles', sheen: 'caustics' },
  solar: { bloom: 1.1, vignette: 0.42, backLight: 0.6, ambient: 'embers', ambientCount: 24, burst: 'embers', sheen: 'heat' },
  aurora: { bloom: 0.85, vignette: 0.42, backLight: 0.5, ambient: 'stars', ambientCount: 30, burst: 'stars', sheen: 'shimmer' },
};

export interface FxContext {
  quality: GraphicsQuality;
  skin: SkinId;
  highContrast: boolean;
  /** El renderizador es WebGL (sin él no hay brillo ni sombreadores). */
  webgl: boolean;
  /** Sin animaciones (ajuste del juego o del sistema). */
  reducedMotion: boolean;
}

/** Qué se ve: nada extra, solo la luz quieta (brillo, viñeta, luz de fondo) o todo (también lo que se mueve). */
export type FxLevel = 'off' | 'static' | 'full';

export function fxLevel(ctx: FxContext): FxLevel {
  if (ctx.quality !== 'high' || !ctx.webgl || ctx.highContrast || !SKIN_FX[ctx.skin]) return 'off';
  return ctx.reducedMotion ? 'static' : 'full';
}

/** Efectos del aspecto si están activos en este contexto. */
export function activeSkinFx(ctx: FxContext): SkinFx | null {
  return fxLevel(ctx) === 'off' ? null : SKIN_FX[ctx.skin];
}

/**
 * El aviso «hay gráficos altos en Ajustes» se enseña una sola vez y solo a quien ya jugaba antes de la
 * actualización (a un jugador nuevo no se le interrumpe con una novedad que aún no puede apreciar).
 */
export function shouldAnnounceGraphics(settings: {
  hasSeenGraphicsNotice?: boolean;
  hasSeenTutorial?: boolean;
  hasSeenLightsTip?: boolean;
  hasSeenFlowTip?: boolean;
}): boolean {
  if (settings.hasSeenGraphicsNotice === true) return false;
  return settings.hasSeenTutorial === true || settings.hasSeenLightsTip === true || settings.hasSeenFlowTip === true;
}
