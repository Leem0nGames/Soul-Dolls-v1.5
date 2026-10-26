import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pilotDocument from '../src/game/data/experimental/villa_marionette.v1.json';
import { applyVillaMapOperations } from '../src/game/data/experimental/villaMapOperations';
import { createVillaMapPreview } from '../src/game/data/experimental/villaMapPreview';
import type { SerializedVilla } from '../src/game/data/experimental/villaMapTypes';

const filePath = resolve(
  process.cwd(),
  'src/game/data/experimental/villa_marionette.v1.json'
);
const sourceContents = readFileSync(filePath, 'utf8');
const source = JSON.parse(sourceContents) as SerializedVilla;
const inMemoryOriginal = JSON.parse(JSON.stringify(pilotDocument)) as SerializedVilla;
const sourceSnapshot = JSON.parse(JSON.stringify(source)) as SerializedVilla;

const initialScene = createVillaMapPreview(source);
assert.deepEqual(source, sourceSnapshot, 'Creating a preview must not mutate its map input');
assert.equal(initialScene.buildings.length, 8, 'Every contract building should have a schematic footprint');
assert.equal(initialScene.trainers.length, 2, 'Every contract trainer should have a marker');
assert.equal(initialScene.signs.length, 2, 'Every contract sign should have a marker');
assert.equal(initialScene.connections.length, 1, 'Every contract connection should have a marker');
assert.ok(initialScene.notRepresented.some(({ label }) => label === 'Decoración procedural'));
assert.ok(initialScene.notRepresented.some(({ label }) => label === 'Modelos 3D de edificios'));

const editResult = applyVillaMapOperations(source, [
  { type: 'move_building', editorId: 'garden-home', position: { x: -15, z: 1 } },
  { type: 'move_trainer', editorId: 'tyler', position: { x: -7, z: -6 } },
  {
    type: 'update_encounter_zone',
    editorId: 'prado-oeste',
    property: 'encounterRate',
    value: 0.12,
  },
]);
if (!editResult.ok) throw new Error(editResult.error);

const editedScene = createVillaMapPreview(editResult.map);
const movedBuilding = editedScene.buildings.find(({ editorId }) => editorId === 'garden-home');
assert.ok(movedBuilding, 'Building selection should retain its stable editor ID');
assert.deepEqual(
  { x: movedBuilding.x, z: movedBuilding.z, entrance: movedBuilding.entrance },
  { x: -15, z: 1, entrance: { x: -15, z: 5.2 } },
  'Preview should reflect the edited building and its moved entrance'
);
assert.deepEqual(
  editedScene.trainers.find(({ editorId }) => editorId === 'tyler'),
  { editorId: 'tyler', name: 'Tyler', x: -7, z: -6 },
  'Preview should reflect trainer edits using the editorial ID'
);
assert.deepEqual(source, sourceSnapshot, 'Previewing an edited copy must not mutate its source map');
assert.equal(readFileSync(filePath, 'utf8'), sourceContents, 'The original JSON file must remain unchanged');
assert.deepEqual(inMemoryOriginal, pilotDocument, 'The imported original document must remain unchanged');

const invalidGeometry = JSON.parse(JSON.stringify(source)) as SerializedVilla;
invalidGeometry.geometry.tilesWide = 0;
assert.throws(
  () => createVillaMapPreview(invalidGeometry),
  /Preview geometry is incompatible/,
  'Invalid preview geometry should report a clear error'
);

const invalidZone = JSON.parse(JSON.stringify(source)) as SerializedVilla;
invalidZone.map.layout.wildZones[0].minX = Number.NaN;
assert.throws(
  () => createVillaMapPreview(invalidZone),
  /zone "prado-oeste" minX must be a finite number/,
  'Invalid zone data should identify its field'
);

console.log('Villa Marionette preview harness');
console.log('=================================');
console.log(`Schematic objects: ${initialScene.buildings.length} buildings, ${initialScene.trainers.length} trainers`);
console.log('Preview source immutability: passed');
console.log('Edited-copy reflection and stable editorial IDs: passed');
console.log(`Explicitly unrepresented categories: ${initialScene.notRepresented.length}`);
console.log('Invalid geometry and data errors: clear');
console.log('Experimental source JSON unchanged: passed');
