# 🧠 PROJECT CONTEXT & MASTER ARCHITECTURE MEMORY
**Proyecto:** Puzzle Adaptativo (Nombre en desarrollo: *Lumen Loop* / *Synapse Flow*)  
**Repositorio GitHub:** [DaManu123/puzzle-adaptativo](https://github.com/DaManu123/puzzle-adaptativo)  
**Última actualización:** Fase 0 (Planificación y Setup)

---

## 🎯 1. Visión y Pilares del Juego

Un juego de puzzle minimalista, visualmente cautivador y altamente satisfactorio (*juicy*), donde **cada partida es un nivel único generado proceduralmente** y la dificultad se modula en tiempo real según el desempeño del jugador (sin importar edad ni experiencia previa).

### Pilares Fundamentales:
1. **Comprensión Instantánea (5 segundos):** Cero tutoriales de texto aburridos. Las reglas son intuitivas desde el primer toque.
2. **Ciclo de Partida Ultrarrápido (30–90s):** Ideal para momentos cotidianos (esperas, descansos). Reinicio inmediato ("un nivel más").
3. **Estética y "Juice" Hipnótico:** En vez de simples "tuberías de agua", usamos **Circuitos de Luz / Energía Neón (Lumen / Synapse)** con efectos de brillo (bloom), partículas sutiles, respuesta háptica suave y notas pentatónicas relajantes (cada rotación y conexión suena armoniosa).
4. **Dificultad Justa y Adaptativa:** Mantener al jugador en el estado de *Flow* (tasa de éxito ~70-80%). El motor ajusta el tamaño, bifurcaciones y señuelos de forma invisible.
5. **Privacidad Total (Cero Datos Personales):** Sin cuentas, sin rastreo invasivo, sin chat. Toda la progresión se almacena localmente.

---

## 🛠️ 2. Stack Tecnológico y Arquitectura Modular

```
┌────────────────────────────────────────────────────────┐
│                   CAPACITOR LAYER                      │
│     (Android AAB / Plugins Nativos / AdMob / Haptics)  │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    PHASER 3 (UI/Game)                  │
│       (Escenas, Render WebGL, Partículas, Audio FX)    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                 CORE MOTOR (TypeScript)                │
│    (Generador Procedural, Solver BFS, Evaluador Diff)  │
│         *100% Independiente del motor gráfico*         │
└────────────────────────────────────────────────────────┘
```

- **Lenguaje & Build:** TypeScript + Vite.
- **Motor 2D:** Phaser 3 (liviano, rápido, aceleración WebGL).
- **Capa Móvil:** Capacitor (código web único empaquetado a Android AAB nativo).
- **Testing:** Vitest (para validar matemáticamente que 10,000+ niveles generados tengan solución garantizada).

---

## 📋 3. Decisiones Estratégicas de la Fase 0

### A. Mecánica Núcleo (Core Gameplay)
- **Mecánica elegida para el MVP:** Conexión de Flujo / Circuitos de Energía giratorios.
- **Diseño de Código:** Se implementa bajo una interfaz abstracta `PuzzleModule`. Esto permitirá en el futuro (Fase 8) añadir otros módulos de puzzle (por ejemplo, mezcla de frecuencias, compuertas lógicas o nodos de colores) sin rehacer la arquitectura.

### B. Identidad Visual y Temática ("Juice")
- **Tema:** *Luz, Pulso y Energía Zen*. Fondo oscuro elegante con líneas neón vibrantes (cian, violeta, ámbar).
- **Audio:** Escala pentatónica interactiva (cada toque es una nota afinada que nunca desentona).
- **Háptica:** Micro-vibraciones suaves al rotar y una pulsación gratificante al cerrar el circuito.

### C. Estrategia de Audiencia y Tiendas
- **Público Declarado:** 13+ (Público General) en Google Play Console.
- **Razón:** Maximiza el catálogo de anuncios, fill-rate y eCPM de AdMob, evitando las restricciones complejas del programa Familias en la fase inicial, pero manteniendo la arquitectura "privacy-first".

### D. Monetización Sostenible y Respetuosa
- **Rewarded Video (Anuncios Recompensados):** Voluntario a cambio de una pista luminosa o deshacer movimientos.
- **Intersticiales con Cooldown:** Solo tras rachas de niveles (ej. cada 4-5 niveles resueltos) y con temporizador de enfriamiento.
- **Compra In-App (Fase 8):** "Modo Zen / Eliminar Anuncios" por pago único accesible.

---

## 🗺️ 4. Roadmap Resumido por Fases
- [x] **Fase 0 (En curso):** Decisiones de diseño, arquitectura, setup de Vite + TS + Phaser 3 + Capacitor, y trámites de cuentas.
- [ ] **Fase 1:** Prototipo jugable con nivel fijo y validación de sensaciones.
- [ ] **Fase 2:** Generador procedural con algoritmos deterministas (semillas RNG) y solver automático.
- [ ] **Fase 3:** Motor de dificultad adaptativa y opciones de accesibilidad.
- [ ] **Fase 4:** Pulido visual, audio pentatónico, racha diaria y estadísticas.
- [ ] **Fase 5:** Integración de AdMob (móvil) y web ads con flujo de consentimiento UMP.
- [ ] **Fase 6:** Build de Android AAB, prueba cerrada de 14 días en Google Play.
- [ ] **Fase 7:** Lanzamiento en producción y versión web.
- [ ] **Fase 8:** Métricas, optimizaciones y nuevos módulos de puzzle.

---

## 📌 5. Convención Git y Estructura del Repositorio
- `main`: Rama de producción estable.
- `dev`: Rama de desarrollo activo e integración continua.
- Convención de Commits: Convencional (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
