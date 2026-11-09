import { toCss } from './color';
import { DEFAULT_SKIN, SkinId } from '../core/skins';

/**
 * Identidad visual "Filamento": la energía es la luz incandescente de un filamento.
 * Lo apagado son trazas frías grabadas en vidrio; lo encendido es calor blanco-ámbar.
 *
 * - Tema "dark" (Noche): vidrio azul-índigo con filamento ámbar.
 * - Tema "light" (Papel): papel azul-grisáceo con filamento naranja quemado.
 *
 * Centralizado aquí para poder cambiar la estética sin tocar la lógica. Los contrastes
 * mínimos de cada token están verificados en tests/theme.test.ts.
 */

export interface GameTheme {
  name: 'dark' | 'light';
  /** Aspecto (paleta) en uso; forma parte de la clave de las texturas de las casillas. */
  skin: SkinId;
  background: number;
  backgroundCss: string;
  text: string;
  mutedText: string;
  /** Filamento: cable energizado, controles principales. */
  primary: number;
  primaryCss: string;
  primaryGlow: number;
  /** Núcleo blanco-caliente en el centro del cable energizado. */
  energyCore: number;
  /** Texto sobre superficies rellenas con el color primario. */
  onPrimary: string;
  /** Fuente de energía. */
  accent: number;
  accentCss: string;
  /** Vidrio: casillas, barras y tarjetas. */
  surface: number;
  surfaceCss: string;
  /** Líneas divisorias discretas dentro de barras y tarjetas. */
  divider: number;
  borderOff: number;
  cardBorder: number;
  /** Traza apagada (verificada ≥ 3:1 contra la superficie). */
  wireOff: number;
  wireOffHub: number;
  /** Sentido de giro: horario / antihorario. */
  clockwise: number;
  clockwiseCss: string;
  counterClockwise: number;
  counterClockwiseCss: string;
  /** Anillo de resalte de la pista. */
  hintRing: number;
}

export const THEME_DARK: GameTheme = {
  name: 'dark',
  skin: DEFAULT_SKIN,
  background: 0x0b1026,
  backgroundCss: toCss(0x0b1026),
  text: '#eceaf6',
  mutedText: '#9aa3cc',
  primary: 0xffb938,
  primaryCss: toCss(0xffb938),
  primaryGlow: 0xffd27a,
  energyCore: 0xfff1cf,
  onPrimary: '#1a1200',
  accent: 0xff6f91,
  accentCss: toCss(0xff6f91),
  surface: 0x151c3d,
  surfaceCss: toCss(0x151c3d),
  divider: 0x2a3366,
  borderOff: 0x2a3366,
  cardBorder: 0x3a4580,
  wireOff: 0x5c6699,
  wireOffHub: 0x7480b8,
  clockwise: 0x7cc8ff,
  clockwiseCss: toCss(0x7cc8ff),
  counterClockwise: 0xc9a0ff,
  counterClockwiseCss: toCss(0xc9a0ff),
  hintRing: 0xffffff,
};

export const THEME_LIGHT: GameTheme = {
  name: 'light',
  skin: DEFAULT_SKIN,
  background: 0xe8edf5,
  backgroundCss: toCss(0xe8edf5),
  text: '#14204a',
  mutedText: '#4a5578',
  primary: 0xc23d05,
  primaryCss: toCss(0xc23d05),
  primaryGlow: 0xff8a4c,
  energyCore: 0xffc79a,
  onPrimary: '#ffffff',
  accent: 0x7b3fe4,
  accentCss: toCss(0x7b3fe4),
  surface: 0xffffff,
  surfaceCss: toCss(0xffffff),
  divider: 0xd3dbea,
  borderOff: 0xd3dbea,
  cardBorder: 0xb9c4dd,
  wireOff: 0x8591b8,
  wireOffHub: 0x6e7ba6,
  clockwise: 0x1668c9,
  clockwiseCss: toCss(0x1668c9),
  counterClockwise: 0xb02a8b,
  counterClockwiseCss: toCss(0xb02a8b),
  hintRing: 0x14204a,
};

/**
 * Variantes de alto contraste: mismas paletas, pero con trazas apagadas, bordes, divisores y texto
 * secundario mucho más marcados (verificado en tests/theme.test.ts: trazas ≥ 4,5:1 y textos ≥ 7:1).
 */
export const THEME_DARK_HC: GameTheme = {
  ...THEME_DARK,
  text: '#ffffff',
  mutedText: '#d6dbf7',
  divider: 0x5a67ad,
  borderOff: 0x6f7dc4,
  cardBorder: 0x95a2e6,
  wireOff: 0x7f8ddc,
  wireOffHub: 0x9aa6e8,
};

export const THEME_LIGHT_HC: GameTheme = {
  ...THEME_LIGHT,
  text: '#080f2a',
  mutedText: '#1f2a55',
  divider: 0x9aa8cc,
  borderOff: 0x7f8fb8,
  cardBorder: 0x56668f,
  wireOff: 0x3a4570,
  wireOffHub: 0x2a3560,
};

