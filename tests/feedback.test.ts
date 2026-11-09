import { describe, it, expect, beforeEach } from 'vitest';
import { FeedbackService } from '../src/services/FeedbackService';
import type { AudioService, NoteOptions } from '../src/services/AudioService';
import type { HapticService } from '../src/services/HapticService';
import type { MusicPlayer } from '../src/services/MusicService';
import type { MusicStyle } from '../src/core/music';
import type { HapticDiagnostics, HapticLevel, HapticMode } from '../src/core/haptics';
import { NOTE_COUNT, noteForCell, WIN_CHORD, HINT_NOTES } from '../src/core/sound';

class FakeAudio implements AudioService {
  notes: Array<{ index: number; options?: NoteOptions }> = [];
  chords: Array<readonly number[]> = [];
  unlocked = 0;
  note(index: number, options?: NoteOptions) { this.notes.push({ index, options }); }
  chord(indices: readonly number[]) { this.chords.push(indices); }
  unlock() { this.unlocked++; }
}

class FakeMusic implements MusicPlayer {
  log: string[] = [];
  intensities: number[] = [];
  start() { this.log.push('start'); }
  stop() { this.log.push('stop'); }
  setIntensity(v: number) { this.intensities.push(v); }
  resolve() { this.log.push('resolve'); }
  style: MusicStyle | null = null;
  volume: number | null = null;
  setStyle(style: MusicStyle) { this.style = style; }
  puzzle: 'circuits' | 'lights' | null = null;
  setPuzzle(puzzle: 'circuits' | 'lights') { this.puzzle = puzzle; }
  setVolume(percent: number) { this.volume = percent; }
}

class FakeHaptics implements HapticService {
  calls: string[] = [];
  level: HapticLevel | null = null;
  setLevel(level: HapticLevel) { this.level = level; }
  mode: HapticMode | null = null;
  setMode(mode: HapticMode) { this.mode = mode; }
  async diagnose(): Promise<HapticDiagnostics | null> { return null; }
  async test() { this.calls.push('test'); return 'prueba'; }
  async lightTap() { this.calls.push('light'); }
  async mediumTap() { this.calls.push('medium'); }
  async success() { this.calls.push('success'); }
}

