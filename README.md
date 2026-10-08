# Puzzle Adaptativo (nombre provisional)

Juego de puzzle casual para **web y Android**, con anuncios, donde **cada partida es un puzzle nuevo generado por algoritmo** y la **dificultad se ajusta al nivel real del jugador** (no a su edad), para que lo disfruten niños, adultos y personas mayores.

> **Estado:** 📋 Planeación (Fase 0). Todavía no hay código.

## Idea en una línea

Partidas de 30–90 segundos, reglas que se entienden en 5 segundos, un puzzle distinto cada vez y una dificultad que siempre se siente "justa": ni aburrida ni frustrante.

## Stack elegido

| Capa | Tecnología | Por qué |
|---|---|---|
| Motor de juego | [Phaser 3](https://phaser.io/) | 2D, ligero, corre en navegador |
| Lenguaje / build | TypeScript + Vite | La lógica del generador de niveles es compleja y se beneficia de tipos |
| Empaquetado móvil | [Capacitor](https://capacitorjs.com/) | Mismo código web → app Android (AAB) |
| Anuncios móvil | AdMob (plugin `@capacitor-community/admob`) | Banner, intersticial y recompensados |
| Anuncios web | AdSense / H5 Games Ads (Ad Placement API) | Requiere aprobación, ver `docs/04` |
| Pruebas | Vitest | Verificar que el generador siempre produce niveles resolubles |
| Hosting web | GitHub Pages / Cloudflare Pages / Netlify | Gratis |

## Documentación

1. [Visión y decisiones](docs/01-vision-y-decisiones.md): concepto, mecánica candidata, audiencia, decisiones pendientes
2. [Roadmap por fases](docs/02-roadmap-por-fases.md): qué se hace en cada fase, con checklists
3. [Generación de niveles y dificultad adaptativa](docs/03-generacion-niveles-y-dificultad.md): el corazón técnico del juego
4. [Monetización y anuncios](docs/04-monetizacion-y-anuncios.md): formatos, reglas de políticas, estrategia
5. [Publicación en Play Store](docs/05-publicacion-play-store.md): cuentas, pruebas cerradas, requisitos

## Resumen del roadmap

| Fase | Objetivo | Duración estimada* |
|---|---|---|
| 0 | Decisiones, setup y cuentas | 1 semana |
| 1 | Prototipo jugable (nivel fijo) | 1–2 semanas |
| 2 | Generador procedural + solver + tests | 1–2 semanas |
| 3 | Dificultad adaptativa, modos y accesibilidad | 1–2 semanas |
| 4 | Pulido y "enganche" (juice, reto diario, rachas) | 1–2 semanas |
| 5 | Anuncios (AdMob + web) y consentimiento | 1 semana |
| 6 | Build Android y pruebas cerradas en Play | ~3 semanas calendario (se solapa con 4–5) |
| 7 | Producción + versión web | 1 semana + revisión |
| 8 | Post-lanzamiento: métricas, mejoras, más puzzles | continuo |

\* Estimaciones para ~8–10 horas por semana. Son una guía, no un compromiso.

## Estructura de código planeada

```
puzzle-adaptativo/
├─ src/
│  ├─ core/          # rng con semilla, generador, solver, dificultad (sin Phaser)
│  ├─ scenes/        # Menú, Juego, Resultado, Ajustes
│  ├─ services/      # AdService, StorageService, HapticsService (interfaces + impl web/nativa)
│  └─ main.ts
├─ tests/            # Vitest: invariantes del generador
├─ android/          # proyecto nativo generado por Capacitor
├─ docs/
└─ capacitor.config.ts
```

Regla de arquitectura: **el código del juego nunca llama directamente a AdMob/AdSense**; todo pasa por `AdService`, con una implementación web y otra nativa.

## Licencia

Pendiente de decidir.
