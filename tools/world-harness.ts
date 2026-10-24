import {
  getMapWildZones,
  MAP_CONNECTIONS,
  MAP_NAMES,
  validateWorldMaps,
} from '../src/game/graphics/OverworldTiles';
import { SOULDOLL_SPECIES } from '../src/game/data/souldolls';

const mapIds = Object.keys(MAP_NAMES) as (keyof typeof MAP_NAMES)[];
const errors = validateWorldMaps();

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
}

console.log('SoulDolls World Harness');
console.log('=======================');
for (const mapId of mapIds) {
  const zones = getMapWildZones(mapId);
  const connections = MAP_CONNECTIONS[mapId];
  console.log(
    `${MAP_NAMES[mapId]}: ${zones.length} encounter zones, ${connections.length} map connection(s)`
  );
}

if (errors.length > 0) {
  console.error('\nWorld validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(
    '\nWorld validation passed: links are reciprocal and walkable; encounter zones, species, weights, and levels are valid.'
  );
}
