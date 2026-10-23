import { AffinityRank, SoulDollSpecies, Move } from '../../types/game';
import { TABLA_PROHIBIDOS } from '../data/TablaProhibidos';

export const AffinityValidator = {
  getAffinity(classRole: string = 'Assassin', weaponType: string = 'Dagger'): AffinityRank {
    const roleTable = (TABLA_PROHIBIDOS as any)[classRole];
    if (!roleTable) return 'B';
    const rank = roleTable[weaponType];
    return rank === 'X' ? 'Forbidden' : (rank || 'B');
  },

  canEquipSkill(species: SoulDollSpecies, move: Move): { allowed: boolean; reason?: string } {
    const role = species.classRole || 'Assassin';
    const weapon = move.weaponType || 'Dagger';
    const rank = this.getAffinity(role, weapon);

    if (rank === 'Forbidden') {
      return {
        allowed: false,
        reason: `Incompatible con el Lore: La clase [${role}] tiene prohibido portar armas/escuelas tipo [${weapon}].`,
      };
    }

    return { allowed: true };
  },
};
