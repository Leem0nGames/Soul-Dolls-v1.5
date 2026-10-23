import { SoulDollInstance, Move } from '../../types/game';
import { SOULDOLL_SPECIES } from '../data/souldolls';
import { AffinityValidator } from '../combat/AffinityValidator';
import { SlotHabilidad, createSlot } from './SlotHabilidad';

/**
 * EntitySystem centraliza la validación de equipamiento de habilidades.
 * Verifica tanto el Lore/Afinidad como la compatibilidad de Slot.
 */
export const EntitySystem = {
  // Inicializa los slots para un SoulDoll según la estructura 4+1+1
  getSlotsForDoll(dollUuid: string): SlotHabilidad[] {
    return [
      createSlot(1, 'base'),
      createSlot(2, 'base'),
      createSlot(3, 'base'),
      createSlot(4, 'base'),
      createSlot(5, 'memoria'),
      createSlot(6, 'reaccion'),
    ];
  },

  /**
   * Valida si un Doll puede equipar una habilidad en un slot determinado.
   * Cubre: 
   * 1. Afinidad Lore (clase + tipo arma/escuela)
   * 2. Compatibilidad de Slot (4+1+1)
   */
  canEquipSkill(doll: SoulDollInstance, move: Move, targetSlotType: 'base' | 'memoria' | 'reaccion'): { allowed: boolean; reason?: string } {
    const species = SOULDOLL_SPECIES[doll.speciesId];
    
    // 1. Validación de Lore/Afinidad
    const loreCheck = AffinityValidator.canEquipSkill(species, move);
    if (!loreCheck.allowed) return loreCheck;

    // 2. Validación de Slot (4+1+1)
    const slot = createSlot(0, targetSlotType); // Creamos instancia temporal para validar
    const slotCheck = slot.validator(move);
    if (!slotCheck.allowed) return slotCheck;

    return { allowed: true };
  }
};
