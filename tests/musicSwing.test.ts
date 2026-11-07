import { describe, it, expect } from 'vitest';
import {
  MUSIC_STYLES,
  MUSIC_STYLE_LABELS,
  MUSIC_VOLUME_DEFAULT,
  MUSIC_VOLUME_MAX,
  barEvents,
  barSeconds,
  beatSeconds,
  isMusicStyle,
  musicGainScale,
  normalizeMusicVolume,
} from '../src/core/music';
import { MIN_VOICING_GAP, SWING_CHORDS, SWING_OFFBEAT, SWING_PROGRESSIONS, openVoicing, swingBarEvents, swingChordAt } from '../src/core/musicSwing';
import { PENTATONIC_SEMITONES, ROOT_HZ } from '../src/core/sound';
import { degreeFrequency } from '../src/core/music';

const BARS = Array.from({ length: 48 }, (_, i) => i);
const SEEDS = [1, 42, 7777, 123456];
const count = (events: ReturnType<typeof swingBarEvents>, voice: string) => events.filter((e) => e.voice === voice).length;
const total = (intensity: number, seed = 21) => BARS.reduce((n, b) => n + swingBarEvents(b, intensity, seed).length, 0);

describe('Música: estilos y volumen', () => {
  it('hay dos estilos con su etiqueta y se reconocen solo los válidos', () => {
    expect(MUSIC_STYLES).toEqual(['swing', 'ambient']);
    expect(MUSIC_STYLES.map((s) => MUSIC_STYLE_LABELS[s])).toEqual(['Swing', 'Ambiental']);
    for (const bad of ['', 'rock', null, undefined, 1]) expect(isMusicStyle(bad)).toBe(false);
  });

  it('cada estilo tiene su tempo y el compás dura lo que dicta', () => {
    expect(beatSeconds('swing')).toBeCloseTo(60 / 90, 6);
    expect(barSeconds('swing')).toBeCloseTo((60 / 90) * 4, 6);
    expect(barSeconds('ambient')).toBeCloseTo((60 / 76) * 4, 6);
    expect(barSeconds('swing')).toBeLessThan(barSeconds('ambient')); // el swing es más movido
  });

  it('barEvents elige el estilo y por defecto es el ambiental de siempre', () => {
    expect(barEvents(3, 0.6, 9)).toEqual(barEvents(3, 0.6, 9, 'ambient'));
    expect(barEvents(3, 0.6, 9, 'swing')).toEqual(swingBarEvents(3, 0.6, 9));
    expect(barEvents(3, 0.6, 9, 'swing')).not.toEqual(barEvents(3, 0.6, 9, 'ambient'));
  });

  it('el 100 % es el estándar y el volumen se puede bajar a 0 o subir hasta el doble', () => {
    expect(MUSIC_VOLUME_DEFAULT).toBe(100);
    expect(musicGainScale(100)).toBe(1);
    expect(musicGainScale(0)).toBe(0);
    expect(musicGainScale(200)).toBe(2);
    expect(musicGainScale(50)).toBe(0.5);
    expect(MUSIC_VOLUME_MAX).toBe(200);
  });

  it('un volumen fuera de rango o corrupto se corrige en vez de romper el audio', () => {
    expect(normalizeMusicVolume(-30)).toBe(0);
    expect(normalizeMusicVolume(900)).toBe(200);
    expect(normalizeMusicVolume(85.6)).toBe(86);
    for (const bad of [NaN, Infinity, '100', null, undefined, {}]) expect(normalizeMusicVolume(bad)).toBe(100);
    expect(musicGainScale(9999)).toBe(2);
  });
});

