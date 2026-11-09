# Registro de cambios

Todas las versiones publicadas del juego. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones, [SemVer](https://semver.org/lang/es/). Las notas completas de cada versión están en `docs/releases/`.

## [Sin publicar]

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
