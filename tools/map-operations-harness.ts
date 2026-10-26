import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyVillaMapOperations,
  type VillaMapEditOperation,
} from '../src/game/data/experimental/villaMapOperations';
import type { SerializedVilla } from '../src/game/data/experimental/villaMapTypes';

const filePath = resolve(
  process.cwd(),
  'src/game/data/experimental/villa_marionette.v1.json'
);
const originalFileContents = readFileSync(filePath, 'utf8');
const sourceMap = JSON.parse(originalFileContents) as SerializedVilla;
const clone = (map: SerializedVilla): SerializedVilla =>
  JSON.parse(JSON.stringify(map)) as SerializedVilla;
const apply = (operations: readonly VillaMapEditOperation[]) =>
  applyVillaMapOperations(sourceMap, operations);

const validOperations: VillaMapEditOperation[] = [
  { type: 'move_building', editorId: 'garden-home', position: { x: -15, z: 1 } },
  { type: 'move_sign', editorId: 'northwest-sign', col: 19, row: 35 },
  { type: 'move_trainer', editorId: 'tyler', position: { x: -7, z: -6 } },
  {
    type: 'update_encounter_zone',
    editorId: 'prado-oeste',
    property: 'encounterRate',
    value: 0.12,
  },
];
const validResult = apply(validOperations);
assert.equal(validResult.ok, true, 'All supported operation types should succeed');

const expectedValidResult = clone(sourceMap);
expectedValidResult.buildings.find(({ id }) => id === 'garden-home')!.x = -15;
expectedValidResult.buildings.find(({ id }) => id === 'garden-home')!.z = 1;
expectedValidResult.buildings.find(({ id }) => id === 'garden-home')!.entrance = { x: -15, z: 5.2 };
const expectedSign = expectedValidResult.map.signSpots.find(({ editorId }) => editorId === 'northwest-sign')!;
expectedSign.col = 19;
expectedSign.row = 35;
expectedValidResult.map.tamers.find(({ editorId }) => editorId === 'tyler')!.position = { x: -7, z: -6 };
expectedValidResult.map.layout.wildZones.find(({ editorId }) => editorId === 'prado-oeste')!.encounterRate = 0.12;
assert.deepEqual(validResult.map, expectedValidResult, 'Valid operations changed unexpected data');
assert.equal(validResult.map.buildings.find(({ id }) => id === 'garden-home')!.id, 'garden-home');
assert.deepEqual(
  validResult.map.buildings.find(({ id }) => id === 'garden-home'),
  {
    ...sourceMap.buildings.find(({ id }) => id === 'garden-home'),
    x: -15,
    z: 1,
    entrance: { x: -15, z: 5.2 },
  },
  'Building position should change by its stable ID without altering other building fields'
);
assert.deepEqual(sourceMap, JSON.parse(originalFileContents), 'Applying operations mutated the in-memory input');
assert.equal(readFileSync(filePath, 'utf8'), originalFileContents, 'The source JSON file was modified');

function expectRejected(operation: unknown, expectedMessage: RegExp): void {
  const result = applyVillaMapOperations(sourceMap, [operation] as VillaMapEditOperation[]);
  assert.equal(result.ok, false, `Expected operation to be rejected: ${JSON.stringify(operation)}`);
  if (result.ok) throw new Error('Expected operation rejection');
  assert.match(result.error, expectedMessage);
}

expectRejected(
  { type: 'move_building', editorId: 'missing-building', position: { x: 0, z: 0 } },
  /Operation 1 \(move_building\).*not found/
);
expectRejected(
  { type: 'delete_map', editorId: 'villa_marionette' },
  /Operation 1 \(delete_map\).*unknown operation type/
);
expectRejected(
  { type: 'move_trainer', editorId: 'tyler', position: { x: Number.NaN, z: 0 } },
  /Operation 1 \(move_trainer\).*finite number/
);
expectRejected(
  { type: 'move_building', editorId: 'garden-home', position: { x: Number.POSITIVE_INFINITY, z: 0 } },
  /Operation 1 \(move_building\).*finite number/
);
expectRejected(
  { type: 'move_building', editorId: 'garden-home', position: { x: 28, z: 0 } },
  /Operation 1 \(move_building\).*footprint must remain inside the map terrain/
);
expectRejected(
  { type: 'move_sign', editorId: 'northwest-sign', col: 19, row: 35, name: 'unsupported' },
  /Operation 1 \(move_sign\).*unsupported properties/
);
expectRejected(
  {
    type: 'update_encounter_zone',
    editorId: 'prado-oeste',
    property: 'speciesPool',
    value: 0.12,
  },
  /Operation 1 \(update_encounter_zone\).*only the "encounterRate" property/
);
expectRejected(
  {
    type: 'update_encounter_zone',
    editorId: 'prado-oeste',
    property: 'encounterRate',
    value: 0,
  },
  /Operation 1 \(update_encounter_zone\).*must be in \(0, 1\]/
);

