import Phaser from 'phaser';
import type { CodeParams, DigitMark, DigitNote, GuessScore } from '../core/code';
import { digitAllowed } from '../core/code';
import { t } from '../core/i18n';
import { THEME } from './theme';
import { mixColors } from './color';
import { drawIcon } from './icons';
import { CodeLayout, FONT, Rect } from './layout';

/**
 * Pantalla del puzzle Claves (solo dibujo y animación; el estado del juego vive en `GameScene` y la lógica en
 * `core/code.ts`): la lista de intentos, las casillas del número que se escribe y el teclado.
 *
 * Los intentos van en una **tabla** con encabezado: «#», «Número», «Aciertos» (cuántas cifras del número están en la
 * clave, en cualquier lugar) y «Posiciones» (cuántas de esas están además en su lugar). Cada intento se revela con
 * emoción: las cifras se dan vuelta una a una con una nota que sube, después cuentan los aciertos y luego las posiciones
 * y, si va cerca (le falta una sola cifra en su lugar), la última posición se hace esperar.
 */

export interface CodeTextOptions {
  size?: number;
  color?: string;
  weight?: string;
  display?: boolean;
  originX?: number;
  wrap?: number;
  align?: 'left' | 'center' | 'right';
}

export interface CodeBoardHost {
  scene: Phaser.Scene;
  text(x: number, y: number, text: string, opts?: CodeTextOptions): Phaser.GameObjects.Text;
  reducedMotion(): boolean;
  /** Duración ajustada a la velocidad de animación elegida. */
  dur(ms: number): number;
}

export interface CodeRow {
  guess: number[];
  score: GuessScore;
  /** Marca de cada cifra (solo en los niveles con colores). */
  marks?: DigitMark[];
}

export interface CodeBoardState {
  params: CodeParams;
  rows: CodeRow[];
  /** Número que se escribe (null = casilla vacía). */
  input: Array<number | null>;
  /** Posiciones reveladas por una pista (su cifra queda fija). */
  revealed: boolean[];
  /** Cifras de la clave en las posiciones reveladas. */
  revealedDigits: Array<number | null>;
  /** Lo que se ve en cada tecla: anotada por el jugador o deducida. */
  notes: DigitNote[];
  notesMode: boolean;
  /** Límite de intentos (modo Reto) o null. */
  maxGuesses: number | null;
}

export interface CodeBoardEvents {
  digit(d: number): void;
  erase(): void;
  submit(): void;
}

export interface CodeSounds {
  key(digit: number): void;
  flip(index: number): void;
  count(kind: 'exact' | 'misplaced', index: number): void;
  suspense(step: number): void;
}

/** Color numérico a partir de uno CSS «#rrggbb» (los textos del tema vienen en CSS). */
const cssToNumber = (css: string): number => parseInt(css.replace('#', '').slice(0, 6), 16);

const themeTag = (): string => `${THEME.name}|${THEME.skin}|${THEME.primary}|${THEME.surface}|${THEME.cardBorder}|${THEME.background}`;

/**
 * Pinta una sola vez en una textura y devuelve su clave: un `Graphics` de Phaser se vuelve a calcular en cada fotograma
 * y con decenas de cifras en pantalla eso costaba ~38 ms por fotograma. `draw` dibuja centrado en (0, 0).
 */
export function bakeTexture(scene: Phaser.Scene, name: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void): string {
  const key = `code|${themeTag()}|${name}`;
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.addDynamicTexture(key, Math.ceil(w), Math.ceil(h));
    if (!texture) return '__DEFAULT';
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    draw(g);
    texture.draw(g, w / 2, h / 2);
    g.destroy();
  }
  return key;
}

type TileLook = DigitMark | 'plain' | 'win';
const tileTexture = (scene: Phaser.Scene, size: number, look: TileLook): string =>
  bakeTexture(scene, `tile|${size}|${look}`, size + 4, size + 4, (g) => paintTile(g, size, look));

/** Color de cada marca: «en su lugar» = principal; «en otro lugar» = azul (el del giro a la derecha). */
const markColor = (mark: 'exact' | 'present'): number => (mark === 'exact' ? THEME.primary : THEME.clockwise);

