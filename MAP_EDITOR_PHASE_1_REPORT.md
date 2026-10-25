# Soul Dolls v1.5 — Informe de preparación para un editor visual de mapas

**Fase:** 1 — preparación segura de la arquitectura  
**Fecha:** 25 de octubre de 2026  
**Alcance:** inspección del código y definición de una propuesta incremental. No se modificaron archivos de código, dependencias ni configuraciones; no se implementó un editor ni se migraron mapas.

## 1. Resumen ejecutivo

El juego ya cuenta con cuatro mapas descritos mediante un contrato TypeScript compartido por el runtime y el harness. El terreno, las colisiones y la distribución de decoraciones se calculan desde ese contrato, pero la validación y la generación siguen integradas en un módulo gráfico. Además, los datos de Villa Marionette importan directamente la lista de edificios del módulo Three.js.

La línea base verificada fue positiva: `npm run world:harness` y `npm run lint` pasaron. No se ejecutó `npm run build`: Vite escribe o actualiza `dist`, y no se solicitó autorización para modificar esos artefactos. No hay un script `test` independiente en `package.json`.

La recomendación es **no migrar todavía los mapas a JSON ni reconstruir el runtime**. Primero conviene separar la validación pura de la representación gráfica, centralizar las dimensiones y coordenadas, y desvincular los datos de colocación de edificios de su carga visual. TypeScript puede seguir siendo la fuente temporal durante esas etapas. Una migración a datos serializables debería empezar solo después de poder comparar los cuatro mapas y demostrar equivalencia de comportamiento.

## 2. Línea base y límites de la verificación

| Comando | Resultado | Alcance |
|---|---|---|
| `npm run world:harness` | **Pasó** | El harness informó conexiones, encuentros y entrenadores de los cuatro mapas y terminó con “World validation passed”. |
| `npm run lint` | **Pasó** | Ejecuta `tsc --noEmit`; no informó errores de tipos. |
| `npm run build` | **No ejecutado** | `vite build` escribe artefactos de producción en `dist`; se dejó sin ejecutar para no modificar archivos sin autorización. |
| Suite `test` | **No encontrada** | `package.json` no define un script `test`. Las dos comprobaciones ejecutadas no equivalen a una prueba visual del juego. |

Los scripts están definidos en [`package.json`](./package.json). No se inició el juego en navegador, por lo que no se verificó visualmente el aspecto de los mapas.

## 3. Arquitectura y contrato actuales

### 3.1 Módulos principales

- [`src/game/data/world.ts`](./src/game/data/world.ts): tipos `MapId`, `MapConnection`, `MapLayoutDefinition`, `WorldMapDefinition`, `MapWildZone` y `MapTamerDefinition`.
- [`src/game/data/maps/`](./src/game/data/maps/): definiciones de Villa Marionette, Ruta 1, Bosque de los Ecos y Cueva del Eco.
- [`src/game/data/maps/index.ts`](./src/game/data/maps/index.ts): registro común `WORLD_MAPS` y tablas derivadas de IDs, nombres y paletas.
- [`src/game/graphics/OverworldTiles.ts`](./src/game/graphics/OverworldTiles.ts): convierte la definición en cuadrícula, decoraciones, colisiones y textura de terreno; también expone la validación del mundo.
- [`src/game/graphics/OverworldProps.ts`](./src/game/graphics/OverworldProps.ts): asocia tipos de decoración a recursos y los representa como sprites.
- [`src/game/graphics/OverworldBuildings.ts`](./src/game/graphics/OverworldBuildings.ts): define colocaciones de los edificios de Villa y carga los modelos GLB.
- [`src/game/graphics/LuminatiRenderer.ts`](./src/game/graphics/LuminatiRenderer.ts): consume datos del mapa para crear entidades, terreno y elementos visuales; también controla transiciones y parte de la lógica del overworld.
- [`tools/world-harness.ts`](./tools/world-harness.ts): ejecuta validación del mundo y comprobaciones adicionales sobre especies, entrenadores y edificios.

### 3.2 Mapas registrados

