# Auditoría técnica del motor de mapas — Soul Dolls v1.5

**Fecha:** 25 de octubre de 2026  
**Alcance:** inspección del código, la documentación y las herramientas existentes. No se modificó el motor ni se inició el juego en navegador.

## 1. Resumen ejecutivo

El proyecto cuenta con un motor de overworld funcional en Three.js y datos de mapa centralizados, pero **no se encontró un editor visual de mapas**. Los niveles actuales se crean editando módulos TypeScript. Un agente puede ayudar a cambiar esos módulos, aunque no existen interfaz de edición, formato independiente de niveles ni operaciones visuales de selección, pintura o deshacer.

El runtime y el validador consumen las mismas definiciones de mapas. El harness verifica conexiones, accesibilidad lógica, zonas de encuentro, entrenadores y referencias a especies. Es una base útil para crear mapas pequeños, pero no sustituye pruebas de renderizado o de juego.

**Recomendación:** conservar el runtime actual y mejorar primero el contrato de datos y las herramientas de validación. Considerar un editor visual sobre el mismo contrato solo cuando el volumen de contenido lo justifique. La inspección no encontró motivos para una migración completa.

## 2. Arquitectura real

### Flujo principal

```text
src/main.tsx
  └── monta React
      └── src/App.tsx
          ├── crea LuminatiRenderer
          │   ├── construye una escena Three.js compartida
          │   ├── crea terreno, props, edificios e interiores
          │   ├── consume WORLD_MAPS
          │   └── coordina cámara, movimiento, colisiones y transiciones
          ├── muestra las interfaces del juego
          └── comparte estado mediante useGameStore

src/game/data/maps/*.ts
  └── src/game/data/maps/index.ts → WORLD_MAPS
      ├── OverworldTiles.ts → grilla, decoraciones, colisiones y textura
      └── LuminatiRenderer.ts → entidades, encuentros y transiciones

tools/world-harness.ts
  └── importa las mismas definiciones y valida el mundo
```

### Módulos y responsabilidades observadas

- [`src/main.tsx`](./src/main.tsx): monta la aplicación React.
- [`src/App.tsx`](./src/App.tsx): inicializa `LuminatiRenderer`, conecta teclado y renderiza las interfaces del juego.
- [`src/game/graphics/LuminatiRenderer.ts`](./src/game/graphics/LuminatiRenderer.ts): inicializa Three.js; coordina terreno, cámara, movimiento, colisiones, transiciones, encuentros e interacciones. También crea y muestra interiores y edificios.
- [`src/game/data/world.ts`](./src/game/data/world.ts): define los tipos `MapId`, `WorldMapDefinition`, conexiones, distribución del mapa, zonas de encuentro y entrenadores.
- [`src/game/data/maps/`](./src/game/data/maps/): contiene las definiciones TypeScript de Villa Marionette, Ruta 1, Bosque de los Ecos y Cueva del Eco.
- [`src/game/data/maps/index.ts`](./src/game/data/maps/index.ts): registra los mapas y deriva IDs, nombres y paletas.
- [`src/game/graphics/OverworldTiles.ts`](./src/game/graphics/OverworldTiles.ts): genera la grilla, coloca decoración determinista, determina colisiones, valida rutas y hornea el terreno a una textura de canvas.
- [`src/game/graphics/OverworldProps.ts`](./src/game/graphics/OverworldProps.ts): carga props como billboards y dibuja los muros de la cueva con `THREE.InstancedMesh`.
- [`src/game/graphics/OverworldBuildings.ts`](./src/game/graphics/OverworldBuildings.ts): declara y carga los ocho edificios GLB de Villa Marionette.
- [`src/game/graphics/FacilityInterior.ts`](./src/game/graphics/FacilityInterior.ts): construye interiores estáticos para cinco tipos de instalaciones.
- [`src/game/ecs/World.ts`](./src/game/ecs/World.ts) y [`src/game/ecs/Components.ts`](./src/game/ecs/Components.ts): almacenan entidades y componentes; el renderer ejecuta la lógica de movimiento y encuentros.
- [`tools/world-harness.ts`](./tools/world-harness.ts): combina `validateWorldMaps()` con comprobaciones adicionales de edificios, encuentros, especies y equipos de entrenadores.

### Datos de mapa, formato y editor

Los niveles se describen mediante objetos TypeScript tipados; no se encontró un formato de niveles JSON, Tiled, LDtk u otro formato exportado por un editor. El juego y `world:harness` importan el mismo registro `WORLD_MAPS`, por lo que **runtime y validador comparten la fuente de datos**. No se encontró un editor que mantenga una representación independiente.

