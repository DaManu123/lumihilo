# Lumihilo

> Antes llamado *Puzzle Adaptativo*. El significado del nombre está en [docs/09-nombre.md](docs/09-nombre.md).

Juego de puzzle casual para **Android, web y escritorio (Windows y Linux)**, donde **cada partida es un puzzle nuevo generado por algoritmo** (siempre resoluble) y la **dificultad se ajusta al nivel real del jugador**, no a su edad. Audiencia: 13+.

> **Estado:** beta pública (`0.2.0-beta.8`). Tres puzzles jugables (Circuitos, Luces e Hilos), tienda de aspectos con Chispas, retos diarios, español e inglés. Las versiones se descargan en [GitHub Releases](https://github.com/DaManu123/lumihilo/releases) y la web se puede jugar en https://damanu123.github.io/lumihilo/. Aún no está en Google Play. Contexto para retomar el trabajo: [CLAUDE.md](CLAUDE.md).

## Los tres puzzles

- **Circuitos:** gira las piezas hasta conectar todo a la fuente.
- **Luces:** tocar una casilla cambia su luz y la de sus cuatro vecinas; enciende todo. Con piedras (casillas bloqueadas) en los niveles altos.
- **Hilos:** arrastra para unir las parejas de puntos del mismo color sin que los hilos se solapen.

Cada puzzle tiene su propio nivel, récords y reto diario. Se ganan **Chispas** resolviendo niveles, para pistas y para los 6 aspectos de la tienda.

## Idea en una línea

Partidas de 30–90 segundos, reglas que se entienden en 5 segundos, un puzzle distinto cada vez y una dificultad que siempre se siente "justa": ni aburrida ni frustrante.

## Stack elegido

| Capa | Tecnología | Por qué |
|---|---|---|
| Motor de juego | [Phaser 3](https://phaser.io/) | 2D, ligero, corre en navegador |
| Lenguaje / build | TypeScript + Vite | La lógica del generador de niveles es compleja y se beneficia de tipos |
| Empaquetado móvil | [Capacitor](https://capacitorjs.com/) | Mismo código web → app Android (AAB) |
| Escritorio | Electron (`desktop/`) | Windows y Linux desde el mismo código |
| Pruebas | Vitest + Playwright (`e2e/`) | Unitarias del núcleo y pruebas de navegador del juego completo |
| Hosting web | GitHub Pages | Gratis; la web y `releases.json` salen de `pages.yml` |
| Anuncios | (pospuestos) | AdMob/AdSense siguen en `docs/04`, pero hoy no hay anuncios ni cuentas |

## Documentación

1. [Visión y decisiones](docs/01-vision-y-decisiones.md): concepto, mecánica candidata, audiencia, decisiones pendientes
2. [Roadmap por fases](docs/02-roadmap-por-fases.md): qué se hace en cada fase, con checklists
3. [Generación de niveles y dificultad adaptativa](docs/03-generacion-niveles-y-dificultad.md): el corazón técnico del juego
4. [Monetización y anuncios](docs/04-monetizacion-y-anuncios.md): formatos, reglas de políticas, estrategia
5. [Publicación en Play Store](docs/05-publicacion-play-store.md): cuentas, pruebas cerradas, requisitos
6. [Identidad visual](docs/07-identidad-visual.md): paleta "Filamento", tipografía, reglas de accesibilidad
7. [Publicar versiones](docs/08-publicar-versiones.md): APK de Android, `.exe` de Windows y Linux con GitHub Actions
8. [El nombre](docs/09-nombre.md) y [economía de las Chispas](docs/10-economia-chispas.md)
9. [Plan de la beta.9](docs/11-plan-beta9.md) y [ficha de la tienda](docs/store/ficha.md)

## Resumen del roadmap

Las fases 0 a 4 están hechas (base técnica, prototipo, generador, dificultad adaptativa, Chispas, retos, sonido, tres puzzles). El detalle y lo que falta (cuenta de Play Console, prueba cerrada de 14 días, anuncios y cuentas pospuestos) está en [docs/02-roadmap-por-fases.md](docs/02-roadmap-por-fases.md) y en [CLAUDE.md](CLAUDE.md).

## Estructura de código

```
lumihilo/
├─ src/
│  ├─ core/          # TypeScript puro: rng, generadores y solvers, dificultad, progreso, i18n, música
│  ├─ game/          # Phaser: GameScene (interfaz y juego), tema, arte de aspectos
│  ├─ services/      # adaptadores: almacenamiento, sonido, vibración, actualizaciones
│  └─ main.ts
├─ tests/            # Vitest
├─ e2e/              # Playwright (navegador)
├─ android/          # proyecto nativo de Capacitor (+ plugin Java de vibración)
├─ desktop/          # Electron (Windows y Linux)
└─ docs/
```

Regla de arquitectura: **el código del juego nunca llama directamente a Capacitor**; todo pasa por `src/services/`, y `src/core/` no conoce Phaser ni el DOM.

## Desarrollo

### Requisitos previos
- **Node.js**: versión 20 o superior (CI usa 20 y 22).
- **Android Studio** (opcional para desarrollo web, obligatorio para compilar Android): con Android SDK y Android SDK Command-line Tools instalados.

### Instalación de dependencias
```bash
npm install
```

### Scripts disponibles
- `npm run dev`: Inicia el servidor de desarrollo local de Vite en `http://localhost:3000`.
- `npm test`: Ejecuta las pruebas unitarias con Vitest (`vitest run`).
- `npm run test:e2e`: pruebas de navegador con Playwright (largas; ver `CLAUDE.md`).
- `npm run typecheck`: Comprobación estricta de tipos con TypeScript (`tsc --noEmit`).
- `npm run build`: Compila el proyecto web para producción en el directorio `dist/`.
- `npm run cap:sync`: Compila el proyecto web y sincroniza los assets con el proyecto nativo Android (`npm run build && npx cap sync android`).

> [!WARNING]
> **Identificador de paquete (`appId`):**  
> El identificador definitivo es `com.damanu.lumihilo` (desde la beta.7; antes `com.placeholder.puzzleadaptativo`). **No se puede modificar una vez publicada la app en Google Play Store.**

## Licencia

Propietaria: **todos los derechos reservados** (ver [LICENSE](LICENSE)). El repositorio es público para poder descargar las versiones y consultar el código, pero eso no concede permiso de uso ni de copia.
