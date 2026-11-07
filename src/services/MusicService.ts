import { BAR_SECONDS, BEAT_SECONDS, CHORDS, MusicEvent, barEvents, degreeFrequency } from '../core/music';
import { AudioEngine, MUSIC_VOLUME } from './AudioService';

/** Música de fondo del juego. */
export interface MusicPlayer {
  /** Empieza (con un fundido de entrada). Si ya suena, no hace nada. */
  start(): void;
  /** Se detiene con un fundido de salida. */
  stop(): void;
  /** Cuánto circuito está encendido, de 0 a 1: con más intensidad entran más notas. */
  setIntensity(value: number): void;
  /** Victoria: la música se serena y resuelve en un acorde cálido. */
  resolve(): void;
}

export class NoopMusicPlayer implements MusicPlayer {
  start(): void {}
  stop(): void {}
  setIntensity(): void {}
  resolve(): void {}
}

/** Con cuánta antelación (s) se programan las notas del siguiente compás. */
const LOOKAHEAD_SEC = 1.6;
const FADE_IN_SEC = 2.5;
const FADE_OUT_SEC = 0.9;

/**
 * Reproduce la música generativa de `core/music.ts` con Web Audio: un colchón suave, un bajo y una
 * arpa de cristal. Programa los compases por adelantado con un temporizador de vigilancia.
 */
export class WebMusicPlayer implements MusicPlayer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private bar = 0;
  private nextBarTime = 0;
  private target = 0;
  private intensity = 0;
  private quietBars = 0;
  /** Semilla de la sesión: cada vez que se abre el juego el tema suena algo distinto. */
  private readonly seed = Math.floor(Math.random() * 0x7fffffff);

  constructor(private readonly engine: AudioEngine) {}

  start(): void {
    if (this.running) return;
    const ctx = this.engine.context();
    const bus = this.engine.musicBus;
    if (!ctx || !bus) return;

    this.running = true;
    this.bar = 0;
    this.nextBarTime = ctx.currentTime + 0.2;

    const now = ctx.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(bus.gain.value, now);
    bus.gain.linearRampToValueAtTime(MUSIC_VOLUME, now + FADE_IN_SEC);

    this.tick();
    this.timer = setInterval(() => this.tick(), 400);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;

    const ctx = this.engine.context();
    const bus = this.engine.musicBus;
    if (!ctx || !bus) return;
    const now = ctx.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(bus.gain.value, now);
    bus.gain.linearRampToValueAtTime(0, now + FADE_OUT_SEC);
  }

  setIntensity(value: number): void {
    this.target = Math.min(1, Math.max(0, value));
  }

  resolve(): void {
    const ctx = this.engine.context();
    if (!ctx || !this.running) return;
    // Los próximos compases se calman y suena un acorde de do abierto y brillante
    this.target = 0.1;
    this.quietBars = 2;
    const t = ctx.currentTime + 0.05;
    for (const degree of CHORDS.C.tones) {
      this.pad(degree, 0, t, 5 * BEAT_SECONDS, 0.5, 0.35);
    }
  }

  private tick(): void {
    const ctx = this.engine.context();
    if (!ctx || !this.running) return;
    // Si el contexto estuvo pausado (app en segundo plano) no se acumulan compases atrasados
    if (this.nextBarTime < ctx.currentTime) this.nextBarTime = ctx.currentTime + 0.1;
    while (this.nextBarTime < ctx.currentTime + LOOKAHEAD_SEC) {
      this.scheduleBar(this.bar, this.nextBarTime);
      this.nextBarTime += BAR_SECONDS;
      this.bar++;
    }
  }

  private scheduleBar(bar: number, start: number): void {
    // La intensidad se acerca poco a poco al objetivo: la música crece y baja con suavidad
    this.intensity += (this.target - this.intensity) * 0.6;
    const level = this.quietBars > 0 ? Math.min(this.intensity, 0.12) : this.intensity;
    if (this.quietBars > 0) this.quietBars--;

    for (const event of barEvents(bar, level, this.seed)) {
      this.play(event, start + event.beat * BEAT_SECONDS);
    }
  }

  private play(event: MusicEvent, when: number): void {
    const freq = degreeFrequency(event.degree, event.octave);
    const length = event.length * BEAT_SECONDS;
    switch (event.voice) {
      case 'pad':
        this.pad(event.degree, event.octave, when, length, event.velocity, 1);
        break;
      case 'bass':
        this.bass(freq, when, length, event.velocity);
        break;
      default:
        this.bell(freq, when, length, event.velocity, event.voice === 'bell');
    }
  }

  /** Colchón: dos osciladores ligeramente desafinados por un filtro suave, con entrada y salida lentas. */
  private pad(degree: number, octave: number, when: number, length: number, velocity: number, gain: number): void {
    const ctx = this.engine.context();
    const bus = this.engine.musicBus;
    if (!ctx || !bus) return;
    const freq = degreeFrequency(degree as 0 | 1 | 2 | 3 | 4, octave);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 820;
    const env = ctx.createGain();
    const peak = 0.06 * velocity * gain;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(peak, when + 1.3);
    env.gain.setValueAtTime(peak, when + Math.max(1.4, length - 1.4));
    env.gain.linearRampToValueAtTime(0.0001, when + length);
    filter.connect(env);
    env.connect(bus);

    for (const detune of [-5, 5]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(when);
      osc.stop(when + length + 0.1);
      osc.onended = () => osc.disconnect();
    }
  }

  /** Bajo: seno redondo con ataque suave que se apaga despacio. */
  private bass(freq: number, when: number, length: number, velocity: number): void {
    const ctx = this.engine.context();
    const bus = this.engine.musicBus;
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.17 * velocity, when + 0.07);
    env.gain.exponentialRampToValueAtTime(0.0001, when + length);
    osc.connect(env);
    env.connect(bus);
    osc.start(when);
    osc.stop(when + length + 0.1);
    osc.onended = () => env.disconnect();
  }

  /** Arpa de cristal: el mismo timbre de los efectos (seno y triángulo una octava arriba), con cola larga. */
  private bell(freq: number, when: number, length: number, velocity: number, soft: boolean): void {
    const ctx = this.engine.context();
    const bus = this.engine.musicBus;
    if (!ctx || !bus) return;
    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.value = freq;
    const shine = ctx.createOscillator();
    shine.type = 'triangle';
    shine.frequency.value = freq * 2;
    const shineGain = ctx.createGain();
    shineGain.gain.value = 0.22;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.22 * velocity * (soft ? 1.1 : 1), when + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, when + Math.min(length, 1.5));
    body.connect(env);
    shine.connect(shineGain);
    shineGain.connect(env);
    env.connect(bus);
    const end = when + Math.min(length, 1.5) + 0.1;
    body.start(when);
    shine.start(when);
    body.stop(end);
    shine.stop(end);
    body.onended = () => {
      env.disconnect();
      shineGain.disconnect();
    };
  }
}
