import { SoulDollInstance, BattleAction } from '../../types/game';
import { combatEngine } from './CombatEngine';

/**
 * BattleManager gestiona el flujo de turnos, el array de 6 habilidades y
 * asegura el cumplimiento de las reglas de diseño (No curación, mitigación).
 */
export class BattleManager {
  /**
   * Inicializa las acciones de turno asegurando que no se incluyan
   * técnicas de curación directa prohibidas.
   */
  public validateAction(action: BattleAction, doll: SoulDollInstance): { valid: boolean; reason?: string } {
    if (action.type === 'item') {
      // Regla: No curación directa en batalla
      return { valid: false, reason: 'La curación directa está prohibida en combate.' };
    }

    // Verificar si la habilidad seleccionada intenta curar
    if (action.type === 'move' && action.moveIndex !== undefined) {
      const move = doll.moves[action.moveIndex];
      if (move && move.healRatio && move.healRatio > 0) {
        return { valid: false, reason: 'Esta habilidad intenta curar, lo cual está prohibido.' };
      }
    }

    return { valid: true };
  }

  /**
   * Obtiene el array completo de 6 habilidades equipadas para la batalla
   */
  public getEquippedMoves(doll: SoulDollInstance): any[] {
    const moves = [...doll.moves]; // 4 Base
    if (doll.memoryMove) moves.push(doll.memoryMove); // Slot 5
    if (doll.reactionMove) moves.push(doll.reactionMove); // Slot 6
    return moves;
  }

  /**
   * Procesa el inicio del turno, aplicando estados de mitigación y shields
   */
  public startTurn(doll: SoulDollInstance) {
    // Reducir duración de estados de mitigación
    if (doll.activeMitigation) {
      doll.activeMitigation.turnsRemaining -= 1;
      if (doll.activeMitigation.turnsRemaining <= 0) {
        doll.activeMitigation = null;
      }
    }

    // Reducir duración de escudos
    if (doll.activeShield) {
      doll.activeShield.turnsRemaining -= 1;
      if (doll.activeShield.turnsRemaining <= 0) {
        doll.activeShield = null;
      }
    }
  }
}

export const battleManager = new BattleManager();
