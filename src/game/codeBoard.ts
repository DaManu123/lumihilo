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
 * Cada intento se revela con emoción: las cifras se dan vuelta una a una con una nota que sube, después los dos
 * contadores se llenan punto a punto y, si va cerca (le falta una sola cifra en su lugar), el último punto se hace
 * esperar. «En su lugar» es un círculo lleno del color principal; «en otro lugar», un anillo azul: la forma distingue
 * las dos cosas aunque no se vean los colores.
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
const countTexture = (scene: Phaser.Scene, kind: 'exact' | 'misplaced', r: number): string =>
  bakeTexture(scene, `count|${kind}|${r}`, 2 * r + 8, 2 * r + 8, (g) => drawCountIcon(g, kind, 0, 0, r));

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

type KeyLook = 'normal' | 'out' | 'in' | 'disabled' | 'primary' | 'notes';

/** Fondo de una tecla, centrado en (0, 0). */
function paintKey(g: Phaser.GameObjects.Graphics, w: number, h: number, look: KeyLook): void {
  const left = -w / 2;
  const top = -h / 2;
  if (look === 'primary') {
    g.fillStyle(THEME.primary, 1);
    g.fillRoundedRect(left, top, w, h, 22);
    return;
  }
  const fill = look === 'disabled' ? mixColors(THEME.surface, THEME.background, 0.7) : look === 'out' ? mixColors(THEME.surface, THEME.background, 0.55) : THEME.surface;
  g.fillStyle(fill, 1);
  g.fillRoundedRect(left, top, w, h, 22);
  if (look === 'disabled') return;
  const border = look === 'in' ? THEME.primary : look === 'notes' ? THEME.accent : THEME.cardBorder;
  g.lineStyle(look === 'in' || look === 'notes' ? 4 : 2, border, 1);
  g.strokeRoundedRect(left + 1, top + 1, w - 2, h - 2, 22);
}

