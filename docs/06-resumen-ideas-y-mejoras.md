# 06 · Resumen de ideas, decisiones y mejoras

Documento de referencia rápida. Resume lo conversado después del plan inicial (octubre de 2026). Los detalles técnicos viven en `01`–`05`.

## 1. Dirección del juego

| Tema | Decisión vigente | Estado |
|---|---|---|
| Género | Puzzle casual, partidas de 30–90 s, un puzzle nuevo generado por partida | Decidido |
| Mecánica MVP | Rotar piezas para conectar un circuito (generado desde un árbol de expansión; solución garantizada) | Validado con éxito (Fase 1 y 2) |
| Temática | **Circuitos de luz / flujo neón** sobre fondo oscuro minimalista, con opción de **Modo Claro** | Validado |
| Dificultad | Adaptativa al comportamiento del jugador, no a su edad; modos Relajado / Normal / Reto | Decidido |
| Plataformas | Web + Android (Phaser 3 + TypeScript + Vite + Capacitor) | Decidido |
| Monetización | Anuncios: recompensados (pistas/chispas), intersticiales entre partidas, banner solo en menús | Decidido |

La temática es una "capa de piel": el código se diseña para que colores y sprites se puedan cambiar sin tocar la lógica (`src/game/theme.ts`). Así no se pierde trabajo si el prototipo sugiere otra estética.

## 2. Mejoras de "juice" (el factor que engancha)

- **Audio pentatónico:** cada rotación toca una nota de una escala pentatónica; al completar el circuito suena un acorde. Siempre con botón de silencio. En web, el audio solo se activa tras el primer toque del usuario.
- **Háptica:** micro-vibración al encajar una pieza y una pulsación más marcada al ganar. Opcional en ajustes.
- **Brillo (bloom):** preferir sprites con brillo pregenerado y mezcla aditiva; el bloom en tiempo real puede ser pesado en teléfonos de gama baja, así que debe ser opcional.
- **Efecto de energía fluyendo** al completar el circuito.
- **Reto diario** (misma semilla para todos) y **racha diaria**.

Todo esto va en la **Fase 4**. No se invierte en bloom ni audio hasta confirmar en la Fase 1 que la mecánica engancha con piezas feas.

## 3. Accesibilidad (por si juegan adolescentes, adultos y personas mayores)

- Piezas con área táctil de al menos 48 dp; máximo 6×6 o 7×7 en modos Relajado y Normal.
- Alto contraste opcional (el neón puede cansar o dificultar la lectura).
- No depender solo del color: añadir patrones o formas (daltonismo).
- Evitar destellos rápidos: nada que parpadee más de 3 veces por segundo.
- Sin cronómetro obligatorio; velocidad de animación ajustable.

## 4. Audiencia y privacidad (correcciones importantes)

- **Decisión provisional: declarar 13+** en Play Console (grupos de edad 13–15, 16–17 y 18+; verificar las opciones vigentes al llenarlo).
- La declaración debe ser **honesta**: declarar 13+ significa no dirigir el juego ni su promoción a menores de 13. La dificultad adaptativa sigue funcionando igual.
- Si algún día se incluyen menores de 13, aplica la política de Familias (SDKs de anuncios certificados, inventario más reducido). Por eso se mantiene el diseño sin datos personales propios.
- **No decir "privacidad total".** Lo correcto: *"sin cuentas ni datos personales propios"*. El SDK de anuncios (AdMob) recoge datos como el ID de publicidad, así que hacen falta:
  - política de privacidad pública,
  - formulario de seguridad de datos en Play Console,
  - flujo de consentimiento (UMP) donde corresponda.
- **No afirmar "sin fricciones legales"**: las políticas de anuncios aplican igual con 13+.

## 5. Anuncios: reglas que no se rompen

