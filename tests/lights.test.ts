import { describe, it, expect } from 'vitest';
import {
  cloneGrid, createGrid, generateLights, isAllLit, lightsHint, lightsParamsForTier, litCount, solveLights, toggleLights,
} from '../src/core/lights';

describe('Luces: toques', () => {
  it('tocar cambia la casilla y sus vecinas, y tocar dos veces lo deshace', () => {
    const g = createGrid(3, true);
    toggleLights(g, 1, 1);
    expect(litCount(g)).toBe(4); // centro y sus 4 vecinas apagados
    expect(g[0][0]).toBe(true);
    toggleLights(g, 1, 1);
    expect(isAllLit(g)).toBe(true);
  });

  it('en una esquina solo afecta a tres casillas', () => {
    const g = createGrid(4, true);
    toggleLights(g, 0, 0);
    expect(litCount(g)).toBe(16 - 3);
  });

  it('el orden de los toques no importa', () => {
    const a = createGrid(4, true);
    const b = createGrid(4, true);
    for (const [r, c] of [[0, 1], [2, 2], [3, 0]]) toggleLights(a, r, c);
    for (const [r, c] of [[3, 0], [0, 1], [2, 2]]) toggleLights(b, r, c);
    expect(a).toEqual(b);
  });
});

describe('Luces: dificultad', () => {
  it('el tamaño y el desorden crecen con el nivel de habilidad', () => {
    let last = lightsParamsForTier(1);
    expect(last.size).toBe(3);
    for (let tier = 2; tier <= 8; tier++) {
      const p = lightsParamsForTier(tier);
      expect(p.size).toBeGreaterThanOrEqual(last.size);
      expect(p.scrambles).toBeGreaterThanOrEqual(last.scrambles);
      expect(p.scrambles).toBeLessThan(p.size * p.size);
      last = p;
    }
    expect(last.size).toBe(6);
    expect(lightsParamsForTier(99)).toEqual(lightsParamsForTier(8));
    expect(lightsParamsForTier(-3)).toEqual(lightsParamsForTier(1));
  });
});

describe('Luces: generador y solver', () => {
  it('todo nivel generado tiene solución, no nace resuelto y su mínimo es correcto (todos los niveles de habilidad)', () => {
    for (let tier = 1; tier <= 8; tier++) {
      const params = lightsParamsForTier(tier);
      for (let seed = 1; seed <= 150; seed++) {
        const level = generateLights(params, seed * 7919);
        expect(isAllLit(level.initial), `tier ${tier} seed ${seed} nace resuelto`).toBe(false);
        const solution = solveLights(level.initial);
        expect(solution, `tier ${tier} seed ${seed} sin solución`).not.toBeNull();
        expect(solution!.length).toBe(level.minTaps);
        expect(level.minTaps).toBeGreaterThan(0);
        expect(level.minTaps).toBeLessThanOrEqual(params.scrambles); // el desorden ya es una solución, la mínima no la supera
        const play = cloneGrid(level.initial);
        for (const [r, c] of solution!) toggleLights(play, r, c);
        expect(isAllLit(play), `tier ${tier} seed ${seed}: la solución no enciende todo`).toBe(true);
      }
    }
  });

  it('la misma semilla da el mismo nivel y semillas distintas dan niveles distintos', () => {
    const params = lightsParamsForTier(4);
    expect(generateLights(params, 42)).toEqual(generateLights(params, 42));
    const distinct = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(generateLights(params, i + 1).initial)));
    expect(distinct.size).toBeGreaterThan(20);
  });

  it('el solver encuentra el mínimo en un caso conocido: un solo toque', () => {
    const g = createGrid(5, true);
    toggleLights(g, 2, 2);
    expect(solveLights(g)).toEqual([[2, 2]]);
  });

  it('las pistas llevan al final: cada pista reduce en uno los toques que faltan', () => {
    const level = generateLights(lightsParamsForTier(6), 123);
    const g = cloneGrid(level.initial);
    let remaining = level.minTaps;
    for (let guard = 0; guard < 40 && !isAllLit(g); guard++) {
      const hint = lightsHint(g)!;
      expect(hint).not.toBeNull();
      toggleLights(g, hint[0], hint[1]);
      remaining--;
      expect(solveLights(g)!.length).toBe(Math.max(0, remaining));
    }
    expect(isAllLit(g)).toBe(true);
    expect(lightsHint(g)).toBeNull();
  });

  it('un tablero sin solución se detecta (no pasa con los generados)', () => {
    // En 5×5 hay estados imposibles (solo 1 de cada 4 se puede resolver): una sola casilla apagada en la esquina lo es
    const g = createGrid(5, true);
    g[0][0] = false;
    expect(solveLights(g)).toBeNull();
    // ...mientras que con la del centro apagada sí tiene solución
    const h = createGrid(5, true);
    h[2][2] = false;
    expect(solveLights(h)).not.toBeNull();
  });

  it('con tableros grandes y núcleo no vacío (5×5) elige la solución más corta', () => {
    // 5×5 tiene núcleo de dimensión 2: hay cuatro soluciones para cada nivel; el mínimo nunca pasa de las casillas tocadas
    const level = generateLights({ size: 5, scrambles: 20 }, 9);
    expect(level.minTaps).toBeLessThanOrEqual(20);
    expect(solveLights(level.initial)!.length).toBe(level.minTaps);
  });
});
