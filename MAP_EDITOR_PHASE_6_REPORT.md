# Soul Dolls v1.5 — Informe de Fase 6: operaciones de edición seguras

**Fecha:** 25 de octubre de 2026  
**Objetivo:** preparar una capa experimental de edición segura sobre una copia serializable de Villa Marionette, sin tocar el runtime ni los mapas oficiales del juego.

## 1. Estado inicial y alcance

La base del proyecto ya incluía:

- validación de mapas desacoplada del renderizado;
- geometría compartida de mundo centralizada;
- datos de edificios separados de los módulos gráficos;
- un documento experimental JSON de Villa Marionette;
- un harness de serialización y recuperación en [tools/map-serialization-harness.ts](./tools/map-serialization-harness.ts);
- validación del mundo en [tools/world-harness.ts](./tools/world-harness.ts).

La regla de seguridad era explícita: no modificar ni el runtime ni los mapas oficiales. Todo trabajo se debía hacer sobre una copia experimental del mapa serializable.

## 2. Archivos creados y modificados

### Archivos creados

- [src/game/data/experimental/villaMapOperations.ts](./src/game/data/experimental/villaMapOperations.ts): módulo experimental con validación y aplicación transaccional de operaciones.
- [src/game/data/experimental/villaMapTypes.ts](./src/game/data/experimental/villaMapTypes.ts): tipos compartidos del esquema experimental.
- [src/game/data/experimental/villa_marionette.v1.json](./src/game/data/experimental/villa_marionette.v1.json): fuente serializable experimental del mapa piloto.
- [tools/map-operations-harness.ts](./tools/map-operations-harness.ts): prueba determinista de operaciones, rollback y inmutabilidad.

### Archivos modificados

- [package.json](./package.json): añade el script `npm run map:operations`.

### Archivos no modificados

- [src/game/data/maps/villaMarionette.ts](./src/game/data/maps/villaMarionette.ts)
- [src/game/data/maps/villaBuildings.ts](./src/game/data/maps/villaBuildings.ts)
- [src/game/data/world.ts](./src/game/data/world.ts)
- [src/game/graphics/OverworldBuildings.ts](./src/game/graphics/OverworldBuildings.ts)
- [src/game/graphics/OverworldTiles.ts](./src/game/graphics/OverworldTiles.ts)
- [WORLD_MAPS] no se tocó y el runtime sigue utilizando la fuente oficial de TypeScript.

## 3. Diseño de las operaciones

El módulo experimental define una unión discriminada de operaciones tipadas:

- `move_building`
  - requiere `editorId` del edificio.
  - acepta `position: { x, z }`.
  - mueve el edificio y también la entrada en el mismo desplazamiento relativo.
  - valida que la huella siga dentro del terreno del mapa.

- `move_sign`
  - requiere `editorId` del letrero.
  - acepta `col` y `row` enteros dentro del borde jugable.
  - valida que ambos valores sean finitos e enteros y que no salgan de la zona válida.

- `move_trainer`
  - requiere `editorId` del entrenador.
  - acepta `position: { x, z }` dentro de los límites actuales del mapa.

- `update_encounter_zone`
  - requiere `editorId` de la zona de encuentro.
  - solo permite editar la propiedad explícita `encounterRate`.
  - valida que el valor sea finito y que quede en `(0, 1]`.

Todos los objetos se validan con `JSON-safe` y `Number.isFinite`, sin depender del navegador, de Three.js ni de `GLTFLoader`.

## 4. Validaciones implementadas

Se aplicaron las siguientes comprobaciones:

- rechazo de IDs inexistentes;
- rechazo de operaciones desconocidas;
- rechazo de propiedades no permitidas;
- rechazo de valores `NaN`, `Infinity` y no finitos;
- rechazo de coordenadas fuera de rango para edificios, entrenadores y letreros;
- validación de que el documento experimental siga teniendo esquema 1 y geometría compatible con [src/game/data/worldGeometry.ts](./src/game/data/worldGeometry.ts);
- validación de unicidad de IDs editoriales;
- validación de que la entrada del edificio siga centrada en la fachada norte;
- confirmación de que el documento de entrada no se muta;
- rollback transaccional: si una operación falla, la lista completa falla y el resultado no expone un estado parcial.