- Intersticial solo en la pantalla de resultado, nunca al abrir la app ni durante el puzzle, nunca dos seguidos, con frecuencia limitada y enfriamiento.
- Recompensado siempre voluntario, con descripción clara ("Ver un anuncio para obtener 1 pista"), y que se pueda cerrar.
- Banner solo en menús, nunca pegado al tablero (riesgo de toques accidentales).
- Nunca hacer clic en los propios anuncios; usar IDs de prueba hasta la build de release.
- Web: H5 Games Ads (Ad Placement API) **requiere aprobación**; plan B con anuncios alrededor del juego.
- No hay cifras de ingresos prometidas: se mide impresiones, opt-in a recompensados y eCPM real.

## 6. Arquitectura (tres capas)

| Capa | Contenido | Regla |
|---|---|---|
| `src/core/` | TypeScript puro: RNG con semilla, generador, solver, dificultad | No conoce Phaser ni la pantalla; se prueba con Vitest |
| `src/game/` | Phaser 3: escenas, tweens, partículas, audio, tema visual | Solo presentación |
| `src/services/` | `StorageService`, `AdService`, `HapticService` con adaptadores web y nativos | El juego nunca llama directo a AdMob/Capacitor |

Matices acordados:

- La meta de pruebas es cubrir **invariantes** (todo nivel es resoluble, misma semilla = mismo nivel, etc.), no "100 % de cobertura".
- La interfaz `PuzzleModule` **se difiere**: con una sola mecánica es fácil abstraer mal. Se extrae cuando exista un segundo tipo de puzzle (Fase 8). Mantener `core/` separado ya da lo necesario.

## 7. Nombre y marca

Resultados de buscar en Play Store (con el filtro "Este dispositivo" activo):

| Nombre | Qué apareció | Veredicto |
|---|---|---|
| **Lumen Loop** | "Lumen Loop: Puzzle de luz" (Rui Codex, Habilidad mental), otro "Lumen Loop" (Palabras) y "Lumen Loom" (Casuales, 5 K+) | ❌ **Descartado**: choca directo con un puzzle de luz |
| **Synapse Flow** | "Synapse Flow" (lykangfan, Casuales) | ❌ **Descartado**: ya existe un juego casual con ese nombre |
| **Zen Circuit** | Sin coincidencia exacta en los primeros resultados; salen apps de electrónica, educación y música llamadas "Circuit ..." | ⚠️ **Candidato con riesgos** (ver abajo) |

Riesgos de **Zen Circuit**:

- Se mezcla en las búsquedas con apps educativas y de electrónica; quien busque "circuit" puede esperar otra cosa.
- "Zen" es muy común en nombres de juegos de puzzle.
- El filtro "Este dispositivo" oculta apps no compatibles con tu teléfono; hay que repetir la búsqueda en la web de Play Store sin ese filtro.
- Falta revisar marcas registradas (IMPI en México; USPTO/EUIPO si se publica globalmente), la App Store y la disponibilidad de dominio.

Alternativas por explorar (**ninguna verificada**, hay que buscarlas igual): Glowline, Pulseweave, Arcway, Voltrail, Wirelight.

Reglas prácticas:

- Mientras tanto se usa un **nombre de trabajo** (antes el repo se llamaba `puzzle-adaptativo`; ahora `lumihilo`).
- El nombre visible va en una sola constante (`APP_NAME`), así cambiarlo es trivial.
- ⚠️ El **identificador del paquete** de Android (`appId`) **no se puede cambiar una vez publicada la app en Play Store**. En Fase 0 se usa uno provisional; el definitivo se fija **antes de subir la primera build a Play Console**.

## 8. Calendario crítico de Play Store

- Cuenta personal nueva: prueba cerrada con **al menos 12 testers durante 14 días continuos** antes de pedir producción (requisito por app).
- No pausar la pista de pruebas cerradas: reinicia el plazo. Reclutar 15–20 personas para tener colchón.
- Registrar la cuenta (25 USD, pago único, verificación de identidad y de dispositivo Android) **ya**, porque los plazos de verificación varían.
- Revisar qué datos de contacto se hacen públicos en la ficha de la app.
- Los 14 días corren **en paralelo** con las Fases 4–5.

