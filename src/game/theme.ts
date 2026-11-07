import { toCss } from './color';

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

export function getTheme(mode: 'dark' | 'light'): GameTheme {
  return mode === 'light' ? THEME_LIGHT : THEME_DARK;
}

export let THEME: GameTheme = THEME_DARK;

export function setActiveTheme(mode: 'dark' | 'light'): GameTheme {
  THEME = getTheme(mode);
  return THEME;
}
