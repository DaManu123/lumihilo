import { describe, it, expect } from 'vitest';
import { FLOW_MAX_PAIRS, flowColor, glyphColorOn } from '../src/game/flowColors';
import { getTheme } from '../src/game/theme';
import { contrastRatio } from '../src/game/color';
import { SKINS } from '../src/core/skins';
import { flowParamsForTier } from '../src/core/flow';

const channels = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const distance = (a: number, b: number) => Math.hypot(...channels(a).map((v, i) => v - channels(b)[i]));

describe('Colores de los hilos (src/game/flowColors.ts)', () => {
  it('hay un color por cada pareja del nivel más difícil', () => {
    expect(FLOW_MAX_PAIRS).toBeGreaterThanOrEqual(flowParamsForTier(10).pairs);
  });

  for (const skin of SKINS) {
    for (const mode of ['dark', 'light'] as const) {
      for (const hc of [false, true]) {
        it(`${skin.name} · ${mode}${hc ? ' · alto contraste' : ''}: todos los hilos se ven (≥ 3:1) sobre el vidrio y el fondo`, () => {
          const theme = getTheme(mode, hc, skin.id);
          for (let i = 0; i < FLOW_MAX_PAIRS; i++) {
            expect(contrastRatio(flowColor(mode, i), theme.surface), `color ${i} vs vidrio`).toBeGreaterThanOrEqual(3);
            expect(contrastRatio(flowColor(mode, i), theme.background), `color ${i} vs fondo`).toBeGreaterThanOrEqual(3);
          }
        });
      }
    }
  }

  for (const mode of ['dark', 'light'] as const) {
    it(`${mode}: los colores se distinguen entre sí y el símbolo se lee sobre cada uno (≥ 4,5:1)`, () => {
      for (let i = 0; i < FLOW_MAX_PAIRS; i++) {
        for (let j = i + 1; j < FLOW_MAX_PAIRS; j++) expect(distance(flowColor(mode, i), flowColor(mode, j)), `${i} y ${j}`).toBeGreaterThan(60);
        expect(contrastRatio(glyphColorOn(flowColor(mode, i)), flowColor(mode, i)), `símbolo ${i}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it('el índice se repite en vez de fallar si hay más parejas que colores', () => {
    expect(flowColor('dark', FLOW_MAX_PAIRS)).toBe(flowColor('dark', 0));
    expect(flowColor('dark', -1)).toBe(flowColor('dark', FLOW_MAX_PAIRS - 1));
  });
});