| ID | Nombre | Conexiones definidas |
|---|---|---|
| `villa_marionette` | Villa Marionette | Ruta 1 |
| `ruta_1` | Ruta 1 · Sendero de los Susurros | Villa Marionette y Bosque de los Ecos |
| `bosque_del_eco` | Bosque de los Ecos | Ruta 1 y Cueva del Eco |
| `cueva_del_eco` | Cueva del Eco | Bosque de los Ecos |

Las definiciones viven en [`villaMarionette.ts`](./src/game/data/maps/villaMarionette.ts), [`ruta1.ts`](./src/game/data/maps/ruta1.ts), [`bosqueDelEco.ts`](./src/game/data/maps/bosqueDelEco.ts) y [`cuevaDelEco.ts`](./src/game/data/maps/cuevaDelEco.ts).

### 3.3 Datos que describe el contrato

El contrato actual incluye:

- Identidad, nombre y paleta visual de cada mapa.
- Conexiones con coordenada de salida, mapa destino, coordenada de llegada y orientación.
- Terreno descrito mediante plaza, ejes de camino o una polilínea, anchura del camino y zonas de hierba silvestre.
- Presupuestos de decoración por tipo, decoraciones fijas y ubicaciones de letreros.
- Huellas de edificios en `layout`, aunque en Villa se derivan desde otra fuente.
- Zonas de encuentro, con límites, tasa y especies con niveles y pesos.
- Entrenadores, con posición, distancia de activación, equipo, retrato y diálogos.
- En la cueva, filas de caracteres `.` y `#` junto con celdas de entrada y objetivo.
- Puntos despejados circulares que reservan espacios para lugares importantes.

### 3.4 Coordenadas, datos derivados y referencias externas

El contrato mezcla varias convenciones:

- Posiciones del mundo expresadas como `x/z`, por ejemplo conexiones, entrenadores y límites de zonas.
- `signSpots` utiliza tuplas `[col, row]`, es decir, coordenadas de tile.
- El laberinto usa `col/row` relativos a sus filas; el generador calcula después su ubicación dentro del mapa.
- Las decoraciones ambientales suelen declararse como cantidades, no como posiciones. [`OverworldTiles.ts`](./src/game/graphics/OverworldTiles.ts) las coloca de forma determinista a partir del ID del mapa y de la geometría disponible.
- Las paredes de la cueva se convierten en decoraciones durante la generación.
- Las huellas y los puntos despejados de los edificios de Villa se construyen a partir de `VILLA_BUILDINGS`.
- Las rutas de imágenes de props se resuelven en [`OverworldProps.ts`](./src/game/graphics/OverworldProps.ts), no en el contrato del mapa.

Por ello, aunque muchos valores son serializables, la definición actual no constituye todavía un archivo de mapa autónomo que contenga toda la información necesaria para editar, validar y representar el nivel sin imports o cálculos adicionales.

El contrato contiene entrenadores y encuentros, pero no un sistema general de puntos de aparición de entidades. Algunas entidades —por ejemplo, el santuario y la tienda— se crean directamente en `LuminatiRenderer.ts`.

## 4. Dependencias y riesgos para un futuro editor

### 4.1 Datos de Villa acoplados a edificios gráficos

[`villaMarionette.ts`](./src/game/data/maps/villaMarionette.ts) importa `VILLA_BUILDINGS` desde [`OverworldBuildings.ts`](./src/game/graphics/OverworldBuildings.ts). De esa lista deriva huellas y reservas de espacio. El módulo de edificios combina ID, archivo GLB, posición, rotación, escala, huella, instalación y entrada.

El harness también importa esa lista para comprobar orientación, puertas y accesos. Así, un cambio de edificio puede afectar visualización, colisión, ubicación de la entrada y validación; los datos del mapa no pueden leerse sin tocar un módulo de presentación Three.js.

### 4.2 Responsabilidades acumuladas en el renderer

[`LuminatiRenderer.ts`](./src/game/graphics/LuminatiRenderer.ts) integra representación de escenas con construcción de elementos, inicialización de entidades, transiciones, consulta de colisiones, movimiento y activación de encuentros y entrenadores. El módulo también participa en otros sistemas visuales, como combate y evolución.

Esto eleva el riesgo de que una modificación de mapas afecte comportamiento no relacionado. La propuesta no requiere reorganizar el renderer en esta fase; se recomienda añadir fronteras de datos y adaptadores pequeños antes de cualquier refactorización mayor.

