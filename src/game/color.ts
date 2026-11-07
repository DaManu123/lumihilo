/**
 * Utilidades de color (funciones puras) para verificar la accesibilidad de los temas.
 * Los colores se manejan como enteros 0xRRGGBB, igual que Phaser.
 */

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Luminancia relativa según WCAG 2.x (0 = negro, 1 = blanco). */
export function luminance(color: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Relación de contraste WCAG entre dos colores (de 1 a 21). */
export function contrastRatio(a: number, b: number): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/** Mezcla dos colores: t = 0 devuelve `a`, t = 1 devuelve `b`. */
export function mixColors(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const mix = (shift: number) => {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    return Math.round(ca + (cb - ca) * k) & 0xff;
  };
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

/** Convierte 0xRRGGBB a "#rrggbb" para estilos CSS (texto de Phaser). */
export function toCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
