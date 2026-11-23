import { describe, it, expect } from 'vitest';
import { LEVEL_CHANGE_SECONDS, Playlist, TRACK_MAX_SECONDS, TRACK_MIN_SECONDS } from '../src/core/playlist';
import { MUSIC_TRACKS, MusicTrack } from '../src/core/music';

describe('Música al azar (src/core/playlist.ts)', () => {
  it('empieza con un tema válido y la semilla decide cuál', () => {
    const first = new Set<MusicTrack>();
    for (let seed = 1; seed <= 60; seed++) {
      const list = new Playlist(seed);
      expect(MUSIC_TRACKS).toContain(list.current);
      first.add(list.current);
      expect(new Playlist(seed).current).toBe(list.current); // determinista
    }
    expect(first.size).toBeGreaterThanOrEqual(7); // casi todos pueden ser el primero
  });

  it('nunca repite el tema que acaba de sonar', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const list = new Playlist(seed);
      let previous = list.current;
      for (let i = 0; i < 100; i++) {
        const next = list.next();
        expect(next).not.toBe(previous);
        previous = next;
      }
    }
  });

  it('no repite ninguno hasta que han sonado los nueve', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const list = new Playlist(seed);
      const round = [list.current];
      for (let i = 1; i < MUSIC_TRACKS.length; i++) round.push(list.next());
      expect(new Set(round).size).toBe(MUSIC_TRACKS.length);
    }
  });

  it('a la larga todos suenan más o menos lo mismo', () => {
    const counts = new Map<MusicTrack, number>();
    const list = new Playlist(2026);
    for (let i = 0; i < 900; i++) {
      const track = list.next();
      counts.set(track, (counts.get(track) ?? 0) + 1);
    }
    for (const track of MUSIC_TRACKS) expect(counts.get(track) ?? 0).toBeGreaterThan(90); // 100 de media
  });

  it('cada tema dura de 2 a 3 minutos (al azar)', () => {
    const limits: number[] = [];
    const list = new Playlist(9);
    for (let i = 0; i < 200; i++) {
      expect(list.limit).toBeGreaterThanOrEqual(TRACK_MIN_SECONDS);
      expect(list.limit).toBeLessThanOrEqual(TRACK_MAX_SECONDS);
      limits.push(list.limit);
      list.next();
    }
    expect(TRACK_MIN_SECONDS).toBe(120);
    expect(TRACK_MAX_SECONDS).toBe(180);
    expect(Math.max(...limits) - Math.min(...limits)).toBeGreaterThan(40);
  });

  it('avisa cuando el tema cumplió su duración, y al cambiar vuelve a contar', () => {
    const list = new Playlist(3);
    expect(list.advance(TRACK_MIN_SECONDS - 1)).toBe(false);
    expect(list.advance(TRACK_MAX_SECONDS)).toBe(true);
    expect(list.due()).toBe(true);
    list.next();
    expect(list.elapsed).toBe(0);
    expect(list.due()).toBe(false);
  });

  it('ignora tiempos inválidos', () => {
    const list = new Playlist(3);
    list.advance(-50);
    list.advance(Number.NaN);
    list.advance(Infinity);
    expect(list.elapsed).toBe(0);
  });

  it('al empezar un nivel cambia solo si el tema ya sonó un rato (no corta uno recién empezado)', () => {
    const list = new Playlist(5);
    expect(list.changeOnLevel()).toBe(false);
    list.advance(LEVEL_CHANGE_SECONDS - 1);
    expect(list.changeOnLevel()).toBe(false);
    list.advance(1);
    expect(list.changeOnLevel()).toBe(true);
    expect(LEVEL_CHANGE_SECONDS).toBeLessThan(TRACK_MIN_SECONDS);
  });

  it('se puede forzar un tema (pruebas) y después sigue al azar sin repetirlo', () => {
    const list = new Playlist(11);
    list.force('chip');
    expect(list.current).toBe('chip');
    expect(list.elapsed).toBe(0);
    for (let i = 0; i < 30; i++) {
      const before = list.current;
      expect(list.next()).not.toBe(before);
    }
  });

  it('con un solo tema no falla', () => {
    const list = new Playlist(1, ['nocturne']);
    expect(list.current).toBe('nocturne');
    expect(list.next()).toBe('nocturne');
    expect(() => new Playlist(1, [])).toThrow();
  });
});
