import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pilotDocument from '../src/game/data/experimental/villa_marionette.v1.json';
import {
  applyVillaMapEditorOperation,
  clientToWorldPosition,
  createPositionOperation,
  createVillaMapEditorState,
  isValidSignGridPosition,
  parseFiniteCoordinate,
  resetVillaMapEditorState,
  serializeVillaMapEditorState,
  undoVillaMapEditorOperation,
  worldPositionToSignGrid,
  type VillaEditableSelection,
} from '../src/game/data/experimental/villaMapEditor';
import { WORLD_MAPS } from '../src/game/data/maps';
import type { SerializedVilla } from '../src/game/data/experimental/villaMapTypes';

const filePath = resolve(
  process.cwd(),
  'src/game/data/experimental/villa_marionette.v1.json'
);
const originalJson = readFileSync(filePath, 'utf8');
const original = JSON.parse(originalJson) as SerializedVilla;
const originalSnapshot = JSON.parse(JSON.stringify(original)) as SerializedVilla;
const initialEditorMap = createVillaMapEditorState(original).map;
const officialMapsSnapshot = JSON.parse(JSON.stringify(WORLD_MAPS));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const smallBounds = { left: 50, top: 20, width: 320, height: 320 };
const pointInSmallSvg = clientToWorldPosition(230, 192, smallBounds);
assert.deepEqual(pointInSmallSvg, { x: 5, z: -3 }, 'Pointer should map to world coordinates at small size');
const largeBounds = { left: 100, top: 40, width: 900, height: 900 };
const pointInLargeSvg = clientToWorldPosition(100 + 450 + 5 * 8 * 1.40625, 40 + 450 + 3 * 8 * 1.40625, largeBounds);
assert.ok(Math.abs(pointInLargeSvg.x - 5) < 1e-10);
assert.ok(Math.abs(pointInLargeSvg.z + 3) < 1e-10, 'Responsive pointer conversion should preserve world position');
const letterboxedBounds = { left: 10, top: 20, width: 640, height: 320 };
assert.deepEqual(
  clientToWorldPosition(330, 180, letterboxedBounds),
  { x: 0, z: 0 },
  'Pointer mapping should respect SVG aspect-ratio letterboxing'
);
assert.throws(
  () => clientToWorldPosition(Number.NaN, 0, smallBounds),
  /must be finite/,
  'Non-finite pointer coordinates must be rejected'
);

const selection: VillaEditableSelection = { kind: 'building', editorId: 'garden-home' };
const sceneObject = original.buildings.find(({ id }) => id === selection.editorId);
assert.equal(sceneObject?.id, selection.editorId, 'Editorial ID should identify the selected object');

let state = createVillaMapEditorState(original);
const buildingMove = createPositionOperation(selection, { x: -15, z: 1 });
const buildingResult = applyVillaMapEditorOperation(state, buildingMove);
if (!buildingResult.ok) throw new Error(buildingResult.error);
assert.equal(buildingResult.ok, true);
state = buildingResult.state;
assert.deepEqual(
  state.map.buildings.find(({ id }) => id === 'garden-home'),
  {
    ...original.buildings.find(({ id }) => id === 'garden-home'),
    x: -15,
    z: 1,
    entrance: { x: -15, z: 5.2 },
  },
  'Building movement should preserve the entrance offset'
);

const trainerMove = applyVillaMapEditorOperation(state, {
  type: 'move_trainer',
  editorId: 'tyler',
  position: { x: -7, z: -6 },
});
if (!trainerMove.ok) throw new Error(trainerMove.error);
assert.equal(trainerMove.ok, true);
state = trainerMove.state;
assert.deepEqual(
  state.map.map.tamers.find(({ editorId }) => editorId === 'tyler')?.position,
  { x: -7, z: -6 },
  'Trainer should move through the existing operation module'
);

const signMove = applyVillaMapEditorOperation(state, {
  type: 'move_sign',
  editorId: 'northwest-sign',
  col: 19,
  row: 35,
});
if (!signMove.ok) throw new Error(signMove.error);
assert.equal(signMove.ok, true);
state = signMove.state;
const movedSign = state.map.map.signSpots.find(({ editorId }) => editorId === 'northwest-sign');
assert.deepEqual(movedSign && { col: movedSign.col, row: movedSign.row }, { col: 19, row: 35 });
assert.ok(isValidSignGridPosition(worldPositionToSignGrid({ x: 0, z: 0 })));
assert.equal(isValidSignGridPosition({ col: 1, row: 35 }), false, 'Sign border cells must be invalid');
assert.deepEqual(
  createPositionOperation(
    { kind: 'sign', editorId: 'northwest-sign' },
    { x: -1.5, z: 22.5 }
  ),
  { type: 'move_sign', editorId: 'northwest-sign', col: 19, row: 35 },
  'Pointer world coordinates should snap letreros to integer tile coordinates'
);
const invalidSignMove = applyVillaMapEditorOperation(state, {
  type: 'move_sign',
  editorId: 'northwest-sign',
  col: 1,
  row: 35,
});
assert.equal(invalidSignMove.ok, false, 'Sign outside the playable border must be rejected');

