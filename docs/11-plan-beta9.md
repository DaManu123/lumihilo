# 11 · Plan para la beta.9 (escrito el 2026-11-09)

**Estado (2026-11-09): las partes 1 a 6 están hechas en `dev`** (commits `d04b65f`, `4d014a9`, `6b89cff`, `de06f2b`, `2843cd7`, `f5ebb89`); typecheck, 450 unitarias y 185/185 e2e en verde. Nada está publicado ni etiquetado: falta la prueba en teléfono y que el usuario pida la beta.

Se desarrolla parte por parte, en `dev`, con commit por parte y CI verde. **No se publica ninguna beta hasta que el usuario lo pida.**

## Parte 1 · El aviso de versión no sale solo
**Síntoma:** en el teléfono el aviso no aparece al abrir la app; sí funciona «Buscar actualizaciones» en Ajustes.
**Lo comprobado:** `releases.json` está publicado, responde 200 con CORS abierto y trae la beta.8; las pruebas e2e del aviso pasan; `overlayOpen()` no se queda atascado (solo el toast y las tarjetas usan profundidad ≥ 100). La diferencia entre el camino manual y el automático es que el automático hace **un solo intento**, 3 s (reloj de Phaser) después de abrir, y **calla cualquier fallo**. En un móvil recién abierto (red aún despertando, tiempo de espera de 7 s por fuente) un único intento fallido deja la sesión sin aviso. Sin dispositivo no se puede confirmar al 100 %, así que se arregla la fragilidad y se deja rastro para diagnosticar.
**Cambios:**
1. Comprobación con reintentos (p. ej. a los 3, 20 y 60 s) si falla por red, con reloj real (`setTimeout`), no el de Phaser.
2. Volver a comprobar al volver a la app (`visibilitychange`/`online`) si aún no se ha ofrecido.
3. Guardar la última comprobación (fecha, resultado o error) y mostrarla en Ajustes junto a «Buscar actualizaciones».
4. Pruebas unitarias del planificador de reintentos (lógica pura en `src/core/`) y e2e: primer intento falla, el segundo acierta → sale el aviso.

## Parte 2 · Docs desactualizados y ficha en inglés
- `README.md`, `PROJECT_CONTEXT.md`, `docs/05`, `docs/store/play-console.md` (audiencia 13+), al día con el estado real.
- Ficha de la tienda en inglés (`docs/store/ficha.md`): revisar que Hilos y las 13 capturas estén también en EN.

## Parte 3 · Pruebas e2e más rápidas sin perder cobertura
Hoy: 1 proceso, 1 navegador, ~36 `openGame`, `deviceScaleFactor: 2` en todo (WebGL por software = 4× píxeles), esperas fijas.
1. Medir primero (tiempo por sección) para atacar lo que pesa.
2. `deviceScaleFactor: 1` salvo en las secciones que hacen capturas.
3. Repartir las secciones independientes (cada `openGame` ya es un contexto aislado) en 3–4 trabajadores en paralelo; el orden de resultados se conserva al imprimir.
4. Cambiar `waitForTimeout` fijos por esperas de condición (`waitForFunction`) donde sea seguro.
5. Criterio de éxito: **las mismas 181+ comprobaciones** pasando, con tiempo bastante menor, repetido 2 veces para descartar fragilidad (el reloj del juego va lento en headless: no saturar la CPU).

## Parte 4 · Dificultad propia por puzzle y bastante más alta
**Diagnóstico:** los tres puzzles comparten un único `profile_adaptive.currentTier` (el rendimiento en Circuitos mueve la dificultad de Luces e Hilos). Además:
- **Luces:** `scrambles = 2 + tier + size/2` → pocos toques mínimos (máx. ~15 en 6×6). Se baraja con muy pocos toques.
- **Hilos:** máximo 8 niveles (7×7, 7 hilos); ganar sin llenar el tablero lo hace muy permisivo.
- **Circuitos:** tiers 1–10 con subida lenta (5 victorias seguidas).
**Cambios:**
1. Un perfil adaptativo **por puzzle** (migración: el perfil actual pasa a Circuitos; Luces e Hilos arrancan desde él).
2. Curvas nuevas con tablas propias por puzzle: Luces con barajado ∝ casillas jugables (mínimo de toques ~40–50 % del tablero) y piedras antes; Hilos hasta 9×9 con más hilos, tramos más cortos y menos holgura; Circuitos con más bucles/ramas en tiers altos.
3. Subida más ágil (p. ej. 3 victorias limpias) y salto inicial según el rendimiento de las primeras partidas.
4. Medir con un «jugador simulado» en Node (tiempo/toques mínimos por tier) y fijar umbrales en pruebas; mantener la garantía «siempre resoluble» y que el tiempo de generación no se dispare.
5. Reajustar `docs/10-economia-chispas.md` y `tests/economy.test.ts` (niveles más largos = más recompensa).

## Parte 5 · Más Chispas con los aspectos
**Decidido por el usuario:** bonus por aspecto equipado. Cada aspecto da un % extra de Chispas por nivel mientras se lleva puesto (propuesta: Cyberpunk +5 %, Matrix +10 %, Océano +15 %, Solar +20 %, Aurora +25 %; Filamento 0 %). Se aplica en `computeSparksReward` (campo nuevo, visible en el desglose de la victoria) y se muestra en la tienda («+15 % Chispas»). Se reequilibra `docs/10-economia-chispas.md` y `tests/economy.test.ts` (los plazos de compra bajan algo; se ajustan los umbrales). Las frases nuevas llevan su entrada en `EN`.

## Parte 6 · Cierre
Pasada completa: `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run test:audio` si se toca audio; actualizar `CLAUDE.md` (números de pruebas, estado). Sin etiquetar ni publicar.
