import { mulberry32 } from './rng';
import type { Chord, Degree, MusicEvent } from './music';

/**
 * Cinco temas más para la música al azar (lógica pura): lo-fi, marimba, sintetizador, nocturno y chip.
 *
 * Son composiciones originales y generativas, como las demás: un compás a la vez sobre la misma progresión de acordes
 * pentatónicos (`chordAt` de `music.ts`), así que **toda nota es de la escala del juego** (do, re, mi, sol, la) y los
 * efectos siguen sonando consonantes. Como en los otros temas, `intensity` (0 a 1, cuánto se ha avanzado en el nivel)
 * añade notas: con 0 queda la base y con 1 el tema suena completo.
 */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const byBeat = (a: MusicEvent, b: MusicEvent) => a.beat - b.beat;
const barRng = (seed: number, bar: number, prime: number) => mulberry32((seed + Math.imul(bar + 1, prime)) >>> 0);
/** Nota del acorde: `i` recorre sus notas en orden (y da la vuelta). */
const tone = (chord: Chord, i: number): Degree => chord.tones[((i % chord.tones.length) + chord.tones.length) % chord.tones.length];

/** Corchea «de después» del lo-fi: un poco tarde, sin llegar al tresillo del swing. */
const LOFI_OFF = 0.58;

/**
 * Lo-fi (72 BPM): teclado eléctrico con acordes que se arrastran, bajo redondo, bombo y caja muy suaves, platillo cerrado
 * algo tarde y una melodía de vibráfono que aparece de vez en cuando.
 */
export function lofiBarEvents(bar: number, intensity: number, seed: number, chord: Chord): MusicEvent[] {
  const level = clamp01(intensity);
  const rng = barRng(seed, bar, 5281);
  const events: MusicEvent[] = [];

  chord.tones.forEach((degree, i) => events.push({ voice: 'keys', beat: i * 0.03, degree, octave: 0, length: 2.6, velocity: 0.38 }));
  if (rng() < 0.4 + 0.5 * level) {
    chord.tones.slice(0, 3).forEach((degree) => events.push({ voice: 'keys', beat: 2 + LOFI_OFF, degree, octave: 0, length: 1.2, velocity: 0.26 }));
  }
  events.push({ voice: 'bass', beat: 0, degree: chord.root, octave: -2, length: 1.6, velocity: 0.5 });
  events.push({ voice: 'bass', beat: 2 + LOFI_OFF, degree: tone(chord, 2), octave: -2, length: 1.2, velocity: 0.34 });

  events.push({ voice: 'kick', beat: 0, degree: 0, octave: 0, length: 0.5, velocity: 0.42 });
  if (level > 0.2 || rng() < 0.5) events.push({ voice: 'kick', beat: 2.5, degree: 0, octave: 0, length: 0.5, velocity: 0.3 });
  events.push({ voice: 'snare', beat: 1, degree: 0, octave: 0, length: 0.5, velocity: 0.22 });
  events.push({ voice: 'snare', beat: 3, degree: 0, octave: 0, length: 0.5, velocity: 0.22 });
  const hats = clamp01(0.45 + 0.55 * level);
  for (let beat = 0; beat < 4; beat++) {
    events.push({ voice: 'hat', beat, degree: 0, octave: 0, length: 0.2, velocity: 0.14 });
    if (rng() < hats) events.push({ voice: 'hat', beat: beat + LOFI_OFF, degree: 0, octave: 0, length: 0.2, velocity: 0.09 });
  }

  const melody = clamp01(0.12 + 0.5 * level);
  for (const beat of [LOFI_OFF, 1 + LOFI_OFF, 2, 3]) {
    if (rng() > melody) continue;
    events.push({ voice: 'lead', beat, degree: tone(chord, Math.floor(rng() * 4)), octave: 1, length: 0.9, velocity: 0.22 + 0.1 * rng() });
  }
  return events.sort(byBeat);
}

/** Recorrido de la marimba por las notas del acorde, en corcheas. */
const MARIMBA_PATTERN = [0, 2, 1, 3, 2, 4, 3, 1] as const;

