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

console.log('Villa Marionette operations harness');
console.log('====================================');
console.log(`Supported operations: ${validOperations.length}`);
console.log('Valid targeted edits: passed');
console.log('Missing IDs, unknown operations, invalid values and unsupported fields: rejected');
console.log('Transactional rollback and input immutability: passed');
console.log('Empty operation list: passed (equal independent copy)');
console.log('Edited document JSON round-trip and editor ID uniqueness: passed');
console.log('Experimental source JSON unchanged: passed');
