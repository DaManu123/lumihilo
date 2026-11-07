import { describe, it, expect } from 'vitest';
import {
  NOTE_COUNT,
  PENTATONIC_SEMITONES,
  ROOT_HZ,
  noteFrequency,
  noteForCell,
  winStepNote,
  connectNote,
  WIN_CHORD,
  HINT_NOTES,
} from '../src/core/sound';

describe('Sonido pentatónico (src/core/sound.ts)', () => {
  it('la nota 0 es el do central y cada 5 notas sube una octava exacta', () => {
    expect(noteFrequency(0)).toBeCloseTo(ROOT_HZ, 5);
    expect(noteFrequency(5)).toBeCloseTo(ROOT_HZ * 2, 5);
    expect(noteFrequency(2)).toBeCloseTo(ROOT_HZ * Math.pow(2, 4 / 12), 5); // mi
  });

  it('las frecuencias crecen de forma estrictamente ascendente', () => {
    for (let i = 1; i < NOTE_COUNT; i++) {
      expect(noteFrequency(i)).toBeGreaterThan(noteFrequency(i - 1));
    }
  });

  it('todas las notas pertenecen a la escala pentatónica', () => {
    for (let i = 0; i < NOTE_COUNT; i++) {
      const semitones = Math.round(12 * Math.log2(noteFrequency(i) / ROOT_HZ));
      expect(PENTATONIC_SEMITONES).toContain(semitones % 12 as never);
    }
  });

  it('los índices fuera de rango se limitan en vez de dar frecuencias absurdas', () => {
    expect(noteFrequency(-5)).toBeCloseTo(noteFrequency(0), 5);
    expect(noteFrequency(999)).toBeCloseTo(noteFrequency(NOTE_COUNT - 1), 5);
    expect(noteFrequency(2.9)).toBeCloseTo(noteFrequency(2), 5);
  });

  it('cada casilla de cualquier tablero (hasta 7x7) tiene una nota válida y estable', () => {
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 7; col++) {
        const n = noteForCell(row, col);
        expect(Number.isInteger(n) && n >= 0 && n < NOTE_COUNT).toBe(true);
        expect(noteForCell(row, col)).toBe(n);
      }
    }
  });

  it('recorrer una fila de izquierda a derecha asciende por la escala', () => {
    const row = [0, 1, 2, 3].map((col) => noteForCell(0, col));
    for (let i = 1; i < row.length; i++) expect(row[i]).toBeGreaterThan(row[i - 1]);
  });

  it('casillas distintas del mismo tablero no suenan todas igual', () => {
    const notes = new Set<number>();
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) notes.add(noteForCell(row, col));
    expect(notes.size).toBeGreaterThanOrEqual(6);
  });

  it('el pulso de victoria asciende y se queda en la nota más aguda', () => {
    const steps = Array.from({ length: 16 }, (_, i) => winStepNote(i));
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1]);
    expect(steps[steps.length - 1]).toBe(NOTE_COUNT - 1);
    expect(winStepNote(-3)).toBe(winStepNote(0));
  });

  it('la nota de conexión es más aguda que la de la casilla y nunca se sale de la escala', () => {
    expect(connectNote(0)).toBeGreaterThan(0);
    for (let i = 0; i < NOTE_COUNT; i++) {
      expect(connectNote(i)).toBeLessThan(NOTE_COUNT);
      expect(connectNote(i)).toBeGreaterThanOrEqual(i);
    }
  });

  it('el acorde de victoria y la campanita de la pista usan notas válidas', () => {
    for (const n of [...WIN_CHORD, ...HINT_NOTES]) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(NOTE_COUNT);
    }
  });
});
