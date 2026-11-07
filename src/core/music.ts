import { mulberry32 } from './rng';
import { noteFrequency } from './sound';

/**
 * Música generativa del juego (lógica pura, sin Web Audio).
 *
 * Es un tema ambiental en bucle que nunca se repite exactamente igual: un acorde por compás sobre una
 * progresión de cuatro compases, con un colchón suave, un bajo y una arpa de cristal que se vuelve
 * más densa cuanto más circuito está encendido.
 *
 * Todos los acordes se construyen solo con las cinco notas de la escala pentatónica del juego
 * (do, re, mi, sol, la), igual que los efectos de sonido: por eso cualquier nota que toque el
 * jugador es consonante con la música de fondo, suene el acorde que suene.
 */

export const TEMPO_BPM = 76;
export const BEATS_PER_BAR = 4;
export const BEAT_SECONDS = 60 / TEMPO_BPM;
export const BAR_SECONDS = BEAT_SECONDS * BEATS_PER_BAR;

/** Grados de la escala: 0 = do, 1 = re, 2 = mi, 3 = sol, 4 = la. */
export type Degree = 0 | 1 | 2 | 3 | 4;

export type MusicVoice = 'pad' | 'bass' | 'arp' | 'bell';

export interface MusicEvent {
  voice: MusicVoice;
  /** Momento dentro del compás, en tiempos (0 a 4). */
  beat: number;
  degree: Degree;
  /** Desplazamiento de octava respecto al do central (-2 = grave, 1 = agudo). */
  octave: number;
  /** Duración en tiempos. */
  length: number;
  /** Volumen relativo de 0 a 1. */
  velocity: number;
}

export interface Chord {
  name: string;
  root: Degree;
  tones: readonly Degree[];
}

/** Acordes hechos solo con notas de la pentatónica. */
export const CHORDS = {
  C: { name: 'Do add9', root: 0, tones: [0, 1, 2, 3] },
  Am: { name: 'La menor 7', root: 4, tones: [4, 0, 2, 3] },
  G: { name: 'Sol sus', root: 3, tones: [3, 1, 4, 2] },
  D: { name: 'Re sus', root: 1, tones: [1, 3, 4, 0] },
} as const satisfies Record<string, Chord>;

/** Progresiones de cuatro compases: todas empiezan en do (la casa) y terminan abiertas para volver a ella. */
export const PROGRESSIONS: readonly (readonly Chord[])[] = [
  [CHORDS.C, CHORDS.Am, CHORDS.G, CHORDS.D],
  [CHORDS.C, CHORDS.G, CHORDS.Am, CHORDS.D],
  [CHORDS.C, CHORDS.Am, CHORDS.D, CHORDS.G],
];

/** Orden en que la arpa recorre las notas del acorde, en corcheas. */
const ARP_PATTERN = [0, 2, 1, 3, 2, 3, 1, 2] as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Frecuencia de un grado de la escala en la octava indicada (0 = do central). */
export function degreeFrequency(degree: Degree, octave: number): number {
  return noteFrequency(degree) * Math.pow(2, octave);
}

/** Progresión de una frase de cuatro compases (la elección depende de la semilla). */
export function progressionFor(phrase: number, seed: number): readonly Chord[] {
  const rng = mulberry32((seed ^ Math.imul(phrase + 1, 7919)) >>> 0);
  return PROGRESSIONS[Math.floor(rng() * PROGRESSIONS.length)];
}

/** Acorde que suena en un compás. */
export function chordAt(bar: number, seed: number): Chord {
  const phrase = Math.floor(bar / 4);
  return progressionFor(phrase, seed)[((bar % 4) + 4) % 4];
}

/**
 * Notas de un compás. `intensity` (0 a 1) es cuánto circuito está encendido: con 0 solo hay colchón,
 * bajo y alguna campanita suelta; con 1 la arpa suena casi en cada corchea.
 */
export function barEvents(bar: number, intensity: number, seed: number): MusicEvent[] {
  const level = clamp01(intensity);
  const chord = chordAt(bar, seed);
  const rng = mulberry32((seed + Math.imul(bar + 1, 977)) >>> 0);
  const events: MusicEvent[] = [];

  // Colchón: el acorde entero, grave y suave, que se mantiene todo el compás
  for (const degree of chord.tones) {
    events.push({ voice: 'pad', beat: 0, degree, octave: -1, length: 4.4, velocity: 0.5 + 0.1 * level });
  }

  // Bajo: la fundamental; con más intensidad, un segundo golpe a media barra
  events.push({ voice: 'bass', beat: 0, degree: chord.root, octave: -2, length: 3.4, velocity: 0.6 });
  if (level >= 0.45) {
    events.push({ voice: 'bass', beat: 2, degree: chord.root, octave: -2, length: 1.6, velocity: 0.42 });
  }

  // Arpa de cristal: más notas cuanto más intensidad
  if (level > 0.08) {
    const chance = clamp01(0.18 + 0.72 * level);
    for (let step = 0; step < 8; step++) {
      if (rng() > chance) continue;
      const degree = chord.tones[ARP_PATTERN[step] % chord.tones.length];
      const high = level > 0.5 && step % 4 === 3;
      events.push({
        voice: 'arp',
        beat: step * 0.5,
        degree,
        octave: high ? 1 : 0,
        length: 1.2,
        velocity: 0.26 + 0.2 * rng(),
      });
    }
  }

  // Campanita suelta y aguda: da vida al tema aunque haya poco circuito encendido
  if (rng() < 0.55 - 0.3 * level) {
    const beat = rng() < 0.5 ? 2.5 : 3.5;
    events.push({
      voice: 'bell',
      beat,
      degree: chord.tones[Math.floor(rng() * chord.tones.length)],
      octave: 1,
      length: 1.6,
      velocity: 0.3,
    });
  }

  return events.sort((a, b) => a.beat - b.beat);
}
