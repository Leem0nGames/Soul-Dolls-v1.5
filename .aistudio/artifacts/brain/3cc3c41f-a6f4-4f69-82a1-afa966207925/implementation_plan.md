# Plan de Implementación — SoulDolls RPG (Sistemas Avanzados)

## Visión General
Este plan integra los 6 bloques estratégicos solicitados para robustecer el motor Luminati y el sistema de combate de SoulDolls RPG:
1. **GDD de Mitigación sin Cura** (Reglas de no-curación en combate, escudos de 25-40%, drenaje 30-50%, posturas de mitigación).
2. **Slots con Identidad 4+1+1** (4 Base + 1 Memoria + 1 Reacción/Purga).
3. **Matriz de Afinidad y Validador de Lore** (Clases, tipos de arma, tags y compatibilidad).
4. **Sistema de Memoria y Aprendizaje** (Banco de habilidades y Memorias Únicas).
5. **Motor de Batalla** (Techo de HP, escudos con duración, drenaje por daño, estados de mitigación).
6. **Flowchains con Chain Bonus** (Secuencias encadenadas con bonificaciones tácticas).

---

## Fases de Ejecución

### Fase 0: Actualización de Tipos y GDD (`GDD_HABILIDADES.md`)
- Documentar las reglas de no-curación y los rangos de mitigación.
- Actualizar `src/types/game.ts` para soportar `slotType` (`base` | `memory` | `reaction`), tags de equipamiento y afinidades.

### Fase 1: Arquitectura de Slots 4+1+1
- Refactorizar la estructura de habilidades del SoulDoll para asegurar los 6 slots fijos.
- Adaptar la UI de preparación / equipo para mostrar los tres bloques diferenciados (Base, Memoria, Reacción).

### Fase 2: Matriz de Afinidad y Validador de Lore
- Implementar la matriz de afinidad (S, A, B, C, Prohibido) por clases de SoulDoll y tipos de armas/escuelas.
- Implementar el validador de equipamiento por tags.

### Fase 3: Sistema de Memoria
- Integrar la ranura de Memoria (Slot 5) con objetos consumibles/equipables del inventario y control de unicidad.

### Fase 4: Motor de Combate (Mitigación & Techo de HP)
- Garantizar la regla estricta de que el HP no se recupera por cura directa en batalla.
- Implementar escudos dinámicos (duración de turnos, cap máximo del 40%), drenaje vinculado al daño y mitigación/esquiva.

### Fase 5: Flowchains con Chain Bonus
- Definir el modelo de secuencias con condiciones y bonificaciones tácticas (+30% crítico, duración de escudos, etc.).
- Registrar y evaluar el historial de uso de habilidades en combate por cada SoulDoll.
