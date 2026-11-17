import { describe, expect, it } from 'vitest';
import { HINT_RECHARGE_SECONDS, IDLE_NUDGE_SECONDS, hintOffer, shouldNudgeHint } from '../src/core/hintOffer';
import { HINT_COST } from '../src/core/progress';

describe('precio de la pista', () => {
  it('la primera de cada nivel es gratis, tenga las Chispas que tenga', () => {
    expect(hintOffer({ hintsUsed: 0, sparks: 0, secondsSinceLastHint: 0 })).toEqual({ cost: 0, waitSeconds: 0 });
    expect(hintOffer({ hintsUsed: 0, sparks: 500, secondsSinceLastHint: 0 })).toEqual({ cost: 0, waitSeconds: 0 });
  });

  it('las siguientes cuestan Chispas si alcanzan', () => {
    expect(hintOffer({ hintsUsed: 1, sparks: HINT_COST, secondsSinceLastHint: 0 })).toEqual({ cost: HINT_COST, waitSeconds: 0 });
    expect(hintOffer({ hintsUsed: 4, sparks: 999, secondsSinceLastHint: 3 })).toEqual({ cost: HINT_COST, waitSeconds: 0 });
  });

  it('sin Chispas nadie se queda atascado: la pista se recarga y sale gratis', () => {
    expect(hintOffer({ hintsUsed: 1, sparks: HINT_COST - 1, secondsSinceLastHint: 0 })).toEqual({ cost: 0, waitSeconds: HINT_RECHARGE_SECONDS });
    expect(hintOffer({ hintsUsed: 2, sparks: 0, secondsSinceLastHint: 12 })).toEqual({ cost: 0, waitSeconds: HINT_RECHARGE_SECONDS - 12 });
    expect(hintOffer({ hintsUsed: 2, sparks: 0, secondsSinceLastHint: HINT_RECHARGE_SECONDS })).toEqual({ cost: 0, waitSeconds: 0 });
    expect(hintOffer({ hintsUsed: 2, sparks: 0, secondsSinceLastHint: 9999 })).toEqual({ cost: 0, waitSeconds: 0 });
    expect(hintOffer({ hintsUsed: 2, sparks: 0, secondsSinceLastHint: Number.NaN }).waitSeconds).toBe(HINT_RECHARGE_SECONDS);
  });
});

describe('recordatorio de la pista', () => {
  const idle = { secondsIdle: IDLE_NUDGE_SECONDS, alreadyNudged: false, isWon: false, hintsUsed: 0 };
  it('sale tras un rato sin jugadas, una vez por nivel', () => {
    expect(shouldNudgeHint(idle)).toBe(true);
    expect(shouldNudgeHint({ ...idle, secondsIdle: IDLE_NUDGE_SECONDS - 1 })).toBe(false);
    expect(shouldNudgeHint({ ...idle, alreadyNudged: true })).toBe(false);
  });
  it('no molesta a quien ya ganó o ya usó una pista', () => {
    expect(shouldNudgeHint({ ...idle, isWon: true })).toBe(false);
    expect(shouldNudgeHint({ ...idle, hintsUsed: 1 })).toBe(false);
  });
});