/** Dibuja el símbolo de un contador: círculo lleno (en su lugar) o anillo (en otro lugar). */
export function drawCountIcon(g: Phaser.GameObjects.Graphics, kind: 'exact' | 'misplaced', x: number, y: number, r: number): void {
  if (kind === 'exact') {
    g.fillStyle(markColor('exact'), 1);
    g.fillCircle(x, y, r);
  } else {
    g.lineStyle(Math.max(4, r * 0.38), markColor('present'), 1);
    g.strokeCircle(x, y, r - Math.max(2, r * 0.19));
  }
}

/** Una cifra de la lista de intentos (o de la clave): fondo según su marca y el número encima. */
export function paintTile(g: Phaser.GameObjects.Graphics, size: number, mark: DigitMark | 'plain' | 'win'): void {
  g.clear();
  const r = Math.round(size * 0.2);
  const half = size / 2;
  if (mark === 'exact' || mark === 'win') {
    g.fillStyle(mark === 'win' ? THEME.primaryGlow : THEME.primary, 1);
    g.fillRoundedRect(-half, -half, size, size, r);
  } else if (mark === 'present') {
    g.fillStyle(mixColors(THEME.surface, THEME.clockwise, 0.14), 1);
    g.fillRoundedRect(-half, -half, size, size, r);
    g.lineStyle(5, THEME.clockwise, 1);
    g.strokeRoundedRect(-half + 2.5, -half + 2.5, size - 5, size - 5, r);
  } else if (mark === 'absent') {
    g.fillStyle(mixColors(THEME.surface, THEME.background, 0.5), 1);
    g.fillRoundedRect(-half, -half, size, size, r);
  } else {
    g.fillStyle(THEME.surface, 1);
    g.fillRoundedRect(-half, -half, size, size, r);
    g.lineStyle(2, THEME.cardBorder, 1);
    g.strokeRoundedRect(-half + 1, -half + 1, size - 2, size - 2, r);
  }
}

type KeyLook = 'normal' | 'in' | 'primary' | 'notes';

/** Fondo de una tecla, centrado en (0, 0). */
function paintKey(g: Phaser.GameObjects.Graphics, w: number, h: number, look: KeyLook): void {
  const left = -w / 2;
  const top = -h / 2;
  if (look === 'primary') {
    g.fillStyle(THEME.primary, 1);
    g.fillRoundedRect(left, top, w, h, 22);
    return;
  }
  // Todas las teclas se ven igual de vivas: anotar una cifra no la bloquea (se puede seguir escribiendo)
  g.fillStyle(THEME.surface, 1);
  g.fillRoundedRect(left, top, w, h, 22);
  const border = look === 'in' ? THEME.primary : look === 'notes' ? THEME.accent : THEME.cardBorder;
  g.lineStyle(look === 'in' || look === 'notes' ? 4 : 2, border, 1);
  g.strokeRoundedRect(left + 1, top + 1, w - 2, h - 2, 22);
}

/**
 * Lo que va encima de una tecla, en la esquina y sin tapar la cifra: una equis pequeña si ya se sabe que no está, un punto
 * si se sabe que está, y el lápiz del modo notas. Centrado en (0, 0).
 */
function paintKeyMark(g: Phaser.GameObjects.Graphics, w: number, h: number, note: DigitNote, notes: boolean): void {
  if (note === 'out') {
    const cx = w / 2 - 18;
    const cy = -h / 2 + 18;
    g.fillStyle(THEME.background, 1);
    g.fillCircle(cx, cy, 12);
    g.lineStyle(3, THEME.wireOff, 1);
    g.lineBetween(cx - 5, cy - 5, cx + 5, cy + 5);
    g.lineBetween(cx - 5, cy + 5, cx + 5, cy - 5);
  } else if (note === 'in') {
    g.fillStyle(THEME.primary, 1);
    g.fillCircle(w / 2 - 16, -h / 2 + 16, 8);
  }
  if (notes) drawIcon(g, 'pencil', -w / 2 + 18, -h / 2 + 18, 20, THEME.accent, THEME.surface);
}

type SlotLook = 'revealed' | 'active' | 'filled' | 'empty';

