# Soul Dolls v1.5 — Informe de Fase 2: validación desacoplada del renderizado

**Fecha:** 25 de octubre de 2026  
**Objetivo:** permitir que el harness valide los mapas sin importar ni inicializar módulos de renderizado gráfico.  
**Alcance:** se mantuvieron los cuatro mapas en TypeScript. No se creó editor visual, no se migraron mapas a JSON y no se cambiaron movimiento, coordenadas ni reglas de colisión.

## 1. Resultado

La extracción quedó implementada y verificada:

- `npm run world:harness`: **pasó** para los cuatro mapas.
- `npm run lint`: **pasó** (`tsc --noEmit`).
- `git diff --check`: **pasó**.
- No se ejecutó `npm run build`, que escribe artefactos de producción en `dist`.
- El harness importa la validación desde datos; ya no importa `OverworldTiles.ts` ni `OverworldBuildings.ts`.
- El nuevo validador y el cálculo lógico de mapas no importan Three.js, `LuminatiRenderer` ni módulos que creen escenas o canvas.

La línea base se ejecutó antes de los cambios: tanto `world:harness` como `lint` pasaron. Durante la implementación, una primera ejecución intermedia de `lint` detectó que faltaba reexportar el tipo `PlacedDecoration` utilizado por los props. Se restauró esa exportación de compatibilidad y la verificación final pasó.

## 2. Archivos creados

- [`src/game/data/worldValidation.ts`](./src/game/data/worldValidation.ts): contiene las comprobaciones del contrato del mundo, conexiones, accesibilidad, zonas, entrenadores, laberinto, letreros y accesos de edificios.
- [`src/game/data/worldMapLayout.ts`](./src/game/data/worldMapLayout.ts): concentra el cálculo lógico de cuadrícula, obstáculos y distribución determinista de decoración. Lo comparten el runtime gráfico y el validador.
- [`src/game/data/maps/villaBuildings.ts`](./src/game/data/maps/villaBuildings.ts): almacena los datos de Villa Marionette relacionados con modelos, posiciones, huellas, instalaciones y entradas, sin depender de Three.js.

## 3. Archivos modificados

- [`tools/world-harness.ts`](./tools/world-harness.ts): conserva el punto de entrada `world:harness`, pero ahora invoca `worldValidation.ts` y obtiene las zonas de encuentro directamente de los datos.
- [`src/game/graphics/OverworldTiles.ts`](./src/game/graphics/OverworldTiles.ts): consume la lógica de mapa extraída. Conserva reexportaciones de compatibilidad utilizadas por el runtime.
- [`src/game/graphics/OverworldBuildings.ts`](./src/game/graphics/OverworldBuildings.ts): usa y reexporta los datos de edificios ahora ubicados en `villaBuildings.ts`.
- [`src/game/data/maps/villaMarionette.ts`](./src/game/data/maps/villaMarionette.ts): cambia únicamente el origen del import de los edificios; sus valores y definiciones de mapa se mantienen.

No se modificaron `world.ts`, los otros tres módulos de mapas ni `LuminatiRenderer.ts`.

## 4. Validaciones conservadas

La lógica del validador conserva las comprobaciones que antes estaban en `OverworldTiles.ts` y en el harness:

- ID de mapa coincidente con el registro y nombre no vacío.
- Formato, dimensiones, límites, entrada y objetivo del laberinto; accesibilidad entre entrada y objetivo.
- Existencia de conexiones, mapas destino registrados, límites de salida/llegada, puntos no bloqueados y conexión recíproca correspondiente.
- Límites, accesibilidad y bloqueos para las zonas de encuentro y ubicaciones de entrenadores.
- Reserva de espacio despejado para entrenadores.
- Límites de las ubicaciones de letreros.
- Orientación de edificios, posición de sus entradas, ausencia de bloqueo en las entradas y camino de acceso.
- En el harness: tasa y contenido de encuentros, referencias a especies existentes, rangos de nivel, pesos, distancia de activación de entrenadores y composición de sus equipos.

Las colisiones usadas para comprobar bloqueos no se duplicaron: se calculan mediante la lógica compartida en `worldMapLayout.ts`.

