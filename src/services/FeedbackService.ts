import {
  HINT_NOTES,
  WIN_CHORD,
  connectNote,
  noteForCell,
  winStepNote,
} from '../core/sound';
import type { HapticLevel } from '../core/haptics';
import type { AudioService } from './AudioService';
import type { HapticService } from './HapticService';
import { MusicPlayer, NoopMusicPlayer } from './MusicService';

export interface FeedbackSettings {
  /** Efectos de sonido. */
  sound: boolean;
  /** Música de fondo. */
  music: boolean;
  haptics: boolean;
  hapticsLevel: HapticLevel;
}

/**
 * Coordina el sonido y la vibración del juego. Cada evento del juego (girar, conectar, pista,
 * victoria…) tiene aquí su respuesta sensorial, y los ajustes del jugador se respetan en un solo sitio.
 */
export class FeedbackService {
  private settings: FeedbackSettings = { sound: true, music: true, haptics: true, hapticsLevel: 'normal' };
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

  /** Muestra de la vibración actual (al cambiar la intensidad en Ajustes). */
  previewHaptics(): void {
    this.vibrate(() => this.haptics.mediumTap());
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
