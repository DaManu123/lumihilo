import { describe, it, expect } from 'vitest';
import {
  DESIGN_WIDTH,
  MIN_GAME_HEIGHT,
  MAX_GAME_HEIGHT,
  BUTTON_H,
  FONT,
  Rect,
  computeGameHeight,
  computeHudLayout,
  computeBoardGeometry,
  computeHomeLayout,
  computeCodeLayout,
  codeKeypadDigits,
  MARGIN as CODE_MARGIN,
  computePlayLayout,
} from '../src/game/layout';

/** Un teléfono típico tiene ~390 dp de ancho útil; el lienzo se reduce a esa escala. */
const DP_PER_LOGICAL_PX = 390 / DESIGN_WIDTH;
const MIN_TOUCH_DP = 48;
const MIN_TEXT_DP = 13;

const top = (r: Rect) => r.y - r.h / 2;
const bottom = (r: Rect) => r.y + r.h / 2;
const left = (r: Rect) => r.x - r.w / 2;
const right = (r: Rect) => r.x + r.w / 2;
const overlaps = (a: Rect, b: Rect) =>
  left(a) < right(b) && right(a) > left(b) && top(a) < bottom(b) && bottom(a) > top(b);

describe('Diseño adaptable (src/game/layout.ts)', () => {
  describe('computeGameHeight', () => {
    it('adapta el alto a la proporción de la pantalla', () => {
      expect(computeGameHeight(1080, 1920)).toBe(1280); // 16:9
      expect(computeGameHeight(1080, 2400)).toBe(1600); // 20:9
    });

    it('limita el alto entre el mínimo y el máximo', () => {
      expect(computeGameHeight(1920, 1080)).toBe(MIN_GAME_HEIGHT); // apaisado / escritorio
      expect(computeGameHeight(500, 3000)).toBe(MAX_GAME_HEIGHT); // pantalla muy alargada
    });

    it('usa el alto mínimo si no hay medidas válidas', () => {
      expect(computeGameHeight(0, 0)).toBe(MIN_GAME_HEIGHT);
      expect(computeGameHeight(NaN, 800)).toBe(MIN_GAME_HEIGHT);
    });
  });

  describe('computeHudLayout', () => {
    const hud = computeHudLayout(DESIGN_WIDTH);
    const buttons: Record<string, Rect> = {
      volver: hud.backBtn,
      estadisticas: hud.statsBtn,
      modo: hud.modeSegments[0],
      diario: hud.modeSegments[1],
      tema: hud.modeSegments[2],
      reiniciar: hud.toolSegments[0],
      deshacer: hud.toolSegments[1],
      pista: hud.toolSegments[2],
      direccion: hud.dirBtn,
    };

    it('todos los botones superan el tamaño táctil mínimo (48 dp)', () => {
      for (const [name, rect] of Object.entries(buttons)) {
        expect(rect.h * DP_PER_LOGICAL_PX, `alto de ${name}`).toBeGreaterThanOrEqual(MIN_TOUCH_DP);
        expect(rect.w * DP_PER_LOGICAL_PX, `ancho de ${name}`).toBeGreaterThanOrEqual(MIN_TOUCH_DP);
      }
      expect(BUTTON_H * DP_PER_LOGICAL_PX).toBeGreaterThanOrEqual(MIN_TOUCH_DP);
    });

    it('los textos son legibles (≥ 13 dp)', () => {
      for (const [name, size] of Object.entries(FONT)) {
        expect(size * DP_PER_LOGICAL_PX, `texto ${name}`).toBeGreaterThanOrEqual(MIN_TEXT_DP);
      }
    });

    it('ningún botón queda fuera del lienzo ni se solapa con otro', () => {
      const entries = Object.entries(buttons);
      for (const [name, rect] of entries) {
        expect(left(rect), name).toBeGreaterThanOrEqual(0);
        expect(right(rect), name).toBeLessThanOrEqual(DESIGN_WIDTH);
      }
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          expect(overlaps(entries[i][1], entries[j][1]), `${entries[i][0]} vs ${entries[j][0]}`).toBe(false);
        }
      }
    });

    it('el botón Volver no choca con el marcador de Chispas aunque el saldo sea grande', () => {
      // Saldo abreviado (p. ej. "99k") + icono de chispa + separaciones
      const sparksBlock = 3 * FONT.stats * 0.9 + 26 + 16;
      expect(right(hud.backBtn)).toBeLessThan(hud.sparksRight.x - sparksBlock);
    });

    it('el texto «Volver» cabe dentro de su botón', () => {
      // Icono (52 px desde el borde) + separación + 6 letras a ≈ 0,6 em
      expect(92 + 6 * FONT.button * 0.6).toBeLessThan(hud.backBtn.w);
    });

    it('el nombre del nivel, su etiqueta de tamaño y el cronómetro caben en la misma fila', () => {
      const name = 'Reto diario'; // el nombre más largo
      const nameRight = hud.levelPos.x + name.length * FONT.display * 0.75;
      const chip = 18 + 5 * FONT.small * 0.6 + 32; // separación + "6×6" + márgenes
      const timeLeft = hud.timePos.x - 5 * FONT.display * 0.85; // "00:00" alineado a la derecha
      expect(nameRight + chip).toBeLessThan(timeLeft);
    });

    it('las barras segmentadas dividen el ancho en tres partes iguales sin huecos', () => {
      for (const [bar, segs] of [
        [hud.modeBar, hud.modeSegments],
        [hud.toolbar, hud.toolSegments],
      ] as const) {
        expect(segs[0].x - segs[0].w / 2).toBeCloseTo(bar.x - bar.w / 2, 5);
        expect(segs[2].x + segs[2].w / 2).toBeCloseTo(bar.x + bar.w / 2, 5);
        expect(segs[0].x + segs[0].w / 2).toBeCloseTo(segs[1].x - segs[1].w / 2, 5);
        expect(segs[1].x + segs[1].w / 2).toBeCloseTo(segs[2].x - segs[2].w / 2, 5);
      }
    });

    it('el tablero empieza debajo de todos los controles', () => {
      for (const rect of Object.values(buttons)) {
        expect(hud.boardTop).toBeGreaterThan(bottom(rect));
      }
    });
  });

  describe('computeBoardGeometry', () => {
    const hud = computeHudLayout(DESIGN_WIDTH);
    const sizes = [4, 5, 6, 7];
    const heights = [MIN_GAME_HEIGHT, 1500, MAX_GAME_HEIGHT];

    it('el tablero cabe en el lienzo para todos los tamaños y proporciones', () => {
      for (const height of heights) {
        for (const n of sizes) {
          const g = computeBoardGeometry(DESIGN_WIDTH, height, n, n, hud.boardTop);
          const label = `${n}x${n} en alto ${height}`;
          const firstTop = g.startY - g.cellSize / 2;
          const lastBottom = g.startY + (n - 1) * g.cellSize + g.cellSize / 2;
          const firstLeft = g.startX - g.cellSize / 2;
          const lastRight = g.startX + (n - 1) * g.cellSize + g.cellSize / 2;

          expect(firstTop, label).toBeGreaterThanOrEqual(hud.boardTop);
          expect(lastBottom, label).toBeLessThanOrEqual(height);
          expect(firstLeft, label).toBeGreaterThanOrEqual(0);
          expect(lastRight, label).toBeLessThanOrEqual(DESIGN_WIDTH);
        }
      }
    });

    it('las celdas son lo bastante grandes para tocarlas (≥ 40 dp) incluso en 7x7', () => {
      for (const height of heights) {
        for (const n of sizes) {
          const g = computeBoardGeometry(DESIGN_WIDTH, height, n, n, hud.boardTop);
          expect(g.cellVisual * DP_PER_LOGICAL_PX, `${n}x${n} en alto ${height}`).toBeGreaterThanOrEqual(40);
        }
      }
    });

    it('aprovecha las pantallas más altas con celdas más grandes', () => {
      const small = computeBoardGeometry(DESIGN_WIDTH, MIN_GAME_HEIGHT, 7, 7, hud.boardTop);
      const tall = computeBoardGeometry(DESIGN_WIDTH, MAX_GAME_HEIGHT, 7, 7, hud.boardTop);
      expect(tall.cellSize).toBeGreaterThanOrEqual(small.cellSize);
    });
  });

  describe('menú: inicio y puzzles', () => {
    const heights = [MIN_GAME_HEIGHT, 1400, MAX_GAME_HEIGHT];
    const inside = (r: Rect, h: number) =>
      left(r) >= 0 && right(r) <= DESIGN_WIDTH && top(r) >= 0 && bottom(r) <= h;

    it('inicio: nombre, botón principal, Elegir puzzle, los tres accesos y el saludo, en orden y sin pisarse', () => {
      for (const h of heights) {
        const m = computeHomeLayout(DESIGN_WIDTH, h);
        const all = [m.play, m.puzzles, ...m.buttons];
        for (const r of all) expect(inside(r, h)).toBe(true);
        for (let i = 1; i < all.length; i++) expect(top(all[i])).toBeGreaterThanOrEqual(bottom(all[i - 1]) + 12);
        expect(m.sparksY).toBeGreaterThan(m.titleY + 40);
        expect(m.streakY).toBeGreaterThan(m.sparksY + 30);
        expect(top(m.play)).toBeGreaterThan(m.streakY + 40);
        expect(m.greetingY).toBeGreaterThan(bottom(m.buttons[2]) + 60);
        expect(m.greetingY + 40).toBeLessThanOrEqual(h);
        for (const r of all) expect(Math.min(r.w, r.h) * DP_PER_LOGICAL_PX).toBeGreaterThanOrEqual(MIN_TOUCH_DP);
      }
    });

    it('puzzles: Volver, título, tarjetas y modos en orden, dentro del lienzo y sin pisarse', () => {
      for (const h of heights) {
        const m = computePlayLayout(DESIGN_WIDTH, h);
        for (const r of [m.backBtn, ...m.cards, ...m.modes]) expect(inside(r, h)).toBe(true);
        expect(m.titleY).toBeGreaterThan(bottom(m.backBtn) + 10);
        expect(top(m.cards[0])).toBeGreaterThan(m.titleY + 30);
        expect(top(m.cards[1])).toBeGreaterThanOrEqual(bottom(m.cards[0]));
        expect(m.cards).toHaveLength(4);
        for (let i = 1; i < m.cards.length; i++) expect(top(m.cards[i])).toBeGreaterThanOrEqual(bottom(m.cards[i - 1]));
        for (const card of m.cards) expect(card.h).toBeGreaterThanOrEqual(150);
        expect(m.modeLabelY).toBeGreaterThan(bottom(m.cards[3]) + 20);
        expect(top(m.modes[0])).toBeGreaterThan(m.modeLabelY + 14);
        expect(m.modeInfoY).toBeGreaterThan(bottom(m.modes[0]) + 20);
        expect(m.modeInfoY + 30).toBeLessThanOrEqual(h);
        for (const r of [...m.cards, ...m.modes]) expect(Math.min(r.w, r.h) * DP_PER_LOGICAL_PX).toBeGreaterThanOrEqual(MIN_TOUCH_DP);
        expect(m.modes[1].x).toBe(DESIGN_WIDTH / 2);
      }
    });
  });
});