/** Casilla del número que se escribe, centrada en (0, 0). */
function paintSlot(g: Phaser.GameObjects.Graphics, w: number, h: number, look: SlotLook): void {
  const left = -w / 2;
  const top = -h / 2;
  if (look === 'revealed') {
    g.fillStyle(THEME.primary, 1);
    g.fillRoundedRect(left, top, w, h, 20);
    return;
  }
  g.fillStyle(THEME.surface, 1);
  g.fillRoundedRect(left, top, w, h, 20);
  const active = look === 'active';
  g.lineStyle(active ? 5 : 3, active ? THEME.primary : look === 'filled' ? THEME.wireOffHub : THEME.cardBorder, 1);
  g.strokeRoundedRect(left + 1.5, top + 1.5, w - 3, h - 3, 20);
  if (active) {
    // Rayita donde va la siguiente cifra
    g.fillStyle(THEME.primary, 1);
    g.fillRoundedRect(-w * 0.2, h * 0.28, w * 0.4, 6, 3);
  }
}

const digitColor = (mark: DigitMark | 'plain' | 'win'): string =>
  mark === 'exact' || mark === 'win' ? THEME.onPrimary : mark === 'absent' ? THEME.mutedText : THEME.text;

/** Lo que se dibuja de una fila de la tabla, para poder animarla. */
interface RowView {
  container: Phaser.GameObjects.Container;
  /** Franja de fondo de la fila. */
  bg: Phaser.GameObjects.Image;
  tiles: Array<{ box: Phaser.GameObjects.Container; img: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text }>;
  /** «Aciertos»: cifras del número que están en la clave (en su lugar o no). */
  hits: Phaser.GameObjects.Text;
  /** «Posiciones»: cifras en su lugar. */
  exact: Phaser.GameObjects.Text;
  /** Lado de cada cifra (se achica con muchas cifras para que quepan las columnas). */
  size: number;
}

/** Ancho de las columnas de «Aciertos» y «Posiciones». */
const VALUE_COL_W = 132;

/** Columnas de la tabla de intentos dentro de `[x, x + w]`: número de intento, cifras, aciertos y posiciones. */
export function codeTableColumns(x: number, w: number, length: number, tile: number) {
  const exactX = x + w - VALUE_COL_W / 2;
  const hitsX = exactX - VALUE_COL_W;
  const indexX = x + 30;
  const tilesLeft = x + 60;
  const tilesRight = hitsX - VALUE_COL_W / 2 - 6;
  const size = Math.min(tile, Math.floor((tilesRight - tilesLeft) / (length + (length - 1) * 0.14)));
  const gap = Math.round(size * 0.14);
  const tilesW = length * size + (length - 1) * gap;
  const numberX = (tilesLeft + tilesRight) / 2;
  return { indexX, numberX, hitsX, exactX, size, gap, first: numberX - tilesW / 2 + size / 2 };
}

/** Línea fina horizontal (debajo del encabezado), pintada una vez. */
const lineTexture = (scene: Phaser.Scene, w: number): string =>
  bakeTexture(scene, `hline|${Math.round(w)}`, Math.round(w), 4, (g) => {
    g.fillStyle(THEME.cardBorder, 1);
    g.fillRect(-w / 2, -1, w, 2);
  });

/** Encabezado de la tabla: «#  Número  Aciertos  Posiciones», con una línea debajo. `withIndex` = con la columna «#». */
export function buildCodeHeader(
  host: CodeBoardHost,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  length: number,
  tile: number,
  withIndex = true
): Phaser.GameObjects.Container {
  const scene = host.scene;
  const c = scene.add.container(0, y);
  parent.add(c);
  const col = codeTableColumns(x, w, length, tile);
  const label = (cx: number, text: string, maxW: number) => {
    const l = host.text(cx, 0, text, { size: FONT.small, weight: '700', color: THEME.mutedText, originX: 0.5 });
    if (l.width > maxW) l.setScale(maxW / l.width);
    c.add(l);
  };
  if (withIndex) label(col.indexX, '#', 50);
  label(col.numberX, t('Número'), col.hitsX - VALUE_COL_W / 2 - col.indexX - 30);
  label(col.hitsX, t('Aciertos'), VALUE_COL_W - 8);
  label(col.exactX, t('Posiciones'), VALUE_COL_W - 8);
  c.add(scene.add.image(x + w / 2, 24, lineTexture(scene, w)));
  return c;
}

