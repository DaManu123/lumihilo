import { mulberry32 } from './rng';

/**
 * Claves: adivinar un número secreto (lógica pura, sin Phaser).
 *
 * El juego elige una clave de `length` cifras (cada una entre `low` y `high`; con o sin repetidas). El jugador prueba
 * números y, por cada intento, se le dice:
 * - **«En su lugar»** (`exact`): cifras correctas en la posición correcta.
 * - **«En otro lugar»** (`misplaced`): cifras que están en la clave, pero en otra posición.
 * En los niveles fáciles (`colors`) además se marca cada cifra del intento: en su lugar, en otro lugar o no está.
 *
 * Siempre es resoluble (la clave existe y cualquier número válido se puede probar). No hay derrota salvo en el modo
 * Reto, que tiene un límite de intentos (`maxGuessesFor`).
 */

export interface CodeParams {
  /** Cifras de la clave (2 a 6). */
  length: number;
  /** Cifras posibles: de `low` a `high` (0 a 9). */
  low: number;
  high: number;
  /** ¿Puede repetirse una cifra en la clave (y en los intentos)? */
  repeats: boolean;
  /** ¿Se marca cada cifra del intento? (niveles fáciles); si no, solo los dos números. */
  colors: boolean;
  /**
   * Intentos de un buen jugador en esta forma de nivel. Medido con un jugador simulado que siempre prueba una clave
   * compatible con todo lo que sabe (`simulateConsistentPlayer`, ver `tests/code.test.ts`) y con margen para personas,
   * que no llevan la cuenta perfecta (más margen cuantas más cifras y sin colores).
   */
  expected: number;
}

export interface CodeLevel {
  params: CodeParams;
  seed: number;
  secret: number[];
  /** Intentos que necesita un buen jugador (hace de «toques mínimos» para la dificultad, las Chispas y las estrellas). */
  expectedGuesses: number;
}

export interface GuessScore {
  exact: number;
  misplaced: number;
}

export type DigitMark = 'exact' | 'present' | 'absent';

/**
 * Peldaños 1 a 10: más cifras, más difícil. **Todos usan las diez cifras (0 a 9)**, para que el teclado tenga siempre las
 * diez (lo pidió el usuario). Los tres primeros marcan cada cifra (el modo Relajado no pasa de ahí; el 3 ya admite
 * repetidas); desde el 4 solo se dan los dos números, y desde el 6 las cifras pueden repetirse.
 */
const CODE_TIERS: ReadonlyArray<CodeParams> = [
  { length: 3, low: 0, high: 9, repeats: false, colors: true, expected: 6 },
  { length: 4, low: 0, high: 9, repeats: false, colors: true, expected: 7 },
  { length: 4, low: 0, high: 9, repeats: true, colors: true, expected: 8 },
  { length: 3, low: 0, high: 9, repeats: false, colors: false, expected: 8 },
  { length: 4, low: 0, high: 9, repeats: false, colors: false, expected: 9 },
  { length: 4, low: 0, high: 9, repeats: true, colors: false, expected: 10 },
  { length: 5, low: 0, high: 9, repeats: false, colors: false, expected: 10 },
  { length: 5, low: 0, high: 9, repeats: true, colors: false, expected: 11 },
  { length: 6, low: 0, high: 9, repeats: false, colors: false, expected: 11 },
  { length: 6, low: 0, high: 9, repeats: true, colors: false, expected: 13 },
];

export const MIN_CODE_LENGTH = 2;
export const MAX_CODE_LENGTH = 6;

export function codeParamsForTier(tier: number): CodeParams {
  const t = Math.max(1, Math.min(CODE_TIERS.length, Math.floor(tier)));
  return { ...CODE_TIERS[t - 1] };
}

/** Cuántas cifras distintas se pueden usar. */
export function alphabetSize(params: CodeParams): number {
  return params.high - params.low + 1;
}

/** Cuántas claves distintas hay con estas reglas. */
export function codeSpaceSize(params: CodeParams): number {
  const n = alphabetSize(params);
  if (params.repeats) return n ** params.length;
  let total = 1;
  for (let i = 0; i < params.length; i++) total *= n - i;
  return total;
}

