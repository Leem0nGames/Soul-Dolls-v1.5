# Soul Dolls v1.5 — Informe de Fase 5: mapa piloto serializable

**Fecha:** 25 de octubre de 2026  
**Objetivo:** demostrar que Villa Marionette puede serializarse y recuperarse desde una representación experimental, sin migrar el mapa del runtime.

## 1. Resultado

Se preparó un documento experimental JSON con versión explícita de esquema y un harness aislado que:

- lee el JSON piloto;
- elimina los identificadores editoriales al reconstruir los tipos actuales;
- vuelve a derivar las huellas y reservas calculadas;
- compara profundamente el mapa y los edificios recuperados con las definiciones TypeScript oficiales;
- comprueba la estabilidad de `JSON.stringify`/`JSON.parse`;
- comprueba la unicidad de los IDs editoriales.

**La prueba pasó.** Villa Marionette en TypeScript sigue siendo la fuente oficial para el runtime; el juego no importa el archivo experimental.

## 2. Contrato piloto

El archivo [`src/game/data/experimental/villa_marionette.v1.json`](./src/game/data/experimental/villa_marionette.v1.json) declara `schemaVersion: 1`.

Incluye:

- ID, nombre y paleta del mapa.
- Referencia explícita a dimensiones y convenciones geométricas compartidas.
- Conexiones con posiciones de salida y llegada, destino y orientación.
- Plaza, caminos rectos, ancho de camino y densidad de flores.
- Presupuestos actuales para decoración procedural.
- Zonas de encuentros, especies, niveles, pesos y tasas.
- Entrenadores, posiciones, activación, retratos, diálogos y equipos.
- Reservas de espacio explícitas, letreros con coordenadas de cuadrícula y edificios.
- Para cada edificio: ID, archivo GLB, posición, rotación, escala, huella, instalación cuando aplica y entrada.
- IDs editoriales únicos para conexiones, zonas, entrenadores, reservas, letreros y edificios.

No se duplica en el JSON la huella de `layout` ni las reservas generadas de entrenadores y edificios: el harness las reconstruye desde la fuente de edificios y las posiciones correspondientes antes de comparar.

## 3. Campos derivados, recursos y elementos ausentes

El documento no afirma que ya sea una definición autónoma de todo el overworld. Permanecen fuera del contrato experimental:

- El algoritmo de generación determinista de decoración, su semilla, orden de colocación, tamaños de ocupación y efecto sobre colisiones.
- La generación de la cuadrícula de terreno, las prioridades entre camino, plaza y zona de encuentro, y el horneado de tiles.
- La asociación de tipos de decoración con archivos y tamaños, actualmente en [`OverworldProps.ts`](./src/game/graphics/OverworldProps.ts), y las reglas de representación del tileset en el código gráfico.
- Los recursos GLB y de imagen propiamente dichos; el JSON solo guarda referencias relativas.
- Entidades y comportamiento definidos directamente en el runtime y no en la definición del mapa, como la aparición inicial dentro de la casa, el santuario, la tienda y sus NPCs, lámparas y configuración/servicios de interiores.
- Valores calculados en TypeScript, como huellas de edificio y reservas de espacio derivadas.

Las definiciones TypeScript pueden incluir imports y expresiones calculadas; el JSON contiene valores literales. La prueba compara explícitamente la definición recuperada con el origen después de reconstruir los valores derivados declarados. No demuestra paridad de los sistemas runtime ausentes.

## 4. Archivos de la fase

**Creados**

- [`src/game/data/experimental/villa_marionette.v1.json`](./src/game/data/experimental/villa_marionette.v1.json): datos experimentales con IDs editoriales.
- [`tools/map-serialization-harness.ts`](./tools/map-serialization-harness.ts): prueba reproducible de recuperación, comparación, estabilidad y unicidad de IDs.

**Modificado**

- [`package.json`](./package.json): añade el script `map:serialization`.

No se modificaron `WORLD_MAPS`, Villa Marionette, los otros tres mapas, ni módulos de runtime. El worktree ya contenía cambios previos de fases anteriores, que se preservaron.

## 5. Resultados de validación

### `npm run map:serialization`

Pasó con código de salida 0:

```text
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

Pasó con código de salida 0:

```text
SoulDolls World Harness
=======================
Villa Marionette: 2 encounter zones, 2 tamer(s), 1 map connection(s)
Ruta 1 · Sendero de los Susurros: 2 encounter zones, 1 tamer(s), 2 map connection(s)
Bosque de los Ecos: 2 encounter zones, 1 tamer(s), 2 map connection(s)
Cueva del Eco: 2 encounter zones, 0 tamer(s), 1 map connection(s)

World validation passed: links and map content are reachable; encounters and tamer parties use valid species and levels.
```

### `npm run lint`

Pasó con código de salida 0:

```text
> react-example@0.0.0 lint
> tsc --noEmit
```

### `git diff --check`

Pasó sin errores de espacios en blanco.

No se ejecutó `npm run build`, porque escribe artefactos en `dist` y no era necesario para la prueba.

## 6. Aislamiento y compatibilidad

El runtime sigue obteniendo Villa Marionette desde [`src/game/data/maps/villaMarionette.ts`](./src/game/data/maps/villaMarionette.ts) mediante el registro `WORLD_MAPS`. La prueba lee el JSON solo desde el harness. La inspección no encontró imports de Three.js, `LuminatiRenderer` ni cargadores gráficos en el archivo experimental o en el harness de serialización.

Los otros tres mapas no se modificaron. Las definiciones originales, las conexiones, los encuentros y las posiciones de los edificios siguen siendo las fuentes actuales del juego.

## 7. Recomendación

JSON funcionó como formato de intercambio y prueba para datos literales editables, con una recuperación comprobable. Se recomienda mantenerlo como **piloto experimental**, no convertirlo aún en fuente oficial: antes se necesita decidir cómo modelar o reconstruir los datos derivados, las reglas deterministas de generación, recursos y entidades runtime omitidas.

Conservar TypeScript como fuente oficial evita por ahora duplicar las reglas y el mapa productivo. Una futura migración puede considerarse cuando el contrato serializable cubra esos componentes y el harness compare también resultados de layout, colisión y generación, no solo la definición de mapa.

## 8. Resumen del diff

La fase añade un JSON piloto, un harness independiente y un comando npm. No altera el runtime ni los mapas oficiales. El harness demuestra igualdad de la definición recuperada —incluidos los campos derivados reconstruidos—, igualdad de los ocho edificios, estabilidad de JSON y unicidad de 18 IDs.

No se realizaron pruebas visuales en navegador; por tanto, no se declara equivalencia visual. No se comenzó ninguna fase posterior.
