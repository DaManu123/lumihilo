# 🧠 PROJECT CONTEXT & MASTER ARCHITECTURE MEMORY
**Proyecto:** Puzzle Adaptativo (Nombre de trabajo provisional; *Lumen Loop* y *Synapse Flow* descartados por colisión en Play Store)  
**Repositorio GitHub:** [DaManu123/puzzle-adaptativo](https://github.com/DaManu123/puzzle-adaptativo)  
**Rama activa de trabajo:** `dev`  
**Última actualización:** Fase 0 (Planificación y Setup)

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
   - Provisional: `"Puzzle Adaptativo"`.
   - *Lumen Loop* y *Synapse Flow*: **Descartados** (ya existen en Play Store).
   - *Zen Circuit*: Candidato con riesgos (mezcla con apps de electrónica).
3. **Identificador Android (`appId`):**
   - Provisional en Fase 0: `com.placeholder.puzzleadaptativo`.
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
- Registrar cuenta de Google Play Console (25 USD, verificación de identidad y de dispositivo Android).
- Crear cuenta de AdMob (app en borrador).
- Verificar nombre definitivo en Play Store (sin filtro de dispositivo), App Store, marcas registradas y dominios.
- Reclutar 15–20 testers para los 14 días de prueba cerrada obligatoria.