/**
 * Marimba (96 BPM): madera alegre en corcheas sobre una marimba grave que marca el primer y tercer tiempo, con un colchón
 * muy bajo y, al avanzar, un sonajero en los contratiempos y un remate de semicorcheas.
 */
export function marimbaBarEvents(bar: number, intensity: number, seed: number, chord: Chord): MusicEvent[] {
  const level = clamp01(intensity);
  const rng = barRng(seed, bar, 3313);
  const events: MusicEvent[] = [];

  for (const degree of chord.tones) events.push({ voice: 'pad', beat: 0, degree, octave: -1, length: 4.4, velocity: 0.2 });
  events.push({ voice: 'mallet', beat: 0, degree: chord.root, octave: -1, length: 1.5, velocity: 0.5 });
  events.push({ voice: 'mallet', beat: 2, degree: tone(chord, 2), octave: -1, length: 1.5, velocity: 0.4 });

  const chance = clamp01(0.35 + 0.6 * level);
  for (let step = 0; step < 8; step++) {
    if (step > 0 && rng() > chance) continue;
    const index = MARIMBA_PATTERN[step];
    events.push({
      voice: 'mallet',
      beat: step * 0.5,
      degree: tone(chord, index),
      octave: index >= chord.tones.length ? 1 : 0,
      length: 0.8,
      velocity: (step % 2 === 0 ? 0.36 : 0.28) + 0.08 * rng(),
    });
  }
  if (level > 0.35) {
    for (let beat = 0; beat < 4; beat++) events.push({ voice: 'hat', beat: beat + 0.5, degree: 0, octave: 0, length: 0.2, velocity: 0.08 });
  }
  if (level > 0.6) {
    events.push({ voice: 'mallet', beat: 3.5, degree: tone(chord, 1), octave: 1, length: 0.5, velocity: 0.24 });
    events.push({ voice: 'mallet', beat: 3.75, degree: tone(chord, 2), octave: 1, length: 0.5, velocity: 0.26 });
  }
  return events.sort(byBeat);
}

/** Recorrido del arpegiador (posiciones de dos octavas sobre el acorde), en semicorcheas. */
const SYNTH_PATTERN = [0, 1, 2, 4, 3, 2, 1, 2, 0, 2, 4, 5, 4, 3, 2, 1] as const;

/**
 * Sintetizador (104 BPM): colchón amplio, arpegiador en semicorcheas con un filtro que se cierra, bajo sintético y un
 * bombo que pasa de dos golpes a uno por tiempo al avanzar.
 */
export function synthBarEvents(bar: number, intensity: number, seed: number, chord: Chord): MusicEvent[] {
  const level = clamp01(intensity);
  const rng = barRng(seed, bar, 7741);
  const events: MusicEvent[] = [];

  for (const degree of chord.tones) events.push({ voice: 'pad', beat: 0, degree, octave: -1, length: 4.4, velocity: 0.36 });
  for (const beat of level > 0.4 ? [0, 1.5, 2, 3.5] : [0, 2]) {
    events.push({ voice: 'bass', beat, degree: chord.root, octave: -2, length: 1.2, velocity: beat % 1 === 0 ? 0.42 : 0.3 });
  }
  for (const beat of level > 0.25 ? [0, 1, 2, 3] : [0, 2]) events.push({ voice: 'kick', beat, degree: 0, octave: 0, length: 0.5, velocity: 0.3 });
  if (level > 0.5) {
    for (let beat = 0; beat < 4; beat++) events.push({ voice: 'hat', beat: beat + 0.5, degree: 0, octave: 0, length: 0.2, velocity: 0.08 });
  }

  const chance = clamp01(0.25 + 0.7 * level);
  for (let step = 0; step < 16; step++) {
    if (step % 4 !== 0 && rng() > chance) continue;
    const position = SYNTH_PATTERN[step];
    const n = chord.tones.length;
    events.push({
      voice: 'synth',
      beat: step * 0.25,
      degree: tone(chord, position),
      octave: position >= n ? 1 : 0,
      length: 0.45,
      velocity: (step % 4 === 0 ? 0.3 : 0.2) + 0.06 * rng(),
    });
  }
  return events.sort(byBeat);
}

