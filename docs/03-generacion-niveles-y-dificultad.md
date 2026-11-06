# 03 · Generación de niveles y dificultad adaptativa

Esta es la parte técnica central. Todo vive en `src/core/` y **no depende de Phaser**, para poder probarlo con Vitest y reutilizarlo.

## Principios

1. **Resoluble por construcción:** se genera la solución primero y luego se desordena.
2. **Determinista:** misma semilla + mismos parámetros = mismo nivel (necesario para el reto diario, para reproducir bugs y para los tests).
3. **Parametrizable:** un solo vector de parámetros controla la dificultad.
4. **Rápido:** generar un nivel debe tardar muy poco, incluso en un teléfono de gama baja.

## Generador (mecánica "rotar tuberías")

```ts
interface LevelParams {
  width: number;        // columnas
  height: number;       // filas
  extraLoops: number;   // aristas extra sobre el árbol → ciclos (más difícil)
  branchBias: number;   // 0..1, tendencia a ramificar vs. camino largo
  decoys: number;       // piezas "ruido" que no aportan al circuito
}

interface Level {
  seed: number;
  params: LevelParams;
  solution: Piece[][];   // rotación correcta de cada celda
  initial: Piece[][];    // rotaciones desordenadas (lo que ve el jugador)
  minTaps: number;       // cota para medir eficiencia del jugador
  difficulty: number;    // d(nivel), ver abajo
}
```

Pasos:

1. **RNG con semilla** (por ejemplo mulberry32).
2. **Árbol de expansión aleatorio** sobre la rejilla (Prim o DFS aleatorio). Garantiza que todas las celdas quedan conectadas a la fuente sin ciclos.
3. **Ciclos opcionales:** añadir `extraLoops` aristas entre celdas vecinas ya conectadas. Los ciclos hacen que haya más de una forma local de conectar y suben la dificultad.
4. **Tipo de pieza según vecinos conectados:** extremo (1), recta (2 opuestos), esquina (2 adyacentes), T (3), cruz (4).
5. **Señuelos:** colocar piezas que no cambian la solución pero distraen visualmente.
6. **Desordenar:** rotar cada pieza una cantidad aleatoria de cuartos de vuelta. Rechazar y repetir si el nivel nace resuelto o con muy pocas piezas fuera de lugar.
7. **Calcular `minTaps`:** suma de giros mínimos por celda (cuidado con piezas simétricas: la cruz tiene 1 orientación, la recta 2).

### Verificación (solver)

Un validador independiente comprueba que `solution` conecta todo y que `initial` no está ya resuelto. Si más adelante se quiere **solución única**, se añade una pasada de conteo de soluciones y se regenera si hay ambigüedad.

## Puntuación de dificultad

Empezar simple y calibrar con pruebas reales:

```
d = celdas * 1.0 + ramas * 1.5 + ciclos * 3.0 + señuelos * 0.5
```

Los pesos son una **hipótesis inicial**: se ajustan comparando `d` contra el tiempo real que tarda la gente en resolver niveles.

### Tabla orientativa de niveles de habilidad

| Skill | Rejilla | Ciclos | Notas |
|---|---|---|---|
| 1–3 | 3×3 – 4×4 | 0 | Ideal para tutorial y primeros pasos |
| 4–8 | 4×4 – 5×5 | 0–1 | |
| 9–15 | 5×5 – 6×6 | 1–3 | |
| 16–22 | 6×6 – 7×7 | 3–5 | |
| 23–30 | 7×7 – 8×8 | 5+ | Solo en modo Reto |

**Límite de tamaño por accesibilidad:** las pautas de Android recomiendan áreas táctiles de al menos 48 dp. En un teléfono de ~360 dp de ancho, una rejilla de 7 columnas deja piezas de ~51 dp; con 8 ya se queda abajo. Por eso el máximo recomendado en modos Relajado y Normal es 6×6 o 7×7, y 8×8 queda para Reto o tablets.