/** Intentos de un buen jugador en este nivel (hace de «toques mínimos»). */
export function expectedGuessesFor(params: CodeParams): number {
  return Math.max(2, Math.round(params.expected));
}

/** Límite de intentos del modo Reto (holgado: el doble de lo que tarda un buen jugador, y al menos 6). */
export function maxGuessesFor(params: CodeParams): number {
  return Math.max(6, expectedGuessesFor(params) * 2);
}

export function generateCode(params: CodeParams, seed: number): CodeLevel {
  const rand = mulberry32(seed);
  const pool: number[] = [];
  for (let d = params.low; d <= params.high; d++) pool.push(d);
  const secret: number[] = [];
  for (let i = 0; i < params.length; i++) {
    if (params.repeats) {
      secret.push(pool[Math.floor(rand() * pool.length)]);
    } else {
      const index = Math.floor(rand() * pool.length);
      secret.push(pool[index]);
      pool.splice(index, 1);
    }
  }
  return { params: { ...params }, seed, secret, expectedGuesses: expectedGuessesFor(params) };
}

/** Califica un intento: cuántas cifras están en su lugar y cuántas en otro lugar (bien también con repetidas). */
export function scoreGuess(secret: readonly number[], guess: readonly number[]): GuessScore {
  let exact = 0;
  const secretLeft = new Array(10).fill(0);
  const guessLeft = new Array(10).fill(0);
  for (let i = 0; i < secret.length; i++) {
    if (guess[i] === secret[i]) exact++;
    else {
      secretLeft[secret[i]]++;
      guessLeft[guess[i]]++;
    }
  }
  let misplaced = 0;
  for (let d = 0; d < 10; d++) misplaced += Math.min(secretLeft[d], guessLeft[d]);
  return { exact, misplaced };
}

/**
 * Marca cada cifra del intento (niveles con colores). Con repetidas, cada cifra de la clave se «usa» una sola vez:
 * primero las que están en su lugar y después, de izquierda a derecha, las que están en otro lugar.
 */
export function markGuess(secret: readonly number[], guess: readonly number[]): DigitMark[] {
  const marks: DigitMark[] = guess.map(() => 'absent');
  const left = new Array(10).fill(0);
  for (let i = 0; i < secret.length; i++) {
    if (guess[i] === secret[i]) marks[i] = 'exact';
    else left[secret[i]]++;
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === 'exact') continue;
    if (left[guess[i]] > 0) {
      marks[i] = 'present';
      left[guess[i]]--;
    }
  }
  return marks;
}

export const isSolvedScore = (score: GuessScore, params: CodeParams): boolean => score.exact === params.length;

export type GuessProblem = 'incomplete' | 'out-of-range' | 'repeated';

/** ¿Se puede probar este número? (completo, con cifras permitidas y sin repetir si el nivel no lo deja). */
export function guessProblem(params: CodeParams, guess: ReadonlyArray<number | null>): GuessProblem | null {
  if (guess.length !== params.length || guess.some((d) => d === null)) return 'incomplete';
  const digits = guess as number[];
  if (digits.some((d) => !Number.isInteger(d) || d < params.low || d > params.high)) return 'out-of-range';
  if (!params.repeats && new Set(digits).size !== digits.length) return 'repeated';
  return null;
}

/** ¿Esta cifra se puede usar en el nivel? */
export const digitAllowed = (params: CodeParams, digit: number): boolean => digit >= params.low && digit <= params.high;

// ---------------------------------------------------------------------------
// Notas automáticas y pista
// ---------------------------------------------------------------------------

/** Lo que el jugador ya sabe de una cifra: que está en la clave, que no está, o nada. */
export type DigitNote = 'in' | 'out' | null;

