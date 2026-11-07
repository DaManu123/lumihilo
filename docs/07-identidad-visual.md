# 07 · Identidad visual: "Filamento"

> Estado: aplicada en la Fase 4 (issue #30). Los valores viven en `src/game/theme.ts`; los tamaños, en `src/game/layout.ts`.

## Idea

La energía es la **luz incandescente de un filamento**. Lo apagado son trazas frías grabadas en vidrio oscuro; lo encendido es calor blanco-ámbar. Cuando el jugador completa el circuito, la luz recorre el tablero desde la fuente: es el momento que la interfaz protege y subraya. Todo lo demás es discreto.

Se descartaron a propósito el cian y magenta "neón" sobre negro azulado (el cliché cyberpunk, con los colores del modo oscuro de GitHub) y las cajas con borde fino idénticas.

## Color

| Rol | Noche (oscuro) | Papel (claro) |
|---|---|---|
| Fondo | `#0B1026` | `#E8EDF5` |
| Vidrio (casillas, barras, tarjetas) | `#151C3D` | `#FFFFFF` |
| Traza apagada | `#5C6699` | `#8591B8` |
| Filamento (energía, acciones principales) | `#FFB938` | `#C23D05` |
| Núcleo blanco-caliente | `#FFF1CF` | `#FFC79A` |
| Fuente de energía | `#FF6F91` | `#7B3FE4` |
| Giro horario / antihorario | `#7CC8FF` / `#C9A0FF` | `#1668C9` / `#B02A8B` |
| Texto / texto atenuado | `#ECEAF6` / `#9AA3CC` | `#14204A` / `#4A5578` |

Los contrastes mínimos están protegidos por `tests/theme.test.ts`: texto ≥ 7:1, texto atenuado ≥ 4,5:1, formas de interfaz (trazas, filamento, fuente, sentido de giro) ≥ 3:1 y texto sobre botones rellenos ≥ 4,5:1.

## Reglas

- **No depender solo del color:** los cables apagados son más finos que los encendidos; los encendidos llevan halo y núcleo brillante; la fuente es más grande y con anillo; el sentido de giro se indica con la forma de la flecha además del color.
- **Un solo elemento destacado:** el filamento. Hay un único botón con velo de color (el sentido de giro) y un único botón relleno por tarjeta (la acción principal).
- **Iconos dibujados** (`src/game/icons.ts`), no emojis: los emojis cambian según la marca del teléfono.
- **Textos en minúscula inicial de frase, sin jerga:** el jugador no ve "Tier", "Rating" ni "Dificultad 23.5". Esos datos viven en la pantalla de estadísticas ("Nivel de habilidad", "Puntuación").
- **Movimiento mínimo:** un único pulso de luz al ganar, giros de 170 ms y el aviso de sentido. Respeta `prefers-reduced-motion`. Nada parpadea.
- **Tamaños táctiles:** botones ≥ 48 dp y texto ≥ 13 dp, verificado en `tests/layout.test.ts`.

## Tipografía

- **Unbounded** (variable): título, números y botones principales. Ancha y rotunda, como un letrero luminoso. Los números van siempre en esta fuente.
- **Atkinson Hyperlegible Next** (variable): todo el resto. Diseñada por el Braille Institute para ser legible por personas de todas las edades, en línea con el pilar de accesibilidad. Dibuja el cero tachado, por eso los números no usan esta fuente.

Ambas se instalan como paquetes (`@fontsource-variable/*`) y viajan dentro de la app, así que funcionan sin conexión. `src/main.ts` espera a que carguen antes de crear el juego, porque Phaser dibuja el texto una sola vez.

## Sonido y vibración

- **Todo el sonido se sintetiza** (`src/services/AudioService.ts`): no hay archivos de audio, así que pesa cero y funciona sin conexión. Cada nota es un seno con un triángulo una octava arriba (timbre de cristal) y un eco corto.
- **Escala pentatónica mayor** (do, re, mi, sol, la): cualquier combinación suena consonante, así que jugar rápido o al azar nunca suena disonante. Cada casilla tiene su nota según su posición (`src/core/sound.ts`).
- **Eventos:** girar (nota de la casilla), conectar (campanita más aguda), deshacer (nota suave), pista (campanita de dos notas), rechazo (nota grave), victoria (melodía ascendente con el pulso de luz y acorde final).
- **Música de fondo generativa** (`src/core/music.ts`, `src/services/MusicService.ts`): un tema ambiental a 76 BPM que nunca suena exactamente igual (la semilla cambia en cada sesión). Un colchón suave, un bajo y una arpa de cristal sobre una progresión de cuatro compases (do add9, la menor 7, sol sus, re sus), siempre empezando en do. **Todos los acordes usan solo las cinco notas de la escala del juego**, así que cualquier efecto que toque el jugador es consonante con la música, suene el acorde que suene (verificado por tests).
- **La música reacciona a la partida:** cuanto más circuito está encendido, más notas de arpa entran; al ganar, la música se serena y resuelve en un acorde de do abierto.
- **Mezcla medida** en navegador: la música queda en torno a −35 dBFS de volumen medio, unos 5 dB por debajo de los efectos, como colchón que no los tapa. Se pausa sola cuando la app pasa a segundo plano.
- **Vibración** con `@capacitor/haptics` usando pulsos de **potencia plena** del motor (los efectos predefinidos "ligero" y "medio" de Android usan solo el 43 % y el 70 % de potencia y en muchos teléfonos apenas se notan). La intensidad (suave, normal o fuerte) se regula por duración: 15 / 25 / 40 ms al girar y 28 / 45 / 70 ms al conectar; la victoria es un patrón de pulsos (`src/core/haptics.ts`).
- **Ajustes** (Estadísticas → Ajustes): efectos, música, vibración e intensidad de la vibración, cada uno por separado. El audio solo arranca tras el primer toque (regla de los navegadores).

## Icono y pantalla de carga

- El icono es la casilla de vidrio con un cable en T encendido y la fuente rosa: el juego en una imagen. Se genera como imagen vectorial y se exporta a todas las densidades de Android (adaptativo, clásico y redondo).
- `docs/store/icon-512.png` es el icono de Google Play (512 × 512) y `public/favicon.svg` el de la web.
- La pantalla de carga es el fondo azul noche con el logo centrado (`res/drawable/splash.xml`): ya no se deforma en teléfonos alargados.

## Pendiente

- La landing (`docs/landing/`) todavía usa su propia paleta.
- Gráfico de funciones de la ficha de Play (1024 × 500) y capturas (issue #54).
