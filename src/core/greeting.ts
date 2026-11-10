/**
 * Mensaje de bienvenida del menú principal (lógica pura, sin Phaser).
 *
 * Según la hora del dispositivo: mañana (5 a 11 h), tarde (12 a 18 h) o noche (19 a 4 h). Dentro de cada franja se elige
 * una frase al azar. Las frases están en español (son la clave de `t()`); cada una tiene su traducción en `EN`.
 */

export type DayPart = 'morning' | 'afternoon' | 'night';

export function dayPart(hour: number): DayPart {
  const h = Math.floor(((hour % 24) + 24) % 24);
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 19) return 'afternoon';
  return 'night';
}

export const GREETINGS: Record<DayPart, readonly string[]> = {
  morning: [
    'Buenos días. Un hilo de luz para empezar.',
    'Buen día. ¿Conectamos algo antes del desayuno?',
    'Amanece: buen momento para encender unas luces.',
    'Buenos días. Un puzzle corto y a por el día.',
    'Arranca la mañana con un tablero fresco.',
  ],
  afternoon: [
    'Buenas tardes. Un descanso con hilos y luces.',
    'Buena tarde para resolver un puzzle.',
    'Tómate un rato para ti: un tablero y listo.',
    'Buenas tardes. ¿Te animas con el reto de hoy?',
    'A media jornada, nada como una pausa luminosa.',
  ],
  night: [
    'Buenas noches. Que todo quede conectado.',
    'Noche tranquila, puzzle tranquilo.',
    'Antes de dormir, una luz más.',
    'Buenas noches. Un tablero y a descansar.',
    'La noche es buena para enhebrar hilos.',
  ],
};

/** Todas las frases (para comprobar que tienen traducción). */
export const ALL_GREETINGS: readonly string[] = Object.values(GREETINGS).flat();

/** Elige una frase de la franja de la hora dada. `random` devuelve un número en [0, 1). */
export function pickGreeting(hour: number, random: () => number = Math.random): string {
  const options = GREETINGS[dayPart(hour)];
  const index = Math.min(options.length - 1, Math.max(0, Math.floor(random() * options.length)));
  return options[index];
}