const transactionInput = clone(sourceMap);
const transactionSnapshot = clone(transactionInput);
const failedTransaction = applyVillaMapOperations(transactionInput, [
  { type: 'move_building', editorId: 'garden-home', position: { x: -15, z: 1 } },
  { type: 'move_sign', editorId: 'unknown-sign', col: 19, row: 35 },
]);
assert.equal(failedTransaction.ok, false, 'A transaction with a failing second operation must fail');
if (failedTransaction.ok) throw new Error('Expected transaction rejection');
assert.match(failedTransaction.error, /Operation 2 \(move_sign\).*not found/);
assert.deepEqual(transactionInput, transactionSnapshot, 'Failed transaction mutated its input');
assert.equal('map' in failedTransaction, false, 'Failed transaction must not expose a partial map');

const emptyResult = apply([]);
assert.equal(emptyResult.ok, true, 'An empty operation list should be a successful no-op');
assert.notEqual(emptyResult.map, sourceMap, 'An empty operation list should return a separate copy');
assert.deepEqual(emptyResult.map, sourceMap, 'An empty operation list should preserve all map data');
assert.deepEqual(
  JSON.parse(JSON.stringify(validResult.map)),
  validResult.map,
  'Edited map should remain serializable without data loss'
);

const editorIds = [
  ...validResult.map.map.connections.map(({ editorId }) => editorId),
  ...validResult.map.map.layout.wildZones.map(({ editorId }) => editorId),
  ...validResult.map.map.tamers.map(({ editorId }) => editorId),
  ...validResult.map.map.clearPointReservations.map(({ editorId }) => editorId),
  ...validResult.map.map.signSpots.map(({ editorId }) => editorId),
  ...validResult.map.buildings.map(({ id }) => id),
];
assert.equal(new Set(editorIds).size, editorIds.length, 'Editor IDs must remain unique after valid operations');
assert.equal(readFileSync(filePath, 'utf8'), originalFileContents, 'The source JSON file must remain unchanged');

const initialXRoadId = 'road-x-m12';
const structuralOperations: VillaMapEditOperation[] = [
  { type: 'set_road_coordinate', editorId: initialXRoadId, axis: 'x', value: -10 },
  { type: 'add_road', editorId: 'road-z-added-test', axis: 'z', value: 6 },
  { type: 'set_road_width', value: 2.25 },
  {
    type: 'add_road_path',
    editorId: 'road-path-test',
    points: [{ x: -4, z: -3 }, { x: 4, z: 3 }],
  },
  {
    type: 'update_road_path_point',
    editorId: 'road-path-test',
    pointIndex: 1,
    position: { x: 5, z: 3 },
  },
  { type: 'set_plaza', position: { x: 1, z: -1 }, radius: 6 },
  {
    type: 'move_encounter_zone',
    editorId: 'prado-oeste',
    position: { x: -12, z: 3 },
  },
  {
    type: 'resize_encounter_zone',
    editorId: 'prado-este',
    bounds: { minX: 9, maxX: 17, minZ: 3, maxZ: 11 },
  },
  {
    type: 'update_clear_point_reservation',
    editorId: 'plaza-clearance',
    position: { x: 1, z: 1 },
    radius: 7,
  },
];
const structuralResult = apply(structuralOperations);
if (!structuralResult.ok) throw new Error(structuralResult.error);
assert.equal(structuralResult.ok, true, 'All supported structural operations should succeed');
assert.equal(structuralResult.map.map.layout.roadXs[0], -10);
assert.ok(structuralResult.map.editorMetadata?.roadsZ.includes('road-z-added-test'));
assert.equal(structuralResult.map.map.layout.roadHalfWidth, 2.25);
assert.deepEqual(structuralResult.map.map.layout.roadPath, [{ x: -4, z: -3 }, { x: 5, z: 3 }]);
assert.equal(structuralResult.map.editorMetadata?.roadPath, 'road-path-test');
assert.deepEqual(structuralResult.map.map.layout.plaza, { x: 1, z: -1, radius: 6 });
const movedWestZone = structuralResult.map.map.layout.wildZones.find(({ editorId }) => editorId === 'prado-oeste')!;
assert.deepEqual(
  { minX: movedWestZone.minX, maxX: movedWestZone.maxX, minZ: movedWestZone.minZ, maxZ: movedWestZone.maxZ },
  { minX: -14.5, maxX: -9.5, minZ: 0.5, maxZ: 5.5 },
  'Moving a zone should preserve its dimensions'
);
const resizedEastZone = structuralResult.map.map.layout.wildZones.find(({ editorId }) => editorId === 'prado-este')!;
assert.deepEqual(
  { minX: resizedEastZone.minX, maxX: resizedEastZone.maxX, minZ: resizedEastZone.minZ, maxZ: resizedEastZone.maxZ },
  { minX: 9, maxX: 17, minZ: 3, maxZ: 11 }
);
assert.deepEqual(
  structuralResult.map.map.clearPointReservations.find(({ editorId }) => editorId === 'plaza-clearance'),
  { editorId: 'plaza-clearance', x: 1, z: 1, r: 7 }
);
assert.deepEqual(sourceMap, JSON.parse(originalFileContents), 'Structural edits must not mutate the source document');
assert.equal(readFileSync(filePath, 'utf8'), originalFileContents, 'Structural edits must not modify the source JSON file');