/** Colores que cambia un aspecto; lo demás (modo, estructura) se hereda del tema base. */
type SkinColors = Partial<Omit<GameTheme, 'name' | 'skin' | 'primaryCss' | 'accentCss' | 'clockwiseCss' | 'counterClockwiseCss' | 'backgroundCss' | 'surfaceCss'>>;

/** Fondo, texto y trazas de lectura que el alto contraste vuelve a imponer sobre cualquier aspecto. */
const HC_KEYS = ['text', 'mutedText', 'divider', 'borderOff', 'cardBorder', 'wireOff', 'wireOffHub'] as const;

/** `hc`: ajustes extra solo cuando el alto contraste está activo (para que las trazas sigan distinguiéndose del filamento). */
type SkinEntry = SkinColors & { hc?: SkinColors };

export const SKIN_COLORS: Record<SkinId, { dark: SkinEntry; light: SkinEntry }> = {
  filamento: { dark: {}, light: {} },
  // Neón cian y magenta sobre violeta casi negro
  cyberpunk: {
    dark: {
      background: 0x0a0612, surface: 0x160c26, text: '#f1eaff', mutedText: '#b3a3d9',
      primary: 0x00e5ff, primaryGlow: 0x7ff3ff, energyCore: 0xe0fcff, onPrimary: '#001418',
      accent: 0xff2e93, clockwise: 0xb28cff, counterClockwise: 0xffd24d,
      divider: 0x35224f, borderOff: 0x35224f, cardBorder: 0x5b3a85, wireOff: 0x6b5a99, wireOffHub: 0x8774b8, hintRing: 0xffffff,
    },
    light: {
      background: 0xf1ecfa, surface: 0xffffff, text: '#1c1038', mutedText: '#51467a',
      primary: 0x00506e, primaryGlow: 0x34c6ee, energyCore: 0xbdeeff, onPrimary: '#ffffff',
      accent: 0xd4146e, clockwise: 0x5a2fd0, counterClockwise: 0xa85400,
      divider: 0xdcd3ef, borderOff: 0xdcd3ef, cardBorder: 0xbfb2de, wireOff: 0x8a7fb5, wireOffHub: 0x726898, hintRing: 0x1c1038,
      hc: { wireOff: 0x66739c, wireOffHub: 0x55628a },
    },
  },
  // Verde fósforo sobre negro verdoso
  matrix: {
    dark: {
      background: 0x020b05, surface: 0x08170d, text: '#e3fbe9', mutedText: '#8fc3a0',
      primary: 0x3dff7a, primaryGlow: 0x9dffbc, energyCore: 0xe6ffee, onPrimary: '#00160a',
      accent: 0xff4d4d, clockwise: 0x5ad7ff, counterClockwise: 0xe2a6ff,
      divider: 0x1c3a27, borderOff: 0x1c3a27, cardBorder: 0x2f6a45, wireOff: 0x3f7d57, wireOffHub: 0x5aa077, hintRing: 0xffffff,
    },
    light: {
      background: 0xe9f4ec, surface: 0xffffff, text: '#0c2a17', mutedText: '#3f5f4b',
      primary: 0x0a7a34, primaryGlow: 0x34c768, energyCore: 0xbff2cf, onPrimary: '#ffffff',
      accent: 0xc2255c, clockwise: 0x1b6fc2, counterClockwise: 0x8a3fd0,
      divider: 0xcfe3d5, borderOff: 0xcfe3d5, cardBorder: 0xaecbb7, wireOff: 0x7a9a85, wireOffHub: 0x5f826b, hintRing: 0x0c2a17,
    },
  },
  // Aguamarina y coral sobre azul abisal
  oceano: {
    dark: {
      background: 0x04131c, surface: 0x0a2433, text: '#e6f7fb', mutedText: '#8fb9c7',
      primary: 0x35e0c4, primaryGlow: 0x8ff5e3, energyCore: 0xe8fffa, onPrimary: '#00201a',
      accent: 0xff7a59, clockwise: 0x7ab8ff, counterClockwise: 0xffd36e,
      divider: 0x16384c, borderOff: 0x16384c, cardBorder: 0x2b6a8a, wireOff: 0x3f7f9a, wireOffHub: 0x5a9db8, hintRing: 0xffffff,
    },
    light: {
      background: 0xe3f3f7, surface: 0xffffff, text: '#06303d', mutedText: '#3d6574',
      primary: 0x005a50, primaryGlow: 0x2fcdb8, energyCore: 0xbff5ec, onPrimary: '#ffffff',
      accent: 0xc2410c, clockwise: 0x1864ab, counterClockwise: 0x8f2dae,
      divider: 0xcfe6ee, borderOff: 0xcfe6ee, cardBorder: 0xa9cfdb, wireOff: 0x6b8f9e, wireOffHub: 0x557a8a, hintRing: 0x06303d,
      hc: { wireOff: 0x66739c, wireOffHub: 0x55628a },
    },
  },
  // Amarillo sol sobre granate oscuro
  solar: {
    dark: {
      background: 0x1c0b0b, surface: 0x2d1414, text: '#fff1e6', mutedText: '#d9aa94',
      primary: 0xffe45c, primaryGlow: 0xfff3a0, energyCore: 0xffffff, onPrimary: '#1f1500',
      accent: 0xff4d2e, clockwise: 0x7ad0ff, counterClockwise: 0xff9ad5,
      divider: 0x502a22, borderOff: 0x502a22, cardBorder: 0x7a4636, wireOff: 0x9a6b57, wireOffHub: 0xb88470, hintRing: 0xffffff,
    },
    light: {
      background: 0xfff4e0, surface: 0xffffff, text: '#3a1a0a', mutedText: '#6e4a38',
      primary: 0xc0392b, primaryGlow: 0xff7a59, energyCore: 0xffd2c4, onPrimary: '#ffffff',
      accent: 0xb87400, clockwise: 0x1a5fb4, counterClockwise: 0x7d3c98,
      divider: 0xf0dcc0, borderOff: 0xf0dcc0, cardBorder: 0xdcbf9a, wireOff: 0xa08a78, wireOffHub: 0x86705f, hintRing: 0x3a1a0a,
    },
  },
};

