# Ficha de Google Play · Lumihilo

Recursos listos para subir a Play Console (Presencia en Play Store → Ficha de la tienda principal).

| Recurso | Archivo | Medida |
|---|---|---|
| Icono | `icon-512.png` | 512×512 |
| Gráfico de funciones | `grafico-de-funciones-1024x500.png` | 1024×500 |
| Capturas de teléfono | `capturas/01…13-*.png` | 1080×2160 (relación 2:1) |

Las capturas se generan del juego real con `npm run build && node e2e/store.mjs` (necesita Chromium de Playwright, ver `docs/08`). El gráfico se compone con `grafico/feature.html`; si cambia el diseño del juego, hay que regenerar ambos.

Capturas de Hilos: `11-hilos` (partida a medias, Filamento), `12-hilos-oceano` (aspecto Océano) y `13-hilos-victoria` (resultado «Todo unido»). Play admite como máximo **8** capturas de teléfono: hay 13, así que hay que elegir. Propuesta: 01, 08, 11, 02, 03, 12, 07 y 05 (un puzzle de cada tipo, reto diario, victoria y tienda de aspectos). Regenerar con `store.mjs` reescribe todas (cambian el reloj y las Chispas de cada una); conviene versionar solo las que cambien de verdad.

## Español (predeterminado)

**Título (máx. 30):** Lumihilo

**Descripción corta (máx. 80):**
Tres puzzles de luz: conecta, enciende y une. Uno nuevo en cada partida.

**Descripción completa:**
Lumihilo reúne tres puzzles de luz. Conecta circuitos, enciende tableros y une parejas de puntos con un hilo de luz, en partidas de menos de un minuto.

• Tres puzzles: Circuitos (gira las piezas y conecta todo), Luces (enciende todo el tablero) y Hilos (une las parejas de puntos con un hilo de luz).
• Un puzzle distinto en cada partida, siempre con solución.
• La dificultad se ajusta a tu forma de jugar, no a tu edad: ni aburrido ni frustrante.
• Partidas cortas: cabe en un descanso o en el camino.
• Reto diario: el mismo puzzle para todos, cada día.
• Pistas con Chispas, que ganas jugando.
• Cinco aspectos extra que se desbloquean con las Chispas: Cyberpunk, Matrix, Océano, Solar y Aurora.
• Tema oscuro y claro, alto contraste y animaciones ajustables.
• Música, efectos y vibración que puedes apagar o regular.
• En español e inglés.
• Sin cuentas, sin anuncios y sin recopilar datos personales.

Fácil de entender en cinco segundos y difícil de soltar.

## English

**Title:** Lumihilo

**Short description:**
Three light puzzles: connect, switch on and join. A new one every game.

**Full description:**
Lumihilo brings together three light puzzles. Connect circuits, light up boards and join pairs of dots with a thread of light, in games that last under a minute.

• Three puzzles: Circuits (rotate pieces and connect everything), Lights (light up the whole board) and Threads (join pairs of dots with a thread of light).
• A different puzzle every game, always solvable.
• Difficulty adapts to how you play, not to your age: never boring, never frustrating.
• Short games: fits a break or a commute.
• Daily challenge: the same puzzle for everyone, every day.
• Hints paid with Sparks, which you earn by playing.
• Five extra skins unlocked with Sparks: Cyberpunk, Matrix, Ocean, Solar and Aurora.
• Dark and light themes, high contrast and adjustable animations.
• Music, sound effects and vibration you can turn off or adjust.
• In Spanish and English.
• No accounts, no ads and no personal data collected.

Easy to learn in five seconds, hard to put down.
