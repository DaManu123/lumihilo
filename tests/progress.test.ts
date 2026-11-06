import { describe, it, expect } from 'vitest';
import {
  HINT_COST,
  STARTING_SPARKS,
  createDefaultProgress,
  sanitizeProgress,
  dateKey,
  daysBetween,
  registerActivity,
  currentStreak,
  dailySeed,
  dailyTier,
  dailyParams,
  levelSeed,
  computeSparksReward,
  isNewTimeRecord,
  applyLevelOutcome,
  spendSparks,
  formatSparks,
  StreakState,
} from '../src/core/progress';
import { generateLevel } from '../src/core/generator';
import { validateLevel } from '../src/core/solver';

describe('Progreso del jugador (src/core/progress.ts)', () => {
  describe('fechas y racha', () => {
    it('genera claves de día en hora local', () => {
      expect(dateKey(new Date(2026, 10, 6))).toBe('2026-11-06');
      expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    });

    it('calcula días entre fechas, incluso cruzando mes y año', () => {
      expect(daysBetween('2026-11-06', '2026-11-07')).toBe(1);
      expect(daysBetween('2026-11-30', '2026-12-01')).toBe(1);
      expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
      expect(daysBetween('2026-11-06', '2026-11-06')).toBe(0);
      expect(daysBetween('2026-11-10', '2026-11-06')).toBe(-4);
    });

    it('la racha empieza en 1, suma con días consecutivos y no cambia el mismo día', () => {
      let s: StreakState = { current: 0, best: 0, lastActiveDate: null };
      s = registerActivity(s, '2026-11-06');
      expect(s).toEqual({ current: 1, best: 1, lastActiveDate: '2026-11-06' });
      s = registerActivity(s, '2026-11-06');
      expect(s.current).toBe(1);
      s = registerActivity(s, '2026-11-07');
      s = registerActivity(s, '2026-11-08');
      expect(s.current).toBe(3);
      expect(s.best).toBe(3);
    });

    it('la racha se reinicia tras saltarse un día pero conserva la mejor', () => {
      let s: StreakState = { current: 5, best: 5, lastActiveDate: '2026-11-06' };
      s = registerActivity(s, '2026-11-08');
      expect(s.current).toBe(1);
      expect(s.best).toBe(5);
    });

    it('la racha mostrada se considera rota si pasó más de un día sin jugar', () => {
      const s: StreakState = { current: 4, best: 6, lastActiveDate: '2026-11-06' };
      expect(currentStreak(s, '2026-11-06')).toBe(4); // hoy
      expect(currentStreak(s, '2026-11-07')).toBe(4); // aún se puede continuar
      expect(currentStreak(s, '2026-11-08')).toBe(0); // rota
      expect(currentStreak({ current: 0, best: 0, lastActiveDate: null }, '2026-11-08')).toBe(0);
    });

    it('si el reloj retrocede no se rompe la racha', () => {
      const s: StreakState = { current: 4, best: 4, lastActiveDate: '2026-11-06' };
      expect(registerActivity(s, '2026-11-03')).toBe(s);
    });
  });

  describe('reto diario y semillas', () => {
    it('la semilla diaria es determinista y distinta cada día', () => {
      expect(dailySeed('2026-11-06')).toBe(dailySeed('2026-11-06'));
      expect(dailySeed('2026-11-06')).not.toBe(dailySeed('2026-11-07'));
    });

    it('el mismo día genera exactamente el mismo puzzle para cualquier jugador', () => {
      const params = dailyParams('2026-11-06');
      const a = generateLevel(params, dailySeed('2026-11-06'));
      const b = generateLevel(params, dailySeed('2026-11-06'));
      expect(a.initialRotations).toEqual(b.initialRotations);
      expect(a.minTaps).toBe(b.minTaps);
      expect(validateLevel(a).valid).toBe(true);
    });

    it('el tier diario depende solo del día de la semana y sube de lunes a sábado', () => {
      // 2026-11-02 es lunes
      const tiers = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'].map(dailyTier);
      expect(tiers).toEqual([3, 4, 5, 6, 7, 8]);
      expect(dailyTier('2026-11-08')).toBe(6); // domingo
    });

    it('las semillas de niveles dependen de la semilla base del jugador', () => {
      expect(levelSeed(1000, 3)).toBe(levelSeed(1000, 3));
      expect(levelSeed(1000, 3)).not.toBe(levelSeed(1000, 4));
      expect(levelSeed(1000, 3)).not.toBe(levelSeed(2000, 3));
    });
  });

  describe('Chispas de Energía', () => {
    const base = { tier: 2, tapEfficiency: 0.5, elapsedSeconds: 999, minTaps: 10, hintsUsed: 0, isNewRecord: false, multiplier: 1 };

    it('siempre da una recompensa base que crece con el tier', () => {
      expect(computeSparksReward({ ...base, tier: 1 }).total).toBeLessThan(computeSparksReward({ ...base, tier: 10 }).total);
      expect(computeSparksReward(base).total).toBe(7);
    });

    it('bonifica eficiencia, rapidez y récord', () => {
      const perfect = computeSparksReward({ ...base, tapEfficiency: 1, elapsedSeconds: 10, isNewRecord: true });
      expect(perfect.efficiencyBonus).toBe(10);
      expect(perfect.speedBonus).toBe(5);
      expect(perfect.recordBonus).toBe(5);
      expect(perfect.total).toBe(7 + 10 + 5 + 5);
    });

    it('el bono de eficiencia tiene tramos', () => {
      expect(computeSparksReward({ ...base, tapEfficiency: 0.85 }).efficiencyBonus).toBe(5);
      expect(computeSparksReward({ ...base, tapEfficiency: 0.65 }).efficiencyBonus).toBe(2);
      expect(computeSparksReward({ ...base, tapEfficiency: 0.3 }).efficiencyBonus).toBe(0);
    });

    it('usar pistas elimina los bonos de eficiencia y rapidez', () => {
      const r = computeSparksReward({ ...base, tapEfficiency: 1, elapsedSeconds: 3, hintsUsed: 1 });
      expect(r.efficiencyBonus).toBe(0);
      expect(r.speedBonus).toBe(0);
    });

    it('el reto diario duplica la recompensa la primera vez y no da nada al repetirlo', () => {
      const normal = computeSparksReward(base).total;
      expect(computeSparksReward({ ...base, multiplier: 2 }).total).toBe(normal * 2);
      expect(computeSparksReward({ ...base, multiplier: 0 }).total).toBe(0);
    });

    it('no puede dar un total negativo ni decimales', () => {
      const r = computeSparksReward({ ...base, multiplier: -3 });
      expect(r.total).toBe(0);
      expect(Number.isInteger(computeSparksReward({ ...base, multiplier: 1.5 }).total)).toBe(true);
    });
  });

  describe('aplicar resultados y gastar Chispas', () => {
    const outcome = { tier: 2, elapsedSeconds: 30, tapEfficiency: 1, sparksEarned: 20, hintsUsed: 0, isDaily: false, today: '2026-11-06' };

    it('suma chispas, estadísticas, racha y mejor tiempo', () => {
      const p = applyLevelOutcome(createDefaultProgress(1), outcome);
      expect(p.sparks).toBe(STARTING_SPARKS + 20);
      expect(p.stats.levelsSolved).toBe(1);
      expect(p.stats.perfectSolves).toBe(1);
      expect(p.stats.bestTimeByTier['2']).toBe(30);
      expect(p.streak.current).toBe(1);
    });

    it('detecta récords solo dentro del mismo tier y no cuenta el primer nivel como récord', () => {
      const empty = createDefaultProgress(1);
      expect(isNewTimeRecord(empty, 2, 5)).toBe(false);
      const p = applyLevelOutcome(empty, outcome);
      expect(isNewTimeRecord(p, 2, 20)).toBe(true);
      expect(isNewTimeRecord(p, 2, 40)).toBe(false);
      expect(isNewTimeRecord(p, 3, 5)).toBe(false);
    });

    it('un tiempo peor no pisa el mejor tiempo', () => {
      const p1 = applyLevelOutcome(createDefaultProgress(1), outcome);
      const p2 = applyLevelOutcome(p1, { ...outcome, elapsedSeconds: 90 });
      expect(p2.stats.bestTimeByTier['2']).toBe(30);
    });

    it('resolver con pistas no crea récords ni cuenta como resolución perfecta', () => {
      const withHints = { ...outcome, hintsUsed: 3, elapsedSeconds: 2 };
      const p = applyLevelOutcome(createDefaultProgress(1), withHints);
      expect(p.stats.levelsSolved).toBe(1);
      expect(p.stats.perfectSolves).toBe(0);
      expect(p.stats.bestTimeByTier['2']).toBeUndefined();
      expect(p.streak.current).toBe(1); // sí cuenta como actividad del día
    });

    it('el reto diario solo cuenta una vez por día', () => {
      const daily = { ...outcome, isDaily: true };
      const p1 = applyLevelOutcome(createDefaultProgress(1), daily);
      const p2 = applyLevelOutcome(p1, daily);
      expect(p1.stats.dailyCompleted).toBe(1);
      expect(p2.stats.dailyCompleted).toBe(1);
      const p3 = applyLevelOutcome(p2, { ...daily, today: '2026-11-07' });
      expect(p3.stats.dailyCompleted).toBe(2);
    });

    it('gastar chispas descuenta el saldo y rechaza si no alcanza', () => {
      const p = createDefaultProgress(1);
      expect(spendSparks(p, HINT_COST)?.sparks).toBe(STARTING_SPARKS - HINT_COST);
      expect(spendSparks({ ...p, sparks: HINT_COST - 1 }, HINT_COST)).toBeNull();
      expect(spendSparks({ ...p, sparks: HINT_COST }, HINT_COST)?.sparks).toBe(0);
    });
  });

  it('formatSparks acorta los saldos grandes para que quepan en el encabezado', () => {
    expect(formatSparks(0)).toBe('0');
    expect(formatSparks(9999)).toBe('9999');
    expect(formatSparks(10000)).toBe('10k');
    expect(formatSparks(123456)).toBe('123k');
  });

  describe('datos guardados corruptos o antiguos', () => {
    it('recupera un progreso por defecto ante datos inválidos', () => {
      for (const bad of [null, undefined, 42, 'texto', [], {}]) {
        const p = sanitizeProgress(bad, 123);
        expect(p.seedBase).toBe(123);
        expect(p.currentLevel).toBe(1);
        expect(p.sparks).toBe(STARTING_SPARKS);
      }
    });

    it('descarta valores no numéricos, negativos o fechas mal formadas', () => {
      const p = sanitizeProgress(
        {
          seedBase: 'x',
          currentLevel: -5,
          sparks: NaN,
          stats: { levelsSolved: -1, bestTimeByTier: { 2: 'rápido', 3: -4, 4: 25 } },
          streak: { current: 3, best: 1, lastActiveDate: 'ayer' },
          lastDailyCompleted: 20261106,
        },
        7
      );
      expect(p.currentLevel).toBe(1);
      expect(p.sparks).toBe(STARTING_SPARKS);
      expect(p.stats.levelsSolved).toBe(0);
      expect(p.stats.bestTimeByTier).toEqual({ '4': 25 });
      expect(p.streak.best).toBe(3); // la mejor racha nunca es menor que la actual
      expect(p.streak.lastActiveDate).toBeNull();
      expect(p.lastDailyCompleted).toBeNull();
    });

    it('conserva un progreso válido sin cambios', () => {
      const original = applyLevelOutcome(createDefaultProgress(99), {
        tier: 3, elapsedSeconds: 41, tapEfficiency: 0.7, sparksEarned: 12, hintsUsed: 0, isDaily: true, today: '2026-11-06',
      });
      expect(sanitizeProgress(JSON.parse(JSON.stringify(original)), 1)).toEqual(original);
    });
  });
});
