# Soul Dolls v1.5 — Informe de Fase 8: editor visual básico

**Fecha:** 26 de octubre de 2026  
**Objetivo:** convertir la página experimental de Villa Marionette en un editor visual básico que mantenga todos los cambios fuera del juego oficial.

## 1. Resultado

La página independiente `map-preview.html` ahora permite seleccionar objetos por ID editorial, mover edificios, entrenadores y letreros con el ratón, editar coordenadas y la tasa permitida de encuentro, deshacer acciones, restablecer la copia inicial y descargar un documento JSON editado.

Todas las ediciones se delegan al validador transaccional existente. No se escriben cambios a disco ni se modifica el JSON original. El renderizado continúa siendo un plano SVG esquemático, no una vista 3D ni una representación visual equivalente al juego.

## 2. Archivos creados y modificados

### Creados

- [src/game/data/experimental/villaMapEditor.ts](./src/game/data/experimental/villaMapEditor.ts): conversión de puntero a mundo, conversión de mundo a cuadrícula, estado de historial, operaciones, reset y serialización validada.
- [tools/map-editor-harness.ts](./tools/map-editor-harness.ts): pruebas deterministas de selección por ID, transformaciones, edición, undo/reset, exportación e inmutabilidad.

### Modificados

- [src/game/experimental/VillaMapPreviewApp.tsx](./src/game/experimental/VillaMapPreviewApp.tsx): barra superior, selección y drag SVG, panel de propiedades, mensajes, historial y descarga JSON.
- [src/game/experimental/villa-map-preview.css](./src/game/experimental/villa-map-preview.css): estilo de selección, drag, toolbar, coordenadas y panel.
- [map-preview.html](./map-preview.html): título de la página experimental.
- [package.json](./package.json): añade el script `npm run map:editor`; los comandos existentes se conservan.

No se modificaron la aplicación principal, `WORLD_MAPS`, definiciones oficiales de mapas, renderizador, combate, movimiento ni colisiones.

## 3. Funcionalidades

- **Selección:** clic o teclado sobre edificios, entrenadores, letreros, zonas de encuentro, conexiones y reservas. Los IDs editoriales se conservan y aparecen en el panel.
- **Movimiento:** arrastre de edificios, entrenadores y letreros. El SVG se convierte a coordenadas del mundo a partir de su `getBoundingClientRect`, su `viewBox` y la escala compartida; la conversión contempla escala responsive y letterboxing.
- **Letreros:** el puntero se convierte a índices de cuadrícula enteros y las operaciones existentes rechazan celdas fuera del borde jugable.
- **Edición numérica:** X/Z para edificios y entrenadores, columna/fila para letreros y `encounterRate` para zonas. Los campos son borradores hasta pulsar **Aplicar**. **Cancelar edición** descarta el borrador.
- **Validación:** coordenadas vacías, no finitas o fuera de los límites no se confirman. Un fallo conserva el último mapa válido y muestra el motivo. Al mover un edificio, se mantiene el desplazamiento de su entrada mediante la operación existente.
- **Historial:** cada edición confirmada añade una sola acción. **Deshacer** y Ctrl/Cmd+Z recuperan el snapshot previo. **Restablecer** vuelve a la copia original de sesión y limpia el historial y los errores.
- **Exportación:** **Exportar JSON** valida el documento con el validador existente y descarga `villa_marionette.editado.json`, conservando versión de esquema, IDs y campos no editados. No toca `villa_marionette.v1.json` y advierte que el resultado no es una fuente oficial.

El contador indica acciones confirmadas pendientes desde el documento de sesión; una acción deshecha reduce el contador y restablecerlo lo deja en cero.

## 4. Cómo usarlo

1. Ejecutar `npm run dev`.
2. Abrir `http://localhost:3000/map-preview.html`.
3. Seleccionar un objeto con un clic. Para mover edificios, entrenadores o letreros, arrastrar y soltar; el arrastre se confirma como una sola acción. Escape cancela el drag.
4. Para editar números, seleccionar el objeto, cambiar sus campos en **Propiedades** y pulsar **Aplicar**. **Cancelar edición** restaura los valores confirmados.
5. Usar **Deshacer** o Ctrl/Cmd+Z para revertir; **Restablecer** elimina el historial y recupera la copia inicial.
6. Pulsar **Exportar JSON** para descargar una copia editada.

Las huellas de edificios son rectángulos esquemáticos, no modelos GLB. Se mantienen visibles las categorías no representadas para no sugerir paridad con el mapa del juego.

## 5. Resultados exactos

### `npm run map:preview`

```text
> react-example@0.0.0 map:preview
> tsx tools/map-preview-harness.ts

Villa Marionette preview harness
=================================
Schematic objects: 8 buildings, 2 trainers
Preview source immutability: passed
Edited-copy reflection and stable editorial IDs: passed
Explicitly unrepresented categories: 6
Invalid geometry and data errors: clear
Experimental source JSON unchanged: passed
```

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

Exit code 0; sin salida.

### `npm run map:editor` (pruebas añadidas)

```text
> react-example@0.0.0 map:editor
> tsx tools/map-editor-harness.ts

Villa Marionette editor harness
================================
Editorial ID selection and responsive pointer transforms: passed
Building, trainer and sign movement: passed
Bounds, non-finite values and invalid state preservation: passed
Undo and reset state behavior: passed
Export schema, IDs, untouched fields and edited values: passed
Experimental JSON and official maps unchanged: passed
```

### Comprobación HTTP del servidor Vite

Vite sirvió la página experimental, el entrypoint React, el componente y los helpers con HTTP 200. El servidor local se detuvo después de las comprobaciones.

## 6. Prueba visual y límites

No se abrió un navegador; tampoco había un navegador instalado en el entorno. Por lo tanto, **no se declara una prueba visual real**. El servicio HTTP y la transformación de módulos se comprobaron, y las pruebas de datos verifican las coordenadas, operaciones, historial y exportación; no verifican la interacción real con el ratón en un navegador.

La vista sigue sin reproducir texturas del terreno, tiles/transiciones, edificios 3D, sprites, decoración procedural, colisiones, accesibilidad, interiores ni entidades runtime ausentes del JSON. El editor no garantiza que el mapa resultante sea jugable.

## 7. Aislamiento y riesgos pendientes

- El editor utiliza el JSON experimental y el estado local del componente; no importa el renderer ni conecta el documento a `WORLD_MAPS`.
- El harness comprobó que el JSON fuente permanece byte por byte intacto y que los mapas oficiales no cambian.
- No se guarda automáticamente; la única salida persistente es la descarga explícita.
- La validación solo garantiza las reglas ya representadas por el contrato y por las operaciones actuales. No comprueba colisiones entre objetos ni accesibilidad.
- Riesgo pendiente: sin navegador no se verificó pointer capture, accesibilidad del SVG ni comportamiento responsive visualmente; esas comprobaciones deben hacerse al abrir la URL indicada.

No se inició una fase posterior.
