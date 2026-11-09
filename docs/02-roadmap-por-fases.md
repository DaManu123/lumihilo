# 02 · Roadmap por fases

Cada fase tiene **objetivo, tareas, entregable y criterio de salida**. No se pasa a la siguiente hasta cumplir el criterio. Las duraciones asumen ~8–10 h/semana y son orientativas.

Puedes convertir cada fase en un *Milestone* de GitHub y cada checkbox en un *Issue*.

---

## Fase 0 · Decisiones, setup y cuentas (≈1 semana)

**Objetivo:** dejar el terreno listo y arrancar los trámites que tardan.

- [ ] Elegir mecánica del MVP (recomendada: rotar tuberías) y nombre provisional
- [x] Decidir audiencia declarada: **13+** (decidido el 2026-11-09), ver `01`
- [ ] Crear repo, ramas (`main`, `dev`) y convención de commits
- [ ] Proyecto base: Vite + TypeScript + Phaser 3
- [ ] Añadir Capacitor y generar proyecto `android/`; correr "hola mundo" en un teléfono real
- [ ] Configurar Vitest y un primer test
- [ ] **Registrar cuenta de desarrollador de Google Play** (la verificación de identidad puede tardar días) y verificar acceso desde un dispositivo Android con la app Play Console
- [ ] Crear cuenta de AdMob y registrar la app (sin publicar aún)
- [ ] Redactar borrador de política de privacidad (hospedable en GitHub Pages)

**Entregable:** app "hola mundo" corriendo en navegador y en teléfono; cuentas creadas.
**Criterio de salida:** `npm run dev` y `npx cap run android` funcionan.

---

## Fase 1 · Prototipo jugable (≈1–2 semanas)

**Objetivo:** comprobar que la mecánica es divertida con un nivel fijo.

- [ ] Rejilla 4×4 con piezas dibujadas con formas simples (sin arte final)
- [ ] Tocar una pieza la rota 90° con animación corta
- [ ] Detección de victoria (todo conectado a la fuente)
- [ ] Pantalla de victoria y botón "otra vez" (aún con el mismo nivel)
- [ ] Contador de toques y cronómetro internos (aún no visibles)
- [ ] Probar con 5 personas, incluyendo alguien joven y alguien mayor, **sin explicarles nada**

**Entregable:** versión jugable en web.
**Criterio de salida:** al menos 4 de 5 personas entienden qué hacer en menos de 10 segundos. Si no, ajustar la mecánica antes de seguir.

---

## Fase 2 · Generador procedural (≈1–2 semanas)

**Objetivo:** niveles nuevos y siempre resolubles. Detalle en `03`.

- [ ] RNG con semilla (mulberry32 o similar) para reproducir cualquier nivel
- [ ] Generador por árbol de expansión aleatorio
- [ ] Parámetros: tamaño, ramas, ciclos, señuelos
- [ ] Solver/validador: confirma solución y calcula mínimo de toques
- [ ] Función de puntuación de dificultad `d(nivel)`
- [ ] Tests: 10 000 niveles por configuración → todos resolubles, ninguno nace resuelto, misma semilla = mismo nivel
- [ ] Generación en < 50 ms en un teléfono de gama baja

**Entregable:** módulo `core/` independiente de Phaser, con tests en verde.
**Criterio de salida:** la suite de tests pasa y se puede jugar una racha de niveles distintos.

---

## Fase 3 · Dificultad adaptativa, modos y accesibilidad (≈1–2 semanas)

**Objetivo:** que el juego se ajuste solo al jugador, ofrezca ergonomía de control óptima y opciones visuales inclusivas.

