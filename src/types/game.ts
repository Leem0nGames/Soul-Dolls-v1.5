/**
 * SoulDolls - Core Game Types & Interfaces
 */

export type ElementalType = 
  | 'Fire'
  | 'Water'
  | 'Nature'
  | 'Electric'
  | 'Earth'
  | 'Frost'
  | 'Wind'
  | 'Shadow'
  | 'Light'
  | 'Poison';

export type MoveCategory = 'Physical' | 'Special' | 'Status';

export type StatusCondition = 'burn' | 'freeze' | 'paralysis' | 'poison' | 'sleep';

export interface StatBlock {
  hp: number;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  spd: number;
}

export type SlotType = 'base' | 'memory' | 'reaction';

export type AffinityRank = 'S' | 'A' | 'B' | 'C' | 'Forbidden';

export interface Move {
  id: string;
  name: string;
  type: ElementalType;
  category: MoveCategory;
  power: number; // 0 for pure status
  accuracy: number; // 0-100
  maxPp: number;
  currentPp: number;
  description: string;
  priority?: number;
  slotType?: SlotType;
  tags?: string[]; // e.g. ['Purge', 'Drain', 'Shield', 'IronPosture', 'ShadowStep']
  weaponType?: string;
  statusEffect?: {
    condition: StatusCondition;
    chance: number; // 0-100
  };
  statModifier?: {
    target: 'self' | 'enemy';
    stat: keyof StatBlock;
    stages: number; // e.g. +1 or -1
    chance: number;
  };
  healRatio?: number; // kept for legacy if needed, but battle engine enforces no direct healing
  shieldRatio?: number; // 0.25 to 0.40 of max HP
  drainRatio?: number; // 0.30 to 0.50 of damage dealt
  mitigationType?: 'iron_posture' | 'shadow_step';
}

export interface EvolutionCondition {
  level?: number;
  itemRequired?: string;
  evolvesInto: string; // speciesId of next stage
}

export interface SoulDollSpecies {
  id: string;
  name: string;
  stage: number; // 1: Basic, 2: Ascended/Evolved
  types: [ElementalType, ElementalType?];
  classRole?: string; // e.g. 'Assassin'
  allowedWeapons?: string[];
  baseStats: StatBlock;
  description: string;
  catchRate: number; // 30-255
  baseExpReward: number;
  evolution?: EvolutionCondition;
  learnset: { level: number; moveId: string }[];
  colorTheme: {
    primary: string;
    secondary: string;
    glow: string;
  };
}

export interface ActiveShield {
  amount: number;
  turnsRemaining: number;
}

export interface ActiveMitigation {
  type: 'iron_posture' | 'shadow_step';
  turnsRemaining: number;
}

export interface SoulDollInstance {
  uuid: string;
  speciesId: string;
  nickname: string;
  level: number;
  currentXp: number;
  xpToNext: number;
  currentHp: number;
  maxHp: number;
  stats: StatBlock;
  moves: Move[]; // Slots 1-4 (Base)
  memoryMove?: Move | null; // Slot 5 (Memory item)
  reactionMove?: Move | null; // Slot 6 (Reaction / Purge)
  status: StatusCondition | null;
  statusDuration?: number;
  isWild?: boolean;
  activeShield?: ActiveShield | null;
  activeMitigation?: ActiveMitigation | null;
  flowchainHistory?: string[];
}

export type ItemCategory = 'vial' | 'medicine' | 'evolution' | 'special';

export interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  description: string;
  count: number;
  price: number;
  catchMultiplier?: number;
  healHpAmount?: number;
  reviveRatio?: number;
  curesStatus?: boolean;
  evolutionTargetItem?: boolean;
}

export interface BattleAction {
  type: 'move' | 'item' | 'switch' | 'run' | 'vial';
  moveIndex?: number;
  itemId?: string;
  switchIndex?: number;
}

export interface BattleState {
  isActive: boolean;
  isTrainerBattle: boolean;
  trainerName?: string;
  phase: 
    | 'intro'
    | 'action_select' 
    | 'move_select' 
    | 'item_select' 
    | 'switch_select' 
    | 'executing_turn' 
    | 'capturing' 
    | 'level_up'
    | 'battle_end';
  playerActiveIndex: number;
  opponentDoll: SoulDollInstance;
  turnNumber: number;
  log: string[];
  pendingPlayerAction?: BattleAction;
  vialShakes?: number;
  vialSuccess?: boolean;
  turnMessageIndex?: number;
}

export type GameView = 'OVERWORLD' | 'BATTLE' | 'EVOLUTION' | 'PARTY' | 'BAG' | 'SOULDEX' | 'BOX';
