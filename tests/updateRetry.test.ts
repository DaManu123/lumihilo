import { describe, expect, it } from 'vitest';
import { MIN_RECHECK_MS, parseLastCheck, retryDelay, serializeLastCheck, shouldRecheck } from '../src/core/updateRetry';

describe('reintentos de la comprobación de versión', () => {
  it('reintenta a los 20 s y a los 60 s y luego se rinde', () => {
    expect(retryDelay(0)).toBeNull();
    expect(retryDelay(1)).toBe(20_000);
    expect(retryDelay(2)).toBe(60_000);
    expect(retryDelay(3)).toBeNull();
  });

  it('al volver a la app comprueba si nunca se intentó o si el último intento falló', () => {
    expect(shouldRecheck(1000, null, false)).toBe(true);
    expect(shouldRecheck(1000, 900, true)).toBe(true);
  });

  it('tras un acierto no vuelve a consultar hasta pasado el mínimo', () => {
    expect(shouldRecheck(1000 + MIN_RECHECK_MS - 1, 1000, false)).toBe(false);
    expect(shouldRecheck(1000 + MIN_RECHECK_MS, 1000, false)).toBe(true);
  });

  it('guarda y lee la última comprobación, e ignora datos raros', () => {
    expect(parseLastCheck(serializeLastCheck({ at: 5, error: null }))).toEqual({ at: 5, error: null });
    expect(parseLastCheck(serializeLastCheck({ at: 5, error: 'tiempo agotado' }))).toEqual({ at: 5, error: 'tiempo agotado' });
    expect(parseLastCheck('no es json')).toBeNull();
    expect(parseLastCheck('{"at":"x"}')).toBeNull();
    expect(parseLastCheck(null)).toBeNull();
  });
});
