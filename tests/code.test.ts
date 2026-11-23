import { describe, it, expect } from 'vitest';
import {
  MAX_CODE_LENGTH,
  MIN_CODE_LENGTH,
  allCodes,
  codeHint,
  codeParamsForTier,
  codeSpaceSize,
  deduceNotes,
  digitAllowed,
  expectedGuessesFor,
  generateCode,
  guessProblem,
  markGuess,
  maxGuessesFor,
  scoreGuess,
  simulateConsistentPlayer,
  type CodeParams,
} from '../src/core/code';
import { INTRO_LEVELS, introCodeParams, isIntroLevel } from '../src/core/intro';
import { PUZZLE_TUNING } from '../src/core/adaptive';
import { codeRecordKey, isPuzzleType, PUZZLES, recordKeyFor } from '../src/core/puzzles';
import { applyLevelOutcome, createDefaultProgress, dailyCodeSeed, dailyFlowSeed, lastDailyOf, levelOf, sanitizeModeProgress, sanitizeProgress, withLevel } from '../src/core/progress';
import { sanitizeSavedGame } from '../src/core/savedGames';
import { starsFor } from '../src/core/stars';

const tiers = Array.from({ length: 10 }, (_, i) => codeParamsForTier(i + 1));
const intro = Array.from({ length: INTRO_LEVELS.code }, (_, i) => introCodeParams(i + 1));

describe('Claves: calificar un intento', () => {
  it('cuenta las cifras en su lugar y en otro lugar', () => {
    expect(scoreGuess([1, 2, 3, 4], [1, 2, 3, 4])).toEqual({ exact: 4, misplaced: 0 });
    expect(scoreGuess([1, 2, 3, 4], [4, 3, 2, 1])).toEqual({ exact: 0, misplaced: 4 });
    expect(scoreGuess([1, 2, 3, 4], [1, 3, 5, 6])).toEqual({ exact: 1, misplaced: 1 });
    expect(scoreGuess([1, 2, 3, 4], [5, 6, 7, 8])).toEqual({ exact: 0, misplaced: 0 });
  });

  it('con cifras repetidas, cada cifra de la clave cuenta una sola vez', () => {
    // Clave 1 1 2 2; intento 1 2 1 1 → el primer 1 en su lugar; un 2 y un 1 en otro lugar (no dos 1)
    expect(scoreGuess([1, 1, 2, 2], [1, 2, 1, 1])).toEqual({ exact: 1, misplaced: 2 });
    expect(scoreGuess([7, 7, 7, 7], [7, 0, 0, 0])).toEqual({ exact: 1, misplaced: 0 });
    expect(scoreGuess([0, 1, 2, 3], [0, 0, 0, 0])).toEqual({ exact: 1, misplaced: 0 });
  });

  it('las marcas por cifra coinciden con los dos números', () => {
    for (const params of [...tiers, ...intro]) {
      for (let seed = 1; seed <= 40; seed++) {
        const secret = generateCode(params, seed).secret;
        const guess = generateCode(params, seed * 31 + 7).secret;
        const marks = markGuess(secret, guess);
        const score = scoreGuess(secret, guess);
        expect(marks.filter((m) => m === 'exact').length).toBe(score.exact);
        expect(marks.filter((m) => m === 'present').length).toBe(score.misplaced);
      }
    }
  });

  it('con repetidas no marca de más: un solo 1 en la clave deja el segundo 1 del intento como «no está»', () => {
    expect(markGuess([1, 2, 3], [1, 1, 4])).toEqual(['exact', 'absent', 'absent']);
    // El único 1 de la clave ya salió en su lugar: el otro 1 del intento no está
    expect(markGuess([2, 1, 3], [1, 1, 4])).toEqual(['absent', 'exact', 'absent']);
    expect(markGuess([3, 1, 2], [1, 4, 1])).toEqual(['present', 'absent', 'absent']);
  });
});

