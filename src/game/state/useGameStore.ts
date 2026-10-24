import { useState, useEffect } from 'react';
import { SoulDollInstance, Item, BattleState, GameView, BattleAction, Move, IntroStep } from '../../types/game';
import { createSoulDoll, SOULDOLL_SPECIES } from '../data/souldolls';
import { ITEMS_DATABASE } from '../data/items';
import { createMoveInstance, MOVES_DATABASE } from '../data/moves';
import { combatEngine } from '../combat/CombatEngine';
import { AffinityValidator } from '../combat/AffinityValidator';
import { sound } from '../audio/SoundEffects';
import { MapId } from '../data/world';
import { ecs } from '../ecs/World';

export interface GameState {
  view: GameView;
  playerParty: SoulDollInstance[];
  soulBox: SoulDollInstance[];
  inventory: Record<string, Item>;
  soulShards: number;
  seenSoulDolls: Set<string>;
  caughtSoulDolls: Set<string>;
  battleState: BattleState | null;
  evolutionCandidate: SoulDollInstance | null;
  activeDialogue: { speaker: string; text: string; onDismiss?: () => void } | null;
  toastMessage: string | null;
  playerPosition: { x: number; y: number; z: number };
  activeShopId: number | null;
  introStep: IntroStep;
  selectedStarterId: string | null;
  activeMapId: MapId;
  wipeCount: number;
  wipeLabel: string | null;
  wipeFlash: boolean;
}

const initialInventory: Record<string, Item> = {
  animus_vial: { ...ITEMS_DATABASE.animus_vial, count: 12 },
  great_vial: { ...ITEMS_DATABASE.great_vial, count: 5 },
  celestial_vial: { ...ITEMS_DATABASE.celestial_vial, count: 1 },
  soul_salve: { ...ITEMS_DATABASE.soul_salve, count: 6 },
  super_salve: { ...ITEMS_DATABASE.super_salve, count: 3 },
  revive_catalyst: { ...ITEMS_DATABASE.revive_catalyst, count: 2 },
  evolution_prism: { ...ITEMS_DATABASE.evolution_prism, count: 1 },
};

let globalState: GameState = {
  view: 'OVERWORLD',
  introStep: 'title',
  selectedStarterId: null,
  activeMapId: 'villa_marionette',
  wipeCount: 0,
  wipeLabel: null,
  wipeFlash: false,
  playerParty: [],
  soulBox: [],
  inventory: initialInventory,
  soulShards: 1250,
  seenSoulDolls: new Set(),
  caughtSoulDolls: new Set(),
  battleState: null,
  evolutionCandidate: null,
  activeDialogue: null,
  toastMessage: null,
  playerPosition: { x: 44, y: 80.8, z: -2.45 },
  activeShopId: null,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(fn => fn());
}