describe('Pantalla de Claves', () => {
  const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
  it('teclas grandes, sin encimarse, dentro de la pantalla y con al menos tres filas de intentos', () => {
    for (const height of [MIN_GAME_HEIGHT, 1440, MAX_GAME_HEIGHT]) {
      const hud = computeHudLayout(DESIGN_WIDTH);
      for (const length of [2, 3, 4, 5, 6]) {
        for (const [low, high] of [[1, 4], [1, 6], [1, 7], [1, 8], [0, 9]]) {
          const l = computeCodeLayout(DESIGN_WIDTH, height, hud.boardTop, length, low, high);
          // Solo hay tecla para las cifras del nivel
          const digitKeys = l.digits.filter((k): k is NonNullable<typeof k> => k !== null);
          expect(digitKeys).toHaveLength(high - low + 1);
          for (let d = 0; d <= 9; d++) expect(l.digits[d] !== null).toBe(d >= low && d <= high);
          expect(codeKeypadDigits(low, high)).toHaveLength(high - low + 1);
          const keys = [...digitKeys, l.erase, l.submit];
          for (const k of keys) {
            expect(k.w).toBeGreaterThanOrEqual(88);
            expect(k.h).toBeGreaterThanOrEqual(88);
            expect(k.x - k.w / 2).toBeGreaterThanOrEqual(CODE_MARGIN - 0.01);
            expect(k.x + k.w / 2).toBeLessThanOrEqual(DESIGN_WIDTH - CODE_MARGIN + 0.01);
            expect(k.y + k.h / 2).toBeLessThanOrEqual(height);
          }
          for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) expect(overlap(keys[i], keys[j])).toBe(false);
          // Cada fila de teclas está centrada en la pantalla
          const rows = new Map<number, typeof digitKeys>();
          for (const k of digitKeys) rows.set(k.y, [...(rows.get(k.y) ?? []), k]);
          for (const row of rows.values()) {
            const left = Math.min(...row.map((k) => k.x - k.w / 2));
            const right = Math.max(...row.map((k) => k.x + k.w / 2));
            expect((left + right) / 2).toBeCloseTo(DESIGN_WIDTH / 2, 3);
          }
          for (const s of l.slots) {
            expect(s.w).toBeGreaterThanOrEqual(88);
            for (const k of keys) expect(overlap(s, k)).toBe(false);
          }
          expect(l.history.y - l.history.h / 2).toBeGreaterThanOrEqual(hud.boardTop);
          expect(Math.floor(l.history.h / l.rowH)).toBeGreaterThanOrEqual(3);
          for (const s of l.slots) expect(s.y - s.h / 2).toBeGreaterThan(l.history.y + l.history.h / 2);
          // El bloque (lista, casillas y teclado) queda centrado en el espacio libre, no pegado abajo
          const blockTop = l.history.y - l.history.h / 2;
          const blockBottom = Math.max(...keys.map((k) => k.y + k.h / 2));
          expect(Math.abs(blockTop - hud.boardTop - (height - 24 - blockBottom))).toBeLessThan(1);
        }
      }
    }
  });
});