/**
 * Nocturno (60 BPM): el más tranquilo. Colchón cálido, la fundamental larga y un piano eléctrico que arpegia a negras;
 * a veces, una campanita lejana.
 */
export function nocturneBarEvents(bar: number, intensity: number, seed: number, chord: Chord): MusicEvent[] {
  const level = clamp01(intensity);
  const rng = barRng(seed, bar, 2729);
  const events: MusicEvent[] = [];

  for (const degree of chord.tones) events.push({ voice: 'pad', beat: 0, degree, octave: -1, length: 4.4, velocity: 0.42 });
  events.push({ voice: 'bass', beat: 0, degree: chord.root, octave: -2, length: 3.6, velocity: 0.45 });

  const chance = clamp01(0.3 + 0.6 * level);
  const start = Math.floor(rng() * chord.tones.length);
  for (let beat = 0; beat < 4; beat++) {
    if (beat > 0 && rng() > chance) continue;
    events.push({ voice: 'keys', beat, degree: tone(chord, start + beat), octave: 0, length: 2, velocity: 0.24 + 0.08 * rng() });
  }
  if (rng() < 0.25 + 0.3 * level) {
    events.push({ voice: 'bell', beat: 2.5, degree: tone(chord, Math.floor(rng() * 4)), octave: 1, length: 1.6, velocity: 0.18 });
  }
  return events.sort(byBeat);
}

/**
 * Chip (112 BPM): una canción de consola antigua, suave. Bajo de triángulo a negras, melodía de onda cuadrada que pasea por
 * la escala sin saltos grandes, platillo en corcheas y, al avanzar, caja y un eco arpegiado al final del compás.
 */
export function chipBarEvents(bar: number, intensity: number, seed: number, chord: Chord): MusicEvent[] {
  const level = clamp01(intensity);
  const rng = barRng(seed, bar, 9049);
  const events: MusicEvent[] = [];

  for (let beat = 0; beat < 4; beat++) {
    events.push({ voice: 'bass', beat, degree: beat % 2 === 0 ? chord.root : tone(chord, 2), octave: -2, length: 0.8, velocity: 0.4 });
  }
  for (let step = 0; step < 8; step++) events.push({ voice: 'hat', beat: step * 0.5, degree: 0, octave: 0, length: 0.2, velocity: step % 2 === 0 ? 0.08 : 0.05 });
  if (level > 0.3) {
    events.push({ voice: 'snare', beat: 1, degree: 0, octave: 0, length: 0.5, velocity: 0.15 });
    events.push({ voice: 'snare', beat: 3, degree: 0, octave: 0, length: 0.5, velocity: 0.15 });
  }

  // Melodía: paseo por dos octavas de la escala (posiciones 0 a 9), empezando en una nota del acorde
  let position = chord.tones[Math.floor(rng() * chord.tones.length)] + 5;
  const chance = clamp01(0.3 + 0.55 * level);
  for (let step = 0; step < 8; step++) {
    const move = [-2, -1, 0, 1, 1, 2][Math.floor(rng() * 6)];
    position = Math.min(9, Math.max(0, position + move));
    if (step > 0 && rng() > chance) continue;
    events.push({
      voice: 'chip',
      beat: step * 0.5,
      degree: (position % 5) as Degree,
      octave: Math.floor(position / 5),
      length: 0.45,
      velocity: (step === 0 ? 0.26 : 0.18) + 0.06 * rng(),
    });
  }
  if (level > 0.6) {
    [0, 1, 2, 3].forEach((i) =>
      events.push({ voice: 'chip', beat: 3 + i * 0.25, degree: tone(chord, i), octave: 1, length: 0.25, velocity: 0.1 })
    );
  }
  return events.sort(byBeat);
}
