# CLAUDE.md — Lumihilo

Guía para retomar el trabajo. Todo lo de aquí se comprobó contra el repositorio el 2026-11-09 (versión **0.2.0-beta.8**). El usuario escribe en español: responde y documenta en español.

## 1. Descripción
**Lumihilo** (antes «Puzzle Adaptativo»; significado del nombre en `docs/09-nombre.md`) es un juego de puzzle casual para **Android, web y escritorio (Windows/Linux)**. Cada nivel se genera por algoritmo (siempre resoluble) y la dificultad se adapta al nivel real del jugador, no a su edad. Audiencia: **13+**, partidas de 30–90 s. Hay **3 puzzles**:
- **Circuitos** (el original): girar piezas hasta conectar todo a la fuente.
- **Luces**: tocar una casilla cambia su luz y la de sus 4 vecinas; encender todo. Con **piedras** (casillas bloqueadas) desde habilidad 3.
- **Hilos**: arrastrar para unir parejas de puntos del mismo color sin que se solapen hilos (cortar el de otro lo borra por ahí). Ganar = unir todas las parejas (no hace falta llenar el tablero).

Economía: moneda **Chispas** (ganar niveles; pistas cuestan 10; tienda de **6 aspectos**: Filamento gratis, Cyberpunk 150, Matrix 350, Océano 550, Solar 800, Aurora 1000). Cada aspecto equipado da un bonus de Chispas por nivel: +5/10/15/20/25 % (Cyberpunk…Aurora; sin publicar, beta.9). Cada puzzle tiene nivel, récords y **reto diario** propios. Localización ES/EN.

Repo: `DaManu123/lumihilo` (público). Web: https://damanu123.github.io/lumihilo/

## 2. Stack y arquitectura
TypeScript 7 + Vite 8 + **Phaser 3.90** + Vitest 5 · Capacitor 8 (Android) · Electron en `desktop/` (carpeta aparte con su `package.json` para que `npm install` no descargue Electron) · Playwright para e2e (`e2e/`, con su propio `package.json`).

Tres capas estrictas:
- `src/core/` — **TypeScript puro** (sin Phaser/DOM/Capacitor), probado en Node. RNG `mulberry32` (`rng.ts`), generadores y solvers (`generator.ts`, `solver.ts`, `lights.ts`, `flow.ts`), dificultad (`adaptive.ts`), progreso/Chispas/retos (`progress.ts`), `puzzles.ts` (tipo `PuzzleType`, claves de récord), `skins.ts`, `updates.ts`, `i18n.ts` (tabla `EN`; el español es la clave), música/sonido (`music.ts`, `musicSwing.ts`, `sound.ts`).
- `src/game/` — Phaser: `scenes/GameScene.ts` (~3300 líneas, TODA la interfaz y el juego), `theme.ts` (paletas + `SKIN_STYLES`), `skinArt.ts` (formas y fondos por aspecto), `flowArt.ts`/`flowColors.ts`/`flowLooks.ts` (Hilos: dibujo, paleta y estado visual puro), `layout.ts` (lienzo de 720 px de ancho lógico y alto variable), `icons.ts`.
- `src/services/` — adaptadores: `StorageService` (ajustes `user_settings`, `player_progress`, `profile_adaptive` en localStorage/Preferences), `FeedbackService` (sonido + vibración + música), `AudioService`, `MusicService`, `HapticService`, `UpdateService`. **El juego nunca llama directo a Capacitor.**
- `android/` (plugin Java `GameHapticsPlugin`: vibración y `openUrl`), `desktop/main.js` (Electron), `docs/` (ver `docs/08-publicar-versiones.md`, `docs/10-economia-chispas.md`, `docs/store/`), `.github/workflows/` (`ci.yml`, `release.yml`, `pages.yml`).

