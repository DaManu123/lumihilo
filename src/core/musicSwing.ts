import { mulberry32 } from './rng';
import { PENTATONIC_SEMITONES } from './sound';
import type { Chord, MusicEvent } from './music';

/**
 * Estilo "swing": una pieza de jazz de sala, cálida y con groove, a 90 BPM con corcheas de tresillo.
 *
 * Es una composición original, en el espíritu de la música de salón de juego y del lo-fi de jazz (teclado
 * eléctrico, bajo caminando, escobillas suaves y una melodía que pregunta y responde), sin tomar la música
 * de ningún juego concreto.
 *
 * Los acordes son los de jazz de siempre (6/9, menor 11, 9 suspendido…), pero construidos **solo con las
 * cinco notas de la escala del juego** (do, re, mi, sol, la): suenan ricos y a jazz, y cualquier efecto que
 * toque el jugador sigue siendo consonante, suene el acorde que suene.
 */

/** La corchea "de después" cae a dos tercios del tiempo (ritmo de tresillo): eso es el swing. */
export const SWING_OFFBEAT = 2 / 3;
const off = (beat: number): number => beat + SWING_OFFBEAT;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export const SWING_CHORDS = {
  C69: { name: 'Do 6/9', root: 0, tones: [0, 2, 3, 4, 1] },
  Am11: { name: 'La menor 11', root: 4, tones: [4, 0, 2, 3, 1] },
  D9sus: { name: 'Re 9 sus', root: 1, tones: [1, 3, 4, 0, 2] },
  G6sus: { name: 'Sol 6 sus', root: 3, tones: [3, 4, 1, 2] },
  Em11: { name: 'Mi menor 11', root: 2, tones: [2, 3, 4, 1] },
} as const satisfies Record<string, Chord>;

/** Progresiones de cuatro compases (I–vi–ii–V y variantes); la última termina abierta para volver a la casa. */
export const SWING_PROGRESSIONS: readonly (readonly Chord[])[] = [
  [SWING_CHORDS.C69, SWING_CHORDS.Am11, SWING_CHORDS.D9sus, SWING_CHORDS.G6sus],
  [SWING_CHORDS.C69, SWING_CHORDS.Em11, SWING_CHORDS.Am11, SWING_CHORDS.D9sus],
  [SWING_CHORDS.Am11, SWING_CHORDS.D9sus, SWING_CHORDS.G6sus, SWING_CHORDS.C69],
];

/** Acorde que suena en un compás. */
export function swingChordAt(bar: number, seed: number): Chord {
  const phrase = Math.floor(bar / 4);
  const rng = mulberry32((seed ^ Math.imul(phrase + 1, 6151)) >>> 0);
  const progression = SWING_PROGRESSIONS[Math.floor(rng() * SWING_PROGRESSIONS.length)];
  return progression[((bar % 4) + 4) % 4];
}

// ---------------------------------------------------------------------------
// Melodía: una frase de cuatro compases que se enuncia, responde, se repite y resuelve
// ---------------------------------------------------------------------------

/** Notas (momento, duración en tiempos) de un compás, sobre la rejilla de swing. */
type Rhythm = ReadonlyArray<readonly [beat: number, length: number]>;

const RHYTHMS: readonly Rhythm[] = [
  [[0, 1], [off(1), 2 / 3], [off(2), 1 / 3], [3, 1]],
  [[off(0), 1 / 3], [1, 5 / 3], [3, 2 / 3], [off(3), 1 / 3]],
  [[0, 2 / 3], [off(0), 1 / 3], [1, 2 / 3], [off(1), 1 / 3], [2, 2]],
  [[1, 2 / 3], [off(1), 1 / 3], [2, 1], [3, 1]],
];

/** Desplazamientos (en notas de la escala) respecto a la nota inicial. */
const CONTOURS: readonly (readonly number[])[] = [
  [0, 2, 1, 3, 2],
  [0, -1, 1, 0, 2],
  [2, 1, 0, 1, 3],
  [0, 1, 3, 2, 4],
];

/** La melodía vive entre mi (4.ª octava) y sol (5.ª): índices 2 a 8 de la escala de dos octaves. */
const LEAD_MIN = 2;
const LEAD_MAX = 8;
const clampIndex = (i: number) => Math.min(LEAD_MAX, Math.max(LEAD_MIN, i));

type Pitch = Pick<MusicEvent, 'degree' | 'octave'>;
const pitchOf = (index: number): Pitch => ({
  degree: (index % 5) as MusicEvent['degree'],
  octave: Math.floor(index / 5),
});

/** Nota de la melodía que mejor representa la fundamental del acorde. */
function rootIndex(chord: Chord): number {
  const low = chord.root;
  return low >= LEAD_MIN ? low : low + 5;
}

function leadEvents(bar: number, level: number, seed: number, chord: Chord, jitter: () => number): MusicEvent[] {
  if (level < 0.45) return [];
  const position = ((bar % 4) + 4) % 4;
  // Con poca intensidad la melodía solo enuncia (compases 1 y 3) y deja respirar los otros dos
  if (level < 0.7 && (position === 1 || position === 3)) return [];

  // Lo que se sortea depende solo de la frase, así que el compás 3 repite exactamente el compás 1
  const phrase = Math.floor(bar / 4);
  const rng = mulberry32((seed + Math.imul(phrase + 1, 40503)) >>> 0);
  const rhythm = RHYTHMS[Math.floor(rng() * RHYTHMS.length)];
  const contour = CONTOURS[Math.floor(rng() * CONTOURS.length)];
  const start = LEAD_MIN + Math.floor(rng() * 3);

  const note = (beat: number, length: number, index: number, velocity: number): MusicEvent => ({
    voice: 'lead',
    beat,
    length,
    velocity: Math.min(1, Math.max(0.05, velocity + jitter())),
    ...pitchOf(clampIndex(index)),
  });

  if (position === 3) {
    // Resolución: dos notas largas que aterrizan en el acorde y vuelven a la nota de salida
    return [note(0, 2, rootIndex(chord), 0.42), note(off(2), 1, start, 0.36)];
  }
  const answer = position === 1;
  const offsets = answer ? [...contour].reverse() : contour;
  const base = answer ? start + 1 : start;
  return rhythm.map(([beat, length], i) => note(beat, length, base + offsets[i], 0.4));
}

