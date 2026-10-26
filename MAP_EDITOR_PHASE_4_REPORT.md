# Soul Dolls v1.5 — Informe de Fase 4: datos de edificios

**Fecha:** 25 de octubre de 2026  
**Objetivo:** verificar que los datos de colocación de edificios estén separados del código que carga y representa los modelos 3D.

## Resultado

La separación solicitada ya estaba completa al iniciar esta fase. La inspección y las pruebas confirmaron que el mapa y el validador consultan datos sin depender de Three.js, mientras que el runtime utiliza esos mismos datos para cargar los modelos GLB.

**No se modificó código en esta fase.** No hubo necesidad de crear otra lista, duplicar huellas o cambiar el contrato del mapa.

## Dependencias actuales

- [`src/game/data/maps/villaBuildings.ts`](./src/game/data/maps/villaBuildings.ts) contiene la fuente oficial y única de edificios de Villa Marionette.
- [`src/game/data/maps/villaMarionette.ts`](./src/game/data/maps/villaMarionette.ts) importa esa lista desde el módulo de datos para derivar huellas y reservas de espacio.
- [`src/game/data/worldValidation.ts`](./src/game/data/worldValidation.ts) valida orientación, ubicación y bloqueo de entradas, así como el acceso por camino.
- [`src/game/graphics/OverworldBuildings.ts`](./src/game/graphics/OverworldBuildings.ts) importa esa misma lista, carga los GLB y coloca sus instancias en la escena.
- [`src/game/graphics/LuminatiRenderer.ts`](./src/game/graphics/LuminatiRenderer.ts) usa los datos compartidos para construir elementos asociados a edificios en el runtime.

La dependencia de Three.js y GLTFLoader existe en el módulo gráfico que representa los edificios, pero no en la definición de datos ni en el camino del harness y el validador.

## Datos verificados

La lista mantiene un registro por edificio con:

- ID estable.
- Ruta del modelo GLB.
- Posición en el mundo.
- Rotación y escala.
- Huella de colisión.
- Tipo de instalación, cuando corresponde.
- Posición de entrada.

Una comparación con la definición registrada confirmó que los valores coinciden: IDs, rutas GLB, posiciones, rotaciones, escalas, huellas, instalaciones y entradas. No se encontró una segunda lista de edificios.

## Pruebas ejecutadas

Las comprobaciones se ejecutaron antes de cualquier edición; no se realizaron ediciones:

- `npm run world:harness`: **pasó** para los cuatro mapas y conservó las comprobaciones de accesibilidad, edificios, encuentros y entrenadores.
- `npm run lint`: **pasó** (`tsc --noEmit`).
- `git diff --check`: **pasó**.

Salida de `npm run world:harness`:

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

## Limitaciones

- No se ejecutó el juego en navegador; no se declara equivalencia visual verificada.
- El build de producción no fue necesario y no se ejecutó.
- La inspección confirma independencia de los módulos de datos y validación respecto de Three.js; la representación gráfica conserva legítimamente su dependencia de Three.js y GLTFLoader.

## Resumen de cambios

La Fase 4 no produjo cambios en el código. El estado del worktree conserva los cambios previos de la Fase 3; este informe es el único archivo añadido por esta solicitud.