export const gameStore = {
  getState(): GameState {
    return globalState;
  },

  setState(partial: Partial<GameState>) {
    globalState = { ...globalState, ...partial };
    notify();
  },

  // Fires a full-screen shutter wipe. Used by map / interior transitions.
  wipeScreen(label: string, flash = false) {
    globalState.wipeCount += 1;
    globalState.wipeLabel = label;
    globalState.wipeFlash = flash;
    notify();
  },

  setView(view: GameView) {
    sound.playSelect();
    globalState.view = view;
    notify();
  },

  showToast(msg: string) {
    globalState.toastMessage = msg;
    notify();
    setTimeout(() => {
      if (globalState.toastMessage === msg) {
        globalState.toastMessage = null;
        notify();
      }
    }, 2800);
  },

  setDialogue(speaker: string, text: string, onDismiss?: () => void) {
    globalState.activeDialogue = { speaker, text, onDismiss };
    notify();
  },

  clearDialogue() {
    if (globalState.activeDialogue?.onDismiss) {
      globalState.activeDialogue.onDismiss();
    }
    globalState.activeDialogue = null;
    notify();
  },

  setIntroStep(step: IntroStep) {
    globalState.introStep = step;
    notify();
  },

  // Choose the initial Souldoll: replaces the starting party with the chosen doll
  chooseStarter(speciesId: string) {
    globalState.selectedStarterId = speciesId;
    const doll = createSoulDoll(speciesId, 12);
    globalState.playerParty = [doll];
    globalState.seenSoulDolls = new Set(globalState.seenSoulDolls).add(speciesId);
    globalState.caughtSoulDolls = new Set(globalState.caughtSoulDolls).add(speciesId);
    globalState.introStep = 'gameplay';
    globalState.view = 'OVERWORLD';
    notify();
  },

  // Heal all party members at Sanctuary Shrine
  healParty() {
    sound.playHeal();
    globalState.playerParty.forEach(doll => {
      doll.currentHp = doll.maxHp;
      doll.status = null;
      doll.moves.forEach(m => (m.currentPp = m.maxPp));
    });
    this.showToast('¡Tus SoulDolls han sido sanados y revitalizados por completo!');
    notify();
  },

  // Start Wild or Trainer Battle
  startBattle(
    opponent: SoulDollInstance,
    isTrainer = false,
    trainerName?: string,
    trainer?: { party: SoulDollInstance[]; entityId: number }
  ) {
    if (globalState.battleState?.isActive) return;
    if (globalState.playerParty.length === 0) {
      this.showToast('Primero elige a tu SoulDoll inicial en el laboratorio.');
      return;
    }
    sound.playEncounter();
    // Register as seen in SoulDex immutably
    globalState.seenSoulDolls = new Set(globalState.seenSoulDolls).add(opponent.speciesId);

    // Pick first non-fainted doll safely
    let firstAliveIdx = globalState.playerParty.findIndex(d => d.currentHp > 0);
    if (firstAliveIdx === -1) {
      firstAliveIdx = 0;
      if (globalState.playerParty[0]) {
        globalState.playerParty[0].currentHp = Math.max(1, Math.floor(globalState.playerParty[0].maxHp * 0.25));
      }
    }

    const activeDoll = globalState.playerParty[firstAliveIdx] || globalState.playerParty[0];

    const initialLog: string[] = isTrainer 
      ? [`¡El Domador ${trainerName} te desafía a un duelo!`, `¡${trainerName} envía a ${opponent.nickname}!` ]
      : [`¡Un ${opponent.nickname} salvaje ha aparecido!`, `¡Adelante, ${activeDoll ? activeDoll.nickname : 'Guerrero'}!`];

    globalState.battleState = {
      isActive: true,
      isTrainerBattle: isTrainer,
      trainerName,
      trainerEntityId: trainer?.entityId,
      opponentParty: trainer?.party ?? [opponent],
      opponentPartyIndex: 0,
      phase: 'action_select',
      playerActiveIndex: firstAliveIdx,
      opponentDoll: opponent,
      turnNumber: 1,
      log: initialLog,
    };
    globalState.view = 'BATTLE';
    notify();
  },

  // End battle
  endBattle(won = true) {
    const battle = globalState.battleState;
    if (!battle) return;
    globalState.battleState = null;
    globalState.view = 'OVERWORLD';
    if (won && battle.isTrainerBattle) {
      const trainer = battle.trainerEntityId === undefined
        ? undefined
        : ecs.tamers.get(battle.trainerEntityId);
      if (trainer) trainer.defeated = true;
      const reward = battle.opponentParty.reduce((total, doll) => total + doll.level * 10, 0);
      globalState.soulShards += reward;
      this.showToast(`¡Venciste a ${battle.trainerName}! Recibiste ${reward} fragmentos de alma.`);
    } else if (won) {
      this.showToast('¡Has triunfado en el combate de almas!');
    }
    notify();
  },

  // Catch wild doll into party or box
  addCaughtSoulDoll(doll: SoulDollInstance) {
    globalState.caughtSoulDolls = new Set(globalState.caughtSoulDolls).add(doll.speciesId);
    globalState.seenSoulDolls = new Set(globalState.seenSoulDolls).add(doll.speciesId);

    if (globalState.playerParty.length < 6) {
      globalState.playerParty.push(doll);
      this.showToast(`¡${doll.nickname} se unió a tu equipo!`);
    } else {
      globalState.soulBox.push(doll);
      this.showToast(`¡Equipo lleno! ${doll.nickname} fue enviado al Santuario.`);
    }
    notify();
  },

  // Consume item
  consumeItem(itemId: string): boolean {
    const item = globalState.inventory[itemId];
    if (item && item.count > 0) {
      item.count--;
      notify();
      return true;
    }
    return false;
  },

  // Use Medicine on a SoulDoll
  useMedicine(itemId: string, dollUuid: string): boolean {
    const item = globalState.inventory[itemId];
    const doll = globalState.playerParty.find(d => d.uuid === dollUuid);
    if (!item || item.count <= 0 || !doll) return false;

    if (item.healHpAmount) {
      if (doll.currentHp >= doll.maxHp) {
        this.showToast('¡La salud de este SoulDoll ya está al máximo!');
        return false;
      }
      doll.currentHp = Math.min(doll.maxHp, doll.currentHp + item.healHpAmount);
      item.count--;
      sound.playHeal();
      this.showToast(`¡Se restauraron ${item.healHpAmount} HP a ${doll.nickname}!`);
      notify();
      return true;
    }

    if (item.reviveRatio) {
      if (doll.currentHp > 0) {
        this.showToast('¡Este SoulDoll no está debilitado!');
        return false;
      }
      doll.currentHp = Math.floor(doll.maxHp * item.reviveRatio);
      item.count--;
      sound.playHeal();
      this.showToast(`¡${doll.nickname} ha vuelto al combate con fuerza restaurada!`);
      notify();
      return true;
    }

    if (item.evolutionTargetItem) {
      const species = SOULDOLL_SPECIES[doll.speciesId];
      if (species.evolution) {
        item.count--;
        this.startEvolutionSequence(doll);
        return true;
      } else {
        this.showToast('¡Este SoulDoll no posee una metamorfosis ascendida!');
        return false;
      }
    }

    if (item.grantsLevel) {
      if (doll.level >= 100) {
        this.showToast(`${doll.nickname} ya alcanzó el nivel máximo.`);
        return false;
      }
      const expNeeded = doll.xpToNext - doll.currentXp;
      const result = combatEngine.grantExperience(doll, expNeeded);
      item.count--;
      sound.playLevelUp();
      this.showToast(`¡${doll.nickname} subió al nivel ${doll.level} gracias al Caramelo de Ánima!`);
      if (result.evolutionReady) {
        this.startEvolutionSequence(doll);
      } else {
        notify();
      }
      return true;
    }

    return false;
  },

  // Trigger dynamic evolution screen
  startEvolutionSequence(doll: SoulDollInstance) {
    sound.playEvolution();
    globalState.evolutionCandidate = doll;
    globalState.view = 'EVOLUTION';
    notify();
  },

  // Confirm evolution completed
  completeEvolution() {
    if (!globalState.evolutionCandidate) return;
    const res = combatEngine.evolveSoulDoll(globalState.evolutionCandidate);
    if (res.success) {
      globalState.caughtSoulDolls = new Set(globalState.caughtSoulDolls).add(globalState.evolutionCandidate.speciesId);
      globalState.seenSoulDolls = new Set(globalState.seenSoulDolls).add(globalState.evolutionCandidate.speciesId);
    }
    globalState.evolutionCandidate = null;
    notify();
  },

  equipMove(dollUuid: string, moveId: string, slotType: 'base' | 'memory' | 'reaction', slotIndex: number): boolean {
    const doll = globalState.playerParty.find(d => d.uuid === dollUuid);
    const moveData = MOVES_DATABASE[moveId] as Move;
    if (!doll || !moveData) return false;

    const species = SOULDOLL_SPECIES[doll.speciesId];
    const validation = AffinityValidator.canEquipSkill(species, moveData);

    if (!validation.allowed) {
      this.showToast(validation.reason || 'No se puede equipar esta habilidad.');
      return false;
    }

    const moveInstance = (createMoveInstance as any)(moveId) as any;
    moveInstance.slotType = slotType;

    if (slotType === 'base') {
      if (slotIndex >= 0 && slotIndex < 4) {
        doll.moves[slotIndex] = moveInstance;
      } else return false;
    } else if (slotType === 'memory') {
      doll.memoryMove = moveInstance;
    } else if (slotType === 'reaction') {
      doll.reactionMove = moveInstance;
    }

    notify();
    return true;
  }
};

export function useGameStore() {
  const [state, setState] = useState(gameStore.getState());

  useEffect(() => {
    const handler = () => setState({ ...gameStore.getState() });
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return state;
}
