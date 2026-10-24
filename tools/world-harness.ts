import {
  getMapWildZones,
  validateWorldMaps,
} from '../src/game/graphics/OverworldTiles';
import { MAP_IDS, MAP_NAMES, WORLD_MAPS } from '../src/game/data/maps';
import { SOULDOLL_SPECIES } from '../src/game/data/souldolls';
import { VILLA_BUILDINGS } from '../src/game/graphics/OverworldBuildings';
import { isBlocked } from '../src/game/graphics/OverworldTiles';

const mapIds = MAP_IDS;
const errors = validateWorldMaps();
const villaLayout = WORLD_MAPS.villa_marionette.layout;

for (const building of VILLA_BUILDINGS) {
  if (building.rotation !== 0) {
    errors.push(`${building.id} must face north toward the plaza/camera`);
  }
  if (building.entrance.x !== building.x || building.entrance.z <= building.z) {
    errors.push(`${building.id} entrance must be centered on its north-facing (+Z) facade`);
  }
  if (isBlocked(building.entrance.x, building.entrance.z, 'villa_marionette')) {
    errors.push(`${building.id} entrance is blocked by its footprint`);
  }
  if (!villaLayout.roadZs.some((z) => Math.abs(z - building.entrance.z) <= villaLayout.roadHalfWidth)) {
    errors.push(`${building.id} entrance has no approach road`);
  }
}

for (const mapId of mapIds) {
  for (const zone of getMapWildZones(mapId)) {
    if (zone.encounterRate <= 0 || zone.encounterRate > 1) {
      errors.push(`${zone.name} has an encounter rate outside (0, 1]`);
    }
    if (zone.speciesPool.length === 0) errors.push(`${zone.name} has no encounter species`);
    for (const entry of zone.speciesPool) {
      if (!SOULDOLL_SPECIES[entry.speciesId]) {
        errors.push(`${zone.name} references unknown SoulDoll "${entry.speciesId}"`);
      }
      if (entry.minLevel < 1 || entry.maxLevel < entry.minLevel) {
        errors.push(`${zone.name} has an invalid level range for "${entry.speciesId}"`);
      }
      if (entry.weight <= 0) errors.push(`${zone.name} has a non-positive weight for "${entry.speciesId}"`);
    }
  }
  for (const tamer of WORLD_MAPS[mapId].tamers) {
    if (tamer.triggerDistance <= 0) errors.push(`${tamer.name} has an invalid trigger distance`);
    if (tamer.party.length === 0) errors.push(`${tamer.name} has no party`);
    for (const member of tamer.party) {
      if (!SOULDOLL_SPECIES[member.speciesId]) {
        errors.push(`${tamer.name} references unknown SoulDoll "${member.speciesId}"`);
      }
      if (member.level < 1) errors.push(`${tamer.name} has an invalid level for "${member.speciesId}"`);
    }
  }
}

console.log('SoulDolls World Harness');
console.log('=======================');
for (const mapId of mapIds) {
  const zones = getMapWildZones(mapId);
  const tamers = WORLD_MAPS[mapId].tamers;
  const connections = WORLD_MAPS[mapId].connections;
  console.log(
    `${MAP_NAMES[mapId]}: ${zones.length} encounter zones, ${tamers.length} tamer(s), ${connections.length} map connection(s)`
  );
}

if (errors.length > 0) {
  console.error('\nWorld validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(
    '\nWorld validation passed: links and map content are reachable; encounters and tamer parties use valid species and levels.'
  );
}