## 5. Comprobaciones ejecutadas y resultados exactos

### Línea base antes de editar

`npm run world:harness` y `npm run lint` pasaron antes de comenzar los cambios. El harness reportó:

```text
Villa Marionette: 2 encounter zones, 2 tamer(s), 1 map connection(s)
Ruta 1 · Sendero de los Susurros: 2 encounter zones, 1 tamer(s), 2 map connection(s)
Bosque de los Ecos: 2 encounter zones, 1 tamer(s), 2 map connection(s)
Cueva del Eco: 2 encounter zones, 0 tamer(s), 1 map connection(s)
World validation passed: links and map content are reachable; encounters and tamer parties use valid species and levels.
```

### Verificación final

`npm run world:harness` terminó con código de salida 0 y mostró:

```text
> react-example@0.0.0 world:harness
> tsx tools/world-harness.ts

SoulDolls World Harness
=======================
Villa Marionette: 2 encounter zones, 2 tamer(s), 1 map connection(s)
Ruta 1 · Sendero de los Susurros: 2 encounter zones, 1 tamer(s), 2 map connection(s)
Bosque de los Ecos: 2 encounter zones, 1 tamer(s), 2 map connection(s)
Cueva del Eco: 2 encounter zones, 0 tamer(s), 1 map connection(s)

World validation passed: links and map content are reachable; encounters and tamer parties use valid species and levels.
```

`npm run lint` terminó con código de salida 0:

```text
> react-example@0.0.0 lint
> tsc --noEmit
```

`git diff --check` también terminó correctamente, sin errores de espacios en blanco.

## 6. Verificación de independencia gráfica

El harness importa `validateWorldMaps` desde `src/game/data/worldValidation.ts`. La validación utiliza módulos bajo `src/game/data/` y no importa `OverworldTiles`, `OverworldBuildings`, `LuminatiRenderer`, `three`, APIs de documento/canvas ni inicializadores de escena.

La generación lógica de cuadrícula y obstáculos quedó en `worldMapLayout.ts`, sin dependencias gráficas. El runtime puede seguir consumiendo esa misma lógica desde `OverworldTiles.ts`; por eso no hay dos algoritmos independientes de colisión que puedan divergir.

## 7. Compatibilidad de los mapas y gameplay

Se conservaron los valores de los cuatro mapas. Villa Marionette solo cambió el módulo del que importa la lista de edificios; la definición de los otros tres mapas no se modificó. La separación de datos mantiene las mismas posiciones, huellas, rotaciones, escalas, instalaciones y entradas que usaba el runtime.

No se modificaron el movimiento del jugador, las reglas de colisión, encuentros, entrenadores, transiciones ni la implementación global de `LuminatiRenderer.ts`. El resultado del harness confirma que las comprobaciones actuales siguen pasando, pero no se realizó inspección visual en navegador ni build de producción.

## 8. Resumen del diff

El cambio extrae las funciones de layout y validación desde el módulo gráfico, mueve los datos de edificios a un módulo de datos y actualiza sus importadores. El diff rastreado reportó:

```text
src/game/data/maps/villaMarionette.ts   |   2 +-
src/game/graphics/OverworldBuildings.ts | 113 +-------
src/game/graphics/OverworldTiles.ts     | 495 ++------------------------------
tools/world-harness.ts                  |  27 +-
4 files changed, 28 insertions(+), 609 deletions(-)
```

Ese resumen de `git diff --stat` solo incluye archivos rastreados; los tres módulos nuevos se muestran como archivos sin seguimiento hasta que se agreguen al control de versiones.

## 9. Limitaciones pendientes

- No se ejecutó `npm run build`, por su impacto de escritura en `dist`.
- No se verificó visualmente el juego en navegador.
- No hay una suite de pruebas `test` independiente declarada en `package.json`.
- Esta fase no introduce una validación de esquema para datos cargados externamente; los mapas siguen siendo TypeScript tipado.
- La verificación de que el camino no importe gráficos fue por inspección de imports y búsqueda estática, además de ejecutar el harness. No se añadió una prueba automatizada de arquitectura.
