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
    expect(dayPart(23)).toBe('night');
    expect(dayPart(0)).toBe('night');
    expect(dayPart(1)).toBe('lateNight');
    expect(dayPart(4)).toBe('lateNight');
    expect(dayPart(5)).toBe('morning');
  });

  it('cada hora del día cae en una franja', () => {
    for (let h = 0; h < 24; h++) expect(['morning', 'afternoon', 'night', 'lateNight']).toContain(dayPart(h));
  });

  it('elige una frase de la franja correspondiente', () => {
    expect(GREETINGS.morning).toContain(pickGreeting(8));
    expect(GREETINGS.afternoon).toContain(pickGreeting(15));
    expect(GREETINGS.night).toContain(pickGreeting(22));
    expect(GREETINGS.night).toContain(pickGreeting(0));
    expect(GREETINGS.lateNight).toContain(pickGreeting(2));
  });

  it('mañana, tarde y noche empiezan con su saludo; la madrugada anima a descansar', () => {
    for (const phrase of GREETINGS.morning) expect(phrase.startsWith('Buenos días')).toBe(true);
    for (const phrase of GREETINGS.afternoon) expect(phrase.startsWith('Buenas tardes')).toBe(true);
    for (const phrase of GREETINGS.night) expect(phrase.startsWith('Buenas noches')).toBe(true);
    expect(GREETINGS.lateNight.some((p) => p.startsWith('Es un poco tarde'))).toBe(true);
    for (const phrase of GREETINGS.lateNight) expect(/descans|dormir|sueño|salud/i.test(phrase), phrase).toBe(true);
  });

  it('hay varias frases por franja y caben en dos líneas del menú', () => {
    for (const list of Object.values(GREETINGS)) {
      expect(list.length).toBeGreaterThanOrEqual(6);
      for (const phrase of list) expect(phrase.length, phrase).toBeLessThanOrEqual(95);
    }
  });

  it('no repite la frase que se acaba de mostrar', () => {
    for (const part of [8, 15, 22, 3]) {
      const last = pickGreeting(part, () => 0);
      for (let i = 0; i < 20; i++) expect(pickGreeting(part, () => i / 20, last)).not.toBe(last);
    }
  });

  it('el azar recorre todas las frases y nunca se sale de la lista', () => {
    for (const part of ['morning', 'afternoon', 'night', 'lateNight'] as const) {
      const list = GREETINGS[part];
      const hour = part === 'morning' ? 8 : part === 'afternoon' ? 15 : part === 'night' ? 22 : 3;
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
