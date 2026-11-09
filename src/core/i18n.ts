/**
 * Idiomas del juego (lógica pura, sin Phaser).
 *
 * El español es el idioma de origen: los textos del código están en español y `t()` los devuelve tal cual.
 * Para el inglés se busca la frase en español en el diccionario `EN`. Si falta una traducción se muestra
 * el español (nunca una clave rota) y un test (tests/i18n.test.ts) comprueba que no falte ninguna.
 *
 * Los datos variables se pasan como argumentos y se escriben como {0}, {1}… en la frase:
 *   t('Nivel {0}', 3)  →  "Nivel 3" / "Level 3"
 */

export type Language = 'es' | 'en';
export type LanguageSetting = 'auto' | Language;

export const LANGUAGES: readonly LanguageSetting[] = ['auto', 'es', 'en'];

export function isLanguageSetting(value: unknown): value is LanguageSetting {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** Idioma del dispositivo (p. ej. "en-US" → en). Cualquier otro idioma usa el español. */
export function detectLanguage(deviceLanguage: string | undefined | null): Language {
  return typeof deviceLanguage === 'string' && deviceLanguage.toLowerCase().startsWith('en') ? 'en' : 'es';
}

export function resolveLanguage(setting: LanguageSetting, deviceLanguage: string | undefined | null): Language {
  return setting === 'auto' ? detectLanguage(deviceLanguage) : setting;
}

export const EN: Record<string, string> = {
  // Barra superior y controles
  'Reto diario': 'Daily challenge',
  'Nivel {0}': 'Level {0}',
  '{0} toque': '{0} tap',
  '{0} toques': '{0} taps',
  'Relajado': 'Relaxed',
  'Reto': 'Challenge',
  'Normal': 'Normal',
  'Modo': 'Mode',
  'Volver': 'Back',
  'al juego': 'to the game',
  'Diario': 'Daily',
  'hecho hoy': 'done today',
  'reto de hoy': 'challenge',
  'Claro': 'Light',
  'Oscuro': 'Dark',
  'Tema': 'Theme',
  'Reiniciar': 'Restart',
  'Deshacer': 'Undo',
  'Pista': 'Hint',
  'Giro horario': 'Clockwise',
  'Giro antihorario': 'Counter-clockwise',
  'Toca para cambiar el sentido': 'Tap to change direction',
  'Todo está bien colocado.': 'Everything is in place.',
  'Necesitas {0} Chispas para una pista.\nResuelve niveles para ganar más.': 'You need {0} Sparks for a hint.\nSolve levels to earn more.',

  // Tutorial
  'Cómo se juega': 'How to play',
  'Toca una pieza para girarla.': 'Tap a piece to rotate it.',
  'El botón grande cambia el sentido del giro.': 'The big button changes the rotation direction.',
  'Conecta todo el circuito a la fuente.': 'Connect the whole circuit to the source.',
  'Gana Chispas y úsalas en las pistas.': 'Earn Sparks and spend them on hints.',
  'Cada día hay un reto nuevo. Cuida tu racha.': 'There is a new challenge every day. Keep your streak.',
  'Entendido': 'Got it',

  // Estadísticas
  'Estadísticas': 'Statistics',
  'Chispas': 'Sparks',
  'Racha actual': 'Current streak',
  'Mejor racha': 'Best streak',
  'Niveles resueltos': 'Levels solved',
  'Sin pistas y sin fallos': 'No hints, no mistakes',
  'Retos diarios': 'Daily challenges',
  'Mejor tiempo (habilidad {0})': 'Best time (skill {0})',
  'Nivel de habilidad': 'Skill level',
  'Puntuación': 'Score',
  '{0} día': '{0} day',
  '{0} días': '{0} days',
  'Ajustes': 'Settings',
  'Cerrar': 'Close',

  // Actualizaciones
  'Hay una versión nueva': 'New version available',
  'Ya está disponible Lumihilo {0}. Tú tienes la {1}.': 'Lumihilo {0} is now available. You have {1}.',
  'Puedes seguir jugando: actualizar es opcional y no volveremos a preguntarte por esta versión.': 'You can keep playing: updating is optional and we will not ask again about this version.',
  'Ahora no': 'Not now',
  'Actualizar': 'Update',

  // Aspectos
  'Aspectos': 'Skins',
  'Equipado': 'Equipped',
  'Usar': 'Use',
  'Tus Chispas: {0}': 'Your Sparks: {0}',
  'Te faltan {0} Chispas para {1}': 'You need {0} more Sparks for {1}',
  'Filamento': 'Filament',
  'Cyberpunk': 'Cyberpunk',
  'Matrix': 'Matrix',
  'Océano': 'Ocean',
  'Solar': 'Solar',

  // Ajustes
  'Efectos': 'Effects',
  'Música': 'Music',
  'Activado': 'On',
  'Desactivado': 'Off',
  'Estilo de la música': 'Music style',
  'Volumen de la música': 'Music volume',
  'estándar': 'standard',
  'Vibración': 'Vibration',
  'Intensidad de la vibración': 'Vibration strength',
  'Accesibilidad': 'Accessibility',
  '¿No vibra?': 'Not vibrating?',
  'Listo': 'Done',
  'Swing': 'Swing',
  'Ambiental': 'Ambient',
  'Suave': 'Soft',
  'Fuerte': 'Strong',

  // Accesibilidad e idioma
  'Alto contraste': 'High contrast',
  'Marcas de energía': 'Energy marks',
  'Cuatro puntos en las esquinas de cada pieza con energía, para distinguirlas sin depender del color.':
    'Four dots in the corners of every powered piece, to tell them apart without relying on color.',
  'Velocidad de las animaciones': 'Animation speed',
  'Rápida': 'Fast',
  'Ninguna': 'None',
  'Idioma': 'Language',
  'Automático': 'Automatic',
  'Español': 'Español',
  'English': 'English',

  // Vibración: prueba y diagnóstico
  'Leyendo los ajustes del teléfono…': 'Reading the phone settings…',
  'La app se cerró antes por:\n{0}': 'The app closed earlier because of:\n{0}',
  'Estos datos solo se pueden leer en la app de Android (APK). En el navegador no hay motor de vibración que diagnosticar.':
    'This data can only be read in the Android app (APK). A browser has no vibration motor to diagnose.',
  'Posibles causas:\n{0}': 'Possible causes:\n{0}',
  'No se detectó ningún ajuste del teléfono que bloquee la vibración.': 'No phone setting that blocks vibration was found.',
  'Probando…': 'Testing…',
  'Método (Auto suele bastar)': 'Method (Auto is usually enough)',
  'Probar': 'Test',
  'Auto': 'Auto',
  'Sistema': 'System',
  'Motor': 'Motor',
  'Táctil': 'Touch',
  'Alarma': 'Alarm',
  'Sin vibración en este dispositivo.': 'No vibration on this device.',
  'Estás en el navegador: la prueba real solo funciona en el teléfono (APK).': "You're in the browser: the real test only works on the phone (APK).",
  'El plugin de vibración del teléfono no respondió; se usó la vibración genérica.': "The phone's vibration plugin did not respond; generic vibration was used.",
  'Enviada por: {0}.': 'Sent through: {0}.',
  'No se pudo enviar por ninguna vía.': 'It could not be sent through any path.',
  ' Errores: {0}': ' Errors: {0}',
  'Teléfono: {0} (Android API {1})': 'Phone: {0} (Android API {1})',
  'Motor de vibración: {0}': 'Vibration motor: {0}',
  ' (con control de potencia)': ' (with strength control)',
  'Respuesta táctil del sistema: {0}': 'System touch feedback: {0}',
  'Intensidad táctil: {0}': 'Touch strength: {0}',
  'Intensidad de medios y juegos: {0}': 'Media and games strength: {0}',
  'Intensidad de notificaciones: {0}': 'Notifications strength: {0}',
  'Modo del timbre: {0}': 'Ringer mode: {0}',
  'No molestar: {0}': 'Do not disturb: {0}',
  'Ahorro de batería: {0}': 'Battery saver: {0}',
  'Sí': 'Yes',
  'No': 'No',
  'No disponible': 'Not available',
  'Desactivada': 'Off',
  'Baja': 'Low',
  'Media': 'Medium',
  'Alta': 'High',
  'Silencio': 'Silent',
  'Vibrar': 'Vibrate',
  'Solo prioritarias': 'Priority only',
  'Silencio total': 'Total silence',
  'Solo alarmas': 'Alarms only',
  'El teléfono indica que no tiene motor de vibración.': 'The phone reports it has no vibration motor.',
  'La respuesta táctil del sistema está desactivada.': 'System touch feedback is turned off.',
  'La intensidad de la vibración táctil está desactivada.': 'Touch vibration strength is turned off.',
  'La intensidad de la vibración de medios y juegos está desactivada.': 'Media and games vibration strength is turned off.',
  '"No molestar" está en modo estricto y puede silenciar las vibraciones.': '"Do not disturb" is in strict mode and may silence vibrations.',
  'El ahorro de batería está activo y puede limitar la vibración.': 'Battery saver is on and may limit vibration.',
  'El teléfono está en modo silencio, y en algunos modelos eso también quita las vibraciones de las apps.':
    'The phone is in silent mode, and on some models that also removes app vibrations.',

  // Victoria
  'Circuito completo': 'Circuit complete',
  'Reto diario superado': 'Daily challenge complete',
  'Nivel {0} superado': 'Level {0} complete',
  'Tiempo': 'Time',
  'Récord personal': 'Personal best',
  'Nuevo': 'New',
  'Toques': 'Taps',
  '{0}  (mínimo {1})': '{0}  (minimum {1})',
  'Eficiencia (sin pistas)': 'Efficiency (no hints)',
  'Eficiencia': 'Efficiency',
  'Pistas usadas': 'Hints used',
  'Dificultad': 'Difficulty',
  'Sube un nivel': 'Goes up a level',
  'Baja un nivel': 'Goes down a level',
  'Ya cobradas hoy': 'Already collected today',
  'Chispas (doble por el reto)': 'Sparks (double for the challenge)',
  'Racha': 'Streak',
  'Base {0}': 'Base {0}',
  'eficiencia {0}': 'efficiency {0}',
  'rapidez {0}': 'speed {0}',
  'récord {0}': 'record {0}',
  'Volver al juego': 'Back to the game',
  'Siguiente nivel': 'Next level',
  'Repetir el reto': 'Replay the challenge',
  'Repetir este nivel': 'Replay this level',
};

let current: Language = 'es';

export function setLanguage(language: Language): void {
  current = language;
}

export function getLanguage(): Language {
  return current;
}

/** Traduce una frase en español al idioma actual y rellena {0}, {1}… con los argumentos. */
export function t(text: string, ...args: Array<string | number>): string {
  const base = current === 'en' ? (EN[text] ?? text) : text;
  return args.length === 0 ? base : base.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ''));
}