- [ ] Registrar por partida: tiempo, toques, pistas, abandono (local)
- [ ] Algoritmo de ajuste v1 (escalera simple) y, si hace falta, v2 (tipo Elo)
- [ ] Modos elegibles por el jugador: **Relajado / Normal / Reto**
- [ ] Opciones de accesibilidad y visuales:
  - **Modo Claro** y Modo Oscuro (conmutador rápido y persistencia en `StorageService`)
  - Alto contraste y modo daltónico (patrones visuales además de color) — hecho: *Ajustes → Accesibilidad* (alto contraste, marcas de energía en las esquinas)
  - Tamaño de piezas (el tablero ya ocupa todo el ancho disponible) y velocidad de animación (normal, rápida, ninguna) — hecho
  - Vibración on/off (háptica)
- [ ] Controles ergonómicos y rotación inversa:
  - Botón grande de **sentido de giro** (↻ horario / ↺ antihorario, cian/magenta): el toque o clic izquierdo gira las piezas hacia donde apunta la flecha; la preferencia se guarda
  - Clic derecho en web: gira en el sentido contrario al seleccionado
  - Botón accesible **Deshacer** que revierte la última jugada (también la antihoraria)
  - Los toques mínimos (`minTaps`) cuentan giros en ambos sentidos
- [ ] Tutorial guiado de 1 nivel con banner/tooltip informativo sobre los controles al comenzar
- [ ] Guardado local de progreso y preferencias (`@capacitor/preferences` en móvil, `localStorage` en web)
- [ ] Probar el ajuste con 3 tipos de jugador (niño, adulto, persona mayor) y afinar parámetros

**Entregable:** el juego sube y baja la dificultad según el desempeño, soporta modo claro/oscuro y ofrece controles cómodos.
**Criterio de salida:** en pruebas, nadie se atora más de 3 niveles seguidos sin que baje la dificultad, y nadie resuelve 5 seguidos sin que suba.

---

## Fase 4 · Pulido, economía y "enganche" (≈1–2 semanas)

**Objetivo:** que dé ganas de jugar "una más" y recompensar el avance del jugador.

- [x] Arte final simple y coherente (paleta, tipografía, icono): identidad "Filamento", ver `07`
- [x] Sonido y vibración al rotar, conectar y ganar (con opción de silencio): notas pentatónicas sintetizadas, vibración con `@capacitor/haptics`, interruptores en Estadísticas
- [x] Efecto de "energía fluyendo" al completar el circuito: pulso de luz desde la fuente con una melodía ascendente
- [x] **Sistema de estímulos y economía interna:**
  - Puntos / Chispas de energía ganadas por nivel resuelto (bonos por resolver en toques mínimos y bajo tiempo)
  - Saldo acumulativo local en `StorageService`
- [x] **Comodines y pistas inteligentes:**
  - Comodín de alineación: reorienta automáticamente la pieza mal colocada más cercana a la fuente (`src/core/hints.ts`)
  - Cuesta 10 Chispas; usar pistas quita el bono de eficiencia y cuenta para el ajuste de dificultad
- [x] **Reto diario:** semilla derivada de la fecha, idéntica para todos los jugadores
- [x] **Racha diaria** y estadísticas (mejor tiempo por tier, niveles resueltos, racha de días activos)
- [x] Progreso guardado: el jugador retoma en su último nivel y no repite niveles (semilla base propia)
- [x] Reinicio instantáneo tras ganar: botón, toque fuera de la tarjeta o Enter / Espacio

**Entregable:** versión con bucle de retención, economía interna de chispas, pistas inteligentes y reto diario.
**Criterio de salida:** en pruebas con amigos, varios piden "otra partida" sin que se les sugiera.

---

## Fase 5 · Anuncios y consentimiento (≈1 semana)

**Objetivo:** monetizar sin arruinar la experiencia ni violar políticas. Detalle en `04`.

- [ ] Crear `AdService` (interfaz) con implementaciones `WebAdService` y `NativeAdService`
- [ ] Instalar plugin de AdMob compatible con tu versión de Capacitor
- [ ] Integrar con **IDs de anuncios de prueba**
- [ ] Rewarded: "ver anuncio para obtener una pista" (con descripción clara de la recompensa)
- [ ] Intersticial: solo entre partidas, con enfriamiento y frecuencia limitada
- [ ] Flujo de consentimiento (UMP) según regiones donde se publique
- [ ] Configurar etiqueta de audiencia/clasificación de contenido de anuncios según lo decidido en Fase 0
- [ ] Web: solicitar acceso a H5 Games Ads (requiere aprobación) o, mientras tanto, anuncios de display alrededor del juego
- [ ] Revisar la lista de cumplimiento de `04` antes de cada release

