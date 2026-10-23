import { Move } from '../../types/game';

export type SlotType = 'base' | 'memoria' | 'reaccion';

export interface SlotHabilidad {
  slotId: number;
  type_slot: SlotType;
  skillId?: string;
  validator: (move: Move) => { allowed: boolean; reason?: string };
}

/**
 * Factory to create SlotHabilidad instances with specific validation logic
 */
export const createSlot = (slotId: number, type_slot: SlotType): SlotHabilidad => {
  return {
    slotId,
    type_slot,
    validator: (move: Move) => {
      const tags = move.tags || [];

      switch (type_slot) {
        case 'base':
          // Base slots: cannot contain special memory/reaction skills
          if (tags.some(t => ['Memory', 'Purga', 'Limpieza', 'Antidoto', 'Desparalizar'].includes(t))) {
            return { allowed: false, reason: 'Esta habilidad es especial y no puede equiparse en ranuras base.' };
          }
          return { allowed: true };

        case 'memoria':
          // Memory slot: requires 'Memory' or 'Unique' tag
          if (!tags.includes('Memory') && !tags.includes('Unique')) {
            return { allowed: false, reason: 'Solo habilidades de memoria o únicas pueden equiparse en esta ranura.' };
          }
          return { allowed: true };

        case 'reaccion':
          // Reaction slot: requires tags related to status cleansing or reaction
          if (!tags.some(t => ['Limpieza', 'Purga', 'Antidoto', 'Desparalizar', 'Reactive'].includes(t))) {
            return { allowed: false, reason: 'Solo habilidades de reacción o purga pueden equiparse en esta ranura.' };
          }
          return { allowed: true };
          
        default:
          return { allowed: false, reason: 'Tipo de slot desconocido.' };
      }
    }
  };
};
