/**
 * Mensaje de bienvenida del menú principal (lógica pura, sin Phaser).
 *
 * Según la hora del dispositivo: mañana (5 a 11 h), tarde (12 a 18 h), noche (19 a 0 h) o madrugada (1 a 4 h). Los
 * mensajes de mañana, tarde y noche empiezan con su saludo («Buenos días», «Buenas tardes», «Buenas noches»); los de
 * madrugada invitan con cariño a descansar. Dentro de cada franja se elige uno al azar, sin repetir el último que se
 * mostró. Las frases están en español (son la clave de `t()`); cada una tiene su traducción en `EN`.
 */

export type DayPart = 'morning' | 'afternoon' | 'night' | 'lateNight';

export function dayPart(hour: number): DayPart {
  const h = Math.floor(((hour % 24) + 24) % 24);
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 19) return 'afternoon';
  if (h >= 1 && h < 5) return 'lateNight';
  return 'night';
}

export const GREETINGS: Record<DayPart, readonly string[]> = {
  morning: [
    'Buenos días. Un hilo de luz para empezar.',
    'Buenos días. Hoy va a ser un gran día, y empieza con un puzzle.',
    'Buenos días. Tú puedes con todo, empezando por este tablero.',
    'Buenos días. Que tengas una mañana llena de buena energía.',
    'Buenos días. Un puzzle corto y a por el día.',
    'Buenos días. Cada nivel resuelto es una pequeña victoria.',
    'Buenos días. Ánimo, hoy te va a salir todo conectado.',
    'Buenos días. Respira, sonríe y conecta algo bonito.',
  ],
  afternoon: [
    'Buenas tardes. Un descanso con hilos y luces.',
    'Buenas tardes. Te mereces una pausa, y un buen puzzle.',
    'Buenas tardes. Vas muy bien, sigue así.',
    'Buenas tardes. Que el resto del día te salga tan bien como un tablero resuelto.',
    'Buenas tardes. ¿Te animas con el reto de hoy?',
    'Buenas tardes. Un rato para ti, sin prisa.',
    'Buenas tardes. Cada pieza que giras te acerca a la solución.',
    'Buenas tardes. Mucho ánimo, ya pasó lo más difícil del día.',
  ],
  night: [
    'Buenas noches. Que todo quede conectado.',
    'Buenas noches. Un tablero tranquilo para cerrar el día.',
    'Buenas noches. Hoy hiciste lo mejor que pudiste, y eso basta.',
    'Buenas noches. Relájate y disfruta, sin prisa.',
    'Buenas noches. Qué bueno verte por aquí.',
    'Buenas noches. Una luz más antes de descansar.',
    'Buenas noches. Te mereces un rato de calma.',
    'Buenas noches. Que descanses, mañana será otro buen día.',
  ],
  lateNight: [
    'Es un poco tarde. Puedes jugar, pero lo mejor sería que descansaras por tu salud.',
    'Ya es de madrugada. Un puzzle más y a dormir: tu cuerpo te lo agradecerá.',
    'Es muy tarde. Cuídate: dormir bien también es ganar.',
    'Madrugada tranquila. Juega un poco, pero descansa pronto. ¡Tú puedes!',
    'Es hora de dormir. Mañana tendrás más ganas y más ánimo.',
    'Aquí seguiré cuando despiertes. Descansa, te lo mereces.',
    'Qué bueno que estés aquí, pero cuida tu sueño. Mereces descansar bien.',
    'Tu salud primero: unas horas de sueño y mañana lo resuelves mejor.',
  ],
};

/** Todas las frases (para comprobar que tienen traducción). */
export const ALL_GREETINGS: readonly string[] = Object.values(GREETINGS).flat();

/**
 * Elige una frase de la franja de la hora dada. `random` devuelve un número en [0, 1). Si se pasa `avoid` (la última
 * que se mostró) y hay más de una opción, no se repite.
 */
export function pickGreeting(hour: number, random: () => number = Math.random, avoid?: string): string {
  const all = GREETINGS[dayPart(hour)];
  const options = all.length > 1 && avoid ? all.filter((phrase) => phrase !== avoid) : all;
  const index = Math.min(options.length - 1, Math.max(0, Math.floor(random() * options.length)));
  return options[index];
}