const removedRoadResult = apply([
  { type: 'remove_road', editorId: initialXRoadId },
  {
    type: 'add_road_path',
    editorId: 'road-path-to-remove',
    points: [{ x: -4, z: -3 }, { x: 4, z: 3 }],
  },
  { type: 'remove_road_path', editorId: 'road-path-to-remove' },
  { type: 'remove_plaza' },
]);
if (!removedRoadResult.ok) throw new Error(removedRoadResult.error);
assert.equal(removedRoadResult.ok, true, 'Existing roads, paths and plaza should be removable');
assert.equal(removedRoadResult.map.map.layout.roadXs.length, sourceMap.map.layout.roadXs.length - 1);
assert.equal(removedRoadResult.map.map.layout.roadPath, undefined);
assert.equal(removedRoadResult.map.editorMetadata?.roadPath, undefined);
assert.equal(removedRoadResult.map.map.layout.plaza, null);

expectRejected(
  { type: 'add_road', editorId: 'garden-home', axis: 'x', value: 5 },
  /Operation 1 \(add_road\).*already exists/
);
expectRejected(
  { type: 'add_road', editorId: 'road-invalid', axis: 'x', value: Number.NaN },
  /Operation 1 \(add_road\).*finite number/
);
expectRejected(
  { type: 'add_road_path', editorId: 'short-path', points: [{ x: 0, z: 0 }] },
  /Operation 1 \(add_road_path\).*at least two points/
);
const invalidPathPoint = applyVillaMapOperations(sourceMap, [
  { type: 'add_road_path', editorId: 'path-for-invalid-point', points: [{ x: 0, z: 0 }, { x: 1, z: 1 }] },
  {
    type: 'update_road_path_point',
    editorId: 'path-for-invalid-point',
    pointIndex: 9,
    position: { x: 0, z: 0 },
  },
]);
assert.equal(invalidPathPoint.ok, false);
if (!invalidPathPoint.ok) assert.match(invalidPathPoint.error, /Operation 2 \(update_road_path_point\).*out of range/);
expectRejected(
  { type: 'set_plaza', position: { x: 0, z: 0 }, radius: 0 },
  /Operation 1 \(set_plaza\).*radius must be positive/
);
expectRejected(
  {
    type: 'resize_encounter_zone',
    editorId: 'prado-oeste',
    bounds: { minX: 2, maxX: 1, minZ: 0, maxZ: 1 },
  },
  /Operation 1 \(resize_encounter_zone\).*bounds/
);
expectRejected(
  {
    type: 'update_clear_point_reservation',
    editorId: 'plaza-clearance',
    position: { x: Number.POSITIVE_INFINITY, z: 0 },
    radius: 1,
  },
  /Operation 1 \(update_clear_point_reservation\).*finite number/
);
const structuralRollbackInput = clone(sourceMap);
const structuralRollback = applyVillaMapOperations(structuralRollbackInput, [
  { type: 'add_road', editorId: 'road-added-then-rejected', axis: 'x', value: 5 },
  { type: 'set_plaza', position: { x: 0, z: 0 }, radius: -1 },
]);
assert.equal(structuralRollback.ok, false, 'Invalid later structural operation should reject the transaction');
assert.deepEqual(structuralRollbackInput, sourceMap, 'Structural rollback must preserve the input');
if (!structuralRollback.ok) {
  assert.match(structuralRollback.error, /Operation 2 \(set_plaza\)/);
}
assert.equal(
  JSON.stringify(structuralResult.map),
  JSON.stringify(JSON.parse(JSON.stringify(structuralResult.map))),
  'Edited structural document should remain JSON-serializable'
);

console.log('Villa Marionette operations harness');
console.log('====================================');
console.log(`Supported existing operations: ${validOperations.length}`);
console.log('Valid targeted edits: passed');
console.log('Missing IDs, unknown operations, invalid values and unsupported fields: rejected');
console.log('Transactional rollback and input immutability: passed');
console.log('Empty operation list: passed (equal independent copy)');
console.log('Edited document JSON round-trip and editor ID uniqueness: passed');
console.log('Experimental source JSON unchanged: passed');
console.log(`Structural operations: ${structuralOperations.length} passed`);
console.log('Structural geometry, duplicate IDs, invalid values and atomic rollback: passed');