// ---------------------------------------------------------------------------
// Disposición del acorde en el teclado
// ---------------------------------------------------------------------------

/** Distancia mínima (en semitonos) entre dos notas de un mismo golpe: evita los racimos turbios. */
export const MIN_VOICING_GAP = 3;

/**
 * Acorde sin fundamental y en disposición abierta: si una nota quedaría a menos de una tercera menor de otra
 * ya colocada, sube una octava (como abre un acorde un pianista de jazz).
 */
export function openVoicing(chord: Chord): Array<Pick<MusicEvent, 'degree' | 'octave'>> {
  const tones = chord.tones.filter((t) => t !== chord.root).sort((a, b) => a - b).slice(0, 4);
  const placed: number[] = [];
  return tones.map((degree) => {
    let pitch = PENTATONIC_SEMITONES[degree];
    if (placed.some((p) => Math.abs(p - pitch) < MIN_VOICING_GAP)) pitch += 12;
    placed.push(pitch);
    return { degree, octave: pitch >= 12 ? 1 : 0 };
  });
}

// ---------------------------------------------------------------------------
// Compás completo
// ---------------------------------------------------------------------------

/**
 * Notas de un compás del estilo swing. `intensity` (0 a 1) es cuánto circuito está encendido: con 0 suenan
 * las escobillas, el bajo y algún acorde suelto; con más intensidad entran los golpes de teclado, el bajo
 * caminando, la caja, el bombo y, a partir de 0,45, la melodía.
 */
export function swingBarEvents(bar: number, intensity: number, seed: number): MusicEvent[] {
  const level = clamp01(intensity);
  const chord = swingChordAt(bar, seed);
  const next = swingChordAt(bar + 1, seed);
  const rng = mulberry32((seed + Math.imul(bar + 1, 2909)) >>> 0);
  const jitter = () => (rng() - 0.5) * 0.1;
  const velocity = (v: number) => Math.min(1, Math.max(0.05, v + jitter()));
  const events: MusicEvent[] = [];

  // Teclado eléctrico: acordes sin fundamental (como lo tocaría un pianista, el bajo ya pone la raíz)
  const comp = (beat: number, length: number, base: number, c: Chord) => {
    for (const { degree, octave } of openVoicing(c)) {
      events.push({ voice: 'keys', beat, degree, octave, length, velocity: velocity(base) });
    }
  };
  comp(0, 1.5, 0.55, chord);
  if (level >= 0.2 || rng() < 0.5) comp(off(1), 0.9, 0.45, chord);
  // Anticipación: el acorde del compás siguiente entra una corchea antes, como en el jazz de verdad
  if (level >= 0.4) comp(off(3), 0.8, 0.42, next);

  // Bajo: la fundamental en el primer tiempo; con más intensidad, caminando
  const others = chord.tones.filter((t) => t !== chord.root);
  const bass = (beat: number, degree: MusicEvent['degree'], length: number, base: number) =>
    events.push({ voice: 'bass', beat, degree, octave: -1, length, velocity: velocity(base) });
  bass(0, chord.root, 1.6, 0.6);
  if (level < 0.35) {
    bass(2, others[Math.floor(rng() * others.length)], 1.5, 0.45);
  } else {
    const first = others[Math.floor(rng() * others.length)];
    const second = others.filter((t) => t !== first)[0] ?? first;
    // Nota de paso hacia la fundamental del compás siguiente (un grado por encima o por debajo)
    const approach = next.root > 0 ? next.root - 1 : next.root + 1;
    bass(1, first, 0.9, 0.5);
    bass(2, second, 0.9, 0.5);
    bass(3, approach as MusicEvent['degree'], 0.9, 0.5);
  }

  // Escobillas: platillo en cada tiempo y, con algo de intensidad, el "salto" del swing
  for (let beat = 0; beat < 4; beat++) {
    events.push({ voice: 'ride', beat, degree: 0, octave: 0, length: 0.3, velocity: velocity(0.38) });
  }
  if (level >= 0.15) {
    for (const beat of [off(1), off(3)]) {
      events.push({ voice: 'ride', beat, degree: 0, octave: 0, length: 0.3, velocity: velocity(0.28) });
    }
  }
  // Caja: notas fantasma en el segundo y cuarto tiempo
  if (level >= 0.3) {
    for (const beat of [1, 3]) {
      events.push({ voice: 'snare', beat, degree: 0, octave: 0, length: 0.2, velocity: velocity(0.3) });
    }
  }
  if (level >= 0.7) {
    events.push({ voice: 'snare', beat: off(2), degree: 0, octave: 0, length: 0.2, velocity: velocity(0.18) });
  }
  // Bombo suave: solo en el primer tiempo y, al final, también en el tercero
  if (level >= 0.55) events.push({ voice: 'kick', beat: 0, degree: 0, octave: 0, length: 0.3, velocity: velocity(0.5) });
  if (level >= 0.8) events.push({ voice: 'kick', beat: 2, degree: 0, octave: 0, length: 0.3, velocity: velocity(0.35) });

  events.push(...leadEvents(bar, level, seed, chord, jitter));
  return events.sort((a, b) => a.beat - b.beat);
}