Hay cierta separación entre datos y presentación, pero no es completa: por ejemplo, [`villaMarionette.ts`](./src/game/data/maps/villaMarionette.ts) importa `VILLA_BUILDINGS` desde el módulo gráfico para derivar las huellas de los edificios.

### Dependencias relevantes

Según [`package.json`](./package.json), el proyecto usa:

- Three.js `^0.186.1` y `@types/three` `^0.186.0`.
- React `^19.0.1`.
- Vite `^8.3.0`.
- `GLTFLoader` de Three.js para los modelos de edificios.

No se encontró una dependencia de editor visual, motor de física externo o pathfinding. Los scripts existentes incluyen `world:harness`, `lint` (`tsc --noEmit`) y `build`.

La documentación disponible incluye [`AGENTS.md`](./AGENTS.md), [`WORLD_DESIGN.md`](./WORLD_DESIGN.md) y la skill de OpenCode [`tilemap-pipeline/SKILL.md`](./.opencode/skills/tilemap-pipeline/SKILL.md). Esta skill es documentación para agentes, no una herramienta conectada al runtime para editar mapas.

## 3. Inventario de funcionalidades del editor

Los estados describen la presencia de una función en el **editor**. Una característica del runtime no implica que exista una herramienta para editarla.

| Funcionalidad | Estado | Evidencia |
|---|---|---|
| Crear y eliminar mapas desde una interfaz | **NO ENCONTRADA** | Los mapas se registran manualmente en [`maps/index.ts`](./src/game/data/maps/index.ts); no se encontró UI de edición. |
| Tamaño y límites del mundo | **PARCIALMENTE IMPLEMENTADA** | El runtime usa 40×40 tiles, 1,5 unidades por tile y movimiento limitado aproximadamente a ±26,8 unidades. Los valores no son configurables desde un editor. |
| Terreno y edición de alturas | **PARCIALMENTE IMPLEMENTADA** | El runtime define tipos de terreno y genera la superficie; no se encontró edición de alturas o relieve. |
| Grid y sistemas de coordenadas | **IMPLEMENTADA Y VERIFICADA** | El runtime convierte entre coordenadas de mundo y tiles; el harness usa la grilla para validar accesibilidad. No hay vista de grilla interactiva. |
| Capas y organización editable de objetos | **NO ENCONTRADA** | Hay grupos de escena y el suelo se hornea en un canvas, pero no hay capas editables en una interfaz. |
| Selección, movimiento, rotación y escalado de objetos | **NO ENCONTRADA** | No se encontraron gizmos o herramientas de transformación. |
| Duplicación o eliminación de objetos | **NO ENCONTRADA** | No se encontraron operaciones de edición visual. |
| Colocación de edificios y decoración | **PARCIALMENTE IMPLEMENTADA** | Edificios y presupuestos de decoración se declaran en código; no se colocan desde una interfaz. |
| Materiales, texturas e iluminación | **PARCIALMENTE IMPLEMENTADA** | El runtime utiliza materiales y luces Three.js; no hay herramientas por mapa para editarlos. |
| Importación de recursos externos | **NO ENCONTRADA** | Los recursos se registran en el código y en carpetas de `public/`; no hay importador visual. |
| Pinceles y pintura | **NO ENCONTRADA** | El terreno se deriva de caminos, zonas y reglas de generación, no de pinceladas editables. |
| Deshacer y rehacer | **NO ENCONTRADA** | No se encontró historial de operaciones de edición. |
| Guardado, carga y exportación de niveles desde el editor | **NO ENCONTRADA** | Los mapas se incluyen en el bundle como TypeScript; no se encontró serialización o almacenamiento de niveles. |
| Vista previa dentro de un editor | **NO ENCONTRADA** | El juego muestra el resultado al ejecutarse, pero no existe una vista previa asociada a una herramienta de edición. |
| Entidades y puntos de aparición editables | **PARCIALMENTE IMPLEMENTADA** | Los datos definen encuentros y entrenadores; el renderer crea además jugador, NPC y servicios. No hay editor genérico de entidades/spawns. |
| Colisiones y navegación | **PARCIALMENTE IMPLEMENTADA** | Hay colisión de tiles, paredes, árboles y huellas de edificios, además de un BFS de validación. No se encontró pathfinding de personajes. |
| Interiores y varios pisos | **PARCIALMENTE IMPLEMENTADA** | Existen cinco interiores estáticos, alcanzados mediante cambios de posición a una plataforma en `Y = 80`. No son pisos editables ni mapas de interior independientes. |
| Generación procedural | **PARCIALMENTE IMPLEMENTADA** | La distribución de decoración es determinista por ID de mapa y la cueva usa filas ASCII. No se encontró generación de mundo con semilla configurable por nivel. |
| Compatibilidad con mapas grandes | **NO ENCONTRADA** | El tamaño y el horneado están fijados a 40×40; no se encontró streaming o soporte probado de mapas mayores. |