/**
 * Fila de la tabla de un intento: número de intento, las cifras, los aciertos y las posiciones. Se usa en el juego y en el
 * tutorial. `x` es el borde izquierdo y `w` el ancho de la tabla.
 */
export function buildCodeRow(
  host: CodeBoardHost,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  tile: number,
  row: CodeRow,
  index: number | null,
  colors: boolean,
  /**
   * Dónde poner la franja de fondo (por defecto, en la fila). La lista del juego las junta todas en una capa aparte: así se
   * dibujan seguidas con la misma textura, en un solo lote, en vez de cambiar de textura en cada fila (~2 ms por fotograma).
   */
  bgParent?: Phaser.GameObjects.Container
): RowView {
  const scene = host.scene;
  const container = scene.add.container(0, y);
  parent.add(container);
  const col = codeTableColumns(x, w, row.guess.length, tile);
  const bgW = Math.round(w);
  const bgH = col.size + 12;
  const bg = scene.add.image(x + w / 2, bgParent ? y : 0, bakeTexture(scene, `rowbg|${bgW}x${bgH}`, bgW, bgH, (g) => {
    g.fillStyle(THEME.surface, 0.55);
    g.fillRoundedRect(-bgW / 2, -bgH / 2, bgW, bgH, 18);
  }));
  (bgParent ?? container).add(bg);
  if (index !== null) {
    container.add(host.text(col.indexX, 2, String(index), { size: FONT.small, display: true, weight: '500', color: THEME.mutedText, originX: 0.5 }));
  }
  const tiles = row.guess.map((digit, i) => {
    const box = scene.add.container(col.first + i * (col.size + col.gap), 0);
    const mark = colors && row.marks ? row.marks[i] : 'plain';
    const img = scene.add.image(0, 0, tileTexture(scene, col.size, mark));
    const text = host.text(0, 2, String(digit), { size: Math.round(col.size * 0.55), display: true, color: digitColor(mark), originX: 0.5 });
    box.add([img, text]);
    container.add(box);
    return { box, img, text };
  });
  const hitsValue = row.score.exact + row.score.misplaced;
  const value = (cx: number, n: number, strong: string) =>
    host.text(cx, 2, String(n), { size: 38, display: true, color: n > 0 ? strong : THEME.mutedText, originX: 0.5 });
  const hits = value(col.hitsX, hitsValue, THEME.text);
  const exact = value(col.exactX, row.score.exact, THEME.primaryCss);
  container.add([hits, exact]);
  return { container, bg, tiles, hits, exact, size: col.size };
}

export class CodeBoard {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly list: Phaser.GameObjects.Container;
  /** Fondos de las filas (debajo de la lista, en un solo lote). */
  private readonly bgList: Phaser.GameObjects.Container;
  private rowViews: RowView[] = [];
  private slotViews: Array<{ img: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text; lock: Phaser.GameObjects.Image }> = [];
  private keyViews: Array<{ rect: Rect; img: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text; mark: Phaser.GameObjects.Image }> = [];
  private submitView!: { img: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text };
  private emptyHelp?: Phaser.GameObjects.Container;
  private message?: Phaser.GameObjects.Container;
  private scroll = 0;
  private maxScroll = 0;
  private dragFrom: { y: number; scroll: number } | null = null;
  /** Mientras se revela un intento no se puede escribir. */
  busy = false;

