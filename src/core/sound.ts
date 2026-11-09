/**
 * Lógica pura del sonido (sin Web Audio): qué nota suena en cada momento.
 *
 * Todo el juego usa la escala pentatónica mayor (do, re, mi, sol, la): cualquier combinación de
 * notas suena consonante, así que jugar rápido o al azar siempre suena bien, nunca disonante.
 */

/** Semitonos de la escala pentatónica mayor dentro de una octava. */
export const PENTATONIC_SEMITONES = [0, 2, 4, 7, 9] as const;

/** Frecuencia de la nota raíz (do central). */
export const ROOT_HZ = 261.63;

/** Cantidad de notas disponibles: dos octavas. */
export const NOTE_COUNT = PENTATONIC_SEMITONES.length * 2;

/** Frecuencia en Hz de una nota de la escala (0 = do central; cada 5 notas sube una octava). */
export function noteFrequency(index: number): number {
  const i = Math.min(NOTE_COUNT - 1, Math.max(0, Math.floor(index)));
  const octave = Math.floor(i / PENTATONIC_SEMITONES.length);
  const semitones = PENTATONIC_SEMITONES[i % PENTATONIC_SEMITONES.length] + 12 * octave;
  return ROOT_HZ * Math.pow(2, semitones / 12);
}

/**
 * Nota que suena al girar una casilla. Depende de su posición: recorrer el tablero de izquierda
 * a derecha asciende por la escala, y las filas desplazan la melodía, así que cada casilla tiene
 * "su" nota y el jugador acaba reconociendo el tablero por el oído.
 */
export function noteForCell(row: number, col: number): number {
  return (col * 2 + row) % NOTE_COUNT;
}

/** Nota del pulso de victoria en el paso `step` de la onda: asciende y se queda en la más aguda. */
export function winStepNote(step: number): number {
  return Math.min(NOTE_COUNT - 1, 2 + Math.max(0, Math.floor(step)));
}

/** Acorde final de victoria: do, mi, sol y do agudo. */
export const WIN_CHORD = [0, 2, 3, 5] as const;

/** Campanita de la pista: dos notas agudas. */
export const HINT_NOTES = [7, 9] as const;

/** Nota de cada casilla que recorre el hilo en Hilos: asciende por la escala conforme el hilo se alarga. */
export function flowStepNote(length: number): number {
  return Math.min(NOTE_COUNT - 1, Math.max(0, Math.floor(length) - 1));
}

/** Campanita de cuando se une una pareja: dos notas que suben. */
export const FLOW_CONNECT_NOTES = [5, 7] as const;

/** Nota de "conexión": una quinta pentatónica por encima de la nota de la casilla, sin pasarse de la escala. */
export function connectNote(index: number): number {
  return Math.min(NOTE_COUNT - 1, Math.max(0, Math.floor(index)) + 3);
}
