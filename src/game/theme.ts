/**
 * Paleta de colores provisional del juego (tema neón oscuro).
 * Centralizado aquí para permitir cambios de estética sin alterar la lógica.
 */
export const THEME = {
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
  wireOff: 0x22272e, // Cable apagado / sin energía (bien oscuro y desaturado)
  wireOffHub: 0x2d333b,
  borderOff: 0x30363d,
  mutedText: '#8b949e',
} as const;