### 4.3 Dimensiones y coordenadas duplicadas

[`OverworldTiles.ts`](./src/game/graphics/OverworldTiles.ts) define `TILE_UNITS = 1.5` y `MAP_TILES = 40`, y usa esos valores para generar cuadrícula, terreno, colisiones y validación. El renderer crea por separado un plano `60 x 60` y mantiene límites de movimiento y radios de transición. El borde de tiles y el radio de conexión también son reglas separadas.

Si un editor usa otros valores o una conversión distinta entre `x/z` y `col/row`, su vista puede no coincidir con el área caminable del runtime.

### 4.4 Acoplamiento entre mapa y sistemas de juego

- `OverworldTiles` calcula obstáculos y define `isBlocked`; el movimiento del jugador lo consulta desde `LuminatiRenderer`.
- `LuminatiRenderer` busca las conexiones del mapa activo para efectuar transiciones.
- Las zonas de encuentro y los entrenadores se convierten en entidades del ECS al inicializar el renderer.
- El harness importa validación desde el módulo que también importa Three.js y genera terreno.

Para un editor fiable, la validación de datos debería ejecutarse sin crear texturas ni depender del renderizado, mientras que el runtime debe conservar la autoridad sobre el movimiento y las reglas actuales.

## 5. Propuesta técnica incremental

### 5.1 Contrato estable

Mantener un contrato TypeScript explícito y versionable, describiendo qué campos son datos de autoría, cuáles son derivados y cuáles son referencias a recursos. No incorporar campos nuevos por anticipado sin una necesidad del runtime/editor que los justifique.

### 5.2 Dimensiones y coordenadas

Crear una fuente única para dimensiones del mapa y conversiones entre coordenadas de tile y de mundo. Primero se usaría desde la lógica actual sin cambiar valores. La prueba esencial es que las conversiones reproduzcan exactamente centros, límites, colisiones y accesos actuales.

### 5.3 Formato de datos: opciones

| Opción | Beneficios | Costes y riesgos | Uso recomendado |
|---|---|---|---|
| **Conservar TypeScript temporalmente** | Aprovecha los tipos y datos existentes; menor cambio inicial. | No impide imports ni expresiones calculadas y no es un formato de intercambio general. | Primera etapa, tras mantener las definiciones como datos planos y validar sin renderizado. |
| **Migrar todos los mapas a JSON ahora** | Fácil de leer y de consumir por herramientas externas. | Migración simultánea, riesgo de diferencias y falta de comparación previa; se puede acabar manteniendo dos fuentes. | No recomendado como primer paso. |
| **Migración gradual a datos serializables** | Permite aprender con un mapa piloto y comparar antes de extender. | Requiere una transición controlada y una sola fuente oficial por mapa. | Opción objetivo, después de estabilizar el contrato y contar con comparación automática. |

JSON no se debe declarar solución definitiva antes de probar las necesidades reales del editor. Puede mantenerse TypeScript como fuente temporal y generar/consumir una representación serializable intermedia, evitando duplicar el contenido.

### 5.4 Validación sin renderizado

Extraer comprobaciones de estructura, límites, referencias y relaciones a una función pura que opere sobre el contrato. El harness puede invocarla sin importar el renderer gráfico. Las comprobaciones actuales deben mantenerse y compararse durante la transición.

### 5.5 Operaciones para OpenCode y futuro editor

Una vez estable el contrato, definir operaciones pequeñas sobre entidades identificables —por ejemplo, cambiar posición, editar conexión o añadir decoración— que validen el resultado y produzcan diferencias revisables. Tanto OpenCode como el editor deberían operar sobre la misma fuente y ejecutar el mismo validador. No se recomienda permitir que cada herramienta implemente sus propias reglas de coordenadas.

## 6. Plan de migración y aceptación

Las siguientes tareas son propuestas; **no se ejecutaron en esta fase**.