## 5. Pruebas realizadas

Se ejecutó [tools/map-operations-harness.ts](./tools/map-operations-harness.ts), que cubre:

1. una operación válida cambia solo el campo previsto;
2. la posición de un edificio puede cambiarse por ID editorial;
3. ID inexistente es rechazado;
4. operación desconocida es rechazada;
5. coordenadas no finitas son rechazadas;
6. campo no permitido es rechazado;
7. si una segunda operación falla, la primera no queda aplicada;
8. la entrada original no se muta;
9. el JSON original no se modifica;
10. una lista vacía devuelve una copia equivalente y definida;
11. el documento resultante sigue siendo serializable;
12. los IDs editoriales siguen siendo únicos.

La prueba pasó con código de salida 0.

## 6. Resultados exactos de las comprobaciones obligatorias

### `npm run map:operations`

```text
> react-example@0.0.0 map:operations
> tsx tools/map-operations-harness.ts

Villa Marionette operations harness
====================================
Supported operations: 4
Valid targeted edits: passed
Missing IDs, unknown operations, invalid values and unsupported fields: rejected
Transactional rollback and input immutability: passed
Empty operation list: passed (equal independent copy)
Edited document JSON round-trip and editor ID uniqueness: passed
Experimental source JSON unchanged: passed
```

### `npm run map:serialization`

```text
> react-example@0.0.0 map:serialization
> tsx tools/map-serialization-harness.ts

Villa Marionette serialization harness
======================================
Schema version: 1
Recovered map fields: 8
Stable editor IDs: 18
Buildings recovered: 8
Map definition round-trip: passed
Building definition round-trip: passed
JSON stringify/parse stability: passed
```

### `npm run world:harness`

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

### `npm run lint`

```text
> react-example@0.0.0 lint
> tsc --noEmit
```

### `git diff --check`

Salida: sin salida, exit 0.

## 7. Confirmación de inmutabilidad y seguridad

Se confirma que:

- la entrada experimental no se muta;
- el JSON original de [src/game/data/experimental/villa_marionette.v1.json](./src/game/data/experimental/villa_marionette.v1.json) permanece intacto;
- los mapas oficiales no se modifican;
- el runtime no se conecta a los datos experimentales;
- no se introduce un sistema de edición visual ni un editor funcional;
- no se añaden dependencias terceros ni librerías de render.

## 8. Limitaciones actuales

Esta fase es segura para el contrato serializable, pero no garantiza que un mapa editado sea jugable completo. Las limitaciones relevantes son:

- no valida colisiones del runtime ni accesibilidad física completa;
- no garanta la jugabilidad del mapa completo;
- no cubre reglas procedurales específicas de generación y layout dinámico;
- no incorpora interiores ni entidades creadas por runtime que no estén representadas en el JSON experimental;
- no se ejecuta navegador ni se compara render visual del mapa editado.

Esto implica que esta etapa es adecuada para operaciones explícitas, reproducibles y transaccionales, pero no para afirmar que el mapa completo es seguro para juego real.

## 9. Resumen del diff y riesgo pendiente

El diff de esta fase añade una capa experimental sobre una copia serializable. No reemplaza la fuente oficial del runtime y no modifica el resto del proyecto. El riesgo principal pendiente es semántico: el JSON experimental todavía no modela todos los elementos procedurales y runtime de un overworld completo, por lo que la edición segura debe respetar ese límite y no confundirse con validación completa del juego.

La fase 6 queda como una base segura para una futura integración con herramientas de edición asistida por OpenCode, pero aún no conecta al runtime ni crea el editor visual.
