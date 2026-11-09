# 10 · Economía de las Chispas

Las Chispas se ganan resolviendo niveles y se gastan en **pistas** (10 cada una) y en los **aspectos** de la tienda. Los precios se calcularon con un modelo de ritmo de juego que vive en `tests/economy.test.ts` y se ejecuta con el resto de las pruebas: si alguien cambia las recompensas o los precios y el ritmo deja de ser razonable, la prueba falla.

## Cuánto se gana

| Fuente | Chispas |
|---|---|
| Nivel resuelto | `5 + nivel de habilidad` (de 6 a 13) |
| Sin pistas: eficiencia de toques ≥ 99 % / ≥ 80 % / ≥ 60 % | +10 / +5 / +2 |
| Sin pistas y rápido | +5 |
| Récord personal de tiempo | +5 |
| Reto diario, la primera vez de cada día | **el doble** |

El puzzle **Luces** paga igual que Circuitos (misma fórmula; sus récords de tiempo son aparte). Cada puzzle tiene su reto diario, y cada uno paga doble la primera vez de cada día. Usar pistas quita los bonos de eficiencia y rapidez, y cada pista cuesta 10: por eso quien juega sin ayuda gana varias veces más que quien juega con pistas.

## Perfiles de jugador (por día)

| Perfil | Tiempo | Niveles + reto | Chispas netas al día |
|---|---|---|---|
| Ocasional (muchas pistas, eficiencia 70 %) | 8 min | 6 + 1 | 52 |
| Habitual (1 pista cada 5 niveles, eficiencia 85 %) | 12 min | 10 + 1 | 153 |
| Dedicado (casi sin pistas, eficiencia 95 %) | 30 min | 25 + 1 | 437 |

## Precios y tiempo para conseguirlos

Se compran en orden, partiendo de las 30 Chispas iniciales (días acumulados):

| Aspecto | Precio | Ocasional | Habitual | Dedicado |
|---|---|---|---|---|
| Cyberpunk | 150 | 2,3 días | 0,8 días | 0,3 días |
| Matrix | 350 | 9,0 días | 3,1 días | 1,1 días |
| Océano | 550 | 19,6 días | 6,7 días | 2,3 días |
| Solar | 800 | 35,0 días | 11,9 días | 4,2 días |
| Aurora | 1000 | 54,2 días | 18,4 días | 6,4 días |

Objetivos que cumple la tabla (y que comprueban las pruebas):
- El primer aspecto se consigue **el mismo día** con juego habitual y en **tres días como máximo** con juego ocasional.
- Con juego habitual, la colección completa se consigue en **unas tres semanas**; un jugador dedicado, en **menos de una**; uno ocasional, en **menos de ocho semanas**. Aurora es la meta a largo plazo.
- Cada aspecto cuesta más que el anterior, así que siempre hay una meta siguiente.

## Cómo ajustarlo

1. Cambia el precio en `src/core/skins.ts` (o las recompensas en `src/core/progress.ts`).
2. Ejecuta `npx vitest run tests/economy.test.ts --reporter=verbose`: imprime la tabla de días por perfil.
3. Si hace falta, ajusta los umbrales de la prueba y esta tabla.

Quien ya compró un aspecto a un precio anterior lo conserva.
