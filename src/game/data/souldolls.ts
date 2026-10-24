import { ElementalType, SoulDollSpecies, SoulDollInstance } from '../../types/game';
import { createMoveInstance, MOVES_DATABASE } from './moves';
import speciesJson from './souldolls.json';

const ELEMENTAL_TYPES: readonly ElementalType[] = [
  'Fire',
  'Water',
  'Nature',
  'Electric',
  'Earth',
  'Frost',
  'Wind',
  'Shadow',
  'Light',
  'Poison',
];

const STAT_KEYS = ['hp', 'atk', 'def', 'spAtk', 'spDef', 'spd'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isPositiveNumber(value) && Number.isInteger(value);
}

function isSpeciesEntry(id: string, value: unknown): value is SoulDollSpecies {
  if (!isRecord(value)) return false;
  if (value.id !== id || typeof value.name !== 'string' || value.name.trim().length === 0) return false;
  if (value.starter !== undefined && typeof value.starter !== 'boolean') return false;
  if (
    (value.starterOrder !== undefined &&
      (typeof value.starterOrder !== 'number' || !Number.isInteger(value.starterOrder) || value.starterOrder < 0)) ||
    (value.starter === true && !Number.isInteger(value.starterOrder))
  ) return false;
  if (!isPositiveInteger(value.stage) || value.stage > 3) return false;
  if (
    !Array.isArray(value.types) ||
    value.types.length < 1 ||
    value.types.length > 2 ||
    !value.types.every((type) => ELEMENTAL_TYPES.some((validType) => validType === type))
  ) {
    return false;
  }
  const baseStats = value.baseStats;
  if (!isRecord(baseStats) || !STAT_KEYS.every((key) => isPositiveInteger(baseStats[key]))) {
    return false;
  }
  if (
    typeof value.description !== 'string' ||
    !isPositiveInteger(value.catchRate) ||
    value.catchRate < 1 ||
    value.catchRate > 255 ||
    !isPositiveNumber(value.baseExpReward)
  ) {
    return false;
  }
  const colorTheme = value.colorTheme;
  if (!isRecord(colorTheme) || !['primary', 'secondary', 'glow'].every(
    (key) => typeof colorTheme[key] === 'string' && /^#[\da-f]{6}$/i.test(colorTheme[key])
  )) {
    return false;
  }
  if (!Array.isArray(value.learnset) || value.learnset.length === 0) return false;
  if (
    !value.learnset.every((entry) =>
      isRecord(entry) && isPositiveInteger(entry.level) && typeof entry.moveId === 'string'
    )
  ) {
    return false;
  }
  if (value.evolution !== undefined) {
    if (
      !isRecord(value.evolution) ||
      typeof value.evolution.evolvesInto !== 'string' ||
      (value.evolution.level !== undefined && !isPositiveInteger(value.evolution.level)) ||
      (value.evolution.itemRequired !== undefined && typeof value.evolution.itemRequired !== 'string')
    ) {
      return false;
    }
  }
  return true;
}

function loadSpeciesCatalog(data: unknown): Record<string, SoulDollSpecies> {
  if (!isRecord(data)) throw new Error('El catálogo JSON de SoulDolls debe ser un objeto por ID.');
  const catalog = Object.create(null) as Record<string, SoulDollSpecies>;

  for (const [id, value] of Object.entries(data)) {
    if (!/^[a-z][a-z0-9_]*$/.test(id)) {
      throw new Error(`ID de SoulDoll inválido "${id}": usa minúsculas, números y guion bajo.`);
    }
    if (!isSpeciesEntry(id, value)) {
      throw new Error(`Definición inválida para SoulDoll "${id}" en souldolls.json.`);
    }
    for (const move of value.learnset) {
      if (!MOVES_DATABASE[move.moveId]) {
        throw new Error(`SoulDoll "${id}" referencia el movimiento inexistente "${move.moveId}".`);
      }
    }
    if (value.learnset.some((move, index, learnset) => index > 0 && move.level < learnset[index - 1].level)) {
      throw new Error(`El learnset de "${id}" debe estar ordenado por nivel ascendente.`);
    }
    catalog[id] = value;
  }

  if (Object.keys(catalog).length === 0) throw new Error('El catálogo de SoulDolls no puede estar vacío.');
  const starterOrders = Object.values(catalog)
    .filter((species) => species.starter)
    .map((species) => species.starterOrder);
  if (starterOrders.length === 0) throw new Error('Debe existir al menos un SoulDoll inicial.');
  if (new Set(starterOrders).size !== starterOrders.length) {
    throw new Error('Cada SoulDoll inicial debe tener un starterOrder único.');
  }
  for (const [id, species] of Object.entries(catalog)) {
    const evolution = species.evolution;
    if (!evolution) continue;
    const target = catalog[evolution.evolvesInto];
    if (!target) {
      throw new Error(`SoulDoll "${id}" evoluciona a la especie inexistente "${evolution.evolvesInto}".`);
    }
    if (target.stage !== species.stage + 1) {
      throw new Error(`La evolución "${id}" -> "${target.id}" debe avanzar exactamente una etapa.`);
    }
    if (!evolution.level && !evolution.itemRequired) {
      throw new Error(`La evolución de "${id}" debe requerir nivel o un objeto.`);
    }
  }
  return catalog;
}

export const SOULDOLL_SPECIES = loadSpeciesCatalog(speciesJson);
export const STARTER_SPECIES = Object.values(SOULDOLL_SPECIES)
  .filter((species) => species.starter)
  .sort((left, right) => (left.starterOrder ?? 0) - (right.starterOrder ?? 0))
  .map((species) => species.id);

export function createSoulDoll(speciesId: string, level: number, isWild = false): SoulDollInstance {
  const species = SOULDOLL_SPECIES[speciesId];
  if (!Object.hasOwn(SOULDOLL_SPECIES, speciesId) || !species) {
    throw new Error(`No existe la especie SoulDoll "${speciesId}".`);
  }
  if (!isPositiveInteger(level)) {
    throw new RangeError(`Nivel inválido "${level}" para SoulDoll "${speciesId}".`);
  }

  const calcHp = Math.floor(((2 * species.baseStats.hp + 15) * level) / 100) + level + 10;
  const calcStat = (base: number) => Math.floor(((2 * base + 15) * level) / 100) + 5;
  const stats = {
    hp: calcHp,
    atk: calcStat(species.baseStats.atk),
    def: calcStat(species.baseStats.def),
    spAtk: calcStat(species.baseStats.spAtk),
    spDef: calcStat(species.baseStats.spDef),
    spd: calcStat(species.baseStats.spd),
  };

  const eligibleMoves = species.learnset.filter((entry) => entry.level <= level);
  const selectedMoves = eligibleMoves.slice(-4).map((entry) => createMoveInstance(entry.moveId));
  if (selectedMoves.length === 0) {
    selectedMoves.push(createMoveInstance(species.learnset[0].moveId));
  }

  return {
    uuid: `doll_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    speciesId: species.id,
    nickname: species.name,
    level,
    currentXp: Math.floor(level ** 3),
    xpToNext: Math.floor((level + 1) ** 3),
    currentHp: stats.hp,
    maxHp: stats.hp,
    stats,
    moves: selectedMoves,
    status: null,
    isWild,
  };
}
