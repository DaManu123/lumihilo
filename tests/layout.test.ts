import { describe, it, expect } from 'vitest';
import { APP_NAME } from '../src/config';
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

    it('el título no choca con el marcador de Chispas aunque el saldo sea grande', () => {
      // Medido en navegador: Unbounded a 28 px ocupa ≈ 0,68 em por carácter; se usa 0,75 por margen
      const titleRight = hud.titlePos.x + APP_NAME.length * FONT.title * 0.75;
      // Saldo abreviado (p. ej. "99k") + icono de chispa + separaciones
      const sparksBlock = 3 * FONT.stats * 0.9 + 26 + 16;
      expect(titleRight).toBeLessThan(hud.sparksRight.x - sparksBlock);
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
});