## 4. Escalabilidad y limitaciones comprobables

### Capacidades existentes

- Cada mapa actual tiene 40×40 tiles, 60×60 unidades y un terreno horneado a una textura de 640×640 píxeles que se aplica a un solo plano.
- La colocación de decoraciones usa una semilla estable basada en el ID del mapa.
- Los muros de la cueva usan `InstancedMesh`; los props ordinarios se representan como sprites individuales.
- Las texturas de terreno se almacenan en caché por ID de mapa. Las props de mapas visitados permanecen en la escena y se ocultan al cambiar de mapa.
- Las definiciones incluyen conexiones entre áreas. El harness comprueba enlaces recíprocos y accesibilidad de zonas de encuentro y entrenadores.

### Límites reales y riesgos técnicos

1. **Dimensiones y coordenadas fijas.** `MAP_TILES`, `TILE_UNITS`, el plano de 60 unidades y los límites de movimiento están en módulos distintos. Cambiar uno sin los demás puede desalinear terreno, colisión y movimiento.
2. **Sin chunks ni streaming.** Cada mapa se hornea completo. No hay carga/descarga de regiones; las texturas horneadas y props visitadas se conservan durante la vida del renderer.
3. **Instanciación parcial.** Los muros de cueva se instancian, pero los props ordinarios son sprites individuales. No se encontraron perfiles de draw calls ni presupuestos medidos.
4. **Una escena Three.js compartida.** Overworld, arena, interiores y evolución conviven en la escena, separados por posición, grupos o visibilidad. Es manejable con el alcance actual, pero incrementa el acoplamiento para añadir espacios.
5. **Edificios específicos de la villa.** El catálogo y cargador GLB están centrados en Villa Marionette, no en un sistema modular general para todos los mapas.
6. **Interiores estáticos.** Las salas comparten dimensiones y se construyen por código; no hay interiores como niveles autónomos, varios pisos o navegación con colisiones.
7. **Azar reproducible solo en parte.** La decoración procedural es determinista, pero los encuentros usan `Math.random()`. No existe una semilla de sesión que permita reproducir toda una partida.
8. **Identidad de objetos limitada.** Entrenadores se identifican por mapa y nombre; decoraciones fijas se definen por tipo y posición. No se encontró un sistema general de IDs persistentes de instancias colocadas.
9. **Cobertura incompleta del validador.** El harness valida enlaces, accesibilidad, entrenadores, encuentros y especies. No valida todos los solapamientos, la integridad de todos los assets, el render visual ni cada tile de una zona; para zonas comprueba el centro.
10. **Campos de niebla sin efecto actual.** Las paletas conservan `fog` y `fogDensity`, pero `applyMapTint()` asigna `scene.fog = null`. Por tanto, esos campos no se aplican al render en el estado actual del código. Esto concuerda con la decisión reciente de eliminar la bruma.
11. **Fallback visual ante fallo de tiles.** Si falla el horneado/carga del terreno, el renderer registra un warning y conserva el suelo verde plano. El juego puede seguir mostrándose con un mapa visualmente incompleto.
12. **Carga de edificios.** Si falla la carga de un GLB, se registra el error y se rechaza la carga conjunta de modelos; no hay un modelo sustituto equivalente definido en ese cargador.

No se encontró evidencia que demuestre que los mapas actuales requieran chunks. Con solo cuatro áreas de 40×40, el horneado completo y un solo plano parecen adecuados; antes de añadir streaming conviene medir memoria y tiempos con mapas representativos más grandes.

## 5. Compatibilidad con OpenCode y agentes de IA

**Evaluación: limitada, con una base aprovechable.**

**A favor**

- Hay tipos explícitos para las definiciones.
- Cada mapa tiene un módulo propio.
- `world:harness` permite verificar una parte importante de los datos sin abrir el juego.
- [`WORLD_DESIGN.md`](./WORLD_DESIGN.md) documenta coordenadas, conexiones, encuentros y reglas de autoría.
- La generación de decoración determinista facilita reproducir esos resultados.

**En contra**

