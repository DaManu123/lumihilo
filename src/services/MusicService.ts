import {
  CHORDS,
  MusicEvent,
  MusicStyle,
  MusicTrack,
  barEvents,
  barSeconds,
  beatSeconds,
  degreeFrequency,
  musicGainScale,
} from '../core/music';
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
  /** Estilo de la música; si ya suena, cambia en el siguiente compás. */
  setStyle(style: MusicStyle): void;
  /** Puzzle que se juega: en Luces suena la caja de música propia («cristal») en vez del estilo elegido. */
  setPuzzle(puzzle: 'circuits' | 'lights'): void;
  /** Volumen en porcentaje: 100 es el estándar del juego (0 = silencio, 200 = el doble). */
  setVolume(percent: number): void;
}

export class NoopMusicPlayer implements MusicPlayer {
  start(): void {}
  stop(): void {}
  setIntensity(): void {}
  resolve(): void {}
  setStyle(): void {}
  setPuzzle(): void {}
  setVolume(): void {}
}

/** Con cuánta antelación (s) se programan las notas del siguiente compás. */
const LOOKAHEAD_SEC = 1.6;
const FADE_IN_SEC = 2.5;
const FADE_OUT_SEC = 0.9;

type Degree = 0 | 1 | 2 | 3 | 4;

/**
 * Reproduce la música generativa de `core/music.ts` con Web Audio. Tiene dos estilos: el ambiental (colchón,
 * bajo y arpa de cristal) y el swing (teclado eléctrico, bajo, vibráfono y escobillas). Programa los compases
 * por adelantado con un temporizador de vigilancia.
 */
