import { describe, it, expect } from 'vitest';
import { ALL_GREETINGS, GREETINGS, dayPart, pickGreeting } from '../src/core/greeting';
import { EN } from '../src/core/i18n';

describe('Saludo del menú', () => {
  it('divide el día en mañana, tarde y noche', () => {
    expect(dayPart(5)).toBe('morning');
    expect(dayPart(11)).toBe('morning');
    expect(dayPart(12)).toBe('afternoon');
    expect(dayPart(18)).toBe('afternoon');
    expect(dayPart(19)).toBe('night');
    expect(dayPart(0)).toBe('night');
    expect(dayPart(4)).toBe('night');
    expect(dayPart(23)).toBe('night');
  });

  it('cada hora del día cae en una franja', () => {
    for (let h = 0; h < 24; h++) expect(['morning', 'afternoon', 'night']).toContain(dayPart(h));
  });

  it('elige una frase de la franja correspondiente', () => {
    expect(GREETINGS.morning).toContain(pickGreeting(8));
    expect(GREETINGS.afternoon).toContain(pickGreeting(15));
    expect(GREETINGS.night).toContain(pickGreeting(22));
    expect(GREETINGS.night).toContain(pickGreeting(2));
  });

  it('el azar recorre todas las frases y nunca se sale de la lista', () => {
    for (const part of ['morning', 'afternoon', 'night'] as const) {
      const list = GREETINGS[part];
      const hour = part === 'morning' ? 8 : part === 'afternoon' ? 15 : 22;
      const seen = new Set(list.map((_, i) => pickGreeting(hour, () => i / list.length)));
      expect(seen.size).toBe(list.length);
      expect(GREETINGS[part]).toContain(pickGreeting(hour, () => 0.9999999));
      expect(GREETINGS[part]).toContain(pickGreeting(hour, () => 1)); // un valor fuera de rango no rompe
    }
  });

  it('todas las frases tienen traducción al inglés y no se repiten', () => {
    for (const phrase of ALL_GREETINGS) expect(EN[phrase], phrase).toBeTruthy();
    expect(new Set(ALL_GREETINGS).size).toBe(ALL_GREETINGS.length);
  });
});