/**
 * Lo que se deduce con seguridad de los intentos hechos, para tachar o marcar las teclas solas:
 * - Con colores: una cifra está si alguna vez salió en su lugar o en otro lugar; no está si en algún intento todas sus
 *   apariciones salieron «no está» (con repetidas, eso solo dice que no hay más copias, así que no se tacha si salió).
 * - Sin colores: un intento con 0 y 0 tacha todas sus cifras; uno con todas las cifras acertadas (en su lugar o no) y
 *   sin repetidas tacha las que no usó.
 */
export function deduceNotes(params: CodeParams, guesses: ReadonlyArray<{ guess: readonly number[]; score: GuessScore; marks?: readonly DigitMark[] }>): DigitNote[] {
  const notes: DigitNote[] = new Array(10).fill(null);
  for (const { guess, score, marks } of guesses) {
    if (params.colors && marks) {
      guess.forEach((d, i) => {
        if (marks[i] !== 'absent') notes[d] = 'in';
      });
    } else if (score.exact + score.misplaced > 0 && !params.repeats) {
      if (score.exact + score.misplaced === params.length) {
        guess.forEach((d) => (notes[d] = 'in'));
        for (let d = 0; d < 10; d++) if (!guess.includes(d) && notes[d] === null) notes[d] = 'out';
      }
    }
  }
  for (const { guess, score, marks } of guesses) {
    if (params.colors && marks) {
      guess.forEach((d, i) => {
        if (marks[i] === 'absent' && notes[d] !== 'in' && guess.every((other, j) => other !== d || marks[j] === 'absent')) notes[d] = 'out';
      });
    } else if (score.exact + score.misplaced === 0) {
      guess.forEach((d) => (notes[d] = 'out'));
    }
  }
  return notes;
}

/**
 * Pista: la posición que se revela (la cifra de la clave queda fija en ella). Primero las que el jugador aún no ha
 * acertado en su lugar en ningún intento (con colores se sabe cuáles son); si no, la primera sin revelar. Null si ya
 * no queda ninguna por revelar.
 */
export function codeHint(
  level: CodeLevel,
  revealed: ReadonlyArray<boolean>,
  guesses: ReadonlyArray<{ guess: readonly number[] }>
): number | null {
  const known = new Array(level.secret.length).fill(false);
  if (level.params.colors) {
    for (const { guess } of guesses) guess.forEach((d, i) => d === level.secret[i] && (known[i] = true));
  }
  const free = level.secret.map((_, i) => i).filter((i) => !revealed[i]);
  if (free.length <= 1) return null; // revelar la última sería resolverlo
  return free.find((i) => !known[i]) ?? free[0];
}

// ---------------------------------------------------------------------------
// Jugador simulado (para medir la dificultad en las pruebas)
// ---------------------------------------------------------------------------

/** Todas las claves posibles (solo para niveles pequeños: con 6 cifras repetidas son un millón). */
export function allCodes(params: CodeParams): number[][] {
  const out: number[][] = [];
  const current: number[] = [];
  const walk = () => {
    if (current.length === params.length) {
      out.push([...current]);
      return;
    }
    for (let d = params.low; d <= params.high; d++) {
      if (!params.repeats && current.includes(d)) continue;
      current.push(d);
      walk();
      current.pop();
    }
  };
  walk();
  return out;
}

/** Intentos que necesita un jugador que siempre prueba al azar una clave compatible con todo lo que sabe. */
export function simulateConsistentPlayer(level: CodeLevel, seed: number, candidates?: number[][]): number {
  const rand = mulberry32(seed);
  let pool = candidates ?? allCodes(level.params);
  for (let turn = 1; turn <= 60; turn++) {
    const guess = pool[Math.floor(rand() * pool.length)];
    const score = scoreGuess(level.secret, guess);
    if (score.exact === level.params.length) return turn;
    if (level.params.colors) {
      const marks = markGuess(level.secret, guess).join();
      pool = pool.filter((c) => markGuess(c, guess).join() === marks);
    } else {
      pool = pool.filter((c) => {
        const s = scoreGuess(c, guess);
        return s.exact === score.exact && s.misplaced === score.misplaced;
      });
    }
  }
  return 60;
}
