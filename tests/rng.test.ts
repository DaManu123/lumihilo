import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../src/core/rng';

describe('mulberry32 PRNG', () => {
  it('produce la misma secuencia con la misma semilla', () => {
    const rng1 = mulberry32(123456);
    const rng2 = mulberry32(123456);

    const seq1 = Array.from({ length: 50 }, () => rng1());
    const seq2 = Array.from({ length: 50 }, () => rng2());

    expect(seq1).toEqual(seq2);
  });

  it('produce secuencias distintas con semillas distintas', () => {
    const rng1 = mulberry32(123456);
    const rng2 = mulberry32(654321);

    const seq1 = Array.from({ length: 20 }, () => rng1());
    const seq2 = Array.from({ length: 20 }, () => rng2());

    expect(seq1).not.toEqual(seq2);
  });

  it('genera valores estrictamente en el rango [0, 1) en 10.000 iteraciones', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 10000; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});
