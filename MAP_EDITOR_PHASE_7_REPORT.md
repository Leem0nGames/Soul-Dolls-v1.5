# Soul Dolls v1.5 — Informe de Fase 7: vista previa aislada

**Fecha:** 25 de octubre de 2026  
**Objetivo:** comprobar una vía segura para visualizar cambios sobre una copia experimental de Villa Marionette, sin conectar los datos al runtime oficial.

## 1. Estrategia elegida

Se eligió la alternativa **C: representación visual esquemática**. La página usa SVG y consume únicamente el JSON piloto y el módulo de operaciones experimentales. Es la opción de menor riesgo porque el renderer 3D actual, [LuminatiRenderer.ts](./src/game/graphics/LuminatiRenderer.ts), construye el mundo oficial desde `WORLD_MAPS`, la generación de layout compartida y sistemas de juego; no ofrece una interfaz aislada para recibir este documento JSON.

La vista no reutiliza ni duplica el motor Three.js. Tampoco pretende representar el aspecto final del juego: muestra geometría y marcadores identificables, y enumera lo que el contrato no contiene.

## 2. Archivos creados o modificados

### Creados

- [map-preview.html](./map-preview.html): entrada Vite independiente, separada de `index.html`.
- [src/map-preview-main.tsx](./src/map-preview-main.tsx): punto de montaje de la página aislada.
- [src/game/experimental/VillaMapPreviewApp.tsx](./src/game/experimental/VillaMapPreviewApp.tsx): interfaz de vista y aplicación manual de operaciones en JSON.
- [src/game/experimental/villa-map-preview.css](./src/game/experimental/villa-map-preview.css): estilos propios, sin cambiar los estilos del juego.
- [src/game/data/experimental/villaMapPreview.ts](./src/game/data/experimental/villaMapPreview.ts): proyección validada del documento experimental a un modelo esquemático.
- [tools/map-preview-harness.ts](./tools/map-preview-harness.ts): pruebas deterministas de proyección, cambios, errores e inmutabilidad.

### Modificados

- [package.json](./package.json): añade `npm run map:preview`.
- [src/game/data/experimental/villaMapOperations.ts](./src/game/data/experimental/villaMapOperations.ts): publica la entrada de operaciones como `readonly unknown[]`; la validación de cada operación existente sigue aplicándose en runtime. Esto permite validar de forma segura el JSON que el usuario pega en la página.

No se editaron las definiciones oficiales de mapas, `WORLD_MAPS`, `App.tsx`, `main.tsx` ni `index.html`. Los cambios previos de fases anteriores en el worktree se conservaron.

## 3. Qué se representa

La página proyecta desde el contrato:

- el tamaño y la paleta declarados, con una cuadrícula esquemática;
- caminos rectos, polilínea si está presente y plaza;
- rectángulos de zonas de encuentro;
- huellas de los ocho edificios y la posición de sus entradas;
- el ID del edificio y la referencia al archivo GLB, **sin cargar el modelo**;
- marcadores de entrenadores, letreros y conexiones;
- reservas de espacio despejado;
- selección de marcadores por ID editorial para consultar detalles.

La forma gráfica de cada huella o marcador es una convención del plano esquemático; no es arte del juego. El color de fondo proviene de la paleta serializada, pero el plano no reproduce texturas ni transiciones.

## 4. Qué queda expresamente fuera

La vista enumera seis categorías no representadas:

1. Texturas del terreno, horneado de tiles y transiciones.
2. Modelos GLB: se muestra solamente la huella y la referencia del recurso.
3. Posiciones de decoración procedural: el documento guarda presupuestos, no placements deterministas.
4. Sprites y orientación visual de entrenadores y letreros.
5. Colisiones, accesibilidad y comportamiento de interiores.
6. Entidades y objetos creados por el runtime que no están en el contrato, como NPCs auxiliares, santuario y lámparas.

Por lo tanto, esta vista no equivale al mapa del juego, no valida que sea jugable y no sirve como prueba de equivalencia visual.

## 5. Cómo se reciben cambios experimentales

El área de texto de la página acepta un array JSON de operaciones compatibles con [villaMapOperations.ts](./src/game/data/experimental/villaMapOperations.ts). Al pulsar **Aplicar a la vista**, las operaciones se ejecutan sobre una copia nueva del documento original; una lista inválida muestra el error y no reemplaza la vista por un resultado parcial. **Restablecer** vuelve al documento original en memoria.

Ejemplo ya cargado en el área de texto:

```json
[
  {
    "type": "move_building",
    "editorId": "garden-home",
    "position": { "x": -15, "z": 1 }
  }
]
```

La vista puede iniciarse independientemente:

```bash
npm run dev
```

Abrir `http://localhost:3000/map-preview.html`. Pulsar **Aplicar a la vista** para ver el cambio de posición de `garden-home` y de su entrada; hacer clic en los marcadores para identificar sus IDs. La lista **No representado** informa qué componentes no se dibujan. La página no guarda modificaciones en el archivo fuente.

## 6. Comprobaciones y resultados exactos

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

Exit code 0; no output.

### Prueba de servicio HTTP

Se inició Vite temporalmente con `npm run dev -- --host 127.0.0.1 --port 4177 --strictPort`. Después de que el servidor indicó que estaba listo, `curl --fail` obtuvo el HTML `/map-preview.html` y las transformaciones de los módulos `/src/map-preview-main.tsx` y `/src/game/experimental/VillaMapPreviewApp.tsx`; las solicitudes terminaron con exit code 0. El servidor se detuvo después de la comprobación.

La primera solicitud HTTP se hizo antes de que Vite estuviera listo y falló por la carrera de inicio; se repitió tras el mensaje de disponibilidad y pasó. Vite también mostró un aviso de configuración existente por `__dirname` en `vite.config.ts`.

## 7. Prueba visual real

**No se abrió un navegador ni se inspeccionó una captura visual.** Se comprobó que Vite puede servir el HTML aislado y transformar los módulos, y que las pruebas deterministas reflejan datos editados; esto no demuestra por sí solo cómo se ve la página en navegador.

## 8. Aislamiento y límites

- El documento original y la copia importada permanecieron intactos durante el harness.
- Los cambios se reflejan únicamente en el estado local de la página.
- La búsqueda en los módulos del preview no encontró imports de Three.js, `LuminatiRenderer`, `OverworldTiles`, `OverworldBuildings` ni `OverworldProps`.
- El runtime y los cuatro mapas oficiales no se conectaron ni se modificaron por esta fase.
- No se ejecutó `npm run build`; la entrada es para el servidor de desarrollo y no se comprobó un bundle de producción.

El riesgo pendiente más importante es de interpretación: al ser un plano de huellas y posiciones, puede parecer más completo de lo que es. La etiqueta de vista aislada, la aclaración de que es esquemática y el listado de omisiones deben mantenerse visibles si se extiende la página.

## 9. Resumen del diff

Se añadió una página Vite independiente con una proyección SVG de los campos presentes, interacción por ID editorial y aplicación en memoria de operaciones sobre copias. Se añadieron pruebas deterministas y un script npm. No se reemplaza el renderer, no se cargan recursos provisionales y no se altera el runtime.
