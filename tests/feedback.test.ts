import { describe, it, expect, beforeEach } from 'vitest';
import { FeedbackService } from '../src/services/FeedbackService';
import type { AudioService, NoteOptions } from '../src/services/AudioService';
import type { HapticService } from '../src/services/HapticService';
import { NOTE_COUNT, noteForCell, WIN_CHORD, HINT_NOTES } from '../src/core/sound';

class FakeAudio implements AudioService {
  notes: Array<{ index: number; options?: NoteOptions }> = [];
  chords: Array<readonly number[]> = [];
  unlocked = 0;
  note(index: number, options?: NoteOptions) { this.notes.push({ index, options }); }
  chord(indices: readonly number[]) { this.chords.push(indices); }
  unlock() { this.unlocked++; }
}

class FakeHaptics implements HapticService {
  calls: string[] = [];
  async lightTap() { this.calls.push('light'); }
  async mediumTap() { this.calls.push('medium'); }
  async success() { this.calls.push('success'); }
}

describe('Sonido y vibración del juego (src/services/FeedbackService.ts)', () => {
  let audio: FakeAudio;
  let haptics: FakeHaptics;
  let feedback: FeedbackService;

  beforeEach(() => {
    audio = new FakeAudio();
    haptics = new FakeHaptics();
    feedback = new FeedbackService(audio, haptics);
  });

  it('girar una casilla toca su nota y da un toque ligero', () => {
    feedback.rotate(2, 3);
    expect(audio.notes).toHaveLength(1);
    expect(audio.notes[0].index).toBe(noteForCell(2, 3));
    expect(haptics.calls).toEqual(['light']);
  });

  it('conectar toca una campanita más aguda que la nota del giro y vibra más fuerte', () => {
    feedback.rotate(0, 1);
    feedback.connected(0, 1);
    const [turn, chime] = audio.notes;
    expect(chime.index).toBeGreaterThan(turn.index);
    expect(chime.options?.bright).toBe(true);
    expect(haptics.calls).toEqual(['light', 'medium']);
  });

  it('deshacer suena más suave que girar y no vibra', () => {
    feedback.undo(1, 1);
    expect(audio.notes[0].options?.volume).toBeLessThan(0.5);
    expect(haptics.calls).toEqual([]);
  });

  it('la pista toca las dos notas de la campanita', () => {
    feedback.hint();
    expect(audio.notes.map((n) => n.index)).toEqual([...HINT_NOTES]);
    expect(haptics.calls).toEqual(['medium']);
  });

  it('la victoria toca el acorde y vibra con éxito', () => {
    feedback.win();
    expect(audio.chords).toEqual([WIN_CHORD]);
    expect(haptics.calls).toEqual(['success']);
  });

  it('los pasos del pulso de victoria ascienden y nunca salen de la escala', () => {
    for (let step = 0; step < 20; step++) feedback.winStep(step);
    const indices = audio.notes.map((n) => n.index);
    for (let i = 1; i < indices.length; i++) expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1]);
    expect(Math.max(...indices)).toBeLessThan(NOTE_COUNT);
  });

  it('con el sonido desactivado no suena nada pero sí vibra', () => {
    feedback.configure({ sound: false });
    feedback.rotate(0, 0);
    feedback.connected(0, 0);
    feedback.hint();
    feedback.win();
    expect(audio.notes).toHaveLength(0);
    expect(audio.chords).toHaveLength(0);
    expect(haptics.calls.length).toBeGreaterThan(0);
  });

  it('con la vibración desactivada no vibra pero sí suena', () => {
    feedback.configure({ haptics: false });
    feedback.rotate(0, 0);
    feedback.win();
    expect(haptics.calls).toHaveLength(0);
    expect(audio.notes.length + audio.chords.length).toBeGreaterThan(0);
  });

  it('con todo desactivado el juego es completamente silencioso', () => {
    feedback.configure({ sound: false, haptics: false });
    feedback.rotate(1, 1);
    feedback.connected(1, 1);
    feedback.undo(1, 1);
    feedback.hint();
    feedback.denied();
    feedback.toggle();
    feedback.winStep(3);
    feedback.win();
    expect(audio.notes).toHaveLength(0);
    expect(audio.chords).toHaveLength(0);
    expect(haptics.calls).toHaveLength(0);
  });

  it('configurar un ajuste no cambia el otro', () => {
    feedback.configure({ sound: false });
    feedback.configure({ haptics: false });
    feedback.rotate(0, 0);
    expect(audio.notes).toHaveLength(0);
    expect(haptics.calls).toHaveLength(0);
    feedback.configure({ sound: true });
    feedback.rotate(0, 0);
    expect(audio.notes).toHaveLength(1);
    expect(haptics.calls).toHaveLength(0);
  });

  it('desbloquear el audio funciona aunque el sonido esté desactivado (para activarlo después sin recargar)', () => {
    feedback.configure({ sound: false });
    feedback.unlock();
    expect(audio.unlocked).toBe(1);
  });

  it('un error de vibración no rompe el juego', async () => {
    const failing: HapticService = {
      lightTap: () => Promise.reject(new Error('sin motor háptico')),
      mediumTap: () => Promise.reject(new Error('sin motor háptico')),
      success: () => Promise.reject(new Error('sin motor háptico')),
    };
    // Aunque el servicio rechace la promesa, FeedbackService no propaga ni deja errores sin capturar
    const f = new FeedbackService(audio, failing);
    expect(() => f.rotate(0, 0)).not.toThrow();
    expect(() => f.connected(0, 0)).not.toThrow();
    expect(() => f.win()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const throwing: HapticService = {
      lightTap: () => { throw new Error('error síncrono'); },
      mediumTap: () => { throw new Error('error síncrono'); },
      success: () => { throw new Error('error síncrono'); },
    };
    expect(() => new FeedbackService(audio, throwing).rotate(0, 0)).not.toThrow();
  });
});
