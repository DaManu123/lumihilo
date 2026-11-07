/**
 * Perfiles de vibración (lógica pura). Cada intensidad define cuánto dura cada pulso.
 *
 * Los pulsos usan la potencia por defecto del motor del teléfono (la máxima que ofrece). Los
 * efectos predefinidos de Android "ligero" y "medio" usan solo el 43 % y el 70 % de potencia, y en
 * muchos teléfonos apenas se notan; con pulsos de potencia plena la intensidad se regula por duración.
 */

export type HapticLevel = 'soft' | 'normal' | 'strong';

export interface HapticProfile {
  /** Duración (ms) del pulso al girar una casilla. */
  tap: number;
  /** Duración (ms) del pulso al conectar o usar una pista. */
  connect: number;
  /** Patrón de la victoria: alterna pulso y pausa, empezando y terminando con pulso (ms). */
  win: readonly number[];
}

export const HAPTIC_LEVELS: readonly HapticLevel[] = ['soft', 'normal', 'strong'];

export const HAPTIC_PROFILES: Record<HapticLevel, HapticProfile> = {
  soft: { tap: 15, connect: 28, win: [30, 70, 30] },
  normal: { tap: 25, connect: 45, win: [45, 70, 45, 70, 90] },
  strong: { tap: 40, connect: 70, win: [70, 80, 70, 80, 130] },
};

export const HAPTIC_LABELS: Record<HapticLevel, string> = {
  soft: 'Suave',
  normal: 'Normal',
  strong: 'Fuerte',
};

export function isHapticLevel(value: unknown): value is HapticLevel {
  return typeof value === 'string' && (HAPTIC_LEVELS as readonly string[]).includes(value);
}

export interface Pulse {
  /** Milisegundos desde el inicio del patrón hasta este pulso. */
  delay: number;
  /** Duración del pulso en ms. */
  duration: number;
}

/** Convierte un patrón [pulso, pausa, pulso, ...] en pulsos con su retraso acumulado. */
export function patternPulses(pattern: readonly number[]): Pulse[] {
  const pulses: Pulse[] = [];
  let elapsed = 0;
  pattern.forEach((ms, i) => {
    if (i % 2 === 0) pulses.push({ delay: elapsed, duration: ms });
    elapsed += ms;
  });
  return pulses;
}

// ---------------------------------------------------------------------------
// Vías de vibración y diagnóstico
// ---------------------------------------------------------------------------

/**
 * Cómo se envía la vibración al teléfono. Android (sobre todo la capa de Xiaomi) puede descartar un tipo
 * de vibración según los ajustes del usuario, así que el juego prueba varias vías:
 * - `all`: todas a la vez (por defecto).
 * - `system`: la respuesta táctil del sistema (la de los botones de cualquier app).
 * - `motor`: el motor de vibración directamente.
 * - `touch`: el motor, marcando la vibración como respuesta a un toque.
 * - `alarm`: el motor, marcada como alarma (Android casi nunca la bloquea).
 */
export type HapticMode = 'all' | 'system' | 'motor' | 'touch' | 'alarm';

export const HAPTIC_MODES: readonly HapticMode[] = ['all', 'system', 'motor', 'touch', 'alarm'];

export const HAPTIC_MODE_LABELS: Record<HapticMode, string> = {
  all: 'Todos',
  system: 'Sistema',
  motor: 'Motor',
  touch: 'Táctil',
  alarm: 'Alarma',
};

export function isHapticMode(value: unknown): value is HapticMode {
  return typeof value === 'string' && (HAPTIC_MODES as readonly string[]).includes(value);
}

/** Potencia (1 a 255) de cada intensidad en los teléfonos con control de amplitud. */
export const HAPTIC_AMPLITUDES: Record<HapticLevel, number> = { soft: 140, normal: 220, strong: 255 };

export type HapticKind = 'tap' | 'connect' | 'win';

/** Lo que recibe el plugin nativo `GameHaptics.trigger`. */
export interface TriggerOptions {
  kind: HapticKind;
  mode: HapticMode;
  /** Duración del pulso en ms (para la victoria, la del primer pulso del patrón). */
  duration: number;
  amplitude: number;
  /** Solo en la victoria: alterna pulso y pausa, empezando y terminando con pulso. */
  pattern?: number[];
}

