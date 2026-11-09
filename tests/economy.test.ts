import { describe, it, expect } from 'vitest';
import { HINT_COST, computeSparksReward, dailyTier } from '../src/core/progress';
import { SKINS } from '../src/core/skins';

/**
 * Ritmo de Chispas. Perfiles de jugador (por día): cuántos niveles resuelve, con qué nivel de habilidad, qué tan
 * bien (eficiencia de toques), cuántos con bonus de rapidez y cuántos con pistas (cada pista cuesta 10).
 * El reto diario paga el doble la primera vez de cada día. Ver docs/10-economia-chispas.md.
 */
interface Profile {
  name: string;
  levels: number;
  tier: number;
  efficiency: number;
  fastShare: number;
  hintShare: number;
  minutesPerDay: number;
}

const PROFILES: Profile[] = [
  { name: 'ocasional', levels: 6, tier: 3, efficiency: 0.7, fastShare: 0, hintShare: 1 / 3, minutesPerDay: 8 },
  { name: 'habitual', levels: 10, tier: 4, efficiency: 0.85, fastShare: 0.4, hintShare: 1 / 5, minutesPerDay: 12 },
  { name: 'dedicado', levels: 25, tier: 5, efficiency: 0.95, fastShare: 0.6, hintShare: 1 / 10, minutesPerDay: 30 },
];

function sparksPerLevel(p: Profile, tier: number, multiplier = 1): number {
  const clean = computeSparksReward({ tier, tapEfficiency: p.efficiency, elapsedSeconds: 1, minTaps: 10, hintsUsed: 0, isNewRecord: false, multiplier });
  const slow = computeSparksReward({ tier, tapEfficiency: p.efficiency, elapsedSeconds: 9999, minTaps: 10, hintsUsed: 0, isNewRecord: false, multiplier });
  const hinted = computeSparksReward({ tier, tapEfficiency: p.efficiency, elapsedSeconds: 9999, minTaps: 10, hintsUsed: 1, isNewRecord: false, multiplier });
  const unhinted = p.fastShare * clean.total + (1 - p.fastShare) * slow.total;
  return (1 - p.hintShare) * unhinted + p.hintShare * (hinted.total - HINT_COST * multiplier);
}

export function sparksPerDay(p: Profile): number {
  const weekAverageTier = [0, 1, 2, 3, 4, 5, 6].reduce((sum, d) => sum + dailyTier(`2026-11-${String(8 + d).padStart(2, '0')}`), 0) / 7;
  return p.levels * sparksPerLevel(p, p.tier) + sparksPerLevel(p, weekAverageTier, 2);
}

/** Días hasta tener cada aspecto, comprándolos en orden (arrancando con las 30 Chispas iniciales). */
export function daysToOwn(p: Profile): number[] {
  const perDay = sparksPerDay(p);
  let spent = 0;
  return SKINS.filter((s) => s.price > 0).map((s) => {
    spent += s.price;
    return Math.max(0, (spent - 30) / perDay);
  });
}

describe('Ritmo de Chispas (tienda de aspectos)', () => {
  it('todos los perfiles ganan Chispas jugando, incluso usando pistas', () => {
    for (const p of PROFILES) expect(sparksPerDay(p), p.name).toBeGreaterThan(40);
  });

  it('los aspectos cuestan cada vez más', () => {
    const prices = SKINS.map((s) => s.price);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it('el primer aspecto está al alcance enseguida: un día de juego habitual, tres del ocasional', () => {
    expect(daysToOwn(PROFILES[1])[0]).toBeLessThanOrEqual(1);
    expect(daysToOwn(PROFILES[0])[0]).toBeLessThanOrEqual(3);
  });

  it('con juego habitual se consigue todo en unas dos semanas, y un jugador dedicado, en menos de una', () => {
    expect(daysToOwn(PROFILES[1]).at(-1)!).toBeLessThanOrEqual(14);
    expect(daysToOwn(PROFILES[2]).at(-1)!).toBeLessThanOrEqual(7);
  });

  it('el jugador ocasional completa la colección en un tiempo razonable (≤ 6 semanas)', () => {
    expect(daysToOwn(PROFILES[0]).at(-1)!).toBeLessThanOrEqual(42);
  });

  it('imprime la tabla para la documentación', () => {
    const rows = PROFILES.map((p) => `${p.name}: ${Math.round(sparksPerDay(p))}/día (${p.minutesPerDay} min) → ${daysToOwn(p).map((d) => d.toFixed(1)).join(' · ')} días`);
    console.log(rows.join('\n'));
    expect(rows.length).toBe(3);
  });
});
