import { noteFrequency } from '../core/sound';

export interface NoteOptions {
  /** Volumen relativo de 0 a 1. */
  volume?: number;
  /** Timbre más brillante y de cola más larga (campanita). */
  bright?: boolean;
  /** Retraso en segundos antes de que suene. */
  delaySec?: number;
}

/**
 * Audio del juego. Todo se sintetiza en el momento (no hay archivos de sonido): pesa cero, funciona
 * sin conexión y cada nota sale de la escala pentatónica de `core/sound.ts`.
 */
export interface AudioService {
  note(index: number, options?: NoteOptions): void;
  chord(indices: readonly number[], options?: NoteOptions): void;
  /** Activa el audio tras el primer gesto del usuario (los navegadores lo exigen). */
  unlock(): void;
}

export class NoopAudioService implements AudioService {
  note(): void {}
  chord(): void {}
  unlock(): void {}
}

/** Máximo de notas sonando a la vez: evita saturar el procesador si se toca muy rápido. */
const MAX_VOICES = 14;

export class WebAudioService implements AudioService {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = 0;
  private failed = false;

  /** Crea el contexto de audio la primera vez que hace falta (siempre tras un gesto del usuario). */
  private context(): AudioContext | null {
    if (this.failed) return null;
    if (!this.ctx) {
      try {
        const Ctor =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) {
          this.failed = true;
          return null;
        }
        const ctx = new Ctor();

        // Cadena: notas → volumen general → salida, más un eco corto que da el brillo de cristal
        const master = ctx.createGain();
        master.gain.value = 0.55;
        master.connect(ctx.destination);

        const delay = ctx.createDelay(0.5);
        delay.delayTime.value = 0.17;
        const feedback = ctx.createGain();
        feedback.gain.value = 0.26;
        const wet = ctx.createGain();
        wet.gain.value = 0.2;
        master.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(wet);
        wet.connect(ctx.destination);

        this.ctx = ctx;
        this.master = master;
      } catch {
        this.failed = true;
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    return this.ctx;
  }

  unlock(): void {
    this.context();
  }

  note(index: number, options: NoteOptions = {}): void {
    const ctx = this.context();
    if (!ctx || !this.master || this.voices >= MAX_VOICES) return;

    const { volume = 0.5, bright = false, delaySec = 0 } = options;
    const freq = noteFrequency(index);
    const start = ctx.currentTime + delaySec + 0.004;
    const length = bright ? 0.95 : 0.55;

    // Voz: seno de cuerpo + triángulo una octava arriba, que le da un timbre de cristal
    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.value = freq;
    const shine = ctx.createOscillator();
    shine.type = 'triangle';
    shine.frequency.value = freq * 2;
    const shineGain = ctx.createGain();
    shineGain.gain.value = bright ? 0.32 : 0.16;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(Math.max(0.0001, volume * 0.32), start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, start + length);

    body.connect(env);
    shine.connect(shineGain);
    shineGain.connect(env);
    env.connect(this.master);

    this.voices++;
    body.onended = () => {
      this.voices = Math.max(0, this.voices - 1);
      env.disconnect();
      shineGain.disconnect();
    };
    body.start(start);
    shine.start(start);
    body.stop(start + length + 0.05);
    shine.stop(start + length + 0.05);
  }

  chord(indices: readonly number[], options: NoteOptions = {}): void {
    // Las notas del acorde se escalonan unos milisegundos: suena a arpegio rápido, no a bloque seco
    indices.forEach((index, i) =>
      this.note(index, { ...options, bright: true, delaySec: (options.delaySec ?? 0) + i * 0.045 })
    );
  }
}