Piezas clave:
- Las casillas se **pintan una vez en texturas** (`ensureCellTexture`, claves por tema|hc|aspecto|tamaño) porque un `Graphics` de Phaser se re-tesela en cada fotograma. No dibujar casillas con `Graphics` vivo.
- `GameScene` ramifica por `this.puzzle` (`'circuits' | 'lights' | 'flow'`): carga (`loadLevel`→`loadLightsLevel`/`loadFlowLevel`), dibujo (`drawCell`), pista (`useHint`→`useLightsHint`/`useFlowHint`), deshacer, victoria (`evaluateVictory`), panel de progreso (`renderDirectionButton`), tutorial por puzzle. Hilos se juega arrastrando: un `zone` único en el tablero + `pointermove/up` de escena (`flowPointerDown/Move/Up`).
- Daily: `isDaily` es independiente del puzzle; semillas `dailySeed`/`dailyLightsSeed`/`dailyFlowSeed` y fecha de «hecho hoy» por puzzle (`lastDailyOf`, `levelOf`, `withLevel` en `progress.ts`).
- Música: pista según puzzle en `WebMusicPlayer.track` (Circuitos = estilo elegido Swing/Ambiental; Luces = «cristal» caja de música; Hilos = «hilo» cuerda pulsada). Todo en escala pentatónica.
- Actualizaciones: `UPDATE_SOURCE` (`'github'|'play'`) se decide **al compilar** (`UPDATE_SOURCE=play`, `npm run build:play`). `releases.json` en Pages (lo regenera `pages.yml`) con la API de GitHub de respaldo. Web nunca consulta.
- Debug: `?debug` en la URL expone `window.__game` (lo usan los e2e); `?debug&update` habilita el aviso de versión en web.

## 3. Comandos (desde la raíz)
```bash
npm ci                    # instalar (si node_modules viene de Windows y rompe: rm -rf node_modules && npm ci)
npm run dev               # desarrollo (Vite, puerto 3000)
npm run typecheck         # tsc --noEmit (strict, noUnusedLocals)
npm test                  # unitarias (Vitest): 450 pruebas
npm run build             # tsc + vite build → dist/
npm run build:play        # build con UPDATE_SOURCE=play
npm run cap:sync          # build + cap sync android (necesario al cambiar plugins)
npm run test:e2e          # navegador (Playwright, ~9-12 min, 185 comprobaciones). Compila solo.
npm run test:audio        # mide volumen/pico en dBFS de música y efectos
npm run test:perf         # CPU por fotograma (requiere ?debug)
```
- e2e: los 21 escenarios de `e2e/game.mjs` son independientes y corren **3 a la vez, cada uno con su propio Chromium** (`E2E_JOBS=1` los pone en serie, ~33 min; `E2E_ONLY=18,19` corre solo esos; `--no-build` salta la compilación). Con 4 o más a la vez, o con un solo navegador compartido, el WebGL por software se atasca y salen timeouts. Chromium arranca con SwiftShader explícito (el doble de rápido) y `openGame` usa escala 1 (`scale: 2` solo en `store.mjs`). Cada escenario imprime su salida entera con su duración al terminar. Al añadir uno: va en `sections.push([...])`, sin estado compartido con otros, y esperas por condición en vez de tiempos fijos (con carga todo tarda más).
- e2e: el puerto **4173 debe estar libre**; no lanzar dos pasadas a la vez ni `npm run build` mientras corre una (cambia `dist/`). Lanzarlas en segundo plano y esperar el aviso. Resultado: línea `Resumen: N/N comprobaciones correctas`.
- Capturas de la tienda: `npm run build && node e2e/store.mjs` → `docs/store/capturas/`. Aspecto de un skin: `node e2e/skins-look.mjs <carpeta>`.
- Escritorio local: `npm run build`, luego `cd desktop && npm install && npm start`.

**Publicar una versión** (detalle en `docs/08-publicar-versiones.md`): en `dev` subir versión en `package.json` y `desktop/package.json` (`npm version X --no-git-tag-version` en ambos), escribir `docs/releases/vX.md` y la entrada del `CHANGELOG.md`, commit `release: vX`, PR `dev`→`main` (`gh pr create` / `gh pr merge --merge`, tras CI verde), y **después** etiquetar el commit de `main` (`git tag vX && git push origin vX`). El tag dispara `release.yml` (APK firmado, AAB, Windows, Linux, pruebas de humo, y comprueba que el APK lleve el aviso de GitHub y el AAB no). Numeración actual: **`0.2.0-beta.N`** (para evitar el orden raro de GitHub con `beta.10`). El usuario autoriza cada beta con frases tipo «fusiona y saca la beta.N».