- No hay esquema serializable/versionado independiente de TypeScript.
- No hay operaciones reutilizables de edición, historial, guardado o recuperación.
- Las instrucciones de OpenCode describen procesos, pero no añaden comandos estructurados para crear, mover o guardar objetos.
- `LuminatiRenderer.ts` concentra responsabilidades de render, movimiento, colisión, encuentros y transiciones.
- Algunos datos dependen de módulos gráficos, como las huellas de edificios.
- No se encontró una suite automatizada de pruebas unitarias, integración o navegador. Un cambio que compila puede aún tener errores visuales o de juego.

Un agente puede modificar mapas en código y ejecutar el harness, pero falta un contrato más completo para hacer cambios repetibles y seguros. El mayor riesgo es que un dato válido para TypeScript no represente una escena legible o una colisión que coincida con la imagen.

## 6. Estrategias posibles

| Criterio | A. Conservar el motor y mejorar herramientas | B. Editor visual sobre el runtime actual | C. Herramienta externa o reemplazo del subsistema |
|---|---|---|---|
| Qué conserva | Three.js, renderer, datos actuales, horneado y colisiones | Runtime y contrato; añade UI de edición | Puede conservar runtime, pero sustituye autoría/formato o generación |
| Qué reemplaza | Ningún sistema central; mejora datos, validación y tooling | Añade editor y probablemente un formato serializable | Importador/formato o partes del subsistema de mapas |
| Riesgo de romper sistemas | Bajo–medio; principalmente si se refactorizan coordenadas y colisiones | Medio; sincronización editor/runtime, selección y transformaciones | Alto si cambia runtime; medio-alto si solo se importa un formato |
| Complejidad aproximada | Baja–media | Media–alta | Alta |
| Dificultad para un desarrollador asistido por IA | Baja–media si hay contratos y harness | Media–alta por UI y operaciones editables | Alta por conversión y diferencias entre formatos |
| Compatibilidad con el juego | Muy alta | Alta si guarda el mismo contrato | Variable; depende del importador |
| Rendimiento potencial | Similar al actual; optimización guiada por mediciones | No necesita cambiar el runtime | Puede mejorar o empeorar según lo que genere |
| Riesgo de migración | Bajo | Medio | Alto para reemplazo; medio-alto para importación |
| Dependencias externas | Bajas | Bajas si es interno | Medias/altas si depende de formato/herramienta externa |
| Mantenimiento a largo plazo | Moderado y controlable | Hay que mantener editor y runtime compatibles | Hay que mantener el importador y compatibilidad del formato |

La opción C no requiere necesariamente abandonar Three.js: una herramienta externa podría exportar un formato que se convierta al contrato del juego. El conversor se volvería entonces una pieza crítica que debe validar tiles, colisiones, objetos, conexiones y referencias a assets.

## 7. Arquitectura objetivo recomendada

**Empezar por A y preparar B de forma incremental.** No recomiendo migrar el runtime ni adoptar un editor externo antes de demostrar que la arquitectura actual no alcanza.

1. Definir un contrato serializable y validable para mapas, con versión de formato e IDs estables.
2. Mantener una fuente única de datos que pueda consumir tanto runtime como harness.
3. Separar los datos de mapa de módulos gráficos. Por ejemplo, las huellas de edificios no deberían depender de importar el renderer.
4. Centralizar dimensiones, conversión de coordenadas y límites para evitar valores repetidos.
5. Ampliar el validador para decoraciones fijas, referencias a assets, solapamientos y límites de zonas.
6. Crear operaciones pequeñas para OpenCode —validar mapa, crear plantilla, modificar datos permitidos— que devuelvan errores claros y no omitan validaciones.
7. Decidir después si las herramientas de lenguaje natural bastan o si el volumen de contenido justifica un editor visual.
8. Medir memoria, tiempos de horneado y draw calls antes de diseñar chunks o streaming.

## 8. Plan por fases y pruebas

