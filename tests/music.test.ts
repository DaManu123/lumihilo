import { describe, it, expect } from 'vitest';
import {
  BAR_SECONDS,
  BEATS_PER_BAR,
  CHORDS,
  PROGRESSIONS,
  barEvents,
  chordAt,
  crystalBarEvents,
  beatSeconds,
  barSeconds,
  degreeFrequency,
  progressionFor,
} from '../src/core/music';
import { noteFrequency, PENTATONIC_SEMITONES, ROOT_HZ } from '../src/core/sound';

const BARS = Array.from({ length: 48 }, (_, i) => i);
const countVoice = (events: ReturnType<typeof barEvents>, voice: string) => events.filter((e) => e.voice === voice).length;

describe('Música generativa (src/core/music.ts)', () => {
  it('el compás dura lo que dicta el tempo (76 BPM, 4 tiempos)', () => {
    expect(BAR_SECONDS).toBeCloseTo((60 / 76) * 4, 6);
  });

  it('es determinista: misma semilla, compás e intensidad dan las mismas notas', () => {
    for (const bar of [0, 1, 5, 17]) {
      expect(barEvents(bar, 0.6, 1234)).toEqual(barEvents(bar, 0.6, 1234));
    }
  });

  it('semillas distintas dan temas distintos (no suena igual en cada sesión)', () => {
    const a = JSON.stringify(BARS.map((b) => barEvents(b, 0.6, 1)));
    const b = JSON.stringify(BARS.map((b2) => barEvents(b2, 0.6, 99999)));
    expect(a).not.toBe(b);
  });

  it('todos los acordes usan solo notas de la escala pentatónica del juego', () => {
    for (const chord of Object.values(CHORDS)) {
      for (const degree of chord.tones) {
        expect(degree).toBeGreaterThanOrEqual(0);
        expect(degree).toBeLessThan(PENTATONIC_SEMITONES.length);
      }
      expect(chord.tones).toContain(chord.root);
    }
  });

  it('toda nota de la música pertenece al acorde de su compás (siempre es consonante)', () => {
    for (const seed of [1, 42, 7777]) {
      for (const bar of BARS) {
        const chord = chordAt(bar, seed);
        for (const intensity of [0, 0.3, 0.7, 1]) {
          for (const event of barEvents(bar, intensity, seed)) {
            expect(chord.tones, `compás ${bar}, ${event.voice}`).toContain(event.degree);
          }
        }
      }
    }
  });

  it('las frecuencias de la música son notas de la pentatónica en cualquier octava', () => {
    for (const bar of BARS) {
      for (const event of barEvents(bar, 1, 5)) {
        const semitones = Math.round(12 * Math.log2(degreeFrequency(event.degree, event.octave) / ROOT_HZ));
        const pitchClass = ((semitones % 12) + 12) % 12;
        expect(PENTATONIC_SEMITONES as readonly number[]).toContain(pitchClass);
      }
    }
  });

  it('los eventos caen dentro del compás y tienen valores válidos', () => {
    for (const bar of BARS) {
      for (const e of barEvents(bar, 1, 3)) {
        expect(e.beat).toBeGreaterThanOrEqual(0);
        expect(e.beat).toBeLessThan(BEATS_PER_BAR);
        expect(e.length).toBeGreaterThan(0);
        expect(e.velocity).toBeGreaterThan(0);
        expect(e.velocity).toBeLessThanOrEqual(1);
      }
    }
  });

  it('los eventos salen ordenados por momento', () => {
    for (const bar of BARS) {
      const beats = barEvents(bar, 0.8, 9).map((e) => e.beat);
      expect(beats).toEqual([...beats].sort((x, y) => x - y));
    }
  });

  it('con intensidad 0 no hay arpa: solo colchón, bajo y alguna campanita', () => {
    for (const bar of BARS) {
      expect(countVoice(barEvents(bar, 0, 11), 'arp')).toBe(0);
    }
    const quiet = barEvents(0, 0, 11);
    expect(countVoice(quiet, 'pad')).toBe(4);
    expect(countVoice(quiet, 'bass')).toBe(1);
  });

  it('cuanto más circuito encendido, más notas de arpa', () => {
    const total = (intensity: number) => BARS.reduce((n, b) => n + countVoice(barEvents(b, intensity, 21), 'arp'), 0);
    const low = total(0.2);
    const mid = total(0.5);
    const high = total(1);
    expect(low).toBeGreaterThan(0);
    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
  });

  it('nunca hay más de 16 notas en un compás (la densidad máxima es manejable)', () => {
    for (const bar of BARS) {
      expect(barEvents(bar, 1, 8).length).toBeLessThanOrEqual(16);
    }
  });

  it('la intensidad se limita al rango 0 a 1', () => {
    expect(barEvents(2, 5, 4)).toEqual(barEvents(2, 1, 4));
    expect(barEvents(2, -3, 4)).toEqual(barEvents(2, 0, 4));
  });

  it('cada frase de cuatro compases empieza en do, que hace de casa', () => {
    for (const seed of [1, 2, 3, 100, 5555]) {
      for (const phrase of [0, 1, 2, 7]) {
        expect(progressionFor(phrase, seed)[0]).toBe(CHORDS.C);
      }
    }
    for (const progression of PROGRESSIONS) {
      expect(progression).toHaveLength(4);
      expect(progression[0]).toBe(CHORDS.C);
    }
  });

  it('el compás N de una frase usa el acorde N de su progresión', () => {
    for (const bar of [0, 1, 2, 3, 4, 5, 6, 7, 40]) {
      expect(chordAt(bar, 6)).toBe(progressionFor(Math.floor(bar / 4), 6)[bar % 4]);
    }
  });

  it('degreeFrequency sube una octava exacta por cada +1 de octava', () => {
    expect(degreeFrequency(0, 1)).toBeCloseTo(noteFrequency(0) * 2, 6);
    expect(degreeFrequency(3, -1)).toBeCloseTo(noteFrequency(3) / 2, 6);
  });
});