describe('Claves: niveles', () => {
  it('la clave cumple las reglas del nivel y es la misma con la misma semilla', () => {
    for (const params of [...tiers, ...intro]) {
      for (let seed = 1; seed <= 60; seed++) {
        const level = generateCode(params, seed);
        expect(level.secret).toHaveLength(params.length);
        expect(level.secret.every((d) => digitAllowed(params, d))).toBe(true);
        if (!params.repeats) expect(new Set(level.secret).size).toBe(params.length);
        expect(guessProblem(params, level.secret)).toBeNull();
        expect(generateCode(params, seed).secret).toEqual(level.secret);
      }
    }
  });

  it('las claves con repetidas sí repiten cifras a veces', () => {
    const params = codeParamsForTier(6);
    const repeated = Array.from({ length: 50 }, (_, i) => generateCode(params, i + 1).secret).filter((s) => new Set(s).size < s.length);
    expect(repeated.length).toBeGreaterThan(5);
  });

  it('mínimo 2 cifras y más cifras = más difícil: la dificultad nunca baja de un peldaño al siguiente', () => {
    for (const params of [...intro, ...tiers]) {
      expect(params.length).toBeGreaterThanOrEqual(MIN_CODE_LENGTH);
      expect(params.length).toBeLessThanOrEqual(MAX_CODE_LENGTH);
    }
    expect(intro[0].length).toBe(2);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].length).toBeGreaterThanOrEqual(tiers[i - 1].length - 1);
      expect(tiers[i].expected).toBeGreaterThanOrEqual(tiers[i - 1].expected);
    }
    expect(tiers[9].length).toBe(6);
  });

  it('los tres primeros peldaños (los de Relajado) y los niveles de entrada marcan cada cifra; los demás no', () => {
    expect(tiers.slice(0, 3).every((p) => p.colors)).toBe(true);
    expect(tiers.slice(3).every((p) => !p.colors)).toBe(true);
    expect(intro.every((p) => p.colors)).toBe(true);
  });

  it('los intentos esperados dejan margen sobre un jugador simulado que no se equivoca nunca', () => {
    // Solo los niveles con pocas claves posibles (los grandes tardarían demasiado en la prueba)
    const shapes: CodeParams[] = [...intro, ...tiers].filter((p) => codeSpaceSize(p) <= 6000);
    for (const params of shapes) {
      const all = allCodes(params);
      let total = 0;
      const games = 60;
      for (let i = 0; i < games; i++) total += simulateConsistentPlayer(generateCode(params, i * 977 + 1), i + 5, all);
      expect(total / games).toBeLessThanOrEqual(expectedGuessesFor(params));
    }
  });

  it('el modo Reto deja al menos el doble de intentos que un buen jugador', () => {
    for (const params of tiers) expect(maxGuessesFor(params)).toBeGreaterThanOrEqual(2 * expectedGuessesFor(params));
  });

  it('los niveles de entrada de Claves no aplican en Reto ni en el diario', () => {
    expect(isIntroLevel({ puzzle: 'code', level: 1, mode: 'normal', isDaily: false })).toBe(true);
    expect(isIntroLevel({ puzzle: 'code', level: INTRO_LEVELS.code + 1, mode: 'normal', isDaily: false })).toBe(false);
    expect(isIntroLevel({ puzzle: 'code', level: 1, mode: 'challenge', isDaily: false })).toBe(false);
    expect(isIntroLevel({ puzzle: 'code', level: 1, mode: 'relaxed', isDaily: true })).toBe(false);
  });
});

describe('Claves: intentos no válidos', () => {
  const params: CodeParams = { length: 3, low: 1, high: 6, repeats: false, colors: true, expected: 4 };
  it('incompleto, fuera de rango o con repetidas cuando no se permite', () => {
    expect(guessProblem(params, [1, 2, null])).toBe('incomplete');
    expect(guessProblem(params, [1, 2])).toBe('incomplete');
    expect(guessProblem(params, [1, 2, 7])).toBe('out-of-range');
    expect(guessProblem(params, [0, 2, 3])).toBe('out-of-range');
    expect(guessProblem(params, [1, 2, 2])).toBe('repeated');
    expect(guessProblem({ ...params, repeats: true }, [1, 2, 2])).toBeNull();
    expect(guessProblem(params, [6, 5, 4])).toBeNull();
  });
});

describe('Claves: notas automáticas', () => {
  it('con colores: marca lo que está y tacha lo que no está', () => {
    const params = codeParamsForTier(1);
    const secret = [1, 2, 3];
    const guess = [3, 4, 1];
    const notes = deduceNotes(params, [{ guess, score: scoreGuess(secret, guess), marks: markGuess(secret, guess) }]);
    expect(notes[3]).toBe('in');
    expect(notes[1]).toBe('in');
    expect(notes[4]).toBe('out');
    expect(notes[2]).toBeNull();
  });

  it('con repetidas, una copia de más «no está» no tacha una cifra que sí está', () => {
    const params: CodeParams = { length: 3, low: 0, high: 9, repeats: true, colors: true, expected: 5 };
    const secret = [1, 2, 3];
    const guess = [1, 1, 5];
    const notes = deduceNotes(params, [{ guess, score: scoreGuess(secret, guess), marks: markGuess(secret, guess) }]);
    expect(notes[1]).toBe('in');
    expect(notes[5]).toBe('out');
  });

  it('sin colores: un intento con 0 y 0 tacha sus cifras; uno con todas acertadas tacha las demás', () => {
    const params = codeParamsForTier(5);
    const secret = [1, 2, 3, 4];
    const none = [5, 6, 7, 8];
    const all = [4, 3, 2, 1];
    const notes = deduceNotes(params, [
      { guess: none, score: scoreGuess(secret, none) },
      { guess: all, score: scoreGuess(secret, all) },
    ]);
    for (const d of none) expect(notes[d]).toBe('out');
    for (const d of all) expect(notes[d]).toBe('in');
    expect(notes[0]).toBe('out');
    expect(notes[9]).toBe('out');
  });

  it('sin colores, lo que no es seguro no se marca', () => {
    const params = codeParamsForTier(5);
    const secret = [1, 2, 3, 4];
    const guess = [1, 5, 6, 7];
    const notes = deduceNotes(params, [{ guess, score: scoreGuess(secret, guess) }]);
    expect(notes.every((n) => n === null)).toBe(true);
  });
});

