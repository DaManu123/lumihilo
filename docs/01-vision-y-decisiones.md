# 01 · Visión y decisiones

## Concepto

Un puzzle casual donde **cada partida = un nivel nuevo generado por algoritmo**. El jugador nunca ve dos veces el mismo puzzle (salvo el reto diario, que comparte semilla para todos), y la dificultad se adapta a cómo juega, no a cuántos años tiene.

### Pilares de diseño

1. **Se entiende en 5 segundos.** Sin texto largo ni tutorial obligatorio.
2. **Partidas cortas (30–90 s).** Cabe en una fila del banco, en el camión o en un descanso.
3. **Reinicio instantáneo.** Terminar → "otra más" en un toque, sin pantallas de por medio.
4. **Dificultad justa.** El objetivo es mantener al jugador en la zona de "casi me sale" (hipótesis a validar con pruebas: que resuelva ~70–80 % de los puzzles sin ayuda).
5. **Accesible por defecto.** Botones grandes, buen contraste, sin presión de tiempo obligatoria.
6. **Sin datos personales.** No hay cuentas, chat ni enlaces externos. Esto simplifica las políticas de Play Store y deja abierta la puerta a la audiencia infantil.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Tecnología | Phaser 3 + Capacitor (código web único → web y Android) |
| Tipo de juego | Puzzle, un nivel por partida, generado proceduralmente |
| Dificultad | Adaptativa al jugador (niño, adulto, persona mayor) |
| Monetización | Anuncios (AdMob en móvil, AdSense/H5 Games Ads en web) |
| Distribución | Play Store + versión web |

## Decisiones pendientes (resolver en la Fase 0)

| Tema | Opciones | Recomendación inicial |
|---|---|---|
| Mecánica del puzzle | Ver tabla de abajo | **Rotar tuberías** para el MVP |
| Nombre y marca | Libre | Elegir uno corto y fácil de buscar; revisar que no exista en Play Store |
| Audiencia declarada | A) 13+ / público general · B) incluye menores de 13 | Decidir con la sección "Audiencia" de más abajo |
| Dominio web | github.io / dominio propio | Dominio propio si se quiere AdSense (revisar requisitos vigentes) |
| Licencia del repo | Propietaria / MIT / otra | Por ahora propietaria (`LICENSE`, repo privado); reevaluar antes de hacerlo público |
| Telemetría | Solo local / Firebase Analytics | Solo local al inicio |

## Mecánicas candidatas

La condición clave: **que se pueda generar el nivel por algoritmo garantizando que tiene solución**. El truco general es partir del estado resuelto y "desordenarlo" con movimientos reversibles.

| Mecánica | Cómo se genera | Dificultad se controla con | Ventajas | Riesgos |
|---|---|---|---|---|
| **Rotar tuberías** (recomendada) | Árbol de expansión aleatorio en rejilla → piezas → rotaciones al azar | Tamaño, ramas, ciclos, piezas señuelo | Reglas obvias, sin texto, solución garantizada, escala muy bien | Que se vea genérico; compensar con buen arte y "juice" |
| Apagar luces (Lights Out) | Aplicar toques aleatorios a un tablero apagado | Tamaño, número de toques | Muy fácil de generar | Más "matemático"; a muchos jugadores les cuesta intuirlo |
| Ordenar colores (water sort) | Generar estado ordenado y mezclar con movimientos inversos | Colores, tubos, capacidad, tubos vacíos | Muy popular | Mercado saturado de clones; ojo con daltonismo |
| Puzzle deslizante | Mezclar con movimientos válidos desde el estado resuelto | Tamaño, imagen/números | Familiar para todas las edades | Poca variedad visual sin imágenes propias |

**Recomendación:** empezar con **rotar tuberías** y diseñar el código con una interfaz `PuzzleModule` para poder añadir otras mecánicas después (Fase 8) sin reescribir el juego.

## Audiencia y jugadores

La dificultad se adapta al **comportamiento** (tiempo, errores, uso de pistas, abandonos), no a la edad. Así no hace falta preguntar la edad y el juego sirve igual a un niño que a una persona mayor.

Perfiles de uso que hay que probar con gente real:

- **Niños:** necesitan feedback visual claro, niveles pequeños al inicio y cero dependencia de texto.
- **Adultos:** quieren variedad y progresión; toleran más complejidad.
- **Personas mayores:** necesitan botones grandes, contraste alto, sin cronómetro obligatorio y animaciones más lentas si lo desean.

### Audiencia declarada en Play Store (decisión importante)

En Play Console hay que declarar la audiencia objetivo. Si entre ella hay menores de 13, aplica la política de Familias: los anuncios deben provenir de SDKs autocertificados, se envían como tratamiento dirigido a niños y el catálogo de anuncios disponible es más reducido, lo que normalmente baja los ingresos.

- **Camino A (más simple):** declarar 13+ / público general y diseñar la experiencia en consecuencia.
- **Camino B:** incluir niños. Es viable, pero hay que cumplir Familias de punta a punta desde el inicio.

Aunque se elija A, conviene mantener el diseño "sin datos personales" para no cerrarse la puerta a B. **Verificar siempre los requisitos vigentes en Play Console antes de declarar.**

## Métricas de éxito (del MVP)

- 8 de 10 personas nuevas entienden el juego sin explicación.
- Una sesión típica dura 3+ minutos (varias partidas).
- Retención día 1 razonable para un juego casual (medir y comparar contra tu propia línea base).
- Cero violaciones de políticas de anuncios.