describe('Caja de música de Luces (pista «cristal»)', () => {
  const box = (bar: number, level: number, seed = 7) => barEvents(bar, level, seed, 'cristal');

  it('es otra pista: su tempo es más lento y se despacha desde barEvents', () => {
    expect(beatSeconds('cristal')).toBeGreaterThan(beatSeconds('ambient'));
    expect(barSeconds('cristal')).toBeCloseTo((60 / 66) * 4, 6);
    expect(box(3, 0.5)).toEqual(crystalBarEvents(3, 0.5, 7));
  });

  it('es determinista y sin batería', () => {
    for (const bar of [0, 1, 9]) expect(box(bar, 0.6)).toEqual(box(bar, 0.6));
    for (const bar of BARS) {
      for (const e of box(bar, 1)) expect(['pad', 'bass', 'bell']).toContain(e.voice);
    }
  });

  it('con todo apagado casi solo suena el tic del primer tiempo; con todo encendido toca muchas más notas', () => {
    const quiet = BARS.reduce((n, b) => n + countVoice(box(b, 0), 'bell'), 0);
    const full = BARS.reduce((n, b) => n + countVoice(box(b, 1), 'bell'), 0);
    expect(quiet / BARS.length).toBeLessThan(2.5);
    expect(full / BARS.length).toBeGreaterThan(quiet / BARS.length + 3);
  });

  it('crece de forma monótona con la intensidad (en promedio)', () => {
    let last = -1;
    for (const level of [0, 0.25, 0.5, 0.75, 1]) {
      const n = BARS.reduce((total, b) => total + box(b, level).length, 0);
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
  });

  it('todas las notas son de la pentatónica, caen dentro del compás y tienen volumen válido', () => {
    for (const bar of BARS) {
      for (const e of box(bar, 0.9)) {
        expect(e.degree).toBeGreaterThanOrEqual(0);
        expect(e.degree).toBeLessThan(PENTATONIC_SEMITONES.length);
        expect(e.beat).toBeGreaterThanOrEqual(0);
        expect(e.beat).toBeLessThan(BEATS_PER_BAR);
        expect(e.velocity).toBeGreaterThan(0);
        expect(e.velocity).toBeLessThanOrEqual(1);
      }
    }
  });

  it('el destello final solo aparece cuando casi todo está encendido', () => {
    const sparkle = (level: number) => BARS.some((b) => box(b, level).some((e) => e.octave === 2));
    expect(sparkle(0.5)).toBe(false);
    expect(sparkle(0.9)).toBe(true);
  });
});
