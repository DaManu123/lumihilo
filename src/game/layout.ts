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

/** Pantalla de inicio del menú: el nombre, «Jugar» y los accesos, y el saludo hasta abajo. */
export interface HomeLayout {
  titleY: number;
  sparksY: number;
  /** Botón principal «Jugar». */
  play: Rect;
  /** Aspectos, Estadísticas y Ajustes, en columna. */
  buttons: [Rect, Rect, Rect];
  greetingY: number;
}

export function computeHomeLayout(width: number = DESIGN_WIDTH, height: number = MIN_GAME_HEIGHT): HomeLayout {
  const w = Math.min(480, width - 2 * MARGIN);
  const titleY = Math.round(height * 0.2);
  const playY = Math.round(height * 0.44);
  const button = (dy: number): Rect => ({ x: width / 2, y: playY + dy, w, h: 96 });
  return {
    titleY,
    sparksY: titleY + 84,
    play: { x: width / 2, y: playY, w, h: 120 },
    buttons: [button(140), button(256), button(372)],
    greetingY: height - 96,
  };
}

/**
 * Pantalla de puzzles («Jugar»): «Volver» arriba a la izquierda, el título, una tarjeta por puzzle centrada en el espacio
 * que sobra y, en la parte de abajo, el modo (con una línea que lo explica). Lo de abajo se ancla al borde inferior.
 */
export interface PlayLayout {
  backBtn: Rect;
  sparksRight: Point;
  titleY: number;
  cards: [Rect, Rect, Rect];
  modeLabelY: number;
  /** Relajado, Normal y Reto. */
  modes: [Rect, Rect, Rect];
  modeInfoY: number;
}

export function computePlayLayout(width: number = DESIGN_WIDTH, height: number = MIN_GAME_HEIGHT): PlayLayout {
  const barW = width - 2 * MARGIN;
  const gap = 12;
  const btnW = (barW - 2 * gap) / 3;
  const modesY = height - 190;
  const center = (height - 70) / 2;
  const cards = [-1, 0, 1].map((i) => ({ x: width / 2, y: center + i * 196, w: barW, h: 176 })) as [Rect, Rect, Rect];
  return {
    backBtn: { x: MARGIN + 100, y: 56, w: 200, h: ICON_BTN },
    sparksRight: { x: width - MARGIN, y: 56 },
    titleY: 170,
    cards,
    modeLabelY: height - 260,
    modes: [0, 1, 2].map((i) => ({ x: width / 2 + (i - 1) * (btnW + gap), y: modesY, w: btnW, h: BUTTON_H })) as [Rect, Rect, Rect],
    modeInfoY: height - 90,
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
