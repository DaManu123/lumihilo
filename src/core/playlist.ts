import { mulberry32 } from './rng';
import { MUSIC_TRACKS, MusicTrack } from './music';

/**
 * Lista de reproducción al azar (lógica pura). El jugador ya no elige la música: suena un tema al azar y cambia solo.
 *
 * - **Sin repetir:** los temas salen de una «bolsa» barajada; hasta que no han sonado todos no se repite ninguno, y al
 *   rellenar la bolsa el primero nunca es el que acaba de sonar.
 * - **Cuándo cambia:** cada tema dura entre `TRACK_MIN_SECONDS` y `TRACK_MAX_SECONDS` (al azar) y el cambio espera al final
 *   de una frase (lo decide el reproductor). Si al empezar un nivel el tema ya sonó `LEVEL_CHANGE_SECONDS`, cambia ahí,
 *   para que el nivel nuevo empiece con música nueva sin cortar un tema recién empezado.
 */

export const TRACK_MIN_SECONDS = 120;
export const TRACK_MAX_SECONDS = 180;
export const LEVEL_CHANGE_SECONDS = 75;

export class Playlist {
  private readonly rand: () => number;
  private bag: MusicTrack[] = [];
  private _current: MusicTrack;
  private _elapsed = 0;
  private _limit: number;

  constructor(seed: number, private readonly tracks: readonly MusicTrack[] = MUSIC_TRACKS) {
    if (tracks.length === 0) throw new Error('Playlist sin temas');
    this.rand = mulberry32(seed >>> 0);
    this._current = this.draw(null);
    this._limit = this.pickLimit();
  }

  /** Tema que suena. */
  get current(): MusicTrack {
    return this._current;
  }

  /** Segundos que lleva sonando el tema. */
  get elapsed(): number {
    return this._elapsed;
  }

  /** Cuánto durará este tema (entre `TRACK_MIN_SECONDS` y `TRACK_MAX_SECONDS`). */
  get limit(): number {
    return this._limit;
  }

  /** Suma tiempo de reproducción. Devuelve true si el tema ya cumplió su duración (toca cambiar en la próxima frase). */
  advance(seconds: number): boolean {
    if (Number.isFinite(seconds) && seconds > 0) this._elapsed += seconds;
    return this.due();
  }

  /** ¿El tema ya cumplió su duración? */
  due(): boolean {
    return this._elapsed >= this._limit;
  }

  /** Al empezar un nivel: ¿conviene cambiar ya de tema? */
  changeOnLevel(): boolean {
    return this._elapsed >= LEVEL_CHANGE_SECONDS;
  }

  /** Pasa al siguiente tema al azar (nunca el mismo que sonaba). */
  next(): MusicTrack {
    this._current = this.draw(this._current);
    this._elapsed = 0;
    this._limit = this.pickLimit();
    return this._current;
  }

  /** Pone un tema concreto (solo para las pruebas). */
  force(track: MusicTrack): void {
    this.bag = this.bag.filter((t) => t !== track);
    this._current = track;
    this._elapsed = 0;
    this._limit = this.pickLimit();
  }

  /** Suma tiempo sin más (solo para las pruebas). */
  age(seconds: number): void {
    this.advance(seconds);
  }

  private draw(previous: MusicTrack | null): MusicTrack {
    if (this.tracks.length === 1) return this.tracks[0];
    if (this.bag.length === 0) {
      const bag = [...this.tracks];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rand() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      // Se saca del final: el que acaba de sonar no puede ser el primero de la bolsa nueva
      if (bag[bag.length - 1] === previous) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      this.bag = bag;
    }
    return this.bag.pop()!;
  }

  private pickLimit(): number {
    return TRACK_MIN_SECONDS + this.rand() * (TRACK_MAX_SECONDS - TRACK_MIN_SECONDS);
  }
}
