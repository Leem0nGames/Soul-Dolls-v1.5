# Soul Dolls v1.5 — Fase 9: edición estructural del mapa

## Resultado

Se amplió el editor experimental de Villa Marionette sin conectar sus datos al runtime oficial. Los cambios estructurales se aplican transaccionalmente a una copia; las operaciones inválidas devuelven un error y no publican una copia parcial.

## Operaciones y campos editables

- Caminos rectos: mover, agregar y eliminar caminos por eje, además de cambiar el semiancho.
- Polilínea: crearla con al menos dos puntos, mover un vértice por índice y eliminarla.
- Plaza: establecer o eliminar posición y radio.
- Zonas de encuentro: mover conservando sus dimensiones, o establecer sus cuatro límites.
- Reservas de espacio: actualizar centro y radio.

El editor asigna IDs iniciales deterministas a los caminos existentes y conserva esos IDs mediante `editorMetadata` en la copia editada/exportada. Las geometrías estructurales se proyectan en SVG con selección por ID; los vértices de polilínea se identifican por números. Los cambios pasan por las operaciones tipadas y se integran con el historial, el restablecimiento y la exportación existentes.

No se habilitó la edición de presupuestos de decoración procedural: el contrato guarda cantidades, pero no las posiciones generadas de los objetos. Tampoco se validan colisiones, accesibilidad física ni jugabilidad.

## Archivos de Fase 9

- Modificados: `src/game/data/experimental/villaMapOperations.ts`, `src/game/data/experimental/villaMapPreview.ts`, `src/game/data/experimental/villaMapTypes.ts`, `src/game/experimental/VillaMapPreviewApp.tsx`, `src/game/experimental/villa-map-preview.css`, `tools/map-operations-harness.ts`, `tools/map-preview-harness.ts` y `tools/map-editor-harness.ts`.
- Añadido: `src/game/data/experimental/villaMapIdentity.ts`.
- Este informe: `MAP_EDITOR_PHASE_9_REPORT.md`.

El árbol ya contenía cambios experimentales de la Fase 8, incluidos `map-preview.html`, `package.json`, `src/game/data/experimental/villaMapEditor.ts` y `tools/map-editor-harness.ts`; se conservaron. No se añadieron dependencias.

## Validación

Resultados exactos:

| Comando | Resultado |
|---|---|
| `npm run map:editor` | Exit code 0. Undo/reset, edición y exportación estructurales, IDs y conservación de datos pasaron. |
| `npm run map:preview` | Exit code 0. Proyección estructural, IDs, copia inmutable y categorías omitidas pasaron. |
| `npm run map:operations` | Exit code 0. Las 9 operaciones estructurales, entradas inválidas, IDs duplicados y rollback atómico pasaron. |
| `npm run map:serialization` | Exit code 0. Round-trip del mapa y edificios pasaron. |
| `npm run world:harness` | Exit code 0. Validación de conexiones, contenido y encuentros del mundo pasó. |
| `npm run lint` | Exit code 0. `tsc --noEmit` pasó. |
| `git diff --check` | Exit code 0. Sin errores de whitespace. |
| `git diff --exit-code -- src/game/data/world.ts src/game/data/maps src/game/data/experimental/villa_marionette.v1.json` | Exit code 0. Las fuentes oficiales y el JSON piloto no tienen cambios en el diff. |

Los harnesses comparan el documento experimental fuente y `WORLD_MAPS` con snapshots y comprueban que siguen intactos.

## Prueba visual y uso manual

No se ejecutó una prueba real en navegador; los comandos anteriores verifican tipos y datos, no interacción gráfica. Para inspeccionarla manualmente, iniciar con `npm run dev` y abrir `http://localhost:3000/map-preview.html`. La página ofrece selección y arrastre de los elementos estructurales representados, edición numérica mediante **Aplicar**, deshacer/restablecer y descarga JSON. El archivo exportado sigue siendo experimental y no constituye un mapa oficial del juego.

## Límites y riesgos pendientes

- El SVG es una vista esquemática: no instancia modelos GLB ni reproduce el horneado de tiles, las transiciones o la decoración procedural.
- Los presupuestos procedurales permanecen solo informativos porque no describen placements deterministas.
- No se simulan colisiones, accesibilidad, navegación ni reglas del runtime; mover una estructura no certifica que el mapa sea jugable.
- Los IDs generados para caminos legacy se guardan en metadatos opcionales de la copia exportada, no en el JSON piloto original.
- La interacción debe confirmarse visualmente en navegador antes de considerarla validada.

## Diff y aislamiento

El diff de la fase amplía las operaciones, la proyección SVG, los controles estructurales y sus harnesses; añade el generador de IDs deterministas y el presente informe. Se conserva la aplicación experimental independiente. No se modificaron `WORLD_MAPS`, los módulos de mapas oficiales, el runtime del juego ni el JSON experimental original.