| Prioridad / tarea | Objetivo y archivos candidatos | Riesgos | Pruebas de aceptación y criterio de término | Recuperación |
|---|---|---|---|---|
| **1. Aislar validación pura** | Extraer reglas de datos de `OverworldTiles.ts` a un módulo independiente; ajustar `world-harness.ts` y mantener `world.ts` como contrato. | Perder comprobaciones o cambiar sus resultados. | Ejecutar validación antigua y nueva en paralelo; comparar errores; `world:harness` y `lint` pasan. Termina cuando el harness no dependa del renderizado y cubra las comprobaciones previas. | Mantener la validación actual como autoridad y retirar el adaptador nuevo si difiere. |
| **2. Centralizar dimensiones y coordenadas** | Añadir un módulo de geometría común y migrar progresivamente referencias en `OverworldTiles.ts`, `LuminatiRenderer.ts` y el harness. | Alterar límites efectivos, colisiones, accesibilidad o accesos. | Pruebas de conversión en centros y bordes; comparación de colisiones y conexiones de los cuatro mapas; harness y lint pasan. Termina con una sola fuente y resultados equivalentes. | Revertir únicamente el uso del módulo nuevo y conservar los valores anteriores. |
| **3. Desacoplar edificios de los módulos gráficos** | Separar datos de colocación del loader GLB; actualizar `villaMarionette.ts`, `OverworldBuildings.ts`, `OverworldTiles.ts` y `world-harness.ts`. | Discrepancias entre modelos, huellas, puertas y caminos. | Mismos IDs, modelos, posiciones, escala, huellas y entradas; accesos sin bloqueo; harness pasa. Termina cuando los datos de Villa se puedan leer sin importar Three.js. | Volver temporalmente al origen actual de `VILLA_BUILDINGS` y restaurar la derivación previa. |
| **4. Verificar serialización del contrato** | Documentar campos y convención de coordenadas en `world.ts` y mapas; ampliar validador/harness. | Representar incorrectamente tuplas, recursos o contenido calculado. | Serializar y volver a leer una representación de prueba; comparar todos los campos de los cuatro mapas. Termina si la representación es completa y reversible, sin migrar aún el runtime. | Mantener TypeScript como fuente y no activar lectura serializada. |
| **5. Probar migración piloto con adaptador** | Elegir un mapa de alcance acotado, añadir loader/adaptador y registrarlo sin reemplazar el runtime global. | Diferencias en decoración determinista, terreno, colisiones o conexiones. | Comparar campos, cuadrícula, obstáculos, conexiones, encuentros y decoración; ejecutar harness, lint, build autorizado e inspección visual. Termina con comportamiento equivalente en juego. | Desactivar el adaptador y volver al módulo TypeScript original del piloto. |
| **6. Añadir operaciones y editor mínimo** | Implementar operaciones estructuradas y posteriormente una interfaz que use el contrato y validador compartidos. | Cambios inválidos, divergencia entre editor y runtime, o edición accidental de datos ajenos. | Pruebas por operación, validación antes de guardar y mapa editado comprobado en el juego. Termina cuando cambios de editor y OpenCode producen diferencias pequeñas y reproducibles sobre una sola fuente. | Descartar el cambio de datos antes de cargarlo y conservar el último mapa validado. |

En todas las etapas se debe preservar la compatibilidad de los cuatro mapas, incluyendo:

- terreno y límites generados;
- resultados de colisión;
- decoraciones deterministas;
- huellas, entradas y caminos de edificios;
- conexiones y puntos de llegada;
- zonas de encuentros y entrenadores;
- accesibilidad del laberinto.

## 7. Recomendación y primeras tareas

La arquitectura objetivo debe conservar Three.js y el runtime existente, pero hacer que el contrato de mapa sea la fuente compartida por el harness, OpenCode y el futuro editor. Para reducir el riesgo, primero se elimina la dependencia del renderizado en la validación; después se centraliza la geometría; y a continuación se separan los datos de edificios. Solo entonces se decide, con pruebas, si conviene conservar TypeScript, generar un formato serializable o migrar gradualmente.

**Primeras tres tareas recomendadas, por prioridad:**

1. Aislar la validación de mapas del renderizado y demostrar que mantiene todas las comprobaciones actuales.
2. Centralizar dimensiones y conversiones de coordenadas sin alterar movimiento, colisiones ni límites.
3. Desacoplar los datos de colocación de edificios de la carga gráfica, preservando huellas, entradas y accesos.

No se ha iniciado ninguna de estas tareas. Se requiere autorización antes de modificar archivos de código.
