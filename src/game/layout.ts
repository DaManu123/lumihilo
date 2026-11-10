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
/** Lado de los botones de icono (≈ 49 dp en un teléfono típico). */
export const ICON_BTN = 92;

/** Tipografía de títulos y números: ancha y rotunda, como un letrero luminoso. */
export const FONT_DISPLAY = '"Unbounded Variable", "Arial Black", system-ui, sans-serif';
/** Tipografía de interfaz: diseñada para ser legible por personas de todas las edades. */
export const FONT_UI = '"Atkinson Hyperlegible Next Variable", system-ui, "Segoe UI", Roboto, sans-serif';

/** Tamaños de texto en píxeles lógicos. */
export const FONT = {
  title: 28,
  display: 34,
  stats: 28,
  button: 27,
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

export interface Point {
  x: number;
  y: number;
}

export interface HudLayout {
  /** Botón «Volver» al menú (flecha y texto), arriba a la izquierda. */
  backBtn: Rect;
  /** Botón de estadísticas (a la derecha del título). */
  statsBtn: Rect;
  /** Borde derecho del marcador de Chispas (justo a la izquierda del botón de estadísticas). */
  sparksRight: Point;
  /** Barra segmentada de modo / reto diario / tema. */
  modeBar: Rect;
  modeSegments: [Rect, Rect, Rect];
  /** Texto del nivel (izquierda) y bloque de tiempo y toques (derecha). */
  levelPos: Point;
  timePos: Point;
  tapsPos: Point;
  /** Barra segmentada de reiniciar / deshacer / pista. */
  toolbar: Rect;
  toolSegments: [Rect, Rect, Rect];
  dirBtn: Rect;
  /** Y donde empieza la zona del tablero. */
  boardTop: number;
}

function segmentsOf(bar: Rect): [Rect, Rect, Rect] {
  const w = bar.w / 3;
  const seg = (i: number): Rect => ({ x: bar.x - bar.w / 2 + w / 2 + i * w, y: bar.y, w, h: bar.h });
  return [seg(0), seg(1), seg(2)];
}

export function computeHudLayout(width: number = DESIGN_WIDTH): HudLayout {
  const barW = width - 2 * MARGIN;
  const titleY = 56;
  const modeBarY = 158;
  const toolbarY = 378;
  const dirY = toolbarY + BUTTON_H / 2 + 22 + DIRECTION_BTN_H / 2;
  const boardTop = dirY + DIRECTION_BTN_H / 2 + 24;

  const statsBtn: Rect = { x: width - MARGIN - ICON_BTN / 2, y: titleY, w: ICON_BTN, h: ICON_BTN };
  const modeBar: Rect = { x: width / 2, y: modeBarY, w: barW, h: BUTTON_H };
  const toolbar: Rect = { x: width / 2, y: toolbarY, w: barW, h: BUTTON_H };

  return {
    backBtn: { x: MARGIN + 100, y: titleY, w: 200, h: ICON_BTN },
    statsBtn,
    sparksRight: { x: statsBtn.x - ICON_BTN / 2 - 16, y: titleY },
    modeBar,
    modeSegments: segmentsOf(modeBar),
    levelPos: { x: MARGIN, y: 254 },
    timePos: { x: width - MARGIN, y: 246 },
    tapsPos: { x: width - MARGIN, y: 286 },
    toolbar,
    toolSegments: segmentsOf(toolbar),
    dirBtn: { x: width / 2, y: dirY, w: barW, h: DIRECTION_BTN_H },
    boardTop,
  };
}

export interface MenuLayout {
  titleY: number;
  sparksY: number;
  /** Una tarjeta por puzzle, de arriba abajo. */
  cards: [Rect, Rect, Rect];
  modeLabelY: number;
  /** Relajado, Normal y Reto. */
  modes: [Rect, Rect, Rect];
  /** Estadísticas, Aspectos y Ajustes. */
  tools: [Rect, Rect, Rect];
  greetingY: number;
}

/**
 * Diseño del menú principal: el nombre arriba, las tarjetas de los puzzles centradas en el espacio que sobra, los modos
 * en medio de la pantalla, los accesos (estadísticas, aspectos y ajustes) y, hasta abajo, el mensaje de bienvenida.
 * Todo lo de abajo se ancla al borde inferior, así que en pantallas altas solo crece el aire entre bloques.
 */
export function computeMenuLayout(width: number = DESIGN_WIDTH, height: number = MIN_GAME_HEIGHT): MenuLayout {
  const barW = width - 2 * MARGIN;
  const gap = 12;
  const btnW = (barW - 2 * gap) / 3;
  const row = (y: number): [Rect, Rect, Rect] =>
    [0, 1, 2].map((i) => ({ x: width / 2 + (i - 1) * (btnW + gap), y, w: btnW, h: BUTTON_H })) as [Rect, Rect, Rect];
  const cardH = 172;
  const pitch = 192;
  const center = (height - 200) / 2;
  const cards = [-1, 0, 1].map((i) => ({ x: width / 2, y: center + i * pitch, w: barW, h: cardH })) as [Rect, Rect, Rect];
  return {
    titleY: 104,
    sparksY: 190,
    cards,
    modeLabelY: height - 420,
    modes: row(height - 350),
    tools: row(height - 220),
    greetingY: height - 96,
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
