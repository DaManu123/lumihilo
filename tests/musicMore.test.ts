import { describe, it, expect } from 'vitest';
import { BEATS_PER_BAR, MUSIC_TRACKS, MusicTrack, TRACK_TEMPO, barEvents, barSeconds, chordAt } from '../src/core/music';

const NEW_TRACKS: MusicTrack[] = ['lofi', 'marimba', 'synth', 'nocturne', 'chip'];
const BARS = Array.from({ length: 48 }, (_, i) => i);
const SEEDS = [1, 42, 7777, 123456];
const PERCUSSION = new Set(['kick', 'snare', 'ride', 'hat']);
const notes = (track: MusicTrack, intensity: number, seed = 21) =>
  BARS.reduce((n, b) => n + barEvents(b, intensity, seed, track).filter((e) => !PERCUSSION.has(e.voice)).length, 0);

describe('Los cinco temas nuevos (src/core/musicMore.ts)', () => {
  it('hay nueve temas en total, cada uno con su tempo', () => {
    expect(MUSIC_TRACKS).toEqual(['swing', 'ambient', 'cristal', 'hilo', 'lofi', 'marimba', 'synth', 'nocturne', 'chip']);
    expect(TRACK_TEMPO).toMatchObject({ lofi: 72, marimba: 96, synth: 104, nocturne: 60, chip: 112 });
    for (const track of MUSIC_TRACKS) {
      expect(barSeconds(track)).toBeCloseTo((60 / TRACK_TEMPO[track]) * BEATS_PER_BAR, 6);
      // Ningún compás dura tan poco que agobie ni tanto que parezca parado
      expect(barSeconds(track)).toBeGreaterThan(2);
      expect(barSeconds(track)).toBeLessThanOrEqual(4);
    }
  });

  for (const track of NEW_TRACKS) {
    describe(`tema «${track}»`, () => {
      it('es determinista y cambia con la semilla', () => {
        expect(barEvents(5, 0.6, 99, track)).toEqual(barEvents(5, 0.6, 99, track));
        const a = BARS.map((b) => JSON.stringify(barEvents(b, 0.6, 1, track))).join();
        const b = BARS.map((b) => JSON.stringify(barEvents(b, 0.6, 2, track))).join();
        expect(a).not.toBe(b);
      });

      it('todas las notas son de la pentatónica, caen dentro del compás y tienen valores válidos', () => {
        for (const seed of SEEDS) {
          for (const bar of BARS) {
            for (const intensity of [0, 0.5, 1]) {
              const events = barEvents(bar, intensity, seed, track);
              for (const e of events) {
                expect([0, 1, 2, 3, 4]).toContain(e.degree);
                expect(e.beat).toBeGreaterThanOrEqual(0);
                expect(e.beat).toBeLessThan(BEATS_PER_BAR);
                expect(e.length).toBeGreaterThan(0);
                expect(e.velocity).toBeGreaterThan(0);
                expect(e.velocity).toBeLessThanOrEqual(1);
                expect(e.octave).toBeGreaterThanOrEqual(-2);
                expect(e.octave).toBeLessThanOrEqual(2);
              }
              // Salen ordenados por momento
              for (let i = 1; i < events.length; i++) expect(events[i].beat).toBeGreaterThanOrEqual(events[i - 1].beat);
            }
          }
        }
      });

      it('cada compás tiene sonido y la densidad es manejable (máximo 40 eventos)', () => {
        for (const seed of SEEDS) {
          for (const bar of BARS) {
            for (const intensity of [0, 1]) {
              const n = barEvents(bar, intensity, seed, track).length;
              expect(n).toBeGreaterThan(0);
              expect(n).toBeLessThanOrEqual(40);
            }
          }
        }
      });

      it('con más avance en el nivel toca más notas', () => {
        expect(notes(track, 1)).toBeGreaterThan(notes(track, 0));
        expect(notes(track, 0.5)).toBeGreaterThanOrEqual(notes(track, 0));
      });

      it('la intensidad se limita al rango 0 a 1', () => {
        expect(barEvents(3, 5, 8, track)).toEqual(barEvents(3, 1, 8, track));
        expect(barEvents(3, -2, 8, track)).toEqual(barEvents(3, 0, 8, track));
      });

      it('el bajo toca siempre una nota del acorde del compás', () => {
        for (const bar of BARS) {
          const chord = chordAt(bar, 21);
          for (const e of barEvents(bar, 1, 21, track).filter((e) => e.voice === 'bass')) expect(chord.tones).toContain(e.degree);
        }
      });
    });
  }

  it('cada tema suena distinto: sus voces principales no son las mismas', () => {
    const voices = (track: MusicTrack) =>
      [...new Set(BARS.flatMap((b) => barEvents(b, 1, 5, track).map((e) => e.voice)))].sort().join();
    const sets = MUSIC_TRACKS.map(voices);
    expect(new Set(sets).size).toBe(MUSIC_TRACKS.length);
  });

  it('el nocturno es el más tranquilo y el chip el más rápido', () => {
    const tempos = MUSIC_TRACKS.map((t) => TRACK_TEMPO[t]);
    expect(TRACK_TEMPO.nocturne).toBe(Math.min(...tempos));
    expect(TRACK_TEMPO.chip).toBe(Math.max(...tempos));
    expect(notes('nocturne', 1)).toBeLessThan(notes('chip', 1));
  });
});