| Fase | Trabajo | Pruebas requeridas |
|---|---|---|
| 1. Contrato y línea base | Documentar campos, coordenadas, colisiones y conexiones; conservar resultados del harness actual. | `world:harness`, `lint`, build y revisión visual manual. |
| 2. Separación de datos | Quitar dependencias gráficas desde definiciones; centralizar dimensiones y conversiones. | Harness para todos los mapas, lint, build y comprobación de bordes/huellas. |
| 3. Validación ampliada | Validar decoraciones fijas, assets, solapamientos y cobertura de zonas; decidir si usar datos versionados. | Casos válidos e inválidos; pruebas de migración si se introduce versión. |
| 4. Herramientas OpenCode | Añadir operaciones estructuradas para leer/crear/modificar mapas y validar antes/después. | Escenarios de creación y cambio, errores reproducibles, harness tras cada operación. |
| 5. Prototipo visual opcional | Implementar selección, movimiento, colocación y guardado sobre el contrato común, sin cambiar el runtime. | Equivalencia guardar/cargar, undo/redo, preview vs. runtime y colisiones. |
| 6. Escalabilidad medida | Perfilado con mapas mayores representativos antes de decidir chunks o streaming. | Comparar draw calls, memoria, tiempo de horneado y cambio de mapa. |

## 9. Módulos que conviene conservar y candidatos futuros

### Conservar como base

- [`src/game/data/world.ts`](./src/game/data/world.ts): contrato tipado.
- [`src/game/data/maps/index.ts`](./src/game/data/maps/index.ts): registro central actual.
- [`src/game/graphics/OverworldTiles.ts`](./src/game/graphics/OverworldTiles.ts): reglas compartidas de grilla, horneado, colisión y validación.
- [`src/game/graphics/LuminatiRenderer.ts`](./src/game/graphics/LuminatiRenderer.ts): runtime Three.js; no hay evidencia para reemplazarlo.
- [`src/game/graphics/OverworldProps.ts`](./src/game/graphics/OverworldProps.ts), [`OverworldBuildings.ts`](./src/game/graphics/OverworldBuildings.ts) y [`FacilityInterior.ts`](./src/game/graphics/FacilityInterior.ts): sistemas visuales existentes.
- [`tools/world-harness.ts`](./tools/world-harness.ts), [`WORLD_DESIGN.md`](./WORLD_DESIGN.md) y [`AGENTS.md`](./AGENTS.md): validación y documentación.

### Candidatos a modificación futura

- [`src/game/data/world.ts`](./src/game/data/world.ts): ampliar/versionar el contrato si se decide hacerlo serializable.
- Los módulos de [`src/game/data/maps/`](./src/game/data/maps/): retirar dependencias gráficas e incorporar el contrato elegido.
- [`src/game/graphics/OverworldTiles.ts`](./src/game/graphics/OverworldTiles.ts): consumir dimensiones compartidas y ampliar checks.
- [`src/game/graphics/LuminatiRenderer.ts`](./src/game/graphics/LuminatiRenderer.ts): reducir responsabilidades y consumir datos normalizados.
- [`tools/world-harness.ts`](./tools/world-harness.ts): cubrir nuevos campos y escenarios.
- [`tools/`](./tools) y [`.opencode/`](./.opencode): añadir operaciones ejecutables solo si se decide que OpenCode debe editar mapas de forma estructurada.

## 10. Pruebas ejecutadas y no ejecutadas

| Prueba o inspección | Resultado | Alcance |
|---|---|---|
| `npm run world:harness` | **Pasó** | Validó los cuatro mapas: enlaces, accesibilidad, encuentros, entrenadores y especies. |
| `npm run lint` | **Pasó** | Ejecuta `tsc --noEmit`; comprueba tipos, no renderizado ni comportamiento visual. |
| Búsqueda de archivos/configuración de pruebas | **No se encontró suite** | No se halló configuración de Vitest/Jest/Playwright ni archivos de pruebas en la inspección. |
| Build de producción | **No ejecutado** | No era necesario para la inspección; además genera archivos de salida. |
| Prueba visual en navegador | **No ejecutada** | No se inició el juego en navegador. |

## 11. Decisiones pendientes del director

1. ¿La fuente futura debe seguir siendo TypeScript o priorizas datos JSON editables por herramientas?
2. ¿La prioridad es que OpenCode genere mapas mediante instrucciones o contar con una interfaz visual manual?
3. ¿Esperas decenas de áreas pequeñas como las actuales o mapas continuos mucho mayores?
4. ¿Los interiores deben seguir siendo salas prefabricadas o deberían ser mapas independientes?
5. ¿El agente podrá colocar objetos libremente o solo mediante operaciones acotadas y validadas?

## Conclusión

La arquitectura actual es adecuada para seguir el juego y construir áreas pequeñas mediante código. No existe hoy un editor visual que pueda ampliarse directamente. La ruta de menor riesgo es mejorar primero el contrato y las herramientas de validación/OpenCode, manteniendo Three.js y el runtime existentes. Un editor visual o una herramienta externa deben evaluarse después, a partir de necesidades de producción y pruebas concretas.
