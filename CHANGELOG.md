# Registro de cambios

Todas las versiones publicadas del juego. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones, [SemVer](https://semver.org/lang/es/). Las notas completas de cada versión están en `docs/releases/`.

## [Sin publicar]

### Añadido
- Ajustes → Accesibilidad: alto contraste (en tema oscuro y claro), marcas de energía en las esquinas de las piezas encendidas y velocidad de animación (normal, rápida, ninguna).

## [0.1.0-beta.5] - 2026-11-07

### Mejorado
- Rendimiento: cada aspecto de casilla se pinta una vez en una textura en lugar de redibujarse en cada fotograma (unas 6 veces menos CPU por fotograma en el reto diario).

### Añadido
- `npm run test:perf` para medir el coste de dibujar cada fotograma.

## [0.1.0-beta.4] - 2026-11-07

### Cambiado
- La vibración en modo Auto (por defecto) usa todas las vías, incluida la de alarma, y deja de depender de que el jugador elija un método.

## [0.1.0-beta.3] - 2026-11-07

### Corregido
- La app ya no se cierra al diagnosticar la vibración en Xiaomi/HyperOS: el plugin nativo captura cualquier error.

### Añadido
- Vía de vibración "Alarma" y registro del último cierre inesperado, visible en Ajustes.

## [0.1.0-beta.2] - 2026-11-07

### Añadido
- Estilo de música **Swing** (nuevo, por defecto) junto al Ambiental.
- Barra de volumen de la música (0–200 %, 100 % = estándar) y limitador de salida.
- Plugin nativo de vibración para Android con varias vías y pantalla de diagnóstico en Ajustes.
- Suite de pruebas de flujo completo (`npm run test:e2e`, `npm run test:audio`) y compilación de Android en el CI.

## [0.1.0-beta.1] - 2026-11-06

Primera beta pública: APK de Android, `.exe` de Windows y AppImage de Linux.

### Añadido
- Generador de niveles infinitos siempre resolubles (4×4 a 7×7), dificultad adaptativa y modos Relajado, Normal y Reto.
- Reto diario, racha de días, estadísticas, Chispas y pistas.
- Música generativa y efectos de sonido pentatónicos, vibración con tres intensidades y pulso de luz al ganar.
- Tema claro y oscuro, sentido de giro configurable, deshacer y reinicio instantáneo.
- Identidad visual "Filamento", icono de la aplicación y pantalla de carga.
- Versión de escritorio para Windows y Linux (Electron) y publicación automática de versiones con GitHub Actions.
