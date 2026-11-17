import { describe, expect, it } from 'vitest';
import { DIFFICULTY_TIERS } from '../src/core/adaptive';
import { generateFlow, flowParamsForTier } from '../src/core/flow';
import { generateLevel } from '../src/core/generator';
import { INTRO_LEVELS, introCircuitsParams, introFlowParams, introLightsParams, introRecordKey, isIntroLevel } from '../src/core/intro';
import { generateLights, isAllLit, lightsParamsForTier } from '../src/core/lights';
import { checkVictory } from '../src/core/grid';

describe('primeros niveles', () => {
  it('solo los primeros niveles de Normal y Relajado son de entrada', () => {
    for (const puzzle of ['circuits', 'lights', 'flow'] as const) {
      const last = INTRO_LEVELS[puzzle];
      expect(isIntroLevel({ puzzle, level: 1, mode: 'normal', isDaily: false })).toBe(true);
      expect(isIntroLevel({ puzzle, level: last, mode: 'relaxed', isDaily: false })).toBe(true);
      expect(isIntroLevel({ puzzle, level: last + 1, mode: 'normal', isDaily: false })).toBe(false);
      expect(isIntroLevel({ puzzle, level: 1, mode: 'challenge', isDaily: false })).toBe(false);
      expect(isIntroLevel({ puzzle, level: 1, mode: 'normal', isDaily: true })).toBe(false);
      expect(isIntroLevel({ puzzle, level: 0, mode: 'normal', isDaily: false })).toBe(false);
    }
  });

  it('nunca son más grandes que el primer peldaño normal y crecen sin retroceder', () => {
    let cells = 0;
    for (let level = 1; level <= INTRO_LEVELS.circuits; level++) {
      const p = introCircuitsParams(level);
      expect(p.width * p.height).toBeGreaterThanOrEqual(cells);
      expect(p.width * p.height).toBeLessThanOrEqual(DIFFICULTY_TIERS[1].width * DIFFICULTY_TIERS[1].height);
      cells = p.width * p.height;
    }
    for (let level = 1; level <= INTRO_LEVELS.lights; level++) {
      const p = introLightsParams(level);
      expect(p.size).toBeLessThanOrEqual(lightsParamsForTier(2).size);
      expect(p.scrambles).toBeLessThan(lightsParamsForTier(2).scrambles);
      expect(p.blocked).toBe(0);
    }
    for (let level = 1; level <= INTRO_LEVELS.flow; level++) {
      expect(introFlowParams(level).size).toBeLessThanOrEqual(flowParamsForTier(1).size);
    }
  });

  it('el primer nivel de cada puzzle es mínimo: 3×3, y en Luces un solo toque', () => {
    expect(introCircuitsParams(1)).toMatchObject({ width: 3, height: 3, extraLoops: 0 });
    expect(introLightsParams(1)).toMatchObject({ size: 3, scrambles: 1 });
    expect(introFlowParams(1)).toMatchObject({ size: 3, pairs: 2 });
    for (let seed = 1; seed <= 40; seed++) expect(generateLights(introLightsParams(1), seed).minTaps).toBe(1);
  });

  it('todos se generan resolubles y sin nacer resueltos, con muchas semillas', () => {
    for (let seed = 1; seed <= 150; seed++) {
      for (let level = 1; level <= INTRO_LEVELS.circuits; level++) {
        const generated = generateLevel(introCircuitsParams(level), seed * 7919 + level);
        expect(generated.minTaps).toBeGreaterThan(0);
        expect(checkVictory(generated.board)).toBe(false);
        for (const row of generated.board.grid) for (const cell of row) cell.rotation = 0;
        expect(checkVictory(generated.board)).toBe(true);
      }
      for (let level = 1; level <= INTRO_LEVELS.lights; level++) {
        const generated = generateLights(introLightsParams(level), seed * 31 + level);
        expect(isAllLit(generated.initial)).toBe(false);
        expect(generated.minTaps).toBeGreaterThan(0);
        expect(generated.minTaps).toBeLessThanOrEqual(introLightsParams(level).scrambles);
      }
      for (let level = 1; level <= INTRO_LEVELS.flow; level++) {
        const params = introFlowParams(level);
        const generated = generateFlow(params, seed * 53 + level);
        expect(generated.pairs.length).toBe(params.pairs);
        expect(generated.solution.flat().length).toBe(params.size * params.size);
      }
    }
  });

  it('las claves se quedan como estaban al pedir un nivel fuera de rango', () => {
    expect(introCircuitsParams(99)).toEqual(introCircuitsParams(INTRO_LEVELS.circuits));
    expect(introLightsParams(0)).toEqual(introLightsParams(1));
    expect(introRecordKey('lights')).toBe('intro-lights');
  });
});