## 9. Qué se hace ahora y qué se difiere

| Ahora (Fase 0) | Después |
|---|---|
| Repo + rama `dev`, Vite + TS + Phaser 3 + Vitest + Capacitor, "Hola Mundo" en navegador y en teléfono | Generador y solver (Fase 2) |
| Estructura `core/ game/ services/` con interfaces y adaptadores *noop* | Dificultad adaptativa (Fase 3) |
| Constantes de nombre, tema y `appId` provisional | Audio, háptica, bloom, reto diario (Fase 4) |
| Borrador de política de privacidad | AdMob real y consentimiento (Fase 5) |
| Cuentas de Play Console y AdMob (tarea humana) | Build firmada y pruebas cerradas (Fase 6) |
| Decisiones documentadas en README y `01` | `PuzzleModule`, segundo puzzle, iOS (Fase 8) |

## 10. Feedback de Playtesting y Asignación de Mejoras (Octubre 2026)

Tras probar el prototipo con usuarios reales, surgieron 4 sugerencias clave para potenciar la comodidad, rejugabilidad y retención. Para evitar sobrecargar el desarrollo y mantener entregas incrementales sólidas, se asignan a las siguientes fases:

| Sugerencia | Análisis UX / Técnico | Fase Asignada |
|---|---|---|
| **1. Modo Claro** | Mayor legibilidad en exteriores y alivio para usuarios con astigmatismo/fatiga visual. Se resuelve con paleta de alto contraste en `theme.ts` (fondo marfil/blanco puro con trazos azul cobalto y neón suave) y guardado en `StorageService`. | **Fase 3** (Accesibilidad y Opciones) |
| **2. Rotación Inversa & Control** | *Riesgo del doble tap en móvil:* añade latencia (250 ms) y provoca toques accidentales cuando el usuario juega rápido. <br>**Solución superior:** <br>• **Web:** Clic derecho = rotar antihorario (-90°). <br>• **Móvil/Web:** Botón flotante accesible **"Deshacer" (Undo)** para revertir el último giro al instante. <br>• **Tutorial inicial:** Notificación/tooltip sutil al arrancar el primer puzzle explicando los controles. | **Fase 3** (Controles, Accesibilidad y Tutorial) |
| **3. Estímulos, Economía y Pistas/Comodines** | • **Moneda blanda (Chispas / Lumen Sparks):** Se ganan al completar puzzles (bonus por eficiencia/tiempo). <br>• **Comodines (Pistas):** Corrige/fija una pieza desalineada (usando `solver.ts`) o ilumina el flujo de la fuente. <br>• **Bucle con anuncios:** En Fase 5, ver un anuncio recompensado otorga comodines o chispas de inmediato si el jugador se queda sin saldo. <br>• **Tienda cosmética:** En Fase 8, las chispas permiten desbloquear temas visuales adicionales (Cyberpunk, Matrix, Solar). | **Fase 4** (Sistema de pistas y economía local) → **Fase 5** (Recompensas con anuncios) → **Fase 8** (Tienda cosmética) |
| **4. Leaderboard Global** | *Dilema:* Los puzzles procedurales tienen diferente complejidad por semilla, y un backend propio violaría la regla de "sin servidores/cuentas ni costes fijos". <br>**Solución:** <br>• Vincular la competencia global al **Reto Diario (Daily Challenge)** de la Fase 4 (misma semilla para todos cada día). <br>• Tabla global gestionada mediante **Google Play Games Services** (sin contraseñas, gestionado por Google, seguro y sin backend propio). | **Fase 4** (Reto Diario & Récords locales) → **Fase 8** (Integración global con Play Games) |

