import { describe, expect, it } from 'vitest';
import { PUZZLE_TUNING } from '../src/core/adaptive';
import { EN } from '../src/core/i18n';
import { applyLevelOutcome, createDefaultProgress, sanitizeProgress } from '../src/core/progress';
import { starsAdvice, starsFor } from '../src/core/stars';

describe('estrellas', () => {
  it('tres: sin pistas y con la eficiencia que pide el puzzle', () => {
    for (const puzzle of ['circuits', 'lights', 'flow'] as const) {
      const need = PUZZLE_TUNING[puzzle].masteryEfficiency;
      expect(starsFor({ puzzle, hintsUsed: 0, tapEfficiency: 1 })).toBe(3);
      expect(starsFor({ puzzle, hintsUsed: 0, tapEfficiency: need })).toBe(3);
      expect(starsFor({ puzzle, hintsUsed: 0, tapEfficiency: need - 0.01 })).toBe(2);
    }
  });

  it('dos con la pista gratis, una con más pistas; ganar siempre da al menos una', () => {
    expect(starsFor({ puzzle: 'circuits', hintsUsed: 1, tapEfficiency: 1 })).toBe(2);
    expect(starsFor({ puzzle: 'circuits', hintsUsed: 2, tapEfficiency: 1 })).toBe(1);
    expect(starsFor({ puzzle: 'lights', hintsUsed: 30, tapEfficiency: 0 })).toBe(1);
  });

  it('el consejo dice cómo ganar más y está traducido', () => {
    expect(starsAdvice({ stars: 3, hintsUsed: 0 })).toBeNull();
    const withHints = starsAdvice({ stars: 1, hintsUsed: 2 })!;
    const manyTaps = starsAdvice({ stars: 2, hintsUsed: 0 })!;
    expect(withHints).not.toBe(manyTaps);
    expect(EN[withHints]).toBeTruthy();
    expect(EN[manyTaps]).toBeTruthy();
  });

  it('se acumulan en el progreso y sobreviven a datos viejos sin el campo', () => {
    const base = createDefaultProgress(1);
    const outcome = { tier: 1, elapsedSeconds: 10, tapEfficiency: 1, sparksEarned: 5, hintsUsed: 0, isDaily: false, today: '2026-11-16' };
    const once = applyLevelOutcome(base, { ...outcome, stars: 3 });
    expect(once.stats.stars).toBe(3);
    expect(applyLevelOutcome(once, { ...outcome, stars: 2 }).stats.stars).toBe(5);
    expect(applyLevelOutcome(once, outcome).stats.stars).toBe(3);
    const old = sanitizeProgress({ stats: { levelsSolved: 4 } }, 1);
    expect(old.stats.stars).toBe(0);
    expect(old.stats.levelsSolved).toBe(4);
  });
});