## 4. Convenciones
- Todo en español (UI, comentarios, commits, docs). Textos de usuario con `t('frase en español')`; **toda frase nueva necesita su entrada en `EN` de `src/core/i18n.ts`** (`tests/i18n.test.ts` lo exige; sin interpolación `${}` dentro de `t()`).
- Sin emojis en la UI (iconos en `icons.ts`); números en tipografía Unbounded, resto Atkinson Hyperlegible Next. Textos ≥ 24 px lógicos, botones ≥ 88 px lógicos (≥ 48 dp). No depender solo del color. Respetar reducción de movimiento (`reducedMotion()`/`this.dur()`).
- Color/tema solo vía `THEME`/`getTheme`; tokens nuevos llevan test de contraste (`tests/theme.test.ts`, `tests/flowColors.test.ts`). Aspectos: añadir en `skins.ts`, `SKIN_COLORS`+`SKIN_STYLES` (`theme.ts`) y `skinArt.ts`; revisar claro, oscuro y alto contraste.
- Lógica nueva de juego va en `src/core/` con pruebas; `GameScene` solo la presenta. Todo nivel generado debe ser **siempre resoluble** (se genera desde la solución).
- Commits y PR terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` / `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Trabajar en `dev`, nunca push directo a `main`; `git push origin v*` está permitido.
- Excepciones de plugins nativos: capturar siempre `Throwable` (un error no capturado cierra la app).
- Cambios de audio: volver a medir con `npm run test:audio` (música ≈ −36…−39 dBFS rms, picos < −3 dBFS).
- **Evitar**: `pkill -f` con texto que aparezca en el propio comando (mata la shell, código 144); fusionar sin CI verde; subir `UPDATE_SOURCE='play'` al APK de GitHub (lo hace el flujo, no a mano); `Graphics` vivos para casillas; editar `package.json` a mano sin subir también `desktop/package.json`.

