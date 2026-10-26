import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { villaMarionette } from '../src/game/data/maps/villaMarionette';
import { VILLA_BUILDINGS } from '../src/game/data/maps/villaBuildings';
import {
  BORDER_TILES,
  MAP_TILES,
  TILE_UNITS,
} from '../src/game/data/worldGeometry';
import type { MapConnection, MapTamerDefinition, MapWildZone, WorldMapDefinition } from '../src/game/data/world';
import type { VillaBuilding } from '../src/game/data/maps/villaBuildings';
import type { SerializedVilla } from '../src/game/data/experimental/villaMapTypes';

const filePath = resolve(
  process.cwd(),
  'src/game/data/experimental/villa_marionette.v1.json'
);
const serialized = JSON.parse(readFileSync(filePath, 'utf8')) as SerializedVilla;

assert.equal(serialized.schemaVersion, 1, 'The pilot data must declare schema version 1');
assert.deepEqual(serialized.geometry, {
  tileUnits: TILE_UNITS,
  tilesWide: MAP_TILES,
  tilesDeep: MAP_TILES,
  borderTiles: BORDER_TILES,
  source: 'src/game/data/worldGeometry.ts',
});

const connections: MapConnection[] = serialized.map.connections.map(
  ({ editorId: _editorId, ...connection }) => connection
);
const wildZones: MapWildZone[] = serialized.map.layout.wildZones.map(
  ({ editorId: _editorId, ...zone }) => zone
);
const tamers: MapTamerDefinition[] = serialized.map.tamers.map(
  ({ editorId: _editorId, ...tamer }) => tamer
);
const buildings: VillaBuilding[] = serialized.buildings.map((building) => ({ ...building }));
const {
  clearPointReservations,
  signSpots: editorSignSpots,
  connections: _editorConnections,
  tamers: _editorTamers,
  ...mapFields
} = serialized.map;

const recoveredMap: WorldMapDefinition = {
  ...mapFields,
  connections,
  layout: {
    ...serialized.map.layout,
    wildZones,
    buildingFootprints: buildings.map(({ x, z, halfWidth, halfDepth }) => ({
      x,
      z,
      halfWidth,
      halfDepth,
    })),
  },
  clearPoints: [
    ...clearPointReservations.map(({ editorId: _editorId, ...point }) => point),
    ...tamers.map(({ position }) => ({ ...position, r: 3.5 })),
    ...buildings.flatMap((building) => [
      { x: building.x, z: building.z, r: 4.5 },
      { x: building.entrance.x, z: building.entrance.z, r: 3.5 },
    ]),
  ],
  signSpots: editorSignSpots.map(({ col, row }) => [col, row]),
  tamers,
};

assert.deepEqual(recoveredMap, villaMarionette, 'Recovered pilot map differs from its TypeScript source');
assert.deepEqual(buildings, VILLA_BUILDINGS, 'Recovered building data differs from its TypeScript source');

const roundTripped = JSON.parse(JSON.stringify(serialized)) as SerializedVilla;
assert.deepEqual(roundTripped, serialized, 'JSON stringify/parse changed the experimental document');
assert.equal(
  JSON.stringify(roundTripped),
  JSON.stringify(serialized),
  'The experimental document is not stable across JSON serialization'
);

const editorIds = [
  ...serialized.map.connections.map(({ editorId }) => editorId),
  ...serialized.map.layout.wildZones.map(({ editorId }) => editorId),
  ...serialized.map.tamers.map(({ editorId }) => editorId),
  ...serialized.map.clearPointReservations.map(({ editorId }) => editorId),
  ...serialized.map.signSpots.map(({ editorId }) => editorId),
  ...serialized.buildings.map(({ id }) => id),
];
assert.equal(new Set(editorIds).size, editorIds.length, 'Editor IDs must be unique within the pilot map');

console.log('Villa Marionette serialization harness');
console.log('======================================');
console.log(`Schema version: ${serialized.schemaVersion}`);
console.log(`Recovered map fields: ${Object.keys(recoveredMap).length}`);
console.log(`Stable editor IDs: ${editorIds.length}`);
console.log(`Buildings recovered: ${buildings.length}`);
console.log('Map definition round-trip: passed');
console.log('Building definition round-trip: passed');
console.log('JSON stringify/parse stability: passed');
