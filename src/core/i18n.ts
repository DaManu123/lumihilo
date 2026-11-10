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
  // Ayuda y tutoriales de Circuitos y Luces
  'Ayuda': 'Help',
  'cómo jugar': 'how to play',
  'Saltar': 'Skip',
  'Cómo se juega Circuitos': 'How to play Circuits',
  'El sentido del giro': 'Rotation direction',
  'Trucos para Circuitos': 'Circuits tips',
  'Gira las piezas hasta que todas queden conectadas a la fuente.': 'Rotate the pieces until all of them are connected to the source.',
  'Cuando todo el circuito se enciende, ganas.': 'When the whole circuit lights up, you win.',
  '¿Atascado? La pista coloca bien una pieza por 10 Chispas.': 'Stuck? A hint places one piece correctly for 10 Sparks.',
  'El botón grande de debajo de la barra cambia el sentido: a la derecha o a la izquierda.': 'The big button below the bar changes the direction: right or left.',
  'Elige el sentido que te deje colocar cada pieza con menos toques.': 'Pick the direction that places each piece in fewer taps.',
  'En computadora, el clic derecho gira al revés.': 'On a computer, right-click rotates the other way.',
  'Deshacer devuelve la última pieza que giraste.': 'Undo turns back the last piece you rotated.',
  'Empieza por las esquinas y los bordes: sus piezas tienen menos posiciones posibles.': 'Start with the corners and edges: their pieces have fewer possible positions.',
  'Las piezas rectas solo tienen dos posiciones distintas.': 'Straight pieces only have two different positions.',
  'Sigue la luz desde la fuente: lo que ya está encendido va bien.': 'Follow the light from the source: whatever is already lit is right.',
  'Cuantos menos toques uses y más rápido termines, más Chispas ganas y antes sube la dificultad.': 'The fewer taps you use and the faster you finish, the more Sparks you earn and the sooner the difficulty goes up.',
  'Si te atascas varias veces seguidas, la dificultad baja sola.': 'If you get stuck several times in a row, the difficulty goes down by itself.',
  'Dos toques se anulan': 'Two taps cancel out',
  'Truco: fila por fila': 'Tip: row by row',
  'Tocar dos veces la misma casilla la deja como estaba.': 'Tapping the same tile twice leaves it as it was.',
  'El orden no importa: solo cuenta qué casillas tocas.': "The order doesn't matter: only which tiles you tap.",
  'Menos toques, más Chispas. Al ganar ves el mínimo posible.': 'Fewer taps, more Sparks. When you win you see the minimum possible.',
  'Ve fila por fila, de arriba abajo.': 'Go row by row, from top to bottom.',
  'Si una luz está apagada, toca la casilla de justo debajo: se enciende sin desordenar las filas de arriba.': 'If a light is off, tap the tile right below it: it turns on without messing up the rows above.',
  'Si al final queda algo apagado en la última fila, toca casillas de la primera fila y repite.': 'If something in the last row is still off, tap tiles in the first row and repeat.',
  // Menú principal
  'Menú': 'Menu',
  'Gira y conecta todo': 'Rotate and connect it all',
  'Enciende todas las luces': 'Turn on every light',
  'Une parejas y llena todo': 'Join pairs and fill it all',
  'Partida en curso': 'Game in progress',
  'Continuar': 'Continue',
  'Jugar': 'Play',
  'Diario hecho': 'Daily done',
  'Diario disponible': 'Daily available',
  'Buenos días. Un hilo de luz para empezar.': 'Good morning. A thread of light to start with.',
  'Buenos días. Hoy va a ser un gran día, y empieza con un puzzle.': "Good morning. Today is going to be a great day, and it starts with a puzzle.",
  'Buenos días. Tú puedes con todo, empezando por este tablero.': 'Good morning. You can do anything, starting with this board.',
  'Buenos días. Que tengas una mañana llena de buena energía.': 'Good morning. May your morning be full of good energy.',
  'Buenos días. Un puzzle corto y a por el día.': 'Good morning. One quick puzzle and on with the day.',
  'Buenos días. Cada nivel resuelto es una pequeña victoria.': 'Good morning. Every level you solve is a small victory.',
  'Buenos días. Ánimo, hoy te va a salir todo conectado.': 'Good morning. Cheer up, today everything will connect for you.',
  'Buenos días. Respira, sonríe y conecta algo bonito.': 'Good morning. Breathe, smile and connect something beautiful.',
  'Buenas tardes. Un descanso con hilos y luces.': 'Good afternoon. A break with threads and lights.',
  'Buenas tardes. Te mereces una pausa, y un buen puzzle.': 'Good afternoon. You deserve a pause, and a good puzzle.',
  'Buenas tardes. Vas muy bien, sigue así.': "Good afternoon. You're doing great, keep it up.",
  'Buenas tardes. Que el resto del día te salga tan bien como un tablero resuelto.': 'Good afternoon. May the rest of your day go as well as a solved board.',
  'Buenas tardes. ¿Te animas con el reto de hoy?': "Good afternoon. Up for today's challenge?",
  'Buenas tardes. Un rato para ti, sin prisa.': 'Good afternoon. A moment for yourself, no rush.',
  'Buenas tardes. Cada pieza que giras te acerca a la solución.': 'Good afternoon. Every piece you rotate brings you closer to the solution.',
  'Buenas tardes. Mucho ánimo, ya pasó lo más difícil del día.': "Good afternoon. Keep your spirits up, the hardest part of the day is behind you.",
  'Buenas noches. Que todo quede conectado.': 'Good evening. May everything stay connected.',
  'Buenas noches. Un tablero tranquilo para cerrar el día.': 'Good evening. A calm board to close the day.',
  'Buenas noches. Hoy hiciste lo mejor que pudiste, y eso basta.': 'Good evening. Today you did the best you could, and that is enough.',
  'Buenas noches. Relájate y disfruta, sin prisa.': 'Good evening. Relax and enjoy, no rush.',
  'Buenas noches. Qué bueno verte por aquí.': "Good evening. It's good to see you here.",
  'Buenas noches. Una luz más antes de descansar.': 'Good evening. One more light before resting.',
  'Buenas noches. Te mereces un rato de calma.': 'Good evening. You deserve a moment of calm.',
  'Buenas noches. Que descanses, mañana será otro buen día.': 'Good evening. Rest well, tomorrow will be another good day.',
  'Es un poco tarde. Puedes jugar, pero lo mejor sería que descansaras por tu salud.': "It's a little late. You can play, but the best thing would be to get some rest for your health.",
  'Ya es de madrugada. Un puzzle más y a dormir: tu cuerpo te lo agradecerá.': "It's the early hours. One more puzzle and off to sleep: your body will thank you.",
  'Es muy tarde. Cuídate: dormir bien también es ganar.': "It's very late. Take care of yourself: sleeping well is winning too.",
  'Madrugada tranquila. Juega un poco, pero descansa pronto. ¡Tú puedes!': 'A quiet night. Play a little, but rest soon. You can do it!',
  'Es hora de dormir. Mañana tendrás más ganas y más ánimo.': "It's time to sleep. Tomorrow you'll have more energy and more spirit.",
  'Aquí seguiré cuando despiertes. Descansa, te lo mereces.': "I'll be right here when you wake up. Rest, you deserve it.",
  'Qué bueno que estés aquí, pero cuida tu sueño. Mereces descansar bien.': "It's great that you're here, but look after your sleep. You deserve good rest.",
  'Tu salud primero: unas horas de sueño y mañana lo resuelves mejor.': 'Your health first: a few hours of sleep and tomorrow you will solve it better.',
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
  'Salir': 'Exit',
  'del reto': 'the challenge',
  'Diario': 'Daily',
  'hecho hoy': 'done today',
  'reto de hoy': 'challenge',
  'Claro': 'Light',
  'Oscuro': 'Dark',
  'Tema': 'Theme',
  'Reiniciar': 'Restart',
  'Deshacer': 'Undo',
  'Pista': 'Hint',
  'Descargando la actualización': 'Downloading the update',
  'Lumihilo {0}': 'Lumihilo {0}',
  'Descargando…': 'Downloading…',
  '{0} %': '{0} %',
  'No se pudo descargar la actualización.\nSe abrirá la página de descarga.': "Couldn't download the update.\nThe download page will open.",
  'Listo para instalar': 'Ready to install',
  'Falta un permiso': 'A permission is missing',
  'Android te pedirá confirmar la instalación. Al terminar, abre Lumihilo para usar la versión nueva.': 'Android will ask you to confirm the installation. When it finishes, open Lumihilo to use the new version.',
  'Activa «Permitir de esta fuente» para Lumihilo en los ajustes que se abrieron, vuelve y pulsa Actualizar otra vez. La descarga ya está lista.': 'Turn on "Allow from this source" for Lumihilo in the settings that just opened, come back and tap Update again. The download is already done.',
  'Se descarga aquí mismo y Android te pedirá confirmar la instalación. Actualizar es opcional: volveremos a avisarte la próxima vez que abras la app.': 'It downloads right here and Android will ask you to confirm the installation. Updating is optional: we will remind you the next time you open the app.',
  'Giro a la derecha': 'Turn right',
  'Giro a la izquierda': 'Turn left',
  'Toca para cambiar el sentido': 'Tap to change direction',
  'Todo está bien colocado.': 'Everything is in place.',
  'Necesitas {0} Chispas para una pista.\nResuelve niveles para ganar más.': 'You need {0} Sparks for a hint.\nSolve levels to earn more.',

  // Tutorial
  'Toca una pieza para girarla.': 'Tap a piece to rotate it.',
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

  // Puzzle Luces
  'Puzzle': 'Puzzle',
  'Circuitos': 'Circuits',
  'Luces': 'Lights',
  'Hilos': 'Threads',
  'Cómo se juega Hilos': 'How to play Threads',
  'Arrastra el dedo de un punto al otro del mismo color.': 'Drag your finger from one dot to the other of the same colour.',
  'Los hilos no pueden cruzarse: si pasas por otro, lo cortas.': "Threads can't cross: if you go over another one, you cut it.",
  'Para ganar, une todas las parejas y llena todas las casillas.': 'To win, connect every pair and fill every tile.',
  'Siguiente': 'Next',
  'Hay que llenar todo el tablero': 'Fill the whole board',
  'Las dos formas unen las dos parejas, pero solo una gana.': 'Both ways connect the two pairs, but only one wins.',
  'Todas las casillas llenas: ¡ganas!': 'Every tile filled: you win!',
  'Quedan casillas vacías: no ganas, aunque las parejas estén unidas.': "Empty tiles left: you don't win, even though the pairs are connected.",
  'Las casillas vacías se marcan con un aro que late.': 'Empty tiles are marked with a pulsing ring.',
  '¿Atascado? La pista también te ayuda a llenarlo.': 'Stuck? The hint also helps you fill it.',
  '{0} de {1} casillas llenas': '{0} of {1} tiles filled',
  'Falta 1 casilla por llenar.\nTodo el tablero debe quedar lleno.': 'One tile is still empty.\nThe whole board must be filled.',
  'Faltan {0} casillas por llenar.\nTodo el tablero debe quedar lleno.': '{0} tiles are still empty.\nThe whole board must be filled.',
  '¿Atascado? La pista une una pareja por ti.': 'Stuck? The hint connects a pair for you.',
  '{0} de {1} hilos unidos': '{0} of {1} threads connected',
  'Todo unido': 'All connected',
  'Todo está unido.': 'Everything is already connected.',
  'Cómo se juega Luces': 'How to play Lights',
  'Toca una casilla.': 'Tap a tile.',
  'Cambia su luz y la de las 4 casillas de al lado.': 'It flips its light and the 4 tiles next to it.',
  'Enciende todas las luces para ganar.': 'Light up every lamp to win.',
  '¿Atascado? La pista te dice qué casilla tocar.': 'Stuck? The hint tells you which tile to tap.',
  '{0} de {1} luces encendidas': '{0} of {1} lights on',
  'Todo está encendido.': 'Everything is already lit.',
  'Las piedras no se encienden ni se tocan: no cuentan.': "Stones don't light up and can't be tapped: they don't count.",
  'Todo encendido': 'All lit up',

  // Actualizaciones
  'Hay una versión nueva': 'New version available',
  'Ya está disponible Lumihilo {0}. Tú tienes la {1}.': 'Lumihilo {0} is now available. You have {1}.',
  'Puedes seguir jugando: actualizar es opcional. Volveremos a avisarte la próxima vez que abras la app.': 'You can keep playing: updating is optional. We will remind you the next time you open the app.',
  'Buscar actualizaciones': 'Check for updates',
  'Aún no se ha comprobado sola.': 'It has not checked by itself yet.',
  'La última comprobación automática ({0}) falló: {1}.': 'The last automatic check ({0}) failed: {1}.',
  'La última comprobación automática ({0}) salió bien.': 'The last automatic check ({0}) succeeded.',
  'aspecto {0}': 'skin {0}',
  '+{0} % Chispas': '+{0} % Sparks',
  'Buscando actualizaciones…': 'Checking for updates…',
  'No se pudo consultar las versiones ({0}).\nRevisa tu conexión.': 'Could not check for updates ({0}).\nCheck your connection.',
  'Ya tienes la última versión ({0}).': 'You have the latest version ({0}).',
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
  'Aurora': 'Aurora',

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