  constructor(
    private readonly host: CodeBoardHost,
    parent: Phaser.GameObjects.Container,
    private readonly layout: CodeLayout,
    private state: CodeBoardState,
    private readonly events: CodeBoardEvents,
    private readonly sounds: CodeSounds
  ) {
    this.scene = host.scene;
    this.root = this.scene.add.container(0, 0);
    parent.add(this.root);

    // Lista de intentos (se desliza con el dedo o la rueda si no caben). Sin máscara: las filas que quedan fuera de la
    // zona se ocultan, que en WebGL sale mucho más barato que recortar con el búfer de plantilla
    const h = layout.history;
    this.list = this.scene.add.container(0, 0);
    this.bgList = this.scene.add.container(0, 0);
    const zone = this.scene.add.zone(h.x, h.y, h.w, h.h).setInteractive();
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => (this.dragFrom = { y: p.y, scroll: this.scroll }));
    zone.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragFrom || !p.isDown) return;
      this.setScroll(this.dragFrom.scroll + (p.y - this.dragFrom.y));
    });
    zone.on('pointerup', () => (this.dragFrom = null));
    zone.on('pointerout', () => (this.dragFrom = null));
    zone.on('wheel', (_p: Phaser.Input.Pointer, _dx: number, dy: number) => this.setScroll(this.scroll - dy));
    this.root.add([zone, this.bgList, this.list]);
    // Encabezado fijo de la tabla (no se desliza con la lista)
    buildCodeHeader(host, this.root, h.x - h.w / 2, layout.headerY, h.w, state.params.length, layout.tile);

    this.buildSlots();
    this.buildKeys();
    this.rebuildRows();
    this.refresh();
  }

  /** Recibe el estado nuevo y lo dibuja (sin animar). */
  setState(state: CodeBoardState): void {
    const rowsChanged = state.rows.length !== this.rowViews.length;
    this.state = state;
    if (rowsChanged) this.rebuildRows();
    this.refresh();
  }

  /** Rectángulo de la clave (las casillas), para los destellos de los gráficos altos. */
  slotsRect(): Rect {
    const first = this.layout.slots[0];
    const last = this.layout.slots[this.layout.slots.length - 1];
    return { x: first.x - first.w / 2, y: first.y - first.h / 2, w: last.x + last.w / 2 - (first.x - first.w / 2), h: first.h };
  }

  /** Centro de la casilla `i` de la clave. */
  slotCenter(i: number): { x: number; y: number } {
    const s = this.layout.slots[i];
    return { x: s.x, y: s.y };
  }

  // -------------------------------------------------------------------------
  // Construcción
  // -------------------------------------------------------------------------

  private buildSlots(): void {
    const lockKey = bakeTexture(this.scene, 'lock', 30, 30, (g) => drawIcon(g, 'code', 0, 0, 22, cssToNumber(THEME.onPrimary), THEME.primary));
    this.layout.slots.forEach((rect) => {
      const img = this.scene.add.image(rect.x, rect.y, '__DEFAULT');
      const lock = this.scene.add.image(rect.x + rect.w / 2 - 18, rect.y - rect.h / 2 + 18, lockKey).setVisible(false);
      const text = this.host.text(rect.x, rect.y + 3, '', { size: Math.round(rect.h * 0.52), display: true, originX: 0.5 });
      this.root.add([img, text, lock]);
      this.slotViews.push({ img, text, lock });
    });
  }

  private buildKeys(): void {
    const add = (rect: Rect, onTap: () => void) => {
      const zone = this.scene.add.zone(rect.x, rect.y, rect.w, rect.h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', onTap);
      return zone;
    };
    for (let d = 0; d <= 9; d++) {
      const rect = this.layout.digits[d];
      if (!rect) continue; // la cifra no se usa en este nivel: no tiene tecla
      const img = this.scene.add.image(rect.x, rect.y, '__DEFAULT');
      const mark = this.scene.add.image(rect.x, rect.y, '__DEFAULT').setVisible(false);
      const text = this.host.text(rect.x, rect.y + 2, String(d), { size: 40, display: true, originX: 0.5 });
      this.root.add([img, text, mark, add(rect, () => this.events.digit(d))]);
      this.keyViews[d] = { rect, img, text, mark };
    }
    const erase = this.layout.erase;
    const eraseKey = bakeTexture(this.scene, `erase|${erase.w}x${erase.h}`, erase.w, erase.h, (g) => {
      paintKey(g, erase.w, erase.h, 'normal');
      drawIcon(g, 'erase', -erase.w / 2 + 46, 0, 40, cssToNumber(THEME.text), THEME.surface);
    });
    const et = this.host.text(erase.x + 22, erase.y, t('Borrar'), { size: FONT.button, weight: '700', originX: 0.5 });
    if (et.width > erase.w - 90) et.setScale((erase.w - 90) / et.width);
    this.root.add([this.scene.add.image(erase.x, erase.y, eraseKey), et, add(erase, () => this.events.erase())]);

    const submit = this.layout.submit;
    const sImg = this.scene.add.image(submit.x, submit.y, '__DEFAULT');
    const st = this.host.text(submit.x, submit.y, t('Probar'), { size: FONT.button, weight: '700', originX: 0.5 });
    if (st.width > submit.w - 20) st.setScale((submit.w - 20) / st.width);
    this.root.add([sImg, st, add(submit, () => this.events.submit())]);
    this.submitView = { img: sImg, text: st };
  }

  /** Textura de una tecla con su aspecto. */
  private keyTexture(rect: Rect, look: KeyLook): string {
    return bakeTexture(this.scene, `key|${rect.w}x${rect.h}|${look}`, rect.w, rect.h, (g) => paintKey(g, rect.w, rect.h, look));
  }

  private rebuildRows(): void {
    this.list.removeAll(true);
    this.bgList.removeAll(true);
    this.rowViews = [];
    const h = this.layout.history;
    const { rows, params } = this.state;
    const contentH = rows.length * this.layout.rowH;
    this.maxScroll = Math.max(0, contentH - h.h);
    rows.forEach((row, i) => {
      const y = this.rowY(i);
      this.rowViews.push(buildCodeRow(this.host, this.list, h.x - h.w / 2, y, h.w, this.layout.tile, row, i + 1, params.colors, this.bgList));
    });
    // Sin intentos: qué hacer y qué significa cada símbolo
    this.emptyHelp?.destroy();
    this.emptyHelp = undefined;
    if (rows.length === 0) this.buildEmptyHelp();
    this.setScroll(-this.maxScroll);
  }

  /** Y de la fila `i` sin desplazar: como en una tabla, de arriba abajo bajo el encabezado (si no caben, se desliza). */
  private rowY(i: number): number {
    const h = this.layout.history;
    const top = h.y - h.h / 2;
    return top + this.layout.rowH * i + this.layout.rowH / 2;
  }

  private setScroll(value: number): void {
    // El desplazamiento va de -maxScroll (lo más nuevo a la vista) a 0 (el primer intento)
    this.scroll = Math.max(-this.maxScroll, Math.min(0, value));
    this.list.y = this.scroll;
    this.bgList.y = this.scroll;
    // Solo se ven las filas que caben enteras en la zona de la lista
    const h = this.layout.history;
    const top = h.y - h.h / 2 - 1;
    const bottom = h.y + h.h / 2 + 1;
    const half = this.layout.rowH / 2;
    for (const view of this.rowViews) {
      const y = view.container.y + this.scroll;
      const visible = y - half >= top - half * 0.2 && y + half <= bottom + half * 0.2;
      view.container.setVisible(visible);
      view.bg.setVisible(visible);
    }
  }

  private buildEmptyHelp(): void {
    const h = this.layout.history;
    const c = this.scene.add.container(0, 0);
    const { params } = this.state;
    const left = h.x - h.w / 2 + 24;
    let y = h.y - h.h / 2 + 24;
    const line = (text: string, opts: CodeTextOptions) => {
      const l = this.host.text(opts.originX === 0.5 ? h.x : left, y, text, { wrap: h.w - 48, ...opts });
      l.setOrigin(opts.originX ?? 0, 0);
      c.add(l);
      y += l.height + 18;
    };
    line(t('Escribe un número y toca «Probar».'), { size: 30, weight: '600', align: 'center', originX: 0.5 });
    line(t('Aciertos: cuántas cifras de tu número están en la clave.'), { size: FONT.small, weight: '500', color: THEME.mutedText });
    line(t('Posiciones: cuántas de esas están además en su lugar.'), { size: FONT.small, weight: '500', color: THEME.mutedText });
    if (params.colors) line(t('Cada cifra se pinta: llena si está en su lugar, con borde si está en otro.'), { size: FONT.small, weight: '500', color: THEME.mutedText });
    // Que no se salga de la zona de la lista en pantallas bajas
    if (y - (h.y - h.h / 2) > h.h + 10) c.setVisible(false);
    this.root.add(c);
    this.emptyHelp = c;
  }

  // -------------------------------------------------------------------------
  // Dibujo del estado
  // -------------------------------------------------------------------------

  /** Redibuja las casillas y el teclado con el estado actual. */
  refresh(): void {
    const { input, revealed, revealedDigits, params, notes, notesMode } = this.state;
    const nextEmpty = input.findIndex((d, j) => d === null && !revealed[j]);
    this.layout.slots.forEach((rect, i) => {
      const view = this.slotViews[i];
      const digit = revealed[i] ? revealedDigits[i] : input[i];
      const filled = digit !== null && digit !== undefined;
      const look: SlotLook = revealed[i] ? 'revealed' : i === nextEmpty && !this.busy ? 'active' : filled ? 'filled' : 'empty';
      view.img.setTexture(bakeTexture(this.scene, `slot|${rect.w}x${rect.h}|${look}`, rect.w, rect.h, (g) => paintSlot(g, rect.w, rect.h, look)));
      view.text.setText(filled ? String(digit) : '').setColor(revealed[i] ? THEME.onPrimary : THEME.text);
      view.lock.setVisible(revealed[i]);
    });

    for (let d = 0; d <= 9; d++) {
      const view = this.keyViews[d];
      if (!view) continue;
      const { rect } = view;
      const allowed = digitAllowed(params, d);
      const note = allowed ? notes[d] : null;
      view.img.setTexture(this.keyTexture(rect, notesMode ? 'notes' : note === 'in' ? 'in' : 'normal'));
      // La cifra se ve siempre clara: que no esté en la clave no impide probarla
      view.text.setColor(THEME.text);
      const pencil = notesMode && allowed;
      if (note || pencil) {
        view.mark.setTexture(bakeTexture(this.scene, `keymark|${rect.w}x${rect.h}|${note}|${pencil}`, rect.w, rect.h, (g) => paintKeyMark(g, rect.w, rect.h, note, pencil)));
        view.mark.setVisible(true);
      } else {
        view.mark.setVisible(false);
      }
    }

    const complete = input.every((d, i) => d !== null || revealed[i]);
    const ready = complete && !this.busy;
    this.submitView.img.setTexture(this.keyTexture(this.layout.submit, ready ? 'primary' : 'normal'));
    this.submitView.text.setColor(ready ? THEME.onPrimary : THEME.mutedText);
  }

  /** Sacude las casillas (intento no válido). */
  shake(): void {
    if (this.host.reducedMotion()) return;
    const targets = this.slotViews.flatMap((v) => [v.img, v.text, v.lock]);
    this.scene.tweens.add({ targets, x: '+=10', duration: 50, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' });
  }

  /** Aviso corto sobre las casillas («¡Casi!»), que se desvanece solo. */
  say(text: string, tone: 'good' | 'info' = 'info'): void {
    this.message?.destroy();
    const c = this.scene.add.container(this.layout.slots[0] ? this.scene.cameras.main.width / 2 : 0, this.layout.messageY);
    const label = this.host.text(0, 0, text, { size: 30, weight: '700', color: tone === 'good' ? THEME.onPrimary : THEME.text, originX: 0.5 });
    const w = label.width + 48;
    const g = this.scene.add.graphics();
    g.fillStyle(tone === 'good' ? THEME.primary : THEME.surface, 1);
    g.fillRoundedRect(-w / 2, -30, w, 60, 30);
    if (tone !== 'good') {
      g.lineStyle(2, THEME.cardBorder, 1);
      g.strokeRoundedRect(-w / 2, -30, w, 60, 30);
    }
    c.add([g, label]);
    this.root.add(c);
    this.message = c;
    if (this.host.reducedMotion()) {
      this.scene.time.delayedCall(1800, () => c.active && c.destroy());
      return;
    }
    c.setScale(0.6).setAlpha(0);
    this.scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: c, alpha: 0, delay: 1700, duration: 300, onComplete: () => c.active && c.destroy() });
  }

  // -------------------------------------------------------------------------
  // Revelar un intento (con emoción)
  // -------------------------------------------------------------------------

  /**
   * Añade el último intento de `state.rows` y lo revela: las cifras se dan vuelta una a una y luego los contadores se
   * llenan punto a punto. Si le falta una sola cifra en su lugar (o la acertó), el último punto se hace esperar.
   * Llama a `done` al terminar.
   */
  reveal(state: CodeBoardState, done: () => void): void {
    this.state = state;
    this.busy = true;
    this.rebuildRows();
    this.refresh();
    const view = this.rowViews[this.rowViews.length - 1];
    const row = state.rows[state.rows.length - 1];
    if (!view || !row) {
      this.busy = false;
      done();
      return;
    }
    const length = state.params.length;
    const fast = this.host.reducedMotion();
    const step = fast ? 0 : this.host.dur(150);
    const countStep = fast ? 0 : this.host.dur(230);

    // Las cifras empiezan «tapadas» y se dan vuelta
    view.tiles.forEach((tile) => {
      tile.img.setTexture(tileTexture(this.scene, view.size, 'plain'));
      tile.text.setColor(THEME.text);
      if (!fast) tile.box.setScale(1, 0.05);
    });
    view.hits.setText('0').setColor(THEME.mutedText);
    view.exact.setText('0').setColor(THEME.mutedText);

    let t0 = 0;
    view.tiles.forEach((tile, i) => {
      this.scene.time.delayedCall(t0 + i * step, () => {
        if (!tile.box.active) return;
        this.sounds.flip(i);
        const mark = state.params.colors && row.marks ? row.marks[i] : 'plain';
        tile.img.setTexture(tileTexture(this.scene, view.size, mark));
        tile.text.setColor(digitColor(mark));
        if (!fast) this.scene.tweens.add({ targets: tile.box, scaleY: 1, duration: this.host.dur(140), ease: 'Back.easeOut' });
      });
    });
    t0 += length * step + (fast ? 0 : this.host.dur(160));

    const pop = (target: Phaser.GameObjects.Text) => {
      if (fast || !target.active) return;
      this.scene.tweens.add({ targets: target, scale: 1.45, duration: 90, yoyo: true, ease: 'Sine.easeOut' });
    };

    // Primero los aciertos (cifras que están), uno a uno…
    const hitsTotal = row.score.exact + row.score.misplaced;
    for (let k = 1; k <= hitsTotal; k++) {
      this.scene.time.delayedCall(t0, () => {
        if (!view.hits.active) return;
        view.hits.setText(String(k)).setColor(THEME.text);
        this.sounds.count('misplaced', k);
        pop(view.hits);
      });
      t0 += countStep;
    }
    if (hitsTotal > 0 && !fast) t0 += this.host.dur(140);
    // …y después las posiciones; la última se hace esperar si va cerca
    const close = row.score.exact >= length - 1;
    for (let k = 1; k <= row.score.exact; k++) {
      const last = k === row.score.exact;
      if (last && close && !fast) {
        // Redoble: tres golpecitos con el número latiendo
        for (let s = 0; s < 3; s++) {
          this.scene.time.delayedCall(t0 + s * this.host.dur(170), () => {
            if (!view.exact.active) return;
            this.sounds.suspense(s);
            this.scene.tweens.add({ targets: view.exact, alpha: 0.4, duration: 80, yoyo: true });
          });
        }
        t0 += 3 * this.host.dur(170) + this.host.dur(120);
      }
      this.scene.time.delayedCall(t0, () => {
        if (!view.exact.active) return;
        view.exact.setText(String(k)).setColor(THEME.primaryCss).setAlpha(1);
        this.sounds.count('exact', k);
        pop(view.exact);
      });
      t0 += countStep;
    }
    this.scene.time.delayedCall(t0 + (fast ? 0 : 120), () => {
      this.busy = false;
      if (this.root.active) this.refresh();
      done();
    });
  }

  /** La clave se abre: las cifras del último intento se encienden una a una. Devuelve la duración en ms. */
  celebrate(onStep: (i: number, x: number, y: number) => void): number {
    const view = this.rowViews[this.rowViews.length - 1];
    if (!view) return 0;
    const fast = this.host.reducedMotion();
    const step = fast ? 0 : 90;
    view.tiles.forEach((tile, i) => {
      this.scene.time.delayedCall(i * step, () => {
        if (!tile.box.active) return;
        tile.img.setTexture(tileTexture(this.scene, view.size, 'win'));
        tile.text.setColor(THEME.onPrimary);
        const m = tile.box.getWorldTransformMatrix();
        onStep(i, m.tx, m.ty);
        if (!fast) this.scene.tweens.add({ targets: tile.box, scale: 1.25, duration: 140, yoyo: true, ease: 'Sine.easeOut' });
      });
    });
    return fast ? 300 : view.tiles.length * step + 520;
  }
}
