# 🧠 PROJECT CONTEXT & MASTER ARCHITECTURE MEMORY
**Proyecto:** Lumihilo (antes "Puzzle Adaptativo"; nombre elegido el 2026-11-08, ver `docs/09-nombre.md`; *Lumen Loop* y *Synapse Flow* descartados por colisión en Play Store)  
**Repositorio GitHub:** [DaManu123/lumihilo](https://github.com/DaManu123/lumihilo)  
**Rama activa de trabajo:** `dev`  
**Última actualización:** Fase 3 completada (noviembre 2026)

---

## 🎯 1. Visión y Pilares del Juego

Un juego de puzzle casual donde **cada partida es un puzzle nuevo generado por algoritmo** (siempre resoluble) y la dificultad se adapta al comportamiento del jugador, no a su edad. Se publicará en Google Play Store y en la web, con anuncios.

### Pilares Fundamentales:
1. **Comprensión Instantánea (5 segundos):** Cero tutoriales de texto largos. Reglas evidentes desde el primer toque.
2. **Ciclo de Partida Corto (30–90 s):** Para pausas cotidianas. Reinicio inmediato ("un nivel más") sin fricción.
3. **Temática "Capa de Piel":** Circuitos de luz / flujo neón sobre fondo oscuro minimalista, centralizados en `src/game/theme.ts` para poder mutar la estética sin tocar la lógica si las pruebas lo sugieren.
4. **Juice (Diferido a Fase 4):** Audio pentatónico (cada giro es una nota armónica), micro-háptica y brillo óptimo. No se invierte en bloom ni audio hasta validar en Fase 1 que la mecánica engancha con piezas simples.
5. **Dificultad Justa y Adaptativa (Fase 3):** Zona de flow (~70–80 % de resolución sin ayuda).
6. **Privacidad y Legal:** Sin cuentas ni datos personales propios (nunca decir "privacidad total" porque AdMob recoge IDs de publicidad). Declaración provisional 13+.

---

## 🛠️ 2. Stack Tecnológico y Arquitectura en 3 Capas Estrictas

```
┌────────────────────────────────────────────────────────┐
│                   CAPACITOR LAYER                      │
│     (Android AAB / Plugins Nativos / AdMob / Haptics)  │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    PHASER 3 (UI/Game)                  │
│       (Escenas, Render WebGL, Tweens, Audio FX)        │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                 CORE MOTOR (TypeScript)                │
│    (RNG con semilla, Generador, Solver, Dificultad)    │
│    *100% TS puro, sin Phaser, sin DOM, sin Capacitor*  │
└────────────────────────────────────────────────────────┘
```

- **Stack:** TypeScript + Vite + Phaser 3 (3.x estable) + Vitest + Capacitor (Android).
- **`src/core/`:** TypeScript puro (RNG mulberry32, generador, solver). Se prueba con Vitest en Node.
- **`src/game/`:** Phaser 3 (escenas, tweens, presentación, `theme.ts`).
- **`src/services/`:** `StorageService`, `AdService`, `HapticService` con adaptadores web/noop. El juego nunca llama directo a AdMob ni a Capacitor.
- **Nota clave:** La abstracción `PuzzleModule` se **difiere a la Fase 8** para no sobre-diseñar prematuramente con una sola mecánica.

---

## 📋 3. Reglas y Decisiones Críticas de la Fase 0

1. **Rama de trabajo:** Siempre `dev`. Nunca push directo a `main`.
2. **Nombre y Branding:**
   - Nombre visible centralizado en una única constante: `APP_NAME` en `src/config.ts`.
   - Elegido: `"Lumihilo"` (ver `docs/09-nombre.md`).
   - *Lumen Loop* y *Synapse Flow*: **Descartados** (ya existen en Play Store).
   - *Zen Circuit*: Candidato con riesgos (mezcla con apps de electrónica).
3. **Identificador Android (`appId`):**
   - Definitivo desde la beta.7: `com.damanu.lumihilo` (antes `com.placeholder.puzzleadaptativo`).
   - **No se puede cambiar una vez publicada la app en Play Store**; se fijará antes de subir el primer bundle.
4. **Accesibilidad desde el inicio:**
   - Áreas táctiles de mínimo 48 dp.
   - Nada que parpadee más de 3 veces por segundo.
   - No depender exclusivamente del color.
5. **Criterios de Aceptación de la Fase 0:**
   - `npm run typecheck` pasa sin errores.
   - `npm test` pasa (pruebas de `rng.ts` con Vitest).
   - `npm run build` genera `dist/`.
   - `npm run dev` corre "Hola Mundo" en navegador con toque interactivo (rotación 90° con tween).
   - `npx cap sync android` genera la carpeta `android/`.

---

## 🧑 4. Tareas Humanas Críticas (Recordatorio)
- **Google Play Console (RESUELTO, nov 2026):** El usuario tramitó la devolución y volvió a pagar los 25 USD en la cuenta con la que sí se publicará. Aún no se ha publicado nada; se lanzará cuando haya una versión madura del juego. Como la cuenta es nueva, conviene subir la primera build a prueba cerrada en cuanto exista una versión estable, para que los 14 días corran en paralelo con el desarrollo.
- Crear cuenta de AdMob (app en borrador).
- Verificar nombre definitivo en Play Store (sin filtro de dispositivo), App Store, marcas registradas y dominios.
- Reclutar 15–20 testers para los 14 días de prueba cerrada obligatoria. **Confirmado (nov 2026):** la cuenta de desarrollador es nueva (creada en 2026), por lo que SÍ aplica el requisito de ≥12 testers continuos durante 14 días antes de pedir producción (detalle en `docs/05-publicacion-play-store.md`).

---

## 🏁 Estado de las Fases
- [x] **Fase 0 (Completada y verificada):** Setup técnico Vite + TS + Phaser 3 + Vitest + Capacitor Android. Escena interactiva probada y verificada por el usuario.
- [x] **Fase 1 (Completada y validada):** Prototipo jugable 4×4 validado por el usuario como divertido y funcional.
- [x] **Fase 2 (Completada y probada):** Generador procedural con árbol de expansión (`generator.ts`), ciclos ajustables, solver independiente (`solver.ts`), cálculo de dificultad `d(nivel)` y prueba de estrés de 10.000 niveles en verde (0.06 ms/nivel). Soporte en `GameScene` para jugar rachas infinitas de niveles con dificultad creciente.
- [x] **Fase 3 (Completada):** Dificultad adaptativa (`src/core/adaptive.ts`): 10 tiers (4×4 a 7×7), perfil con rating tipo Elo y modos Relajado / Normal / Reto. Reglas verificadas por tests: 3 atascos (o abandonos) seguidos bajan el tier, 5 victorias seguidas sin atasco lo suben. El modo Relajado nunca penaliza (ni lentitud, ni reintentos, ni abandono) y se limita a los tiers 1-3 (4×4). Incluye modo claro/oscuro persistente, botón grande de sentido de giro (horario/antihorario, persistente; el clic derecho en PC invierte el sentido), deshacer que revierte exactamente la jugada, y aviso inicial. `minTaps` cuenta giros en ambos sentidos (umbral de maestría 0.6). Interfaz adaptable (`src/game/layout.ts`): lienzo de 720 px lógicos de ancho y alto según la pantalla, botones ≥ 48 dp y textos ≥ 13 dp (verificado por tests); orientación vertical fija en Android. Persistencia local con `StorageService` (localStorage + Capacitor Preferences). Landing page y política de privacidad en `docs/landing/` y `docs/`. 24 tests en verde.
- [~] **Fase 4 (En curso):**
  - **Entrega A (hecha, `src/core/progress.ts` y `hints.ts`):** progreso guardado (nivel actual, semilla base propia), Chispas (recompensa base por tier + bonos de eficiencia, rapidez y récord; 30 iniciales), pista de alineación (10 Chispas), reto diario por fecha local (tier según día de la semana, doble recompensa la primera vez, no altera el perfil adaptativo), racha diaria y pantalla de estadísticas. 65 tests.
  - **Identidad visual "Filamento" (hecha, `docs/07-identidad-visual.md`):** paleta Noche/Papel con contrastes verificados por tests, tipografías Unbounded + Atkinson Hyperlegible Next incluidas en la app, iconos dibujados (sin emojis), barras segmentadas, cables con halo y núcleo, pulso de luz al ganar, textos sin jerga. 91 tests.
  - **Entrega B (hecha, PR pendiente de fusionar):** sonido pentatónico sintetizado (`src/core/sound.ts`, `src/services/AudioService.ts`, `FeedbackService.ts`), música de fondo generativa que reacciona a la partida (`src/core/music.ts`, `MusicService.ts`), vibración de potencia plena con tres intensidades (`src/core/haptics.ts`, `@capacitor/haptics`), tarjeta de Ajustes (efectos, música, vibración, intensidad), melodía ascendente con el pulso de luz de la victoria, icono de la app (todas las densidades) + icono de Play 512 + favicon, pantalla de carga sin deformación, reinicio instantáneo (toque fuera de la tarjeta o Enter/Espacio). 145 pruebas unitarias + 63 de flujo completo en navegador.
  - **Criterio de salida de la Fase 4 aún por validar con gente real:** que varios jugadores pidan "otra partida" sin que se les sugiera.

## 📝 Pendientes conocidos
- `appId` definitivo: `com.damanu.lumihilo` (beta.7).
- La landing tiene placeholders de tráiler y capturas; la política de privacidad es un borrador.
- `HelloScene` sigue registrada en `main.ts` y hay un `console.log` de depuración.
- Añadir `.gitattributes` (`* text=auto eol=lf`) para evitar falsos cambios CRLF/LF.