/** Lo que va encima de una tecla: tachada, punto de «está» y el lápiz del modo notas. Centrado en (0, 0). */
function paintKeyMark(g: Phaser.GameObjects.Graphics, w: number, h: number, note: DigitNote, notes: boolean): void {
  if (note === 'out') {
    g.lineStyle(5, THEME.wireOff, 1);
    g.lineBetween(-w * 0.26, h * 0.26, w * 0.26, -h * 0.26);
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

/** Lo que se dibuja de una fila de la lista, para poder animarla. */
interface RowView {
  container: Phaser.GameObjects.Container;
  tiles: Array<{ box: Phaser.GameObjects.Container; img: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text }>;
  exact: { icon: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text };
  misplaced: { icon: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text };
}

/**
 * Fila de un intento: número de intento, las cifras y los dos contadores. Se usa en el juego y en el tutorial.
 * `x` es el borde izquierdo y `w` el ancho disponible.
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
  colors: boolean
): RowView {
  const scene = host.scene;
  const container = scene.add.container(0, y);
  parent.add(container);
  let left = x;
  if (index !== null) {
    container.add(host.text(x + 4, 0, String(index), { size: FONT.small, display: true, weight: '500', color: THEME.mutedText }));
    left = x + 56;
  }
  const gap = Math.round(tile * 0.14);
  const tiles = row.guess.map((digit, i) => {
    const box = scene.add.container(left + tile / 2 + i * (tile + gap), 0);
    const mark = colors && row.marks ? row.marks[i] : 'plain';
    const img = scene.add.image(0, 0, tileTexture(scene, tile, mark));
    const text = host.text(0, 2, String(digit), { size: Math.round(tile * 0.55), display: true, color: digitColor(mark), originX: 0.5 });
    box.add([img, text]);
    container.add(box);
    return { box, img, text };
  });
  // Contadores a la derecha: «● 2   ○ 1»
  const right = x + w;
  const groupW = 96;
  const counter = (kind: 'exact' | 'misplaced', cx: number, value: number) => {
    const icon = scene.add.image(cx - 22, 0, countTexture(scene, kind, 16));
    const text = host.text(cx + 2, 2, String(value), { size: 34, display: true, color: value > 0 ? THEME.text : THEME.mutedText });
    container.add([icon, text]);
    return { icon, text };
  };
  const exact = counter('exact', right - groupW * 2 + 30, row.score.exact);
  const misplaced = counter('misplaced', right - groupW + 30, row.score.misplaced);
  return { container, tiles, exact, misplaced };
}

export class CodeBoard {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly list: Phaser.GameObjects.Container;
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
    const zone = this.scene.add.zone(h.x, h.y, h.w, h.h).setInteractive();
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => (this.dragFrom = { y: p.y, scroll: this.scroll }));
    zone.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragFrom || !p.isDown) return;
      this.setScroll(this.dragFrom.scroll + (p.y - this.dragFrom.y));
    });
    zone.on('pointerup', () => (this.dragFrom = null));
    zone.on('pointerout', () => (this.dragFrom = null));
    zone.on('wheel', (_p: Phaser.Input.Pointer, _dx: number, dy: number) => this.setScroll(this.scroll - dy));
    this.root.add([zone, this.list]);

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
      const img = this.scene.add.image(rect.x, rect.y, '__DEFAULT');
      const mark = this.scene.add.image(rect.x, rect.y, '__DEFAULT').setVisible(false);
      const text = this.host.text(rect.x, rect.y + 2, String(d), { size: 40, display: true, originX: 0.5 });
      this.root.add([img, text, mark, add(rect, () => this.events.digit(d))]);
      this.keyViews[d] = { rect, img, text, mark };
    }
    const erase = this.layout.erase;
    const eraseKey = bakeTexture(this.scene, `erase|${erase.w}x${erase.h}`, erase.w, erase.h, (g) => {
      paintKey(g, erase.w, erase.h, 'normal');
      drawIcon(g, 'erase', 0, 0, 46, cssToNumber(THEME.text), THEME.surface);
    });
    this.root.add([this.scene.add.image(erase.x, erase.y, eraseKey), add(erase, () => this.events.erase())]);

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
    this.rowViews = [];
    const h = this.layout.history;
    const { rows, params } = this.state;
    const contentH = rows.length * this.layout.rowH;
    this.maxScroll = Math.max(0, contentH - h.h);
    rows.forEach((row, i) => {
      const y = this.rowY(i);
      this.rowViews.push(buildCodeRow(this.host, this.list, h.x - h.w / 2, y, h.w, this.layout.tile, row, i + 1, params.colors));
    });
    // Sin intentos: qué hacer y qué significa cada símbolo
    this.emptyHelp?.destroy();
    this.emptyHelp = undefined;
    if (rows.length === 0) this.buildEmptyHelp();
    this.setScroll(-this.maxScroll);
  }

  /** Y de la fila `i` sin desplazar: la última queda abajo del todo de la lista. */
  private rowY(i: number): number {
    const h = this.layout.history;
    const contentH = this.state.rows.length * this.layout.rowH;
    const bottom = h.y + h.h / 2;
    const top = contentH <= h.h ? bottom - contentH : h.y - h.h / 2;
    return top + this.layout.rowH * i + this.layout.rowH / 2;
  }

  private setScroll(value: number): void {
    // El desplazamiento va de -maxScroll (lo más nuevo a la vista) a 0 (el primer intento)
    this.scroll = Math.max(-this.maxScroll, Math.min(0, value));
    this.list.y = this.scroll;
    // Solo se ven las filas que caben enteras en la zona de la lista
    const h = this.layout.history;
    const top = h.y - h.h / 2 - 1;
    const bottom = h.y + h.h / 2 + 1;
    const half = this.layout.rowH / 2;
    for (const view of this.rowViews) {
      const y = view.container.y + this.scroll;
      view.container.setVisible(y - half >= top - half * 0.2 && y + half <= bottom + half * 0.2);
    }
  }

  private buildEmptyHelp(): void {
    const h = this.layout.history;
    const c = this.scene.add.container(0, 0);
    const { params } = this.state;
    const lines = [t('Escribe un número y toca «Probar».')];
    const title = this.host.text(h.x, h.y - 56, lines[0], { size: 30, weight: '600', align: 'center', wrap: h.w - 40, originX: 0.5 });
    c.add(title);
    // Leyenda de los dos símbolos
    const legend = (kind: 'exact' | 'misplaced', y: number, label: string) => {
      const icon = this.scene.add.image(h.x - h.w / 2 + 70, y, countTexture(this.scene, kind, 16));
      const text = this.host.text(h.x - h.w / 2 + 104, y, label, { size: FONT.small, weight: '500', color: THEME.mutedText, wrap: h.w - 130 });
      c.add([icon, text]);
    };
    legend('exact', h.y + 4, t('cifras en su lugar'));
    legend('misplaced', h.y + 52, t('cifras que están, pero en otro lugar'));
    if (params.colors) {
      const note = this.host.text(h.x, h.y + 104, t('Cada cifra se pinta: llena si está en su lugar, con borde si está en otro.'), {
        size: FONT.small,
        weight: '500',
        color: THEME.mutedText,
        align: 'center',
        wrap: h.w - 40,
        originX: 0.5,
      });
      c.add(note);
    }
    // Que no se salga de la zona de la lista en pantallas bajas
    if (c.getBounds().height > h.h) c.setVisible(false);
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
      const { rect } = view;
      const allowed = digitAllowed(params, d);
      const note = allowed ? notes[d] : null;
      view.img.setTexture(this.keyTexture(rect, !allowed ? 'disabled' : notesMode ? 'notes' : note === 'out' ? 'out' : note === 'in' ? 'in' : 'normal'));
      view.text.setColor(note === 'out' || !allowed ? THEME.mutedText : THEME.text);
      view.text.setAlpha(allowed ? 1 : 0.35);
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
      tile.img.setTexture(tileTexture(this.scene, this.layout.tile, 'plain'));
      tile.text.setColor(THEME.text);
      if (!fast) tile.box.setScale(1, 0.05);
    });
    view.exact.text.setText('0').setColor(THEME.mutedText);
    view.misplaced.text.setText('0').setColor(THEME.mutedText);
    view.exact.icon.setAlpha(0.35);
    view.misplaced.icon.setAlpha(0.35);

    let t0 = 0;
    view.tiles.forEach((tile, i) => {
      this.scene.time.delayedCall(t0 + i * step, () => {
        if (!tile.box.active) return;
        this.sounds.flip(i);
        const mark = state.params.colors && row.marks ? row.marks[i] : 'plain';
        tile.img.setTexture(tileTexture(this.scene, this.layout.tile, mark));
        tile.text.setColor(digitColor(mark));
        if (!fast) this.scene.tweens.add({ targets: tile.box, scaleY: 1, duration: this.host.dur(140), ease: 'Back.easeOut' });
      });
    });
    t0 += length * step + (fast ? 0 : this.host.dur(160));

    const pop = (target: Phaser.GameObjects.Text) => {
      if (fast || !target.active) return;
      this.scene.tweens.add({ targets: target, scale: 1.45, duration: 90, yoyo: true, ease: 'Sine.easeOut' });
    };

    // «En su lugar», punto a punto; el último se hace esperar si va cerca
    const close = row.score.exact >= length - 1;
    for (let k = 1; k <= row.score.exact; k++) {
      const last = k === row.score.exact;
      if (last && close && !fast) {
        // Redoble: tres golpecitos con el contador latiendo
        for (let s = 0; s < 3; s++) {
          this.scene.time.delayedCall(t0 + s * this.host.dur(170), () => {
            if (!view.exact.text.active) return;
            this.sounds.suspense(s);
            this.scene.tweens.add({ targets: view.exact.icon, alpha: 0.4, duration: 80, yoyo: true });
          });
        }
        t0 += 3 * this.host.dur(170) + this.host.dur(120);
      }
      this.scene.time.delayedCall(t0, () => {
        if (!view.exact.text.active) return;
        view.exact.text.setText(String(k)).setColor(THEME.text);
        view.exact.icon.setAlpha(1);
        this.sounds.count('exact', k);
        pop(view.exact.text);
      });
      t0 += countStep;
    }
    for (let k = 1; k <= row.score.misplaced; k++) {
      this.scene.time.delayedCall(t0, () => {
        if (!view.misplaced.text.active) return;
        view.misplaced.text.setText(String(k)).setColor(THEME.text);
        view.misplaced.icon.setAlpha(1);
        this.sounds.count('misplaced', k);
        pop(view.misplaced.text);
      });
      t0 += countStep;
    }
    this.scene.time.delayedCall(t0 + (fast ? 0 : 120), () => {
      this.busy = false;
      if (view.container.active) {
        if (row.score.exact > 0) view.exact.icon.setAlpha(1);
        if (row.score.misplaced > 0) view.misplaced.icon.setAlpha(1);
      }
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
        tile.img.setTexture(tileTexture(this.scene, this.layout.tile, 'win'));
        tile.text.setColor(THEME.onPrimary);
        const m = tile.box.getWorldTransformMatrix();
        onStep(i, m.tx, m.ty);
        if (!fast) this.scene.tweens.add({ targets: tile.box, scale: 1.25, duration: 140, yoyo: true, ease: 'Sine.easeOut' });
      });
    });
    return fast ? 300 : view.tiles.length * step + 520;
  }
}