## Dificultad adaptativa

El objetivo es mantener al jugador cerca de "lo logro pero me costó". Se usa un **nivel de habilidad** (`skill`, de 1 a 30) por jugador, guardado localmente.

### Qué se mide por partida

| Señal | Cómo se usa |
|---|---|
| `tiempo / tiempoEsperado(d)` | ¿Fue más rápido o más lento de lo esperado? |
| `toques / minTaps` | Eficiencia: ¿tanteó al azar o razonó? |
| Pistas usadas | Señal de frustración |
| Abandono | Señal fuerte de que fue demasiado difícil (o aburrido) |

Con eso se calcula un `score` entre 0 y 1 (1 = muy cómodo, 0 = muy difícil).

### v1 · Escalera simple (para el MVP)

```
si score > 0.8 → skill += 1   (o +2 tras 3 victorias cómodas seguidas)
si score < 0.4 → skill -= 1   (o -2 tras 2 partidas difíciles seguidas)
en otro caso   → se queda igual
skill acotado a [1, 30]
```

El siguiente nivel se genera con parámetros correspondientes a `skill`, más un pequeño ruido aleatorio para que no se sienta mecánico.

### v2 · Tipo Elo (si v1 no basta)

Tratar cada partida como un "duelo" jugador vs. nivel:

```
esperado = 1 / (1 + 10^((d - skill) / escala))
skill   += K * (score - esperado)
```

Permite que el sistema converja más rápido al nivel real, pero necesita calibrar `escala` y `K` con datos.

### Modos (los elige el jugador)

| Modo | Cronómetro visible | Velocidad de subida | Pistas |
|---|---|---|---|
| Relajado | No | Lenta, tope en 6×6 | Más generosas |
| Normal | Opcional | Media | Estándar |
| Reto | Sí | Rápida, sin tope | Limitadas |

Esto reemplaza preguntar la edad: el jugador elige cómo quiere jugar y el algoritmo hace el resto.

### Accesibilidad ligada a la dificultad

- Tamaño de pieza configurable (nunca menor al mínimo táctil recomendado).
- Alto contraste y **patrones además de color** para daltonismo.
- Sin límites de tiempo obligatorios.
- Velocidad de animación ajustable y vibración opcional.
- Reglas expresadas con iconos y animación, no con párrafos.

## Reto diario

`seed = hash(fecha)` y parámetros fijos según el día de la semana (tier 3 el lunes, subiendo hasta 8 el sábado; domingo 6) → todos los que comparten fecha juegan el mismo nivel, sin depender de su perfil adaptativo. Permite comparar tiempos con amigos y crea el hábito de volver cada día.

**Decisión (nov 2026):** se usa la **fecha local del jugador**, no UTC, para que el reto cambie a medianoche de su día y la racha sea coherente. Para el leaderboard de la Fase 8 se compararán resultados por clave de fecha (`YYYY-MM-DD`). Solo la primera vez de cada día da Chispas (el doble); repetirlo no da nada y no altera el perfil adaptativo.

## Pruebas obligatorias (Vitest)

- [ ] 10 000 semillas × cada configuración → el solver confirma que todos son resolubles
- [ ] Ningún nivel nace resuelto
- [ ] Misma semilla y parámetros → nivel idéntico
- [ ] `minTaps` coincide con el cálculo del solver
- [ ] Tiempo de generación dentro del presupuesto (< 50 ms objetivo)
- [ ] El ajuste adaptativo nunca sale del rango [1, 30] y reacciona a rachas

## Telemetría (decisión pendiente)

Para calibrar `d(nivel)` y el ajuste adaptativo hacen falta datos. Opciones:

1. **Solo local** (MVP): se afina con pruebas presenciales; no hay que declarar recolección de datos.
2. **Analítica anónima** (después del lanzamiento): da datos reales, pero hay que declararla en el formulario de seguridad de datos de Play y en la política de privacidad.
