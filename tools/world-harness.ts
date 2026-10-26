import { MAP_IDS, MAP_NAMES, WORLD_MAPS } from '../src/game/data/maps';
import { SOULDOLL_SPECIES } from '../src/game/data/souldolls';
import { validateWorldMaps } from '../src/game/data/worldValidation';
import type { MapId } from '../src/game/data/world';
import {
  gridToWorldBoundary,
  gridToWorldCenter,
  MAP_DEPTH_UNITS,
  MAP_TILES,
  MAP_WIDTH_UNITS,
  TILE_UNITS,
  worldToGridIndex,
} from '../src/game/data/worldGeometry';
import { getLayout, isBlocked } from '../src/game/data/worldMapLayout';

const mapIds = MAP_IDS;
const errors = validateWorldMaps();
const assertEqual = (label: string, actual: unknown, expected: unknown) => {
  if (actual !== expected) errors.push(`${label}: expected ${String(expected)}, got ${String(actual)}`);
};
const assertNear = (label: string, actual: number, expected: number) => {
  if (Math.abs(actual - expected) > 1e-9) {
    errors.push(`${label}: expected ${expected}, got ${actual}`);
  }
};

assertEqual('Tile size', TILE_UNITS, 1.5);
assertEqual('Map tile width', MAP_TILES, 40);
assertEqual('Map world width', MAP_WIDTH_UNITS, 60);
assertEqual('Map world depth', MAP_DEPTH_UNITS, 60);
assertNear('Grid column 0 center', gridToWorldCenter(0), -29.25);
assertNear('Grid column 20 center', gridToWorldCenter(20), 0.75);

for (const index of [0, 2, 19, 20, 37, 39]) {
  assertEqual(
    `Grid center round-trip at ${index}`,
    worldToGridIndex(gridToWorldCenter(index)),
    index
  );
}
for (const index of [0, 1, 39, 40]) {
  assertEqual(
    `Grid boundary conversion at ${index}`,
    worldToGridIndex(gridToWorldBoundary(index)),
    index
  );
}

for (const mapId of mapIds) {
  const grid = getLayout(mapId).grid;
  assertEqual(`${mapId} grid row count`, grid.length, MAP_TILES);
  assertEqual(`${mapId} grid column count`, grid[0]?.length, MAP_TILES);
}

const expectedConnections: Record<
  MapId,
  readonly (readonly [number, number, MapId, number, number, string])[]
> = {
  villa_marionette: [[0, -26, 'ruta_1', 0, 25.5, 'up']],
  ruta_1: [
    [0, 26, 'villa_marionette', 0, -25.5, 'down'],
    [0, -26, 'bosque_del_eco', 0, 25.5, 'up'],
  ],
  bosque_del_eco: [
    [0, 26, 'ruta_1', 0, -25.5, 'down'],
    [0, -24.5, 'cueva_del_eco', 0, 26, 'up'],
  ],
  cueva_del_eco: [[0, 26, 'bosque_del_eco', 0, -24, 'down']],
};

for (const mapId of mapIds) {
  const actualConnections = WORLD_MAPS[mapId].connections.map(({ at, toMap, arrival, facing }) => [
    at.x,
    at.z,
    toMap,
    arrival.x,
    arrival.z,
    facing,
  ]);
  assertEqual(
    `${mapId} connection coordinates`,
    JSON.stringify(actualConnections),
    JSON.stringify(expectedConnections[mapId])
  );
}

const expectedCollisionSamples: readonly [MapId, number, number, boolean][] = [
  ['villa_marionette', -17, -12, true],
  ['villa_marionette', -17, -7.65, false],
  ['ruta_1', 0, 0, false],
  ['bosque_del_eco', 10, 1, false],
  ['cueva_del_eco', 0, 0, true],
  ['cueva_del_eco', 0, 27, false],
];
for (const [mapId, x, z, expected] of expectedCollisionSamples) {
  assertEqual(
    `${mapId} collision sample at ${x},${z}`,
    isBlocked(x, z, mapId),
    expected
  );
}

for (const mapId of mapIds) {
  for (const zone of WORLD_MAPS[mapId].layout.wildZones) {
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
  const zones = WORLD_MAPS[mapId].layout.wildZones;
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