export function getTheme(mode: 'dark' | 'light', highContrast = false, skin: SkinId = DEFAULT_SKIN): GameTheme {
  const base = mode === 'light' ? (highContrast ? THEME_LIGHT_HC : THEME_LIGHT) : highContrast ? THEME_DARK_HC : THEME_DARK;
  if (skin === DEFAULT_SKIN) return base;
  const { hc: hcColors, ...colors } = SKIN_COLORS[skin][mode];
  const merged: GameTheme = { ...base, ...colors, skin };
  // El alto contraste manda sobre el aspecto en texto y trazas; los colores de marca (filamento, fuente…) se conservan
  if (highContrast) for (const key of HC_KEYS) (merged as unknown as Record<string, unknown>)[key] = base[key];
  if (highContrast && hcColors) Object.assign(merged, hcColors);
  merged.backgroundCss = toCss(merged.background);
  merged.surfaceCss = toCss(merged.surface);
  merged.primaryCss = toCss(merged.primary);
  merged.accentCss = toCss(merged.accent);
  merged.clockwiseCss = toCss(merged.clockwise);
  merged.counterClockwiseCss = toCss(merged.counterClockwise);
  return merged;
}

export let THEME: GameTheme = THEME_DARK;

export function setActiveTheme(mode: 'dark' | 'light', highContrast = false, skin: SkinId = DEFAULT_SKIN): GameTheme {
  THEME = getTheme(mode, highContrast, skin);
  return THEME;
}

/**
 * Identidad de forma de cada aspecto (más allá del color): cómo se dibujan las casillas, los nodos y el cable
 * encendido, y qué fondo animado lleva. Los aspectos se pintan en texturas, así que cuestan lo mismo que el inicial.
 */
export interface SkinStyle {
  /** Forma de la casilla: redondeada, con esquinas cortadas, cuadrada o circular. */
  tile: 'round' | 'chamfer' | 'square' | 'circle' | 'pill';
  /** Forma de los nodos del centro. */
  node: 'circle' | 'diamond' | 'square' | 'sun' | 'bubble';
  /** Cable encendido: macizo, de doble pista (circuito), de bits (datos) o de plasma (núcleo ancho al rojo blanco). */
  wire: 'solid' | 'double' | 'bits' | 'plasma' | 'wave';
  /** Multiplicador del grosor del cable. */
  wireScale: number;
  /** Multiplicador del halo de luz alrededor del cable encendido. */
  halo: number;
  /** Fondo: nada, cuadrícula en perspectiva, lluvia de código u órbitas con rayos. */
  backdrop: 'none' | 'grid' | 'rain' | 'orbit' | 'waves';
}

export const SKIN_STYLES: Record<SkinId, SkinStyle> = {
  filamento: { tile: 'round', node: 'circle', wire: 'solid', wireScale: 1, halo: 1, backdrop: 'none' },
  cyberpunk: { tile: 'chamfer', node: 'diamond', wire: 'double', wireScale: 1.1, halo: 1.25, backdrop: 'grid' },
  matrix: { tile: 'square', node: 'square', wire: 'bits', wireScale: 0.85, halo: 0.8, backdrop: 'rain' },
  oceano: { tile: 'pill', node: 'bubble', wire: 'wave', wireScale: 0.95, halo: 1.2, backdrop: 'waves' },
  solar: { tile: 'circle', node: 'sun', wire: 'plasma', wireScale: 1.05, halo: 1.5, backdrop: 'orbit' },
};

export function skinStyle(skin: SkinId): SkinStyle {
  return SKIN_STYLES[skin] ?? SKIN_STYLES.filamento;
}
