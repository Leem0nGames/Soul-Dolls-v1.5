import { Move, SlotType } from '../../types/game';

/**
 * Validador de Habilidades por Tipo de Slot (4+1+1)
 * Lógica de validación basada en tags para garantizar la identidad de cada ranura.
 */
export const SlotValidator = {
  validate(move: Move, slotType: SlotType): { allowed: boolean; reason?: string } {
    const tags = move.tags || [];

    switch (slotType) {
      case 'base':
        // Los slots base no pueden contener habilidades exclusivas de memoria o reacción
        if (tags.includes('Memory') || tags.includes('Purge') || tags.includes('Antidote') || tags.includes('Cleanse')) {
          return { 
            allowed: false, 
            reason: 'Esta habilidad es especial y no puede equiparse en ranuras base.' 
          };
        }
        return { allowed: true };

      case 'memory':
        // Solo habilidades con tag 'Memory' o 'Unique'
        if (!tags.includes('Memory') && !tags.includes('Unique')) {
          return { 
            allowed: false, 
            reason: 'Solo habilidades de memoria o únicas pueden equiparse en esta ranura.' 
          };
        }
        return { allowed: true };

      case 'reaction':
        // Solo habilidades de utilidad/reacción
        if (!tags.includes('Purge') && !tags.includes('Antidote') && !tags.includes('Cleanse') && !tags.includes('Reactive')) {
          return { 
            allowed: false, 
            reason: 'Solo habilidades de reacción o purga pueden equiparse en esta ranura.' 
          };
        }
        return { allowed: true };
    }
  }
};
