/**
 * Diseño adaptable de la interfaz (funciones puras, sin Phaser, para poder probarlas).
 *
 * El juego se dibuja en un lienzo de ancho lógico fijo (DESIGN_WIDTH) y alto variable según la
 * proporción de la pantalla (ver `computeGameHeight`), de modo que ocupa todo el dispositivo sin
 * franjas vacías. Como en un teléfono típico (~390 dp de ancho) el lienzo se reduce a ~0,55×,
 * todos los tamaños de aquí están pensados con ese factor en mente:
 *   - Botones ≥ 88 px lógicos  → ≥ 48 dp (mínimo táctil recomendado por Android).
 *   - Textos  ≥ 24 px lógicos  → ≥ 13 dp (legibles sin esfuerzo).
 */

export const DESIGN_WIDTH = 720;
export const MIN_GAME_HEIGHT = 1280;
export const MAX_GAME_HEIGHT = 1700;

export const MARGIN = 24;
export const GAP = 16;
export const BUTTON_H = 92;
export const DIRECTION_BTN_H = 112;

export const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Tamaños de texto en píxeles lógicos. */
export const FONT = {
  title: 38,
  level: 30,
  stats: 28,
  button: 26,
  small: 24,
} as const;

/** Alto lógico del lienzo según la proporción del área visible (sin franjas vacías). */
export function computeGameHeight(viewportWidth: number, viewportHeight: number): number {
  if (!(viewportWidth > 0) || !(viewportHeight > 0)) return MIN_GAME_HEIGHT;
  const height = Math.round((DESIGN_WIDTH * viewportHeight) / viewportWidth);
  return Math.min(MAX_GAME_HEIGHT, Math.max(MIN_GAME_HEIGHT, height));
}

/** Rectángulo centrado en (x, y). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HudLayout {
  titleY: number;
  modeBtn: Rect;
  themeBtn: Rect;
  levelY: number;
  diffY: number;
  statsY: number;
  tapsX: number;
  timeX: number;
  resetBtn: Rect;
  undoBtn: Rect;
  dirBtn: Rect;
  /** Y donde empieza la zona del tablero. */
  boardTop: number;
}

export function computeHudLayout(width: number = DESIGN_WIDTH): HudLayout {
  const halfW = (width - 2 * MARGIN - GAP) / 2;
  const leftX = MARGIN + halfW / 2;
  const rightX = width - MARGIN - halfW / 2;

  const titleY = 52;
  const topRowY = 146;
  const levelY = 230;
  const diffY = 266;
  const statsY = 312;
  const controlsY = 396;
  const dirY = controlsY + BUTTON_H / 2 + 22 + DIRECTION_BTN_H / 2;
  const boardTop = dirY + DIRECTION_BTN_H / 2 + 24;

  return {
    titleY,
    modeBtn: { x: leftX, y: topRowY, w: halfW, h: BUTTON_H },
    themeBtn: { x: rightX, y: topRowY, w: halfW, h: BUTTON_H },
    levelY,
    diffY,
    statsY,
    tapsX: leftX,
    timeX: rightX,
    resetBtn: { x: leftX, y: controlsY, w: halfW, h: BUTTON_H },
    undoBtn: { x: rightX, y: controlsY, w: halfW, h: BUTTON_H },
    dirBtn: { x: width / 2, y: dirY, w: width - 2 * MARGIN, h: DIRECTION_BTN_H },
    boardTop,
  };
}

export interface BoardGeometry {
  /** Lado de cada celda incluyendo el espacio entre celdas. */
  cellSize: number;
  /** Espacio entre celdas. */
  gap: number;
  /** Lado visible de cada celda (cellSize - gap). */
  cellVisual: number;
  /** Centro de la celda (0, 0). */
  startX: number;
  startY: number;
  boardWidth: number;
  boardHeight: number;
}

/** Calcula el tamaño y la posición del tablero para aprovechar todo el espacio disponible. */
export function computeBoardGeometry(
  width: number,
  height: number,
  rows: number,
  cols: number,
  boardTop: number
): BoardGeometry {
  const availW = width - 2 * MARGIN;
  const availH = height - boardTop - MARGIN;
  const cellSize = Math.floor(Math.min(availW / cols, availH / rows));
  const gap = Math.max(4, Math.round(cellSize * 0.04));
  const boardWidth = cellSize * cols;
  const boardHeight = cellSize * rows;

  return {
    cellSize,
    gap,
    cellVisual: cellSize - gap,
    startX: (width - boardWidth) / 2 + cellSize / 2,
    // En pantallas altas el tablero queda algo más cerca de los controles que del borde inferior
    startY: boardTop + (availH - boardHeight) * 0.35 + cellSize / 2,
    boardWidth,
    boardHeight,
  };
}
