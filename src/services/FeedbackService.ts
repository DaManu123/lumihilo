import {
  FLOW_CONNECT_NOTES,
  HINT_NOTES,
  WIN_CHORD,
  connectNote,
  flowStepNote,
  noteForCell,
  winStepNote,
} from '../core/sound';
import type { HapticDiagnostics, HapticLevel, HapticMode } from '../core/haptics';
import { MUSIC_VOLUME_DEFAULT, MusicStyle } from '../core/music';
import type { PuzzleType } from '../core/puzzles';
import type { AudioService } from './AudioService';
import type { HapticService } from './HapticService';
import { MusicPlayer, NoopMusicPlayer } from './MusicService';

export interface FeedbackSettings {
  /** Efectos de sonido. */
  sound: boolean;
  /** Música de fondo. */
  music: boolean;
  musicStyle: MusicStyle;
  /** Volumen de la música en porcentaje: 100 es el estándar. */
  musicVolume: number;
  haptics: boolean;
  hapticsLevel: HapticLevel;
  hapticsMode: HapticMode;
}

/**
 * Coordina el sonido y la vibración del juego. Cada evento del juego (girar, conectar, pista,
 * victoria…) tiene aquí su respuesta sensorial, y los ajustes del jugador se respetan en un solo sitio.
 */
export class FeedbackService {
  private settings: FeedbackSettings = {
    sound: true,
    music: true,
    musicStyle: 'swing',
    musicVolume: MUSIC_VOLUME_DEFAULT,
    haptics: true,
    hapticsLevel: 'normal',
    hapticsMode: 'all',
  };
  /** El audio solo puede empezar tras el primer gesto del usuario. */
  private unlocked = false;

  constructor(
    private readonly audio: AudioService,
    private readonly haptics: HapticService,
    private readonly music: MusicPlayer = new NoopMusicPlayer()
  ) {}

  configure(settings: Partial<FeedbackSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.haptics.setLevel(this.settings.hapticsLevel);
    this.haptics.setMode(this.settings.hapticsMode);
    // Estilo y volumen se pasan siempre: la música los aplica al empezar o al instante si ya suena
    this.music.setStyle(this.settings.musicStyle);
    this.music.setVolume(this.settings.musicVolume);
    // La música se enciende o se apaga al instante, pero solo si ya hubo un gesto del usuario
    if (this.unlocked) {
      if (this.settings.music) this.music.start();
      else this.music.stop();
    }
  }

  private sound(play: () => void): void {
    if (this.settings.sound) play();
  }

  private vibrate(play: () => Promise<void>): void {
    if (!this.settings.haptics) return;
    try {
      // La vibración nunca debe poder romper el juego, ni siquiera si el servicio falla
      play().catch(() => undefined);
    } catch {
      // Error síncrono del servicio: se ignora
    }
  }

  /** Primer gesto del usuario: habilita el audio y, si está activada, arranca la música. */
  unlock(): void {
    this.audio.unlock();
    this.unlocked = true;
    if (this.settings.music) this.music.start();
  }

  /** Cuánto circuito está encendido (0 a 1): la música gana capas a medida que el jugador avanza. */
  setIntensity(value: number): void {
    if (this.settings.music) this.music.setIntensity(value);
  }

  /** Prueba de la vibración con la vía actual. Funciona aunque la vibración esté desactivada: es una prueba explícita. */
  testHaptics(): Promise<string> {
    return this.haptics.test();
  }

  /** Ajustes del teléfono que afectan a la vibración (null si no es el APK). */
  diagnoseHaptics(): Promise<HapticDiagnostics | null> {
    return this.haptics.diagnose();
  }

  /** Motivo del último cierre inesperado de la app (APK); cadena vacía si no hubo. */
  async lastCrash(): Promise<string> {
    try {
      return (await this.haptics.lastCrash?.()) ?? '';
    } catch {
      return '';
    }
  }

  /** Muestra de la vibración actual (al cambiar la intensidad en Ajustes). */
  previewHaptics(): void {
    this.vibrate(() => this.haptics.mediumTap());
  }

  /** Puzzle que se juega: en Luces la música cambia a su caja de música. */
  setPuzzle(puzzle: PuzzleType): void {
    this.music.setPuzzle(puzzle);
  }