describe('Claves: pista', () => {
  it('revela primero una posición que el jugador aún no ha acertado y nunca la última', () => {
    const level = generateCode(codeParamsForTier(1), 3);
    const [a, b, c] = level.secret;
    // Ya acertó la primera en su lugar: la pista va a otra
    const first = codeHint(level, [false, false, false], [{ guess: [a, (b + 1) % 10, (c + 2) % 10] }]);
    expect(first).not.toBe(0);
    expect(first).not.toBeNull();
    const revealed = [false, false, false];
    revealed[first!] = true;
    const second = codeHint(level, revealed, []);
    expect(second).not.toBeNull();
    revealed[second!] = true;
    expect(codeHint(level, revealed, [])).toBeNull();
  });
});

describe('Claves en el resto del juego', () => {
  it('es el cuarto puzzle, con récord, nivel y reto diario propios', () => {
    expect(PUZZLES).toEqual(['circuits', 'lights', 'flow', 'code']);
    expect(isPuzzleType('code')).toBe(true);
    expect(recordKeyFor('code', 4)).toBe(codeRecordKey(4));
    expect(dailyCodeSeed('2026-11-22')).not.toBe(dailyFlowSeed('2026-11-22'));
    let progress = withLevel(createDefaultProgress(5), 'code', 9);
    expect(levelOf(progress, 'code')).toBe(9);
    expect(levelOf(progress, 'flow')).toBe(1);
    progress = applyLevelOutcome(progress, { tier: 2, elapsedSeconds: 40, tapEfficiency: 1, sparksEarned: 10, hintsUsed: 0, isDaily: true, dailyPuzzle: 'code', today: '2026-11-22' });
    expect(lastDailyOf(progress, 'code')).toBe('2026-11-22');
    expect(lastDailyOf(progress, 'flow')).toBeNull();
  });

  it('un progreso de una versión anterior (sin Claves) empieza Claves en el nivel 1', () => {
    const old = { ...createDefaultProgress(1), currentLevel: 30 } as Record<string, unknown>;
    delete old.codeLevel;
    delete old.lastCodeDailyCompleted;
    const progress = sanitizeProgress(old, 1);
    expect(progress.codeLevel).toBe(1);
    expect(progress.lastCodeDailyCompleted).toBeNull();
    const modes = sanitizeModeProgress({ challenge: { levels: { circuits: 9, lights: 3, flow: 2 }, tiers: { circuits: 8, lights: 7, flow: 6 } } });
    expect(modes.challenge!.levels.code).toBe(1);
    expect(modes.challenge!.tiers.code).toBe(5);
  });

  it('la partida guardada conserva intentos, notas y posiciones reveladas, y rechaza lo corrupto', () => {
    const base = { level: 4, daily: false, dailyKey: '', seed: 9, width: 3, height: 1, minTaps: 5, elapsed: 30, taps: 2, hints: 1, moves: [] };
    const game = sanitizeSavedGame('code', { ...base, guesses: [[1, 2, 3], [4, 5, 6]], notes: [0, 1, 2, 0, 0, 0, 0, 0, 0, 0], revealed: [false, true, false] });
    expect(game?.guesses).toEqual([[1, 2, 3], [4, 5, 6]]);
    expect(game?.notes?.[2]).toBe(2);
    expect(game?.revealed).toEqual([false, true, false]);
    expect(sanitizeSavedGame('code', { ...base, guesses: [[1, 2]] })).toBeNull();
    expect(sanitizeSavedGame('code', { ...base, guesses: [[1, 2, 12]] })).toBeNull();
    expect(sanitizeSavedGame('code', { ...base })).toBeNull();
    // Notas o reveladas raras: se descartan sin perder la partida
    expect(sanitizeSavedGame('code', { ...base, guesses: [], notes: 'x', revealed: [1] })?.notes).toEqual(new Array(10).fill(0));
  });

  it('estrellas: tres con pocos intentos de más y sin pistas', () => {
    const expected = 8;
    const eff = (guesses: number) => Math.min(1, expected / guesses);
    expect(starsFor({ puzzle: 'code', hintsUsed: 0, tapEfficiency: eff(9) })).toBe(3);
    expect(starsFor({ puzzle: 'code', hintsUsed: 0, tapEfficiency: eff(14) })).toBe(2);
    expect(starsFor({ puzzle: 'code', hintsUsed: 2, tapEfficiency: eff(8) })).toBe(1);
    expect(PUZZLE_TUNING.code.masteryEfficiency).toBeGreaterThan(PUZZLE_TUNING.code.struggleEfficiency);
  });
});
