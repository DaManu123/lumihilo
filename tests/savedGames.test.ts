import { describe, it, expect } from 'vitest';
import { hasProgress, matchesLevel, sanitizeSavedGame, sanitizeSavedGames, type SavedGame } from '../src/core/savedGames';

const base = { level: 3, daily: false, dailyKey: '', seed: 42, width: 2, height: 2, minTaps: 5, elapsed: 10, taps: 4, hints: 0, moves: [[0, 1, 1]] };

describe('Partidas guardadas', () => {
  it('acepta una partida válida de cada puzzle', () => {
    expect(sanitizeSavedGame('circuits', { ...base, rotations: [0, 1, 2, 3] })?.rotations).toEqual([0, 1, 2, 3]);
    expect(sanitizeSavedGame('lights', { ...base, moves: [[0, 0, 0]], lights: [true, false, true, false], lastLightsTap: [1, 1] })?.lastLightsTap).toEqual([1, 1]);
    const flow = sanitizeSavedGame('flow', {
      ...base,
      moves: [[0, 0, 0]],
      paths: [[{ row: 0, col: 0 }, { row: 0, col: 1 }], []],
      flowUndo: [[[], []]],
    });
    expect(flow?.paths?.[0]).toHaveLength(2);
    expect(flow?.flowUndo).toHaveLength(1);
  });

  it('descarta datos corruptos sin lanzar errores', () => {
    for (const bad of [null, 5, 'x', [], {}, { ...base, level: 0 }, { ...base, seed: 'a' }, { ...base, width: 99 }]) {
      expect(sanitizeSavedGame('circuits', bad)).toBeNull();
    }
    expect(sanitizeSavedGame('circuits', { ...base, rotations: [0, 1, 2] })).toBeNull(); // faltan casillas
    expect(sanitizeSavedGame('circuits', { ...base, rotations: [0, 1, 2, 9] })).toBeNull(); // giro imposible
    expect(sanitizeSavedGame('lights', { ...base, lights: [1, 0, 1, 0] })).toBeNull();
    expect(sanitizeSavedGame('flow', { ...base, paths: [[{ row: 'a', col: 0 }]] })).toBeNull();
    expect(sanitizeSavedGame('circuits', { ...base, rotations: [0, 0, 0, 0], moves: [[0, 0, 7]] })).toBeNull();
    expect(sanitizeSavedGame('circuits', { ...base, rotations: [0, 0, 0, 0], daily: true })).toBeNull(); // diario sin fecha
  });

  it('en Hilos, si el deshacer no coincide con las jugadas se parte de cero', () => {
    const game = sanitizeSavedGame('flow', { ...base, moves: [[0, 0, 0], [0, 0, 0]], paths: [[]], flowUndo: [[[]]] });
    expect(game?.moves).toEqual([]);
    expect(game?.flowUndo).toEqual([]);
  });

  it('sanea el conjunto y ignora lo que no es de un puzzle conocido', () => {
    const games = sanitizeSavedGames({ circuits: { ...base, rotations: [0, 0, 0, 0] }, lights: 'roto', otro: base });
    expect(Object.keys(games)).toEqual(['circuits']);
    expect(sanitizeSavedGames('basura')).toEqual({});
    expect(sanitizeSavedGames(undefined)).toEqual({});
  });

  it('reconoce si la partida es del nivel que toca', () => {
    const game = sanitizeSavedGame('circuits', { ...base, rotations: [0, 0, 0, 0] }) as SavedGame;
    const id = { level: 3, daily: false, dailyKey: '', seed: 42, width: 2, height: 2, minTaps: 5 };
    expect(matchesLevel(game, id)).toBe(true);
    expect(matchesLevel(game, { ...id, level: 4 })).toBe(false);
    expect(matchesLevel(game, { ...id, seed: 43 })).toBe(false);
    expect(matchesLevel(game, { ...id, width: 3 })).toBe(false);
    expect(matchesLevel(game, { ...id, daily: true, dailyKey: '2026-11-10' })).toBe(false);
  });

  it('el reto diario se reconoce por su fecha', () => {
    const game = sanitizeSavedGame('circuits', { ...base, daily: true, dailyKey: '2026-11-10', rotations: [0, 0, 0, 0] }) as SavedGame;
    const id = { level: 3, daily: true, dailyKey: '2026-11-10', seed: 42, width: 2, height: 2, minTaps: 5 };
    expect(matchesLevel(game, id)).toBe(true);
    expect(matchesLevel(game, { ...id, dailyKey: '2026-11-11' })).toBe(false);
  });

  it('solo cuenta como partida en curso si ya se hizo algo', () => {
    expect(hasProgress({ ...base, rotations: [], moves: [] } as unknown as SavedGame)).toBe(true);
    expect(hasProgress({ ...base, taps: 0, hints: 0 } as unknown as SavedGame)).toBe(false);
    expect(hasProgress({ ...base, taps: 0, hints: 1 } as unknown as SavedGame)).toBe(true);
  });
});
