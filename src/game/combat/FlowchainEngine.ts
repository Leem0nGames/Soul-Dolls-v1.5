import { SoulDollInstance, Move } from '../../types/game';

export interface FlowchainDefinition {
  id: string;
  name: string;
  sequence: string[]; // moveIds in exact order
  bonusDescription: string;
  applyBonus: (doll: SoulDollInstance) => void;
}

const FLOWCHAIN_DATABASE: FlowchainDefinition[] = [
  {
    id: 'cosecha_almas',
    name: 'Cosecha de Almas',
    sequence: ['ember', 'flame_claw', 'inferno_surge'],
    bonusDescription: '+30% probabilidad de crítico en este ataque encadenado.',
    applyBonus: (doll) => {
      // Temporary flag for next attack crit boost
      (doll as any)._nextCritBoost = 0.30;
    },
  },
  {
    id: 'purificacion_completa',
    name: 'Purificación Completa',
    sequence: ['bubble_veil', 'hydro_jet', 'inferno_surge'],
    bonusDescription: 'El escudo desplegado dura +1 turno adicional.',
    applyBonus: (doll) => {
      if (doll.activeShield) {
        doll.activeShield.turnsRemaining += 1;
      }
    },
  },
];

export const FlowchainEngine = {
  checkFlowchain(doll: SoulDollInstance, move: Move): { triggered: boolean; flowchainName?: string; bonusMsg?: string } {
    if (!doll.flowchainHistory) {
      doll.flowchainHistory = [];
    }

    doll.flowchainHistory.push(move.id);
    if (doll.flowchainHistory.length > 3) {
      doll.flowchainHistory.shift();
    }

    for (const fc of FLOWCHAIN_DATABASE) {
      if (doll.flowchainHistory.length >= fc.sequence.length) {
        const slice = doll.flowchainHistory.slice(-fc.sequence.length);
        const matches = slice.every((mId, idx) => mId === fc.sequence[idx]);
        if (matches) {
          fc.applyBonus(doll);
          return {
            triggered: true,
            flowchainName: fc.name,
            bonusMsg: `✨ ¡FLOWCHAIN ACTIVADA: [${fc.name}]! ${fc.bonusDescription}`,
          };
        }
      }
    }

    return { triggered: false };
  },
};