  /**
   * Toque en Luces: «pop» de la lámpara tocada y, escalonadas, las que cambian a su alrededor. Las que se encienden suenan
   * a campanita (más aguda cuanto más a la derecha); las que se apagan, a un clic seco.
   */
  lamps(changes: ReadonlyArray<{ row: number; col: number; on: boolean }>, tapped: { row: number; col: number }): void {
    this.sound(() => {
      this.audio.note(noteForCell(tapped.row, tapped.col), { volume: 0.42, kind: 'tick' });
      changes.forEach((change, i) => {
        const index = noteForCell(change.row, change.col);
        const delaySec = 0.04 + i * 0.05;
        if (change.on) this.audio.note(connectNote(index), { volume: 0.5, bright: true, delaySec });
        else this.audio.note(index, { volume: 0.3, kind: 'tick', delaySec });
      });
    });
    const turnedOn = changes.filter((c) => c.on).length;
    this.vibrate(() => (turnedOn > changes.length - turnedOn ? this.haptics.mediumTap() : this.haptics.lightTap()));
  }

  /** Hilos: el hilo avanza una casilla; la nota asciende conforme se alarga. */
  flowStep(length: number): void {
    this.sound(() => this.audio.note(flowStepNote(length), { volume: 0.34 }));
  }

  /** Hilos: se empieza un trazo (vibración ligera, sin sonido). */
  flowStart(): void {
    this.vibrate(() => this.haptics.lightTap());
  }

  /** Hilos: el hilo corta el de otra pareja (clic seco). */
  flowCut(): void {
    this.sound(() => this.audio.note(2, { volume: 0.34, kind: 'tick' }));
    this.vibrate(() => this.haptics.lightTap());
  }

  /** Hilos: se une una pareja (campanita de dos notas y toque medio). */
  flowConnected(): void {
    this.sound(() => FLOW_CONNECT_NOTES.forEach((n, i) => this.audio.note(n, { volume: 0.5, bright: true, delaySec: i * 0.08 })));
    this.vibrate(() => this.haptics.mediumTap());
  }

  /** Tocar una piedra de Luces: golpe sordo y vibración ligera. */
  stone(): void {
    this.sound(() => this.audio.note(2, { volume: 0.55, kind: 'thud' }));
    this.vibrate(() => this.haptics.lightTap());
  }

  /** Giro de una casilla: su nota y un toque ligero. */
  rotate(row: number, col: number): void {
    this.sound(() => this.audio.note(noteForCell(row, col), { volume: 0.5 }));
    this.vibrate(() => this.haptics.lightTap());
  }

  /** El giro encendió más casillas: campanita aguda y toque medio. */
  connected(row: number, col: number): void {
    this.sound(() => this.audio.note(connectNote(noteForCell(row, col)), { volume: 0.55, bright: true, delaySec: 0.07 }));
    this.vibrate(() => this.haptics.mediumTap());
  }

  /** Deshacer: nota suave, sin vibración. */
  undo(row: number, col: number): void {
    this.sound(() => this.audio.note(noteForCell(row, col), { volume: 0.28 }));
  }

  /** Pista: campanita de dos notas. */
  hint(): void {
    this.sound(() => HINT_NOTES.forEach((n, i) => this.audio.note(n, { volume: 0.5, bright: true, delaySec: i * 0.1 })));
    this.vibrate(() => this.haptics.mediumTap());
  }

  /** Acción rechazada (p. ej. sin Chispas): nota grave y breve. */
  denied(): void {
    this.sound(() => this.audio.note(0, { volume: 0.4 }));
    this.vibrate(() => this.haptics.lightTap());
  }

  /** Cambio de un ajuste (sentido de giro, tema): clic suave. */
  toggle(): void {
    this.sound(() => this.audio.note(4, { volume: 0.3 }));
    this.vibrate(() => this.haptics.lightTap());
  }

  /** Casilla del pulso de victoria: asciende con la onda de luz. */
  winStep(step: number): void {
    this.sound(() => this.audio.note(winStepNote(step), { volume: 0.32 }));
  }

  /** Circuito completo: acorde, vibración de éxito y la música se serena y resuelve. */
  win(): void {
    this.sound(() => this.audio.chord(WIN_CHORD, { volume: 0.6 }));
    this.vibrate(() => this.haptics.success());
    if (this.settings.music) this.music.resolve();
  }
}