const validStateSnapshot = clone(state);
const outOfBounds = applyVillaMapEditorOperation(state, {
  type: 'move_building',
  editorId: 'garden-home',
  position: { x: 40, z: 1 },
});
assert.equal(outOfBounds.ok, false, 'Out-of-bounds building position must fail');
if (!outOfBounds.ok) assert.match(outOfBounds.error, /footprint must remain inside/);
const nonFinite = applyVillaMapEditorOperation(state, {
  type: 'move_trainer',
  editorId: 'tyler',
  position: { x: Number.NaN, z: 0 },
});
assert.equal(nonFinite.ok, false, 'Non-finite coordinate must fail');
if (!nonFinite.ok) assert.match(nonFinite.error, /finite number/);
assert.deepEqual(state, validStateSnapshot, 'Invalid operations must not change the last valid editor state');
assert.throws(() => parseFiniteCoordinate('', 'X'), /is required/);
assert.throws(() => parseFiniteCoordinate('NaN', 'X'), /finite number/);

const afterUndo = undoVillaMapEditorOperation(state);
assert.equal(afterUndo.history.length, 2);
assert.deepEqual(
  afterUndo.map.map.signSpots.find(({ editorId }) => editorId === 'northwest-sign'),
  original.map.signSpots.find(({ editorId }) => editorId === 'northwest-sign'),
  'Undo should restore the last confirmed object position'
);
assert.deepEqual(
  afterUndo.map.buildings.find(({ id }) => id === 'garden-home')?.entrance,
  { x: -15, z: 5.2 },
  'Undoing a later action should preserve earlier edits'
);
const resetState = resetVillaMapEditorState(original);
assert.equal(resetState.history.length, 0, 'Reset should clear history');
assert.deepEqual(
  resetState.map,
  initialEditorMap,
  'Reset should restore the untouched editor copy, including its deterministic road IDs'
);
const roadEdit = applyVillaMapEditorOperation(resetState, {
  type: 'set_road_coordinate',
  editorId: 'road-x-m12',
  axis: 'x',
  value: -10,
});
if (!roadEdit.ok) throw new Error(roadEdit.error);
assert.equal(roadEdit.state.map.map.layout.roadXs[0], -10, 'Structural road edit should be committed to the editor copy');
const undoneRoadEdit = undoVillaMapEditorOperation(roadEdit.state);
assert.equal(undoneRoadEdit.map.map.layout.roadXs[0], original.map.layout.roadXs[0]);
assert.equal(undoneRoadEdit.history.length, 0, 'Undo should remove the structural edit from history');
const plazaEdit = applyVillaMapEditorOperation(undoneRoadEdit, {
  type: 'set_plaza',
  position: { x: 1, z: -1 },
  radius: 6,
});
if (!plazaEdit.ok) throw new Error(plazaEdit.error);
const exportedStructural = JSON.parse(serializeVillaMapEditorState(plazaEdit.state)) as SerializedVilla;
assert.deepEqual(
  exportedStructural.map.layout.plaza,
  { x: 1, z: -1, radius: 6 },
  'Export should include confirmed structural changes'
);
assert.deepEqual(
  exportedStructural.map.layout.decorations,
  original.map.layout.decorations,
  'Structural export should preserve unmodified decoration fields'
);
assert.deepEqual(
  resetVillaMapEditorState(original).map,
  initialEditorMap,
  'Reset after structural edits should still restore the initial copy'
);
const encounterEdit = applyVillaMapEditorOperation(afterUndo, {
  type: 'update_encounter_zone',
  editorId: 'prado-oeste',
  property: 'encounterRate',
  value: 0.12,
});
if (!encounterEdit.ok) throw new Error(encounterEdit.error);
assert.equal(encounterEdit.ok, true, 'Encounter rate property should remain editable');
const exported = JSON.parse(serializeVillaMapEditorState(encounterEdit.state)) as SerializedVilla;
assert.equal(exported.schemaVersion, original.schemaVersion, 'Export must preserve schema version');
assert.deepEqual(
  exported.buildings.map(({ id }) => id),
  original.buildings.map(({ id }) => id),
  'Export must preserve all building editorial IDs'
);
assert.deepEqual(
  exported.map.tamers.map(({ editorId }) => editorId),
  original.map.tamers.map(({ editorId }) => editorId),
  'Export must preserve trainer editorial IDs'
);
assert.deepEqual(exported.map.palette, original.map.palette, 'Export should preserve unmodified map fields');
assert.deepEqual(
  exported.map.layout.wildZones[0].speciesPool,
  original.map.layout.wildZones[0].speciesPool,
  'Export should preserve unmodified encounter data'
);
assert.throws(
  () => serializeVillaMapEditorState({
    map: { ...afterUndo.map, schemaVersion: 99 },
    history: [],
  }),
  /Cannot export map: Input map is invalid: Unsupported schema version/,
  'Export must reject an invalid document'
);
assert.equal(
  exported.map.layout.wildZones[0].encounterRate,
  0.12,
  'Export should preserve confirmed edits'
);
assert.deepEqual(original, originalSnapshot, 'Editor operations must not mutate the original document');
assert.equal(readFileSync(filePath, 'utf8'), originalJson, 'The source JSON file must remain byte-for-byte intact');
assert.deepEqual(WORLD_MAPS, officialMapsSnapshot, 'Official maps must remain unchanged');

console.log('Villa Marionette editor harness');
console.log('================================');
console.log('Editorial ID selection and responsive pointer transforms: passed');
console.log('Building, trainer and sign movement: passed');
console.log('Bounds, non-finite values and invalid state preservation: passed');
console.log('Undo and reset state behavior: passed');
console.log('Export schema, IDs, untouched fields and edited values: passed');
console.log('Experimental JSON and official maps unchanged: passed');
