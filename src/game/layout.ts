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

/**
 * Pantalla de inicio del menú: el nombre, las Chispas y la racha; el botón principal (un toque y a jugar: «Jugar» para
 * quien empieza, «Continuar» para quien vuelve), «Elegir puzzle», los accesos y el saludo hasta abajo.
 */
export interface HomeLayout {
  titleY: number;
  sparksY: number;
  /** Línea de la racha y las estrellas, bajo las Chispas. */
  streakY: number;
  /** Botón principal: entra directo a jugar. */
  play: Rect;
  /** «Elegir puzzle»: la pantalla de puzzles y modos. */
  puzzles: Rect;
  /** Aspectos, Estadísticas y Ajustes, en columna. */
  buttons: [Rect, Rect, Rect];
  greetingY: number;
}

export function computeHomeLayout(width: number = DESIGN_WIDTH, height: number = MIN_GAME_HEIGHT): HomeLayout {
  const w = Math.min(480, width - 2 * MARGIN);
  const titleY = Math.round(height * 0.17);
  const playY = Math.round(height * 0.42);
  const button = (dy: number): Rect => ({ x: width / 2, y: playY + dy, w, h: 96 });
  return {
    titleY,
    sparksY: titleY + 84,
    streakY: titleY + 140,
    play: { x: width / 2, y: playY, w, h: 132 },
    puzzles: button(146),
    buttons: [button(262), button(378), button(494)],
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
  /** Una tarjeta por puzzle (Circuitos, Luces, Hilos y Claves). */
  cards: Rect[];
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
  // Las tarjetas se centran entre el título y el modo; con poco alto se acercan (nunca bajan de 150 de alto)
  const count = 4;
  const areaTop = 214;
  const areaBottom = height - 290;
  const step = Math.min(196, Math.floor((areaBottom - areaTop) / count));
  const cardH = Math.min(176, step - 14);
  const center = (areaTop + areaBottom) / 2;
  const cards = Array.from({ length: count }, (_, i) => ({ x: width / 2, y: center + (i - (count - 1) / 2) * step, w: barW, h: cardH }));
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

/**
 * Pantalla de Claves (bajo el panel del nivel), como un solo bloque **centrado** en el espacio libre: arriba la tabla de
 * intentos (encabezado «#  Número  Aciertos  Posiciones» y una fila por intento, de arriba abajo), en medio las casillas del número que se escribe y abajo el
 * teclado. El teclado solo tiene **las cifras que se usan en el nivel** (con 1 a 4 hay cuatro teclas, no diez con seis
 * bloqueadas): hasta 6 en una fila y, si son más, en dos filas centradas (`1 2 3 4 5` / `6 7 8 9 0`). Debajo, «Borrar»
 * y un «Probar» ancho.
 */
export interface CodeLayout {
  /** Teclas de las cifras 0 a 9 (índice = cifra); null si la cifra no se usa en el nivel. */
  digits: Array<Rect | null>;
  erase: Rect;
  submit: Rect;
  /** Casillas del número que se escribe. */
  slots: Rect[];
  /** Encabezado de la tabla de intentos («#  Número  Aciertos  Posiciones»): centro vertical. */
  headerY: number;
  /** Zona de la lista de intentos (debajo del encabezado) y alto de cada fila. */
  history: Rect;
  rowH: number;
  /** Lado de cada cifra en la lista de intentos. */
  tile: number;
  /** Aviso corto («¡Casi!»), encima de las casillas. */
  messageY: number;
}

export const CODE_KEY_H = 96;
export const CODE_ROW_H = 80;
/** Alto del encabezado de la tabla de intentos. */
export const CODE_HEADER_H = 44;
/** Filas de intentos que se ven como mucho (si hay más, la lista se desliza). */
export const CODE_MAX_VISIBLE_ROWS = 6;

/** Cifras del teclado en el orden del teléfono: 1 a 9 y el 0 al final. */
export function codeKeypadDigits(low: number, high: number): number[] {
  const out: number[] = [];
  for (let d = Math.max(1, low); d <= Math.min(9, high); d++) out.push(d);
  if (low <= 0 && high >= 0) out.push(0);
  return out;
}

export function computeCodeLayout(width: number, height: number, boardTop: number, length: number, low = 0, high = 9): CodeLayout {
  const barW = width - 2 * MARGIN;
  const gap = 10;
  const keys = codeKeypadDigits(low, high);
  const n = keys.length;
  // Hasta 6 cifras en una fila; si son más, dos filas (la de arriba con una más si son impares)
  const perRow = n <= 6 ? n : Math.ceil(n / 2);
  const digitRows = n <= 6 ? 1 : 2;
  const keyW = Math.min((barW - 4 * gap) / 5, (barW - (perRow - 1) * gap) / perRow);
  const slotGap = 14;
  const avail = height - MARGIN - boardTop;
  // En pantallas bajas se aprietan los espacios (y un poco las teclas, sin bajar de 88) para que quepan 3 intentos
  const sizes = (compact: boolean) => {
    const keyH = compact ? 90 : CODE_KEY_H;
    const slot = Math.min(compact ? 92 : 100, Math.floor((barW - (length - 1) * slotGap) / length));
    const gapHistory = compact ? 14 : 26;
    const gapKeypad = compact ? 20 : 34;
    const keypadH = (digitRows + 1) * keyH + digitRows * gap;
    const rowH = compact ? 70 : CODE_ROW_H;
    return { keyH, slot, gapHistory, gapKeypad, keypadH, rowH, tile: compact ? 54 : 60, fixed: gapHistory + slot + gapKeypad + keypadH };
  };
  const roomy = sizes(false);
  const headerH = CODE_HEADER_H;
  const { keyH, slot, gapHistory, gapKeypad, fixed, rowH, tile } = avail - roomy.fixed - CODE_HEADER_H >= 3 * CODE_ROW_H ? roomy : sizes(true);
  // Un número entero de filas: al deslizar no queda media fila oculta con un hueco encima
  const historyH = rowH * Math.max(1, Math.min(CODE_MAX_VISIBLE_ROWS, Math.floor((avail - fixed - headerH) / rowH)));
  const total = headerH + historyH + fixed;
  const top = boardTop + Math.max(0, (avail - total) / 2);

  const historyTop = top + headerH;
  const slotsY = historyTop + historyH + gapHistory + slot / 2;
  const keypadTop = slotsY + slot / 2 + gapKeypad;

  const digits: Array<Rect | null> = new Array(10).fill(null);
  keys.forEach((d, i) => {
    const row = digitRows === 1 ? 0 : i < perRow ? 0 : 1;
    const inRow = row === 0 ? Math.min(perRow, n) : n - perRow;
    const col = row === 0 ? i : i - perRow;
    const rowW = inRow * keyW + (inRow - 1) * gap;
    digits[d] = {
      x: width / 2 - rowW / 2 + keyW / 2 + col * (keyW + gap),
      y: keypadTop + keyH / 2 + row * (keyH + gap),
      w: keyW,
      h: keyH,
    };
  });
  const actionY = keypadTop + digitRows * (keyH + gap) + keyH / 2;
  const eraseW = 190;
  const submitW = barW - eraseW - gap;

  const slotsW = length * slot + (length - 1) * slotGap;
  const slots = Array.from({ length }, (_, i) => ({ x: width / 2 - slotsW / 2 + slot / 2 + i * (slot + slotGap), y: slotsY, w: slot, h: slot }));
  return {
    digits,
    erase: { x: MARGIN + eraseW / 2, y: actionY, w: eraseW, h: keyH },
    submit: { x: width - MARGIN - submitW / 2, y: actionY, w: submitW, h: keyH },
    slots,
    headerY: top + headerH / 2,
    history: { x: width / 2, y: historyTop + historyH / 2, w: barW, h: historyH },
    rowH,
    tile,
    // El aviso va sobre las casillas (vacías tras probar), sin tapar el intento que se acaba de revelar
    messageY: slotsY,
  };
}