describe('Música swing (src/core/musicSwing.ts)', () => {
  it('es determinista y semillas distintas dan temas distintos', () => {
    for (const bar of [0, 1, 5, 17]) expect(swingBarEvents(bar, 0.7, 1234)).toEqual(swingBarEvents(bar, 0.7, 1234));
    const a = JSON.stringify(BARS.map((b) => swingBarEvents(b, 0.7, 1)));
    const b = JSON.stringify(BARS.map((b2) => swingBarEvents(b2, 0.7, 99999)));
    expect(a).not.toBe(b);
  });

  it('todos los acordes de jazz usan solo las cinco notas de la escala del juego', () => {
    for (const chord of Object.values(SWING_CHORDS)) {
      for (const degree of chord.tones) {
        expect(degree).toBeGreaterThanOrEqual(0);
        expect(degree).toBeLessThan(5);
      }
      expect(chord.tones).toContain(chord.root);
      expect(new Set(chord.tones).size).toBe(chord.tones.length); // sin notas repetidas
    }
  });

  it('toda nota de la música suena en la escala pentatónica (cualquier efecto es consonante)', () => {
    for (const seed of SEEDS) {
      for (const bar of BARS) {
        for (const intensity of [0, 0.4, 0.8, 1]) {
          for (const e of swingBarEvents(bar, intensity, seed)) {
            if (e.voice === 'ride' || e.voice === 'snare' || e.voice === 'kick') continue; // percusión sin altura
            const semitones = Math.round(12 * Math.log2(degreeFrequency(e.degree, e.octave) / ROOT_HZ));
            expect(PENTATONIC_SEMITONES as readonly number[], `compás ${bar}, ${e.voice}`).toContain(((semitones % 12) + 12) % 12);
          }
        }
      }
    }
  });

  it('el teclado toca solo notas del acorde (sin la fundamental) y el bajo empieza en la fundamental', () => {
    for (const seed of SEEDS) {
      for (const bar of BARS) {
        const chord = swingChordAt(bar, seed);
        const next = swingChordAt(bar + 1, seed);
        const events = swingBarEvents(bar, 1, seed);
        for (const e of events.filter((x) => x.voice === 'keys')) {
          // Las anticipaciones (corchea 3,667) pertenecen al acorde del compás siguiente
          const owner = e.beat > 3.5 ? next : chord;
          expect(owner.tones, `compás ${bar}`).toContain(e.degree);
          expect(e.degree).not.toBe(owner.root);
        }
        const firstBass = events.find((x) => x.voice === 'bass' && x.beat === 0);
        expect(firstBass?.degree).toBe(chord.root);
      }
    }
  });

  it('los acordes del teclado están abiertos: ninguna nota queda pegada a otra (sin racimos turbios)', () => {
    for (const chord of Object.values(SWING_CHORDS)) {
      const pitches = openVoicing(chord)
        .map((n) => PENTATONIC_SEMITONES[n.degree] + 12 * n.octave)
        .sort((a, b) => a - b);
      expect(pitches.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < pitches.length; i++) {
        expect(pitches[i] - pitches[i - 1], `${chord.name}: ${pitches.join(', ')}`).toBeGreaterThanOrEqual(MIN_VOICING_GAP);
      }
    }
  });

  it('la disposición abierta no incluye la fundamental (la pone el bajo) y mantiene las notas del acorde', () => {
    for (const chord of Object.values(SWING_CHORDS)) {
      const voiced = openVoicing(chord).map((n) => n.degree);
      expect(voiced).not.toContain(chord.root);
      for (const degree of voiced) expect(chord.tones).toContain(degree);
    }
  });

  it('todo cae en la rejilla del swing: en un tiempo o a dos tercios de él', () => {
    for (const bar of BARS) {
      for (const e of swingBarEvents(bar, 1, 5)) {
        const fraction = e.beat - Math.floor(e.beat);
        const onGrid = Math.abs(fraction) < 1e-9 || Math.abs(fraction - SWING_OFFBEAT) < 1e-9;
        expect(onGrid, `compás ${bar}, ${e.voice} en ${e.beat}`).toBe(true);
        expect(e.beat).toBeGreaterThanOrEqual(0);
        expect(e.beat).toBeLessThan(4);
        expect(e.length).toBeGreaterThan(0);
        expect(e.velocity).toBeGreaterThan(0);
        expect(e.velocity).toBeLessThanOrEqual(1);
      }
    }
  });

  it('los eventos salen ordenados por momento', () => {
    for (const bar of BARS) {
      const beats = swingBarEvents(bar, 0.9, 3).map((e) => e.beat);
      expect(beats).toEqual([...beats].sort((x, y) => x - y));
    }
  });

  it('cada frase empieza en un acorde "casa" (do 6/9 o la menor 11) y las progresiones tienen cuatro compases', () => {
    const homes = [SWING_CHORDS.C69, SWING_CHORDS.Am11];
    for (const progression of SWING_PROGRESSIONS) {
      expect(progression).toHaveLength(4);
      expect(homes).toContain(progression[0]);
    }
    for (const seed of SEEDS) for (const phrase of [0, 1, 2, 7]) expect(homes).toContain(swingChordAt(phrase * 4, seed));
  });

  it('cuanto más circuito encendido, más notas suenan', () => {
    const low = total(0.1);
    const mid = total(0.5);
    const high = total(1);
    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
  });

  it('con intensidad 0 solo hay escobillas, bajo y algún acorde: sin melodía, caja ni bombo', () => {
    for (const bar of BARS) {
      const events = swingBarEvents(bar, 0, 11);
      expect(count(events, 'lead')).toBe(0);
      expect(count(events, 'snare')).toBe(0);
      expect(count(events, 'kick')).toBe(0);
      expect(count(events, 'ride')).toBe(4);
      expect(count(events, 'bass')).toBe(2);
      expect(count(events, 'keys')).toBeGreaterThan(0);
    }
  });

  it('la melodía entra a partir de 0,45 y con poca intensidad solo en los compases 1 y 3 de la frase', () => {
    for (const bar of BARS) expect(count(swingBarEvents(bar, 0.4, 7), 'lead')).toBe(0);
    for (const bar of BARS) {
      const position = bar % 4;
      const leads = count(swingBarEvents(bar, 0.5, 7), 'lead');
      expect(leads > 0, `compás ${bar}`).toBe(position === 0 || position === 2);
    }
    for (const bar of BARS) expect(count(swingBarEvents(bar, 0.9, 7), 'lead')).toBeGreaterThan(0);
  });

  it('la melodía se repite: el tercer compás de la frase repite el primero', () => {
    const shape = (bar: number, seed: number) =>
      swingBarEvents(bar, 1, seed).filter((e) => e.voice === 'lead').map((e) => [e.beat, e.degree, e.octave, e.length]);
    for (const seed of SEEDS) {
      for (const phrase of [0, 1, 3]) {
        expect(shape(phrase * 4 + 2, seed)).toEqual(shape(phrase * 4, seed));
        expect(shape(phrase * 4, seed).length).toBeGreaterThan(0);
      }
    }
  });

  it('la respuesta del segundo compás no es una copia del primero', () => {
    const shape = (bar: number) => swingBarEvents(bar, 1, 5).filter((e) => e.voice === 'lead').map((e) => [e.degree, e.octave]);
    expect(shape(1)).not.toEqual(shape(0));
  });

  it('la frase resuelve en el cuarto compás con notas largas', () => {
    for (const seed of SEEDS) {
      const ending = swingBarEvents(3, 1, seed).filter((e) => e.voice === 'lead');
      expect(ending).toHaveLength(2);
      expect(ending[0].length).toBeGreaterThanOrEqual(2);
    }
  });

  it('la melodía se mantiene en un registro cómodo (de mi a sol de la octava aguda)', () => {
    for (const bar of BARS) {
      for (const e of swingBarEvents(bar, 1, 13).filter((x) => x.voice === 'lead')) {
        const index = e.degree + 5 * e.octave;
        expect(index).toBeGreaterThanOrEqual(2);
        expect(index).toBeLessThanOrEqual(8);
      }
    }
  });

  it('nunca hay más de 40 notas en un compás', () => {
    for (const seed of SEEDS) for (const bar of BARS) expect(swingBarEvents(bar, 1, seed).length).toBeLessThanOrEqual(40);
  });

  it('la intensidad se limita al rango 0 a 1', () => {
    expect(swingBarEvents(2, 5, 4)).toEqual(swingBarEvents(2, 1, 4));
    expect(swingBarEvents(2, -3, 4)).toEqual(swingBarEvents(2, 0, 4));
  });
});