export class WebMusicPlayer implements MusicPlayer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private bar = 0;
  private nextBarTime = 0;
  private target = 0;
  private intensity = 0;
  private quietBars = 0;
  private style: MusicStyle = 'swing';
  private puzzle: 'circuits' | 'lights' = 'circuits';
  private volume = 1;
  /** Vaivén suave de afinación, como el de una cinta antigua: da calidez al teclado y a la melodía. */
  private wobble: { lfo: OscillatorNode; depth: GainNode } | null = null;
  private noise: AudioBuffer | null = null;
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
    this.ensureWobble(ctx);

    const now = ctx.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(bus.gain.value, now);
    bus.gain.linearRampToValueAtTime(MUSIC_VOLUME * this.volume, now + FADE_IN_SEC);

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

    // El vaivén se apaga cuando termina el fundido
    const wobble = this.wobble;
    this.wobble = null;
    if (wobble) {
      try {
        wobble.lfo.stop(now + FADE_OUT_SEC + 0.1);
      } catch {
        // ya detenido
      }
    }
  }

  setIntensity(value: number): void {
    this.target = Math.min(1, Math.max(0, value));
  }

  setStyle(style: MusicStyle): void {
    if (style === this.style) return;
    this.style = style;
    // Si ya suena, el nuevo estilo empieza desde el principio de su frase en el siguiente compás
    this.bar = 0;
  }

  setPuzzle(puzzle: 'circuits' | 'lights'): void {
    if (puzzle === this.puzzle) return;
    this.puzzle = puzzle;
    // La caja de música de Luces y el estilo elegido son pistas distintas: la nueva empieza su frase
    this.bar = 0;
  }

  /** Pista que suena ahora: la caja de música en Luces, y el estilo elegido en Circuitos. */
  private get track(): MusicTrack {
    return this.puzzle === 'lights' ? 'cristal' : this.style;
  }

  setVolume(percent: number): void {
    this.volume = musicGainScale(percent);
    const ctx = this.engine.context();
    const bus = this.engine.musicBus;
    if (!ctx || !bus || !this.running) return;
    // Cambio suave (sin chasquidos) mientras se arrastra la barra de volumen
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setTargetAtTime(MUSIC_VOLUME * this.volume, ctx.currentTime, 0.04);
  }

  resolve(): void {
    const ctx = this.engine.context();
    if (!ctx || !this.running) return;
    // Los próximos compases se calman y suena un acorde de do abierto y brillante
    this.target = 0.1;
    this.quietBars = 2;
    const t = ctx.currentTime + 0.05;
    if (this.track === 'cristal') {
      // Arpegio ascendente de campanitas: la caja de música cierra el nivel
      ([0, 2, 3, 1] as Degree[]).forEach((degree, i) => this.bell(degreeFrequency(degree, 1), t + i * 0.16, 3, 0.5, true));
      for (const degree of CHORDS.C.tones) this.pad(degree, 0, t, 5 * beatSeconds('cristal'), 0.4, 0.3);
    } else if (this.track === 'swing') {
      for (const degree of [2, 3, 4, 1] as Degree[]) this.keys(degreeFrequency(degree, 0), t, 3.2, 0.55);
      this.swingBass(degreeFrequency(0, -1), t, 2.4, 0.7);
      this.kick(t, 0.5);
      this.ride(t, 0.5);
    } else {
      for (const degree of CHORDS.C.tones) this.pad(degree, 0, t, 5 * beatSeconds('ambient'), 0.5, 0.35);
    }
  }

  private tick(): void {
    const ctx = this.engine.context();
    if (!ctx || !this.running) return;
    // Si el contexto estuvo pausado (app en segundo plano) no se acumulan compases atrasados
    if (this.nextBarTime < ctx.currentTime) this.nextBarTime = ctx.currentTime + 0.1;
    while (this.nextBarTime < ctx.currentTime + LOOKAHEAD_SEC) {
      this.scheduleBar(this.bar, this.nextBarTime);
      this.nextBarTime += barSeconds(this.track);
      this.bar++;
    }
  }

  private scheduleBar(bar: number, start: number): void {
    // La intensidad se acerca poco a poco al objetivo: la música crece y baja con suavidad
    this.intensity += (this.target - this.intensity) * 0.6;
    const level = this.quietBars > 0 ? Math.min(this.intensity, 0.12) : this.intensity;
    if (this.quietBars > 0) this.quietBars--;

    const beat = beatSeconds(this.track);
    for (const event of barEvents(bar, level, this.seed, this.track)) {
      this.play(event, start + event.beat * beat, beat);
    }
  }

  private play(event: MusicEvent, when: number, beat: number): void {
    const freq = degreeFrequency(event.degree, event.octave);
    const length = event.length * beat;
    switch (event.voice) {
      case 'pad':
        this.pad(event.degree, event.octave, when, length, event.velocity, 1);
        break;
      case 'bass':
        if (this.track === 'swing') this.swingBass(freq, when, length, event.velocity);
        else this.bass(freq, when, length, event.velocity);
        break;
      case 'keys':
        this.keys(freq, when, length, event.velocity);
        break;
      case 'lead':
        this.lead(freq, when, length, event.velocity);
        break;
      case 'ride':
        this.ride(when, event.velocity);
        break;
      case 'snare':
        this.snare(when, event.velocity);
        break;
      case 'kick':
        this.kick(when, event.velocity);
        break;
      default:
        this.bell(freq, when, length, event.velocity, event.voice === 'bell');
    }
  }

  // ---------------------------------------------------------------------------
  // Voces del estilo ambiental
  // ---------------------------------------------------------------------------

  /** Colchón: dos osciladores ligeramente desafinados por un filtro suave, con entrada y salida lentas. */
  private pad(degree: number, octave: number, when: number, length: number, velocity: number, gain: number): void {
    const ctx = this.engine.context();
    const bus = this.engine.musicBus;
    if (!ctx || !bus) return;
    const freq = degreeFrequency(degree as Degree, octave);

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

  /** Bajo ambiental: seno redondo con ataque suave que se apaga despacio. */
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

  // ---------------------------------------------------------------------------
  // Voces del estilo swing
  // ---------------------------------------------------------------------------

  /** Crea (una vez por sesión) el vaivén lento de afinación que se aplica al teclado y a la melodía. */
  private ensureWobble(ctx: AudioContext): void {
    if (this.wobble) return;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.47;
    const depth = ctx.createGain();
    depth.gain.value = 7; // centésimas de semitono
    lfo.connect(depth);
    lfo.start();
    this.wobble = { lfo, depth };
  }

  /** Aplica el vaivén a un oscilador y lo suelta cuando termina. */
  private wobbleOn(osc: OscillatorNode): void {
    const depth = this.wobble?.depth;
    if (!depth) return;
    depth.connect(osc.detune);
    osc.addEventListener('ended', () => {
      try {
        depth.disconnect(osc.detune);
      } catch {
        // ya desconectado
      }
    });
  }

  /** Teclado eléctrico: tono de seno con un armónico que ladra al pulsar y un filtro cálido; la cola se apaga sola. */
  private keys(freq: number, when: number, length: number, velocity: number): void {
    const ctx = this.engine.context();
    const bus = this.engine.musicBus;
    if (!ctx || !bus) return;

    const tail = Math.max(0.9, length * 1.5);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    filter.Q.value = 0.4;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, when);
    out.gain.linearRampToValueAtTime(0.2 * velocity, when + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0001, when + tail);
    filter.connect(out);
    out.connect(bus);

    const partials = [
      { mult: 1, gain: 0.55, decay: tail },
      { mult: 2, gain: 0.16, decay: tail * 0.45 },
      { mult: 5.04, gain: 0.05, decay: 0.13 },
    ];
    for (const p of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * p.mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(p.gain, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + p.decay);
      osc.connect(g);
      g.connect(filter);
      this.wobbleOn(osc);
      osc.start(when);
      osc.stop(when + p.decay + 0.05);
      osc.onended = () => g.disconnect();
    }
  }

  /** Bajo de jazz: seno redondo con un toque de triángulo para que se oiga en el altavoz del móvil. */
  private swingBass(freq: number, when: number, length: number, velocity: number): void {
    const ctx = this.engine.context();
    const bus = this.engine.musicBus;
    if (!ctx || !bus) return;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 650;
    const env = ctx.createGain();
    const end = when + Math.max(0.3, length * 0.95);
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.3 * velocity, when + 0.014);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    filter.connect(env);
    env.connect(bus);

    for (const [mult, type, gain] of [[1, 'sine', 1], [2, 'triangle', 0.32]] as const) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq * mult;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(g);
      g.connect(filter);
      osc.start(when);
      osc.stop(end + 0.05);
      osc.onended = () => g.disconnect();
    }
  }

  /** Melodía: vibráfono (seno con un armónico agudo que se apaga rápido) y el vaivén de afinación. */
  private lead(freq: number, when: number, length: number, velocity: number): void {
    const ctx = this.engine.context();
    const bus = this.engine.musicBus;
    if (!ctx || !bus) return;

    const tail = Math.max(0.5, Math.min(2.2, length * 1.5));
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, when);
    out.gain.linearRampToValueAtTime(0.24 * velocity, when + 0.008);
    out.gain.exponentialRampToValueAtTime(0.0001, when + tail);
    out.connect(bus);

    for (const p of [{ mult: 1, gain: 1, decay: tail }, { mult: 4, gain: 0.14, decay: 0.28 }]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * p.mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(p.gain, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + p.decay);
      osc.connect(g);
      g.connect(out);
      this.wobbleOn(osc);
      osc.start(when);
      osc.stop(when + p.decay + 0.05);
      osc.onended = () => g.disconnect();
    }
  }

  /** Buffer de ruido blanco, compartido por toda la percusión. */
  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noise) {
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    return this.noise;
  }

  /** Disparo de percusión: ruido filtrado con una envolvente corta. */
  private noiseHit(
    when: number,
    velocity: number,
    filterType: BiquadFilterType,
    frequency: number,
    q: number,
    peak: number,
    decay: number
  ): void {
    const ctx = this.engine.context();
    const bus = this.engine.musicBus;
    if (!ctx || !bus) return;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(peak * velocity, when + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    src.connect(filter);
    filter.connect(env);
    env.connect(bus);
    src.start(when, Math.random() * 0.5);
    src.stop(when + decay + 0.05);
    src.onended = () => env.disconnect();
  }

  /** Platillo ride con escobillas: ruido agudo y corto. */
  private ride(when: number, velocity: number): void {
    this.noiseHit(when, velocity, 'highpass', 6800, 0.5, 0.2, 0.26);
  }

  /** Caja con escobillas: ruido de banda media. */
  private snare(when: number, velocity: number): void {
    this.noiseHit(when, velocity, 'bandpass', 2300, 0.7, 0.34, 0.15);
  }

  /** Bombo suave: un seno que cae de frecuencia. */
  private kick(when: number, velocity: number): void {
    const ctx = this.engine.context();
    const bus = this.engine.musicBus;
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, when);
    osc.frequency.exponentialRampToValueAtTime(48, when + 0.1);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.5 * velocity, when + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.26);
    osc.connect(env);
    env.connect(bus);
    osc.start(when);
    osc.stop(when + 0.3);
    osc.onended = () => env.disconnect();
  }
}
