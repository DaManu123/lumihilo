import { contrastRatio } from './color';

/** Colores de los hilos del puzzle Hilos (sin Phaser, para poder probarlos en Node). */

/** Ocho colores bien separados: vivos para los fondos oscuros y más hondos para los claros (≥ 3:1 contra el vidrio). */
const FLOW_COLORS: Record<'dark' | 'light', readonly number[]> = {
  dark: [0xff6b81, 0x5cc8ff, 0xffd24d, 0x6dffb2, 0xa98bff, 0xff8a3d, 0xb8ff5c, 0xff8ad8],
  light: [0xc0213a, 0x0a62b8, 0x6b6b00, 0x0c7a3d, 0x7a2fd0, 0xc25400, 0x00837f, 0xb0287e],
};

export const FLOW_MAX_PAIRS = FLOW_COLORS.dark.length;

export function flowColor(mode: 'dark' | 'light', index: number): number {
  const palette = FLOW_COLORS[mode];
  return palette[((index % palette.length) + palette.length) % palette.length];
}

/** Color del símbolo sobre el color de la pareja: negro o blanco, el que más contraste dé. */
export function glyphColorOn(color: number): number {
  return contrastRatio(0x000000, color) >= contrastRatio(0xffffff, color) ? 0x0b1026 : 0xffffff;
}

