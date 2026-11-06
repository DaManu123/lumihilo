/**
 * Mulberry32 PRNG determinista de 32 bits con semilla.
 * Genera números pseudoaleatorios flotantes uniformemente distribuidos en [0, 1).
 *
 * Regla de arquitectura: src/core/ es TypeScript puro sin dependencias de DOM, Phaser o Capacitor.
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function (): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
