# 10 · Economía de las Chispas

Las Chispas se ganan resolviendo niveles y se gastan en **pistas** (10 cada una) y en los **aspectos** de la tienda. Los precios se calcularon con un modelo de ritmo de juego que vive en `tests/economy.test.ts` y se ejecuta con el resto de las pruebas: si alguien cambia las recompensas o los precios y el ritmo deja de ser razonable, la prueba falla.

## Cuánto se gana

| Fuente | Chispas |
|---|---|
| Nivel resuelto | `5 + nivel de habilidad` (de 6 a 13) |
| Sin pistas: eficiencia de toques ≥ 99 % / ≥ 80 % / ≥ 60 % | +10 / +5 / +2 |
| Sin pistas y rápido | +5 |
| Récord personal de tiempo | +5 |
| Aspecto equipado | **+5 % / +10 % / +15 % / +20 % / +25 %** (Cyberpunk / Matrix / Océano / Solar / Aurora) del subtotal del nivel |
| Reto diario, la primera vez de cada día | **el doble** (también del bonus del aspecto) |

Los puzzles **Luces** e **Hilos** pagan igual que Circuitos (misma fórmula; sus récords de tiempo son aparte), salvo el bono de rapidez: el tiempo que cuenta como «rápido» es el tiempo esperado de cada puzzle (`expectedSecondsFor` en `adaptive.ts`: Luces da más tiempo para pensar y en Hilos crece con el tablero), el mismo que usa la dificultad. Cada puzzle tiene su reto diario, y cada uno paga doble la primera vez de cada día. Usar pistas quita los bonos de eficiencia y rapidez, y cada pista cuesta 10: por eso quien juega sin ayuda gana varias veces más que quien juega con pistas.

## Perfiles de jugador (por día)

| Perfil | Tiempo | Niveles + reto | Chispas netas al día |
|---|---|---|---|
| Ocasional (muchas pistas, eficiencia 70 %) | 8 min | 6 + 1 | 52 |
| Habitual (1 pista cada 5 niveles, eficiencia 85 %) | 12 min | 10 + 1 | 153 |
| Dedicado (casi sin pistas, eficiencia 95 %) | 30 min | 25 + 1 | 437 |

## Precios y tiempo para conseguirlos

Se compran en orden, partiendo de las 30 Chispas iniciales y llevando puesto el último comprado, cuyo bonus acelera la siguiente compra (días acumulados; el modelo aplica el bonus al ingreso neto, una aproximación ligeramente optimista):

| Aspecto | Precio | Bonus | Ocasional | Habitual | Dedicado |
|---|---|---|---|---|---|
| Cyberpunk | 150 | +5 % | 2,3 días | 0,8 días | 0,3 días |
| Matrix | 350 | +10 % | 8,7 días | 3,0 días | 1,0 días |
| Océano | 550 | +15 % | 18,3 días | 6,2 días | 2,2 días |
| Solar | 800 | +20 % | 31,7 días | 10,8 días | 3,8 días |
| Aurora | 1000 | +25 % | 47,7 días | 16,2 días | 5,7 días |

Objetivos que cumple la tabla (y que comprueban las pruebas):
- El primer aspecto se consigue **el mismo día** con juego habitual y en **tres días como máximo** con juego ocasional.
- Con juego habitual, la colección completa se consigue en **unas tres semanas**; un jugador dedicado, en **menos de una**; uno ocasional, en **menos de ocho semanas**. Aurora es la meta a largo plazo.
- Cada aspecto cuesta más que el anterior, así que siempre hay una meta siguiente.

## Bonus de los aspectos

Cada aspecto da un porcentaje extra de Chispas por nivel mientras está equipado: es la recompensa por haberlo conseguido, además de su aspecto. El bonus se calcula sobre el subtotal del nivel (base + eficiencia + rapidez + récord), se redondea y aparece en el desglose de la victoria («aspecto N») y en la tienda («+15 % Chispas»). El bonus acelera la colección, pero no la regala: la prueba exige que con él se tarde más del 75 % de lo que se tardaría sin él. No afecta al coste de las pistas.

**Nota sobre la dificultad:** desde la beta.9 los jugadores suben de nivel de habilidad antes (3 victorias seguidas en vez de 5; tras la beta.12, 3 victorias buenas o 6 normales), y cada peldaño paga `5 + nivel` Chispas, así que en la práctica se gana algo más de lo que modela esta tabla (que parte de un nivel fijo por perfil). Si la colección resulta demasiado rápida con datos reales, se ajustan los precios o los bonus aquí.

## Cómo ajustarlo

1. Cambia el precio o el bonus en `src/core/skins.ts` (o las recompensas en `src/core/progress.ts`).
2. Ejecuta `npx vitest run tests/economy.test.ts --reporter=verbose`: imprime la tabla de días por perfil.
3. Si hace falta, ajusta los umbrales de la prueba y esta tabla.

Quien ya compró un aspecto a un precio anterior lo conserva.