describe('Sonido y vibración del juego (src/services/FeedbackService.ts)', () => {
  let audio: FakeAudio;
  let haptics: FakeHaptics;
  let music: FakeMusic;
  let feedback: FeedbackService;

  beforeEach(() => {
    audio = new FakeAudio();
    haptics = new FakeHaptics();
    music = new FakeMusic();
    feedback = new FeedbackService(audio, haptics, music);
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

  it('en Luces cada lámpara suena a su manera: campanita si se enciende, clic seco si se apaga', () => {
    feedback.lamps([{ row: 1, col: 1, on: true }, { row: 0, col: 1, on: false }, { row: 1, col: 2, on: true }], { row: 1, col: 1 });
    const [pop, onCenter, off, onRight] = audio.notes;
    expect(pop.options?.kind).toBe('tick');
    expect(onCenter.options?.bright).toBe(true);
    expect(onCenter.index).toBeGreaterThan(noteForCell(1, 1));
    expect(off.options?.kind).toBe('tick');
    expect(onRight.options?.bright).toBe(true);
    // Las notas se escalonan para que suenen como un arpegio y no como un bloque
    expect(onCenter.options!.delaySec!).toBeLessThan(off.options!.delaySec!);
    expect(off.options!.delaySec!).toBeLessThan(onRight.options!.delaySec!);
    expect(haptics.calls).toEqual(['medium']); // dos encendidas y una apagada: más encendidas que apagadas
  });

  it('en Luces, si se apagan más de las que se encienden, la vibración es ligera', () => {
    feedback.lamps([{ row: 0, col: 0, on: false }, { row: 0, col: 1, on: false }, { row: 1, col: 0, on: true }], { row: 0, col: 0 });
    expect(haptics.calls).toEqual(['light']);
  });

  it('tocar una piedra suena a golpe sordo y vibra ligero', () => {
    feedback.stone();
    expect(audio.notes).toHaveLength(1);
    expect(audio.notes[0].options?.kind).toBe('thud');
    expect(haptics.calls).toEqual(['light']);
  });

  it('el puzzle activo se pasa a la música', () => {
    feedback.setPuzzle('lights');
    expect(music.puzzle).toBe('lights');
    feedback.setPuzzle('circuits');
    expect(music.puzzle).toBe('circuits');
  });

  it('con el sonido apagado, Luces no suena pero sí vibra', () => {
    feedback.configure({ sound: false });
    feedback.lamps([{ row: 0, col: 0, on: true }], { row: 0, col: 0 });
    feedback.stone();
    expect(audio.notes).toHaveLength(0);
    expect(haptics.calls).toEqual(['medium', 'light']);
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

  describe('música', () => {
    it('no arranca hasta el primer gesto del usuario', () => {
      feedback.configure({ music: true });
      expect(music.log).toEqual([]);
      feedback.unlock();
      expect(music.log).toEqual(['start']);
    });

    it('con la música desactivada no arranca aunque haya gesto', () => {
      feedback.configure({ music: false });
      feedback.unlock();
      expect(music.log).toEqual([]);
    });

    it('activar o desactivar la música después del primer gesto la enciende o la apaga al instante', () => {
      feedback.unlock();
      feedback.configure({ music: false });
      feedback.configure({ music: true });
      expect(music.log).toEqual(['start', 'stop', 'start']);
    });

    it('la música es independiente de los efectos de sonido', () => {
      feedback.configure({ sound: false });
      feedback.unlock();
      expect(music.log).toEqual(['start']);
      feedback.configure({ sound: true, music: false });
      feedback.rotate(0, 0);
      expect(audio.notes).toHaveLength(1);
      expect(music.log[music.log.length - 1]).toBe('stop');
    });

    it('la intensidad llega a la música solo si está activada', () => {
      feedback.setIntensity(0.4);
      feedback.configure({ music: false });
      feedback.setIntensity(0.9);
      expect(music.intensities).toEqual([0.4]);
    });

    it('pasa el estilo y el volumen elegidos a la música', () => {
      feedback.configure({ musicStyle: 'ambient', musicVolume: 140 });
      expect(music.style).toBe('ambient');
      expect(music.volume).toBe(140);
      feedback.configure({ musicVolume: 35 });
      expect(music.volume).toBe(35);
      expect(music.style).toBe('ambient'); // cambiar el volumen no toca el estilo
    });

    it('el estilo y el volumen llegan a la música aunque todavía no haya habido un gesto del usuario', () => {
      feedback.configure({ musicStyle: 'swing', musicVolume: 80 });
      expect(music.style).toBe('swing');
      expect(music.volume).toBe(80);
      expect(music.log).toEqual([]); // sin gesto no arranca
    });

    it('cambiar el volumen no reinicia la música que ya suena', () => {
      feedback.unlock();
      feedback.configure({ musicVolume: 150 });
      feedback.configure({ musicVolume: 60 });
      expect(music.log.filter((l) => l === 'stop')).toHaveLength(0);
    });

    it('al ganar la música se serena y resuelve', () => {
      feedback.win();
      expect(music.log).toEqual(['resolve']);
    });

    it('al ganar con la música desactivada no la toca', () => {
      feedback.configure({ music: false });
      feedback.win();
      expect(music.log).not.toContain('resolve');
    });
  });

  describe('intensidad de la vibración', () => {
    it('pasa la intensidad elegida al servicio de vibración', () => {
      feedback.configure({ hapticsLevel: 'strong' });
      expect(haptics.level).toBe('strong');
      feedback.configure({ hapticsLevel: 'soft' });
      expect(haptics.level).toBe('soft');
    });

    it('pasa la vía de vibración elegida al servicio', () => {
      feedback.configure({ hapticsMode: 'system' });
      expect(haptics.mode).toBe('system');
      feedback.configure({ hapticsMode: 'touch' });
      expect(haptics.mode).toBe('touch');
    });

    it('la prueba de vibración funciona aunque la vibración esté desactivada (es explícita)', async () => {
      feedback.configure({ haptics: false });
      expect(await feedback.testHaptics()).toBe('prueba');
      expect(haptics.calls).toEqual(['test']);
    });

    it('el diagnóstico se pide al servicio de vibración', async () => {
      expect(await feedback.diagnoseHaptics()).toBeNull();
    });

    it('la muestra vibra con la intensidad actual y respeta el ajuste de vibración', () => {
      feedback.previewHaptics();
      expect(haptics.calls).toEqual(['medium']);
      feedback.configure({ haptics: false });
      feedback.previewHaptics();
      expect(haptics.calls).toEqual(['medium']);
    });
  });

  it('un error de vibración no rompe el juego', async () => {
    const failing: HapticService = {
      lightTap: () => Promise.reject(new Error('sin motor háptico')),
      mediumTap: () => Promise.reject(new Error('sin motor háptico')),
      success: () => Promise.reject(new Error('sin motor háptico')),
      setLevel: () => undefined,
      setMode: () => undefined,
      diagnose: async () => null,
      test: async () => '',
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
      setLevel: () => undefined,
      setMode: () => undefined,
      diagnose: async () => null,
      test: async () => '',
    };
    expect(() => new FeedbackService(audio, throwing).rotate(0, 0)).not.toThrow();
  });
});
