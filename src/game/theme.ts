/**
 * Paletas de colores del juego: Modo Oscuro (Neón) y Modo Claro (Alto Contraste Zen).
 * Centralizado aquí para permitir cambios de estética sin alterar la lógica.
 */

export interface GameTheme {
  name: 'dark' | 'light';
  background: number;
  backgroundCss: string;
  text: string;
  primary: number; // Cable energizado / foco
  primaryCss: string;
  primaryGlow: number;
  accent: number; // Fuente de poder
  accentCss: string;
  surface: number; // Fondo de cada casilla
  surfaceCss: string;
  wireOff: number; // Cable apagado / inactivo
  wireOffHub: number;
  borderOff: number;
  mutedText: string;
  cardBorder: number;
}

export const THEME_DARK: GameTheme = {
  name: 'dark',
  background: 0x0d1117,
  backgroundCss: '#0d1117',
  text: '#ffffff',
  primary: 0x00f0ff, // Cian neón brillante
  primaryCss: '#00f0ff',
  primaryGlow: 0x38f9d7,
  accent: 0xff007f, // Magenta neón
  accentCss: '#ff007f',
  surface: 0x161b22,
  surfaceCss: '#161b22',
  wireOff: 0x22272e, // Cable apagado oscuro
  wireOffHub: 0x2d333b,
  borderOff: 0x30363d,
  mutedText: '#8b949e',
  cardBorder: 0x30363d,
};

export const THEME_LIGHT: GameTheme = {
  name: 'light',
  background: 0xf5f7fa, // Blanco marfil suave, cero reflejos molestos
  backgroundCss: '#f5f7fa',
  text: '#111827', // Texto pizarra oscuro
  primary: 0x0284c7, // Azul eléctrico intenso
  primaryCss: '#0284c7',
  primaryGlow: 0x38bdf8,
  accent: 0xd946ef, // Violeta/fucsia vibrante para la fuente
  accentCss: '#d946ef',
  surface: 0xffffff, // Tarjeta blanca limpia
  surfaceCss: '#ffffff',
  wireOff: 0xd1d5db, // Gris neutro visible y sutil
  wireOffHub: 0x9ca3af,
  borderOff: 0xe5e7eb,
  mutedText: '#6b7280',
  cardBorder: 0xd1d5db,
};

export function getTheme(mode: 'dark' | 'light'): GameTheme {
  return mode === 'light' ? THEME_LIGHT : THEME_DARK;
}

export let THEME: GameTheme = THEME_DARK;

export function setActiveTheme(mode: 'dark' | 'light'): GameTheme {
  THEME = getTheme(mode);
  return THEME;
}