**Entregable:** anuncios de prueba funcionando en Android y en web.
**Criterio de salida:** ningún anuncio aparece durante el juego, al abrir la app ni dos seguidos.

---

## Fase 6 · Build Android y pruebas cerradas (≈3 semanas calendario)

**Objetivo:** cumplir el requisito de Play Store para cuentas personales nuevas. Detalle en `05`.

> **Importante:** esta fase empieza **en cuanto exista una primera build estable** (puede ser al terminar la Fase 3 o 4) y corre **en paralelo** con las Fases 4–5. Los 14 días de pruebas cerradas son tiempo de reloj, no de trabajo.

- [ ] Generar AAB firmado (Play App Signing)
- [ ] Crear ficha de la app en Play Console (borrador)
- [ ] Declaraciones: audiencia, anuncios, seguridad de datos, clasificación de contenido
- [ ] Subir build a **pruebas cerradas** y reclutar testers (≥12, continuos 14 días)
- [ ] Mantener a los testers activos; publicar actualizaciones durante la prueba
- [ ] Recoger feedback y corregir bugs
- [ ] Al cumplirse el plazo, solicitar acceso a producción

**Entregable:** acceso a producción aprobado.
**Criterio de salida:** Play Console permite solicitar/publicar en producción.

---

## Fase 7 · Producción y versión web (≈1 semana + revisión)

- [ ] Reemplazar IDs de prueba por IDs reales de anuncios (solo en la build de release)
- [ ] Capturas, icono 512×512, gráfico de funciones, descripción corta y larga
- [ ] Publicar con **despliegue escalonado** (porcentaje creciente de usuarios)
- [ ] Publicar la versión web (GitHub Pages / Cloudflare Pages / Netlify)
- [ ] Publicar política de privacidad y enlazarla en la ficha
- [ ] Monitorear crashes y reseñas los primeros días

**Entregable:** juego público en Play Store y en la web.

---

## Fase 8 · Post-lanzamiento y Expansión (continuo)

- [ ] Revisar métricas: duración de sesión, retención, ingresos por anuncio, tasa de opt-in a recompensados
- [ ] Ajustar frecuencia de intersticiales con datos reales
- [ ] **Leaderboard Global:** integración de Google Play Games Services para competir en el Reto Diario sin servidores propios
- [x] **Tienda de ventajas cosméticas:** desbloqueo de skins y temas visuales adicionales (Cyberpunk, Matrix, Solar) usando las Chispas acumuladas (hecho: Estadísticas → Aspectos)
- [x] Segundo módulo de puzzle: **Luces** (`src/core/lights.ts`, `src/core/puzzles.ts`; se elige en Estadísticas → Puzzle)
- [ ] Opción "quitar anuncios" con compra única (Google Play Billing)
- [ ] ~~Evaluar iOS~~ (descartado por ahora: no hay Mac ni dispositivo para probarlo; se retoma si cambia)
- [ ] Localización (español/inglés al menos)

---

## Riesgos principales

| Riesgo | Mitigación |
|---|---|
| Los 12 testers abandonan y se reinicia el plazo | Reclutar 15–20, avisarles del calendario, recordatorios semanales |
| Suspensión de AdMob por prácticas de anuncios | Seguir la lista de `04`, nunca hacer clic en tus propios anuncios, usar IDs de prueba |
| El puzzle se siente genérico | Prototipar rápido (Fase 1) y invertir en "juice" y arte (Fase 4) |
| Dificultad mal calibrada | Probar con gente real de distintas edades en Fase 3 y registrar métricas |
| Alcance que crece sin parar | Nuevas ideas van a la Fase 8; el MVP es una mecánica |
