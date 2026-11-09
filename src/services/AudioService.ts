import { noteFrequency } from '../core/sound';

export interface NoteOptions {
  /** Volumen relativo de 0 a 1. */
  volume?: number;
  /** Timbre más brillante y de cola más larga (campanita). */
  bright?: boolean;
  /** Retraso en segundos antes de que suene. */
  delaySec?: number;
  /**
   * Carácter del sonido: `chime` (por defecto, cristal), `tick` (clic seco y agudo, como apagar una lámpara) o
   * `thud` (golpe sordo y grave, como tocar una piedra).
   */
  kind?: 'chime' | 'tick' | 'thud';
}

/**
 * Efectos de sonido del juego. Todo se sintetiza en el momento (no hay archivos de audio): pesa
 * cero, funciona sin conexión y cada nota sale de la escala pentatónica de `core/sound.ts`.
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

/** Volumen general de la música (queda por debajo de los efectos para no taparlos). */
export const MUSIC_VOLUME = 0.36;

/**
 * Motor de audio compartido por los efectos y la música: un único contexto de Web Audio con dos
 * canales (efectos y música), cada uno con su propio eco, que se pausa solo cuando la app pasa a segundo plano.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  /** Salida común: un limitador suave que evita la distorsión aunque se suba mucho el volumen. */
  private out: AudioNode | null = null;
  private failed = false;

  /** Crea el contexto de audio la primera vez que hace falta (siempre tras un gesto del usuario). */
  context(): AudioContext | null {
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

        // Limitador suave (tanh): no cambia el volumen normal, pero impide que los picos pasen de ~-2 dBFS
        // y se distorsionen al sumar efectos y música con el volumen de la música subido
        const limiter = ctx.createWaveShaper();
        const curve = new Float32Array(2048);
        for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i / (curve.length - 1)) * 2 - 1);
        limiter.curve = curve;
        limiter.oversample = '2x';
        limiter.connect(ctx.destination);
        this.out = limiter;

        // Canal de efectos: eco corto que da el brillo de cristal
        const sfx = ctx.createGain();
        sfx.gain.value = 0.55;
        this.withEcho(ctx, sfx, 0.17, 0.26, 0.2);

        // Canal de música: nace en silencio (entra con un fundido) y tiene un eco largo y ambiental
        const music = ctx.createGain();
        music.gain.value = 0;
        this.withEcho(ctx, music, 0.592, 0.36, 0.34);

        this.ctx = ctx;
        this.sfx = sfx;
        this.music = music;

        // Al pasar la app a segundo plano el audio se pausa; al volver, continúa
        document.addEventListener('visibilitychange', () => {
          if (!this.ctx) return;
          if (document.hidden) void this.ctx.suspend().catch(() => undefined);
          else void this.ctx.resume().catch(() => undefined);
        });
      } catch {
        this.failed = true;
        return null;
      }
    }
    if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume().catch(() => undefined);
    return this.ctx;
  }

  /** Conecta un canal a la salida, con un eco (retardo con realimentación) en paralelo. */
  private withEcho(ctx: AudioContext, bus: GainNode, delaySec: number, feedback: number, wet: number): void {
    const out = this.out ?? ctx.destination;
    bus.connect(out);
    const delay = ctx.createDelay(1);
    delay.delayTime.value = delaySec;
    const fb = ctx.createGain();
    fb.gain.value = feedback;
    const wetGain = ctx.createGain();
    wetGain.gain.value = wet;
    bus.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wetGain);
    wetGain.connect(out);
  }

  get sfxBus(): GainNode | null {
    return this.sfx;
  }

  get musicBus(): GainNode | null {
    return this.music;
  }
}

/** Máximo de efectos sonando a la vez: evita saturar el procesador si se toca muy rápido. */
const MAX_VOICES = 14;

export class WebAudioService implements AudioService {
  private voices = 0;

  constructor(private readonly engine: AudioEngine) {}

  unlock(): void {
    this.engine.context();
  }

  note(index: number, options: NoteOptions = {}): void {
    const ctx = this.engine.context();
    const bus = this.engine.sfxBus;
    if (!ctx || !bus || this.voices >= MAX_VOICES) return;

    const { volume = 0.5, bright = false, delaySec = 0, kind = 'chime' } = options;
    const freq = kind === 'thud' ? noteFrequency(index) / 2 : noteFrequency(index);
    const start = ctx.currentTime + delaySec + 0.004;
    const length = kind === 'thud' ? 0.24 : kind === 'tick' ? 0.13 : bright ? 0.95 : 0.55;

    // Voz: seno de cuerpo + triángulo una octava arriba, que le da un timbre de cristal
    const body = ctx.createOscillator();
    body.type = kind === 'thud' ? 'triangle' : 'sine';
    body.frequency.value = freq;
    const shine = ctx.createOscillator();
    shine.type = 'triangle';
    shine.frequency.value = freq * 2;
    const shineGain = ctx.createGain();
    shineGain.gain.value = kind === 'chime' ? (bright ? 0.32 : 0.16) : kind === 'tick' ? 0.5 : 0;
    // Un golpe sordo cae de tono al instante: así suena a «toc» y no a nota
    if (kind === 'thud') {
      body.frequency.setValueAtTime(freq * 1.5, start);
      body.frequency.exponentialRampToValueAtTime(freq, start + 0.06);
    }

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(Math.max(0.0001, volume * 0.32), start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, start + length);

    body.connect(env);
    shine.connect(shineGain);
    shineGain.connect(env);
    env.connect(bus);

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
