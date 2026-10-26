# Soul Dolls v1.5 — Informe de Fase 3: dimensiones y coordenadas

**Fecha:** 25 de octubre de 2026  
**Objetivo:** centralizar las dimensiones y conversiones geométricas existentes sin cambiar el comportamiento de los mapas.

## Resultado

Se añadió [`src/game/data/worldGeometry.ts`](./src/game/data/worldGeometry.ts) como fuente común de dimensiones del overworld y conversiones entre índices de cuadrícula y coordenadas del mundo. El runtime y el validador consumen estas reglas compartidas. Se añadieron comprobaciones de equivalencia al harness para detectar cambios accidentales.

No se modificaron los mapas, sus conexiones, las colisiones ni las reglas de movimiento. No se migraron mapas a JSON, no se creó un editor visual y no se ejecutó el build.

## Valores centralizados

- Tamaño de casilla: `1.5` unidades de mundo.
- Dimensiones de cada mapa: `40 × 40` tiles.
- Marco de borde: `2` tiles.
- Terreno: `60 × 60` unidades de mundo.
- Límite existente de movimiento: `±26.8`.

El borde geométrico del terreno (`±30`), el marco de tiles y el límite de movimiento son reglas distintas; se conservaron separadas. También permanecen sin cambios los radios de transición (`1.4` para activación y `2.5` para rearme) y las dimensiones de interiores (`12 × 8`).

## Convención de coordenadas conservada

El centro de un tile de índice `i` conserva la fórmula:

```text
(i - MAP_TILES / 2 + 0.5) × TILE_UNITS
```

La conversión de coordenada de mundo a tile conserva la convención `floor`:

```text
floor(coordenada / TILE_UNITS + MAP_TILES / 2)
```

Los índices de borde se comportan igual que antes: `-30` corresponde al índice `0`; `30` corresponde al índice `40`, fuera del rango de índices válidos `0–39`.

## Archivos creados y modificados

**Creado**

- [`src/game/data/worldGeometry.ts`](./src/game/data/worldGeometry.ts): dimensiones, límites geométricos y conversiones.

**Modificados**

- [`src/game/data/worldMapLayout.ts`](./src/game/data/worldMapLayout.ts): usa el helper de centro y conversión a cuadrícula.
- [`src/game/data/worldValidation.ts`](./src/game/data/worldValidation.ts): usa dimensiones y conversiones compartidas.
- [`src/game/graphics/OverworldTiles.ts`](./src/game/graphics/OverworldTiles.ts): consume la dimensión común del terreno y las dimensiones de cuadrícula.
- [`src/game/graphics/LuminatiRenderer.ts`](./src/game/graphics/LuminatiRenderer.ts): usa las dimensiones centralizadas para el plano del terreno y el límite de movimiento existente.
- [`tools/world-harness.ts`](./tools/world-harness.ts): añade comprobaciones deterministas de geometría y compatibilidad.

## Comprobaciones de equivalencia

El harness verifica:

1. Tamaño de tile, dimensiones de cuadrícula y ancho/profundidad del terreno.
2. Centros conocidos y conversiones de ida y vuelta para índices representativos.
3. Conversión de límites de tile, incluidos los bordes exteriores.
4. Dimensiones `40 × 40` para los cuatro mapas.
5. Coordenadas de salida y llegada de las conexiones de los cuatro mapas.
6. Muestras de colisión antes/después, junto con la validación existente de accesibilidad.

Las definiciones de los cuatro mapas no tienen cambios en el diff.

## Resultados de validación

La línea base ejecutada antes de editar pasó para `npm run world:harness` y `npm run lint`.

Después de los cambios:

- `npm run world:harness`: **pasó**. Reportó los cuatro mapas y concluyó que los enlaces, contenido, encuentros y equipos de entrenadores son válidos.
- `npm run lint`: **pasó** (`tsc --noEmit`).
- `git diff --check`: **pasó**, sin errores de formato.
- `npm run build`: no ejecutado; genera artefactos en `dist` y no era necesario para esta fase.

Salida del harness:

```text
SoulDolls World Harness
=======================
Villa Marionette: 2 encounter zones, 2 tamer(s), 1 map connection(s)
Ruta 1 · Sendero de los Susurros: 2 encounter zones, 1 tamer(s), 2 map connection(s)
Bosque de los Ecos: 2 encounter zones, 1 tamer(s), 2 map connection(s)
Cueva del Eco: 2 encounter zones, 0 tamer(s), 1 map connection(s)

World validation passed: links and map content are reachable; encounters and tamer parties use valid species and levels.
```

Salida de `npm run lint`:

```text
> react-example@0.0.0 lint
> tsc --noEmit
```

## Resumen del diff y límites

El diff contiene un módulo nuevo de geometría, actualizaciones de consumidores existentes y comprobaciones deterministas adicionales en el harness. No se modificaron datos de mapas ni sistemas de gameplay. Las dimensiones de interiores y los umbrales de transición siguen siendo valores separados porque no representan las dimensiones del overworld ni la misma regla.

No se hicieron pruebas visuales en navegador. El informe no inicia la siguiente fase; cualquier trabajo adicional requiere autorización.
