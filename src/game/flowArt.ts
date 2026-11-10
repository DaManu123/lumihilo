import Phaser from 'phaser';
import { GameTheme, SkinStyle } from './theme';
import { fillNode, fillTile, strokeTile } from './skinArt';
import { mixColors } from './color';
import { flowColor, glyphColorOn } from './flowColors';
import type { FlowCellLook, FlowLeg } from './flowLooks';

/**
 * Dibujo de las casillas del puzzle Hilos: el hilo de luz de cada pareja (con su color) y los puntos de las
 * parejas, cada uno con un símbolo propio para que no dependa solo del color (daltonismo). Todo se pinta una
 * sola vez en una textura, como el resto de casillas.
 */

type G = Phaser.GameObjects.Graphics;

/** Símbolo del punto de cada pareja (índice 0 a 7). */
export function paintFlowGlyph(g: G, index: number, r: number, color: number): void {
  const line = Math.max(2, r * 0.3);
  g.fillStyle(color, 1);
  g.lineStyle(line, color, 1);
  switch (((index % 8) + 8) % 8) {
    case 0: // punto
      g.fillCircle(0, 0, r * 0.55);
      break;
    case 1: // anillo
      g.strokeCircle(0, 0, r * 0.62);
      break;
    case 2: // cuadrado
      g.fillRect(-r * 0.5, -r * 0.5, r, r);
      break;
    case 3: // triángulo
      g.fillTriangle(0, -r * 0.65, r * 0.65, r * 0.5, -r * 0.65, r * 0.5);
      break;
    case 4: // más
      g.fillRect(-r * 0.7, -line / 2, r * 1.4, line);
      g.fillRect(-line / 2, -r * 0.7, line, r * 1.4);
      break;
    case 5: // equis
      g.beginPath();
      g.moveTo(-r * 0.5, -r * 0.5);
      g.lineTo(r * 0.5, r * 0.5);
      g.moveTo(r * 0.5, -r * 0.5);
      g.lineTo(-r * 0.5, r * 0.5);
      g.strokePath();
      break;
    case 6: // dos barras
      g.fillRect(-r * 0.55, -r * 0.5, r * 0.4, r);
      g.fillRect(r * 0.15, -r * 0.5, r * 0.4, r);
      break;
    default: // rombo
      g.fillPoints([{ x: 0, y: -r * 0.7 }, { x: r * 0.7, y: 0 }, { x: 0, y: r * 0.7 }, { x: -r * 0.7, y: 0 }], true);
  }
}

/** Dibuja una casilla de Hilos centrada en (0, 0). */
export function paintFlowCell(g: G, theme: GameTheme, style: SkinStyle, cellVisual: number, look: FlowCellLook): void {
  const radius = cellVisual * 0.17;
  const color = look.owner >= 0 ? flowColor(theme.name, look.owner) : theme.wireOff;
  const tint = look.owner >= 0 ? (look.complete ? 0.2 : 0.12) + 0.1 * look.glow : 0;

  // Casilla de vidrio, teñida del color del hilo que pasa por ella
  g.fillStyle(look.owner >= 0 ? mixColors(theme.surface, color, tint) : theme.surface, 1);
  fillTile(g, style, cellVisual, radius);
  g.lineStyle(2, look.owner >= 0 ? mixColors(theme.divider, color, 0.55) : theme.borderOff, 1);
  strokeTile(g, style, cellVisual, radius);
  if (look.hintRing) {
    g.lineStyle(5, theme.hintRing, 1);
    strokeTile(g, style, cellVisual, radius, 3);
  }
  if (look.missing) {
    // Casilla que falta llenar: aro de aviso y un punto en el centro (no depende solo del color)
    g.lineStyle(5, theme.accent, 1);
    strokeTile(g, style, cellVisual, radius, 5);
    g.fillStyle(theme.accent, 0.9);
    g.fillCircle(0, 0, cellVisual * 0.09);
  }

  const w = Math.max(10, cellVisual * 0.2) * style.wireScale;
  if (look.owner >= 0) {
    const stroke = (leg: FlowLeg) => {
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(leg.dx * leg.reach, leg.dy * leg.reach);
      g.strokePath();
    };
    // Halo, cuerpo y filo de luz del hilo
    for (const [scale, alpha] of [[1.9, 0.1], [1.4, 0.16]] as const) {
      g.lineStyle(w * scale, color, Math.min(1, (alpha + 0.12 * look.glow) * style.halo));
      for (const leg of look.legs) stroke(leg);
      g.fillStyle(color, Math.min(1, (alpha + 0.12 * look.glow) * style.halo));
      g.fillCircle(0, 0, (w * scale) / 2);
    }
    g.lineStyle(w, color, 1);
    for (const leg of look.legs) stroke(leg);
    g.fillStyle(color, 1);
    g.fillCircle(0, 0, w / 2);
    g.lineStyle(Math.max(2, w * 0.26), mixColors(color, theme.energyCore, 0.55), 0.85);
    for (const leg of look.legs) stroke(leg);
  }

  if (look.endpoint) {
    const r = cellVisual * 0.25;
    g.fillStyle(color, 0.22 + 0.2 * look.glow);
    g.fillCircle(0, 0, r * 1.55);
    fillNode(g, style, r, color);
    // Marco claro y símbolo propio de la pareja
    g.lineStyle(Math.max(2, r * 0.12), mixColors(color, theme.energyCore, 0.5), 1);
    g.strokeCircle(0, 0, r * 1.05);
    paintFlowGlyph(g, look.owner, r * 0.78, glyphColorOn(color));
  }
}