export function triggerOptions(kind: HapticKind, level: HapticLevel, mode: HapticMode): TriggerOptions {
  const profile = HAPTIC_PROFILES[level];
  const amplitude = HAPTIC_AMPLITUDES[level];
  if (kind === 'win') return { kind, mode, duration: profile.win[0], amplitude, pattern: [...profile.win] };
  return { kind, mode, duration: kind === 'tap' ? profile.tap : profile.connect, amplitude };
}

/** Lo que informa el teléfono sobre sus ajustes de vibración (`GameHaptics.diagnose`). */
export interface HapticDiagnostics {
  sdk: number;
  manufacturer: string;
  model: string;
  hasMotor: boolean;
  hasAmplitudeControl: boolean;
  /** 0 = desactivada, 1 = baja, 2 = media, 3 = alta, -1 = el teléfono no lo expone. */
  hapticFeedbackEnabled: number;
  touchIntensity: number;
  mediaIntensity: number;
  notificationIntensity: number;
  ringIntensity: number;
  /** 0 = silencio, 1 = vibrar, 2 = normal. */
  ringerMode: number;
  /** 1 = todo permitido, 2 = solo prioritarias, 3 = silencio total, 4 = solo alarmas. */
  interruptionFilter: number;
  powerSave: boolean;
  /** Datos que el teléfono no dejó leer (vacío si todo fue bien). */
  problems?: string;
}

const INTENSITY_TEXT: Record<number, string> = { 0: 'Desactivada', 1: 'Baja', 2: 'Media', 3: 'Alta' };
const RINGER_TEXT: Record<number, string> = { 0: 'Silencio', 1: 'Vibrar', 2: 'Normal' };
const FILTER_TEXT: Record<number, string> = { 1: 'Desactivado', 2: 'Solo prioritarias', 3: 'Silencio total', 4: 'Solo alarmas' };

const intensityText = (value: number) => INTENSITY_TEXT[value] ?? 'No disponible';
const yesNo = (value: boolean) => (value ? 'Sí' : 'No');

/** Líneas legibles con el diagnóstico, para mostrarlas en pantalla. */
export function describeDiagnostics(d: HapticDiagnostics): string[] {
  return [
    `Teléfono: ${d.manufacturer} ${d.model} (Android API ${d.sdk})`.replace('  ', ' ').trim(),
    `Motor de vibración: ${yesNo(d.hasMotor)}${d.hasMotor && d.hasAmplitudeControl ? ' (con control de potencia)' : ''}`,
    `Respuesta táctil del sistema: ${d.hapticFeedbackEnabled === -1 ? 'No disponible' : yesNo(d.hapticFeedbackEnabled === 1)}`,
    `Intensidad táctil: ${intensityText(d.touchIntensity)}`,
    `Intensidad de medios y juegos: ${intensityText(d.mediaIntensity)}`,
    `Intensidad de notificaciones: ${intensityText(d.notificationIntensity)}`,
    `Modo del timbre: ${RINGER_TEXT[d.ringerMode] ?? 'No disponible'}`,
    `No molestar: ${FILTER_TEXT[d.interruptionFilter] ?? 'No disponible'}`,
    `Ahorro de batería: ${yesNo(d.powerSave)}`,
  ];
}

/** Ajustes del teléfono que probablemente están impidiendo que el juego vibre. */
export function vibrationBlockers(d: HapticDiagnostics): string[] {
  const blockers: string[] = [];
  if (!d.hasMotor) blockers.push('El teléfono indica que no tiene motor de vibración.');
  if (d.hapticFeedbackEnabled === 0) blockers.push('La respuesta táctil del sistema está desactivada.');
  if (d.touchIntensity === 0) blockers.push('La intensidad de la vibración táctil está desactivada.');
  if (d.mediaIntensity === 0) blockers.push('La intensidad de la vibración de medios y juegos está desactivada.');
  if (d.interruptionFilter >= 3) blockers.push('"No molestar" está en modo estricto y puede silenciar las vibraciones.');
  if (d.powerSave) blockers.push('El ahorro de batería está activo y puede limitar la vibración.');
  if (d.ringerMode === 0) blockers.push('El teléfono está en modo silencio, y en algunos modelos eso también quita las vibraciones de las apps.');
  return blockers;
}
