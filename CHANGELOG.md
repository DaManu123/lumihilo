# Registro de cambios

Todas las versiones publicadas del juego. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones, [SemVer](https://semver.org/lang/es/). Las notas completas de cada versión están en `docs/releases/`.

## [Sin publicar]

## [0.2.0-beta.15] - 2026-11-11

### Añadido
- **Gráficos altos** (Ajustes → Gráficos: «Normales» o «Altos»). «Normales» es el estilo de siempre y sigue siendo el de partida. Con «Altos», los aspectos de la tienda (desde Cyberpunk) suman iluminación: las piezas encendidas irradian luz (brillo), hay un halo que late detrás del tablero, viñeta en los bordes y los títulos y tarjetas brillan con el color del aspecto. Cada aspecto tiene además su propia textura animada y partículas de ambiente: Cyberpunk, líneas de escaneo y polvo de neón; Matrix, monitor CRT y símbolos que caen; Océano, reflejos de luz del agua y plancton luminoso; Solar, una corona que late y brasas que suben; Aurora, un velo de luz, estrellas que titilan y estrellas fugaces. Al jugar saltan destellos (al conectar piezas, encender luces o unir un hilo) y al ganar, una onda de luz con destellos por todo el tablero. Gastan más batería. Filamento se ve igual en los dos modos; con alto contraste no hay efectos y sin animaciones solo queda la luz quieta.
- **Aviso de una sola vez** al abrir el juego tras actualizar: cuenta que hay gráficos altos en Ajustes («Ver Ajustes» / «Ahora no»). A quien empieza a jugar no se le enseña.

### Cambiado
- **Ajustes reacomodado** para que quepa la opción nueva: «Gráficos» arriba, y «Efectos» y «Música» en la misma fila.

## [0.2.0-beta.14] - 2026-11-11

### Cambiado
- **Menú en dos pantallas** (sugerencia de un probador): la de inicio tiene el nombre, «Jugar», «Aspectos», «Estadísticas» y «Ajustes», y el saludo abajo; «Jugar» abre la pantalla de puzzles (las tres tarjetas y, abajo, el modo con una línea que lo explica). «Volver» del juego lleva a la pantalla de puzzles y, desde ahí, otro «Volver» al inicio.
- **Cambiar de modo ya no reinicia nada.** Cada modo (Relajado, Normal, Reto) guarda su propio nivel, su dificultad y sus partidas a medias en cada puzzle: si cambias de modo y vuelves, sigues donde ibas. La primera vez que entras en un modo empiezas en su nivel 1.
- **La música del menú es el estilo elegido.** Al cambiar entre Swing y Ambiental en Ajustes se oye al momento; Luces e Hilos siguen con su propia música al jugarlos. En Ajustes la opción se llama ahora «Música del menú y de Circuitos».

### Corregido
- **Cambiar el estilo de la música «no hacía nada»** si se venía de jugar Luces o Hilos: en el menú seguía sonando la música de ese puzzle. Además, el audio se reanuda si Android lo interrumpe (una llamada u otra app) al volver a la app.
- **Textos que se salían de las tarjetas:** el título «Hay que llenar todo el tablero» se salía del marco y una frase de esa pantalla quedaba tapada por el botón. Ahora los títulos y los textos de los botones y del menú se achican solos si no caben, la segunda pantalla del tutorial de Hilos se reacomodó, y una prueba nueva revisa todas las tarjetas, tutoriales, el menú y la barra del juego, en español e inglés y en dos tamaños de pantalla: ningún texto se sale de su marco, se pisa con otro ni queda debajo de un botón.

## [0.2.0-beta.13] - 2026-11-10

### Añadido
- **Tutorial de Circuitos nuevo, animado y en tres pantallas** (como el de Hilos): un tablero de ejemplo donde un dedo gira las piezas mal puestas y todo se enciende; el sentido del giro (una pieza que gira a la derecha y a la izquierda con su flecha); y trucos (empezar por esquinas y bordes, las rectas solo tienen dos posiciones, seguir la luz desde la fuente, cómo se gana más y cómo baja la dificultad).
- **Tutorial de Luces ampliado a tres pantallas:** la de siempre; «Dos toques se anulan» (tocar dos veces la misma casilla la deja igual y el orden no importa); y «Truco: fila por fila» (si una luz está apagada, se toca la de justo debajo), con un ejemplo animado que se resuelve en dos toques.
- **Botón «Ayuda» en el juego** (a la izquierda de la barra, donde estaba «Modo»): vuelve a mostrar el tutorial del puzzle en juego. El modo se ve y se cambia en el menú. Los tutoriales tienen puntos de página y «Saltar».

### Cambiado
- **La dificultad se adapta a lo bien que juegas, en cada puzzle con su propia vara.** Antes los tres puzzles medían el tiempo como Circuitos (2,5 s por toque mínimo), así que en Hilos casi nadie llegaba a «rápido», y casi cualquier victoria hacía subir. Ahora: Luces da más tiempo para pensar y pide la mitad de eficiencia (encontrar el mínimo exacto es muy difícil); Hilos mide el tiempo por casillas del tablero y por hilo. Las victorias suman puntos: una buena (eficiente, a buen ritmo y sin pistas) 2 y una normal 1; con 6 se sube un peldaño. Quien juega muy bien sube cada 3 niveles, quien va justo cada 6, y un atasco borra los puntos. Bajar es más rápido: 2 atascos seguidos (antes 3), y tardar muchísimo más de lo esperado también cuenta como atasco. El bono de rapidez de Chispas usa el mismo tiempo esperado de cada puzzle.

### Corregido
- **Hilos: el aviso de casillas vacías ya no bloquea el tablero.** Antes, al unir todas las parejas sin llenar el tablero, el aviso «Faltan N casillas por llenar» impedía mover los hilos durante un par de segundos. Ahora el aviso se queda en pantalla sin bloquear nada y desaparece en cuanto vuelves a tocar los hilos (las casillas vacías siguen marcadas con su aro). Ningún aviso breve bloquea ya el juego.

## [0.2.0-beta.12] - 2026-11-10

### Añadido
- **Botón «Volver» dentro del juego:** una flecha con el texto «Volver», arriba a la izquierda (donde estaba el título), que regresa al menú. El segmento de la barra que decía «Menú» vuelve a mostrar el modo («Modo»; tocarlo también abre el menú, donde se cambia). El botón del reto diario que decía «Volver al juego» ahora dice «Salir del reto».
- **Madrugada en el saludo del menú** (1 a 4 h): mensajes que animan a descansar sin prohibir jugar («Es un poco tarde. Puedes jugar, pero lo mejor sería que descansaras por tu salud»), con 8 variantes.

### Cambiado
- **Saludos del menú:** los de mañana, tarde y noche empiezan siempre con «Buenos días», «Buenas tardes» o «Buenas noches», con 8 mensajes de ánimo y buena vibra por franja (ES/EN). No se repite el mismo dos veces seguidas. La franja de noche va de 19 a 0 h.

## [0.2.0-beta.11] - 2026-11-10

### Añadido
- **Menú principal.** La app siempre abre en un menú: arriba el nombre del juego, después una tarjeta por puzzle (Circuitos, Luces e Hilos, con su nivel, si tienes una partida en curso y si el reto diario está hecho), en medio el selector de modo (Relajado, Normal, Reto), los accesos a Estadísticas, Aspectos y Ajustes y, hasta abajo, un mensaje de bienvenida al azar según la hora del dispositivo (mañana, tarde o noche, ES y EN). Dentro del juego, el botón de la izquierda de la barra de arriba (antes «Modo») es ahora «Menú» y vuelve al menú.
- **Cada puzzle conserva su partida.** Al salir al menú, cambiar de puzzle o cerrar la app, se guarda el tablero a medias (giros, luces, hilos, toques, tiempo y jugadas para deshacer) y la tarjeta muestra «Partida en curso / Continuar». Si cambias de modo, las partidas a medias se descartan (eran de otra dificultad); reiniciar o ganar el nivel también borra la del puzzle.

### Cambiado
- **Estadísticas y Ajustes ya no van juntos.** Estadísticas solo muestra los números (con «Cerrar»); Ajustes y Aspectos se abren desde el menú. Elegir puzzle ya no se hace desde Estadísticas.
- El modo de juego se cambia desde el menú y reinicia el nivel de los tres puzzles.
- El mini tutorial de Luces y el de Hilos salen la primera vez que entras a ese puzzle, aunque no hayas visto el de Circuitos.

## [0.2.0-beta.10] - 2026-11-10

### Añadido
- **Actualizar sin salir de la app (APK de Android).** Al pulsar «Actualizar» en el aviso de versión, el juego descarga el APK de la versión nueva (con una barra de avance) y abre el instalador de Android: solo tienes que confirmar. La primera vez, Android pide permitir a Lumihilo «instalar apps desconocidas»: se abre ese ajuste, lo activas, vuelves y pulsas «Actualizar» otra vez (la descarga ya está hecha). Si algo falla, se abre la página de descarga como antes. Solo existe en el APK de GitHub; la versión de Google Play se actualiza por la tienda y no lleva ese permiso. La primera versión que lo trae hay que instalarla a mano; desde ahí, ya se actualiza sola.

### Cambiado
- **Hilos: hay que llenar todo el tablero en todos los modos,** también en Relajado (en la beta.9 Relajado seguía bastando con unir las parejas). Relajado mantiene los tableros más pequeños y fáciles de los niveles bajos.

## [0.2.0-beta.9] - 2026-11-10

### Añadido
- **Hilos: hay que llenar todo el tablero.** Para ganar ya no basta con unir las parejas: no puede quedar ninguna casilla vacía (en Normal, Reto y en el reto diario; en Relajado sigue bastando con unir las parejas). Siempre hay una forma de llenarlo y cualquiera vale. Si unes todas las parejas pero quedan casillas vacías, esas casillas se marcan con un aro que late y un aviso te dice cuántas faltan. El panel muestra «N de M casillas llenas» y la pista, si todo está unido pero falta llenar, te enseña qué hilo cambiar. El tutorial tiene ahora dos pantallas: la segunda muestra el mismo tablero resuelto de dos formas, la que lo llena todo (paloma) y la que deja casillas vacías (equis).
- **Bonus de Chispas por aspecto.** Cada aspecto que llevas puesto da un porcentaje extra de Chispas por nivel: Cyberpunk +5 %, Matrix +10 %, Océano +15 %, Solar +20 %, Aurora +25 % (Filamento, 0 %). Se ve en la tienda («+15 % Chispas») y en el desglose de la victoria («aspecto N»). Se aplica antes del doble del reto diario.
- **El aviso de versión nueva reintenta.** Antes hacía un solo intento, unos segundos después de abrir la app, y si la red aún no estaba lista no avisaba. Ahora reintenta a los 20 y 60 segundos y vuelve a comprobar al volver a la app o cuando regresa la conexión. «Buscar actualizaciones» en Ajustes muestra cuándo fue la última comprobación automática.

### Cambiado
- **Circuitos: «Giro a la derecha» y «Giro a la izquierda»** en vez de «horario» y «antihorario» (en inglés, «Turn right» y «Turn left»).
- **Cada puzzle tiene su propia dificultad** (antes los tres compartían un solo nivel de habilidad: lo que hacías en Circuitos movía Luces e Hilos). Luces e Hilos arrancan desde tu nivel actual y desde ahí evolucionan solos.
- **Más dificultad en los niveles altos.** Circuitos llega a 7×7 con más bucles; Luces llega a 7×7 y pide cerca del doble de toques mínimos en el nivel 10 (≈27, antes ≈13); Hilos llega a 8×8 con hasta 8 hilos. Los modos Relajado y Reto ahora también se notan en Luces e Hilos.
- **Subes más rápido:** con 3 victorias seguidas (antes 5), y una victoria muy buena (eficiente y rápida) tras otra salta dos peldaños.

### Interno
- **La Release solo lleva tres archivos:** el APK de Android, el portable de Windows y el AppImage de Linux (se quitan el instalador de Windows, el `.tar.gz` de Linux y las sumas de verificación).
- Las pruebas del navegador (e2e) corren en paralelo: de unos 33 a unos 9–16 minutos, con las mismas comprobaciones (185).

## [0.2.0-beta.8] - 2026-11-09

### Añadido
- **Música propia de Hilos: cuerda pulsada** (pista «hilo»), a un tempo más vivo que la caja de música de Luces. Una melodía que se «hila» por la escala (pasos de uno o dos grados, nunca saltos grandes) sobre un colchón cálido y un bajo que late al primer y tercer tiempo; cada hilo unido hace que toque más notas y, con casi todo unido, entra una segunda voz aguda. Al ganar cierra con un arpegio de cuerda. Suena sola en Hilos, sea cual sea el estilo elegido, así que cada puzzle tiene su carácter (Circuitos: Swing o Ambiental; Luces: caja de música; Hilos: cuerda pulsada). Medido con la prueba de audio: volumen parecido al ambiental y sin distorsión.

- **Tercer puzzle: Hilos** (se elige en Estadísticas → Puzzle). Un tablero con parejas de puntos del mismo color: se arrastra el dedo de un punto al otro para unirlas con un hilo de luz, sin que dos hilos compartan casilla (pasar por otro lo corta). Gana quien une todas las parejas. Cada nivel se genera desde una solución (un camino aleatorio que recorre todo el tablero, cortado en tramos), así que **siempre tiene solución**; el tamaño va de 4×4 a 7×7 y de 3 a 7 hilos según el nivel de habilidad. Cada pareja tiene su color y un símbolo propio (punto, anillo, cuadrado, triángulo, más, equis, barras, rombo), para que no dependa solo del color; los colores cumplen contraste ≥ 3:1 en todos los aspectos, claro, oscuro y alto contraste. Un toque sobre un hilo ya unido no lo borra: el trazo solo cambia algo cuando el dedo se mueve. Tiene deshacer (por trazo), pistas (10 Chispas: unen la pareja que menos estropea), nivel y récords propios, mini tutorial animado la primera vez (se repite tocando el panel «N de M hilos unidos»), reto diario propio (uno por puzzle) y sonido propio: la nota asciende por la escala conforme el hilo se alarga, con campanita al unir una pareja y clic seco al cortar.

## [0.2.0-beta.7] - 2026-11-09

### Añadido
- **Sonido propio de Luces.** La música pasa a ser una **caja de música** (pista «cristal», más lenta y sin batería): con todo apagado casi solo suena un «tic» al empezar cada compás, y cada lámpara encendida añade notas hasta cerrar con un destello; al ganar, cierra con un arpegio de campanitas. Suena sola en Luces sea cual sea el estilo elegido (Swing o Ambiental siguen valiendo en Circuitos). Efectos nuevos: tocar enciende o apaga las lámparas con un arpegio rápido (campanita al encenderse, clic seco al apagarse, más aguda cuanto más a la derecha) y tocar una piedra da un golpe sordo. Medido con la prueba de audio: volumen parecido al ambiental, sin distorsión ni siquiera con el volumen al 200 %.

## [0.2.0-beta.6] - 2026-11-09

### Cambiado
- **Fuente de actualizaciones por build:** `UPDATE_SOURCE` ya no se edita a mano en el código: se decide al compilar (`UPDATE_SOURCE=play`, o `npm run build:play`). El flujo de publicación compila el APK de GitHub con `'github'` y el AAB de Google Play con `'play'`, y verifica que cada uno lleva lo que debe.

## [0.2.0-beta.5] - 2026-11-09

### Añadido
- **Reto diario de Luces:** con Luces activo, el botón «Diario» abre el reto de Luces del día (igual para todos, siempre con piedras y dificultad según el día de la semana, como el de Circuitos). Cada puzzle tiene su reto: se pueden hacer los dos el mismo día, cada uno paga doble la primera vez, y el botón marca «hecho hoy» según el puzzle activo. Ya no cambia de puzzle al tocarlo desde Luces.

## [0.2.0-beta.4] - 2026-11-09

### Añadido
- **Piedras en Luces:** desde el nivel de habilidad 3 aparecen casillas bloqueadas (1 al principio, hasta 4). No se encienden, no se pueden tocar, no cambian cuando tocas a su vecina y no cuentan para ganar; hay que rodearlas. Siguen siendo niveles con solución (se generan desde el tablero resuelto) y el solver y las pistas las tienen en cuenta. Un aviso breve las explica la primera vez. El panel cuenta solo las casillas jugables («N de M luces encendidas»).

## [0.2.0-beta.2] - 2026-11-09

### Añadido
- Sexto aspecto, **Aurora** (1000 Chispas): casillas de cristal con dos esquinas cortadas, nodos en destello de cuatro puntas, cable de cortina de aurora (velo translúcido con hebras verde y violeta) y fondo de cortinas que ondulan sobre un cielo estrellado. La tienda ajusta el alto de las filas para que quepan las seis.

## [0.2.0-beta.1] - 2026-11-09

### Cambiado
- **Aviso de versión nueva:** ahora sale **cada vez que se abre la app por completo** mientras exista una versión más nueva (antes, una sola vez por versión). La lista de versiones se lee de un archivo de la web (`releases.json`, sin límite de consultas) con la API de GitHub de respaldo, y hay un botón nuevo, **Ajustes → Buscar actualizaciones**, que siempre contesta (oferta, «estás al día» o el motivo del fallo).
- **Luces con diseño propio:** ya no parece Circuitos. Cada casilla es un portalámparas con una bombilla de vidrio (apagada, hueca; encendida, con halo) cuya forma sale del aspecto, sobre una placa con remaches y una luz ambiente que crece al encender; el panel cuenta «N de M luces encendidas» con una barra.

### Añadido
- **Mini tutorial de Luces**, una sola vez (y de nuevo al tocar el panel de luces): un tablero de ejemplo animado donde un dedo toca el centro y cambian las cinco lámparas, con tres frases cortas.

## [0.1.0-beta.10] - 2026-11-09

### Añadido
- **Segundo puzzle: Luces.** Tocas una casilla y cambia su luz y la de sus cuatro vecinas; hay que dejar todo el tablero encendido. Cada nivel se genera siempre con solución (parte del tablero resuelto), el tamaño sube con tu nivel de habilidad (de 3×3 a 6×6) y el mínimo de toques y las pistas salen de resolver el sistema sobre GF(2). Se elige en Estadísticas → Puzzle. Tiene nivel propio, récords propios, deshacer y pistas (10 Chispas), usa los aspectos, el tema claro y el alto contraste, y paga Chispas como Circuitos. El reto diario sigue siendo de Circuitos.

## [0.1.0-beta.9] - 2026-11-09

### Añadido
- **Aviso de versión nueva** (APK y escritorio): al abrir el juego se busca una versión más nueva en GitHub y, si la hay, se pregunta una sola vez por versión si quieres actualizar; con «Ahora no» sigues jugando. La web no consulta nada. Al pasar a Google Play basta con cambiar `UPDATE_SOURCE` a `'play'` (ver `docs/08`). La política de privacidad lo explica.
- Quinto aspecto, **Océano**: casillas en píldora, nodos de burbuja, cable en onda, olas con haces de luz y burbujas que suben.

### Cambiado
- **Precios de los aspectos** recalculados con un modelo de ritmo de juego (`docs/10-economia-chispas.md`): Cyberpunk 150, Matrix 350, Océano 550 y Solar 800 Chispas. El primer aspecto se consigue el mismo día con juego habitual.

### Mejorado
- Los aspectos de la tienda ya no solo cambian de color: cada uno tiene su forma y su fondo. **Cyberpunk**: casillas con esquinas cortadas, nodos en rombo, cable de doble pista y cuadrícula en perspectiva con una franja de escaneo. **Matrix**: casillas y nodos cuadrados, cable de bits y lluvia de código. **Solar**: casillas circulares, nodos en forma de sol, cable al rojo blanco y órbitas con rayos que giran muy despacio. Las muestras de la tienda enseñan esas formas. Con alto contraste el fondo se atenúa y se queda quieto; con las animaciones desactivadas también.

## [0.1.0-beta.8] - 2026-11-09

### Añadido
- **Tienda de aspectos**: Estadísticas → Aspectos. Paletas Cyberpunk (150 Chispas), Matrix (250) y Solar (400) además del Filamento inicial, cada una en tema oscuro y claro y compatible con el alto contraste. Solo cambia el aspecto, no el juego.
- Página de presentación y política de privacidad en inglés (`/en/`), con enlace entre idiomas.

### Corregido
- La página de presentación aún mostraba el nombre anterior en la cabecera y marcaba como hechos pasos de Play Console que no lo estaban.

## [0.1.0-beta.7] - 2026-11-08

### Cambiado
- Identificador de Android definitivo `com.damanu.lumihilo`: hay que desinstalar la beta anterior y se pierde el progreso guardado. En escritorio la carpeta de datos pasa a `Lumihilo`.
- El repositorio pasa a llamarse `lumihilo`.

## [0.1.0-beta.6] - 2026-11-07

### Cambiado
- El juego se llama ahora **Lumihilo** (antes "Puzzle Adaptativo"): título, icono de la app, archivos de las versiones, página web y política de privacidad. Ver `docs/09-nombre.md`.

### Añadido
- Inglés y español: automático según el dispositivo o a elegir en Ajustes → Accesibilidad → Idioma.
- Versión web jugable en GitHub Pages (`/play/`), página de presentación y política de privacidad pública (sin anuncios).
- El flujo de publicación genera y verifica el `.aab` de Google Play.
- Ajustes → Accesibilidad: alto contraste (en tema oscuro y claro), marcas de energía en las esquinas de las piezas encendidas y velocidad de animación (normal, rápida, ninguna).

## [0.1.0-beta.5] - 2026-11-07

### Mejorado
- Rendimiento: cada aspecto de casilla se pinta una vez en una textura en lugar de redibujarse en cada fotograma (unas 6 veces menos CPU por fotograma en el reto diario).

### Añadido
- `npm run test:perf` para medir el coste de dibujar cada fotograma.

## [0.1.0-beta.4] - 2026-11-07

### Cambiado
- La vibración en modo Auto (por defecto) usa todas las vías, incluida la de alarma, y deja de depender de que el jugador elija un método.

## [0.1.0-beta.3] - 2026-11-07

### Corregido
- La app ya no se cierra al diagnosticar la vibración en Xiaomi/HyperOS: el plugin nativo captura cualquier error.

### Añadido
- Vía de vibración "Alarma" y registro del último cierre inesperado, visible en Ajustes.

## [0.1.0-beta.2] - 2026-11-07

### Añadido
- Estilo de música **Swing** (nuevo, por defecto) junto al Ambiental.
- Barra de volumen de la música (0–200 %, 100 % = estándar) y limitador de salida.
- Plugin nativo de vibración para Android con varias vías y pantalla de diagnóstico en Ajustes.
- Suite de pruebas de flujo completo (`npm run test:e2e`, `npm run test:audio`) y compilación de Android en el CI.

## [0.1.0-beta.1] - 2026-11-06

Primera beta pública: APK de Android, `.exe` de Windows y AppImage de Linux.

### Añadido
- Generador de niveles infinitos siempre resolubles (4×4 a 7×7), dificultad adaptativa y modos Relajado, Normal y Reto.
- Reto diario, racha de días, estadísticas, Chispas y pistas.
- Música generativa y efectos de sonido pentatónicos, vibración con tres intensidades y pulso de luz al ganar.
- Tema claro y oscuro, sentido de giro configurable, deshacer y reinicio instantáneo.
- Identidad visual "Filamento", icono de la aplicación y pantalla de carga.
- Versión de escritorio para Windows y Linux (Electron) y publicación automática de versiones con GitHub Actions.