## 5. Decisiones técnicas
- **iOS descartado** (sin Mac ni dispositivo). **Anuncios y cuentas pospuestos** (Fase 5; #7, #8). Nada de «privacidad total» (AdMob recogería IDs si algún día se añade).
- **appId definitivo `com.damanu.lumihilo`** desde la beta.7 (las betas 1–6 usaban otro; el progreso no se traslada). No cambiable tras publicar.
- Segundo puzzle = Luces (eligió el usuario entre 3 opciones); tercero = Hilos (eligió entre Hilos/Espejos/Mareas; descartados Espejos y Mareas, quedan como ideas).
- Hilos: nivel = camino hamiltoniano aleatorio («backbite») cortado en tramos de ≥3 casillas; ganar = unir parejas (sin obligar a llenar → más accesible). Un toque sobre un hilo unido no lo borra (el trazo es «perezoso»: no cambia nada hasta que el dedo se mueve).
- Dificultad (parte 4 del plan beta.9, sin publicar): **un perfil adaptativo por puzzle** (`profile_adaptive` = Circuitos, `profile_adaptive_lights`, `profile_adaptive_flow`; los que no existen heredan modo y peldaño del de Circuitos). Tablas propias de 10 peldaños en `adaptive.ts` (Circuitos), `lights.ts` (hasta 7×7, ~27 toques mínimos en el 10, antes ~13) y `flow.ts` (hasta 8×8 y 8 hilos; el 9 y el 10 son iguales porque solo hay 8 colores). Sube con 3 victorias seguidas (antes 5) y una victoria dominante tras otra salta 2 peldaños. `effectiveTier()` aplica el modo (Relajado ≤3, Reto ≥5) también a Luces e Hilos.
- Luces: Gaussian GF(2) para mínimo de toques y pista; las piedras se excluyen del sistema.
- Economía modelada por ritmo de juego en `tests/economy.test.ts` (perfiles 52/153/437 Chispas al día) y documentada en `docs/10-economia-chispas.md`; Aurora a 1000 obligó a relajar límites (habitual ≤ 21 días, ocasional ≤ 56).
- Aviso de versión: cada apertura completa de la app mientras haya una más nueva (antes una vez por versión; no apareció en el teléfono del usuario con la API de GitHub, por eso `releases.json` + botón «Buscar actualizaciones»). El usuario ha probado las betas posteriores sin reportar fallos en el aviso, pero conviene confirmarlo explícitamente con la beta.8.
- Música propia por puzzle (Luces/Hilos) en vez de opción del jugador; pista sonora de Circuitos sigue siendo elegible.
- Clave de firma de las betas fuera del repo (`~/.puzzle-adaptativo-signing/`); Play usará Play App Signing con clave de subida propia (por crear).

## 6. Estado actual
**Hecho y publicado** (betas 0.2.0-beta.1…8 en GitHub Releases; beta.8 = Hilos + música de cuerda): 3 puzzles, 6 aspectos, tienda de Chispas, retos diarios por puzzle, tutoriales animados de Luces y Hilos, aviso de actualización, ES/EN, store assets (10 capturas 1080×2160 + gráfico de funciones en `docs/store/`), política de privacidad (es/en), flujo de Release con AAB `'play'`. Pruebas: 431 unitarias, 181 e2e, audio y rendimiento OK.
**Probado por el usuario en teléfono (POCO F6, Samsung A05) hasta la beta.7**; la **beta.8 (Hilos) aún no se ha probado con un dedo real**.
**Descartado**: iOS, anuncios/cuentas por ahora, Espejos/Mareas como tercer puzzle.

## 7. Pendientes (por prioridad)
1. **Retomar aquí:** el usuario probará la beta.8 en el teléfono. Esperar su feedback sobre Hilos: control táctil (arrastre rápido/diagonal, cortes accidentales), dificultad/tamaño, música de cuerda. Ajustar lo que diga (probable: sensibilidad del trazo en `flowPointerMove`, `flowStepsTo`).
2. Tareas **del usuario** (bloquean Play): cuenta de Play Console (#7), clave de subida (#46; pasos en `docs/store/play-console.md`), reintentar búsqueda de marca en el IMPI, reclutar ≥12 testers para prueba cerrada de 14 días (#49).
3. Capturas de la tienda con Hilos: hechas (11-13). Falta elegir las 8 que se suben a Play (propuesta en `docs/store/ficha.md`) y, si se quiere, versión en inglés.
4. Ideas: leaderboard del reto diario (Google Play Games; requiere cuentas → pospuesto), nuevos aspectos, refactor de `GameScene.ts` (extraer lógica por puzzle), 4.º puzzle (Espejos/Mareas).
5. Al publicar en Play: usar el AAB `aab-android` de Actions (ya sale con `'play'`), revisar política de privacidad (`docs/politica-de-privacidad.md`, `landing/`).

## 8. Problemas conocidos y puntos delicados
- **Docs:** `README.md`, `PROJECT_CONTEXT.md` (histórico de las fases 0-4), `docs/05` y `docs/store/play-console.md` se pusieron al día el 2026-11-09. El plan de trabajo vigente está en `docs/11-plan-beta9.md`.
- **Caídas de GitHub Actions:** la Release falló alguna vez con 504 al descargar herramientas de `electron-builder-binaries` o por un incidente de Actions («workflow file issue»); se repite con `gh run rerun <id> --failed` (o sin `--failed`). Tras una Release, `releases.json` tarda unos minutos (workflow «Publicar la web»); borrar una Release no lo regenera (`gh workflow run pages.yml --ref main`).
- **Nombres confusos:** en `GameScene`, `updateFlowVisuals`/`flowState`… mezclan «flujo de energía» de Circuitos con el puzzle **Hilos** (`puzzle==='flow'`, `src/core/flow.ts`). `Scene.lights` choca con Phaser (por eso el campo es `lightGrid`).
- **e2e frágiles ante el reloj:** el reloj del juego va más lento que el real en headless; esperar con `settle()`/3 s tras ganar. Si una pasada sale con pocas comprobaciones, repetir (una pasada en serie del 2026-11-09 dio solo 139 de 184 sin que se viera el motivo: con el reparto en escenarios, cualquier interrupción sale como FALLA con su nombre).
- Lista de Releases de GitHub se ordena por nombre de etiqueta (`beta.10` < `beta.9`); la app usa SemVer (`src/core/updates.ts`).
- WSL: posibles falsos cambios CRLF/LF (falta `.gitattributes`); `gh pr edit` falla por proyectos clásicos (usar `gh api -X PATCH`).
- Windows/Linux sin firmar (SmartScreen avisa).
- El estado `flowDrag` solo vive en memoria; al abrir un diálogo a mitad de trazo se descarta en el siguiente `pointerup`.
