import {
  BORDER_TILES,
  MAP_HALF_DEPTH_UNITS,
  MAP_HALF_WIDTH_UNITS,
  MAP_TILES,
  TILE_UNITS,
} from '../worldGeometry';
import type { SerializedVilla } from './villaMapTypes';

export interface MoveBuildingOperation {
  type: 'move_building';
  editorId: string;
  position: { x: number; z: number };
}

export interface MoveSignOperation {
  type: 'move_sign';
  editorId: string;
  col: number;
  row: number;
}

export interface MoveTrainerOperation {
  type: 'move_trainer';
  editorId: string;
  position: { x: number; z: number };
}

export interface UpdateEncounterZoneOperation {
  type: 'update_encounter_zone';
  editorId: string;
  property: 'encounterRate';
  value: number;
}

export type VillaMapEditOperation =
  | MoveBuildingOperation
  | MoveSignOperation
  | MoveTrainerOperation
  | UpdateEncounterZoneOperation;

export type VillaMapOperationResult =
  | { ok: true; map: SerializedVilla }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertExactKeys(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} has missing or unsupported properties`);
  }
  return value;
}

function assertFiniteNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
}

function assertWorldPosition(value: unknown, label: string): asserts value is { x: number; z: number } {
  const position = assertExactKeys(value, ['x', 'z'], label);
  assertFiniteNumber(position.x, `${label}.x`);
  assertFiniteNumber(position.z, `${label}.z`);
  if (
    Math.abs(position.x) >= MAP_HALF_WIDTH_UNITS - TILE_UNITS ||
    Math.abs(position.z) >= MAP_HALF_DEPTH_UNITS - TILE_UNITS
  ) {
    throw new Error(`${label} must be inside the existing map validation bounds`);
  }
}

function assertBuildingPosition(
  value: unknown,
  building: SerializedVilla['buildings'][number]
): asserts value is { x: number; z: number } {
  const position = assertExactKeys(value, ['x', 'z'], 'position');
  assertFiniteNumber(position.x, 'position.x');
  assertFiniteNumber(position.z, 'position.z');
  if (
    Math.abs(position.x) + building.halfWidth >= MAP_HALF_WIDTH_UNITS ||
    Math.abs(position.z) + building.halfDepth >= MAP_HALF_DEPTH_UNITS
  ) {
    throw new Error('building footprint must remain inside the map terrain');
  }
}

function assertSerializable(value: unknown, label: string, ancestors = new Set<object>()): void {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) return;
  if (typeof value === 'number') {
    assertFiniteNumber(value, label);
    return;
  }
  if (typeof value !== 'object') {
    throw new Error(`${label} contains a value JSON cannot preserve`);
  }
  if (ancestors.has(value)) throw new Error(`${label} contains a circular reference`);
  if (Object.getPrototypeOf(value) !== Object.prototype && !Array.isArray(value)) {
    throw new Error(`${label} contains a non-plain object`);
  }

  ancestors.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSerializable(entry, `${label}[${index}]`, ancestors));
  } else {
    for (const [key, entry] of Object.entries(value)) {
      assertSerializable(entry, `${label}.${key}`, ancestors);
    }
  }
  ancestors.delete(value);
}

function cloneSerializedVilla(input: SerializedVilla): SerializedVilla {
  assertSerializable(input, 'map');
  return JSON.parse(JSON.stringify(input)) as SerializedVilla;
}

function allEditorIds(map: SerializedVilla): string[] {
  return [
    ...map.map.connections.map(({ editorId }) => editorId),
    ...map.map.layout.wildZones.map(({ editorId }) => editorId),
    ...map.map.tamers.map(({ editorId }) => editorId),
    ...map.map.clearPointReservations.map(({ editorId }) => editorId),
    ...map.map.signSpots.map(({ editorId }) => editorId),
    ...map.buildings.map(({ id }) => id),
  ];
}

function validateExperimentalVilla(map: SerializedVilla): void {
  if (map.schemaVersion !== 1) throw new Error(`Unsupported schema version "${map.schemaVersion}"`);
  if (map.map.id !== 'villa_marionette') throw new Error('Expected map id "villa_marionette"');
  if (
    map.geometry.tileUnits !== TILE_UNITS ||
    map.geometry.tilesWide !== MAP_TILES ||
    map.geometry.tilesDeep !== MAP_TILES ||
    map.geometry.borderTiles !== BORDER_TILES
  ) {
    throw new Error('Map geometry does not match the shared world geometry');
  }

  const ids = allEditorIds(map);
  if (ids.some((id) => typeof id !== 'string' || id.trim().length === 0)) {
    throw new Error('Every editable object must have a non-empty editor ID');
  }
  if (new Set(ids).size !== ids.length) throw new Error('Editor IDs must be unique');

  for (const building of map.buildings) {
    assertFiniteNumber(building.x, `Building "${building.id}".x`);
    assertFiniteNumber(building.z, `Building "${building.id}".z`);
    assertFiniteNumber(building.entrance.x, `Building "${building.id}" entrance.x`);
    assertFiniteNumber(building.entrance.z, `Building "${building.id}" entrance.z`);
    if (
      Math.abs(building.x) + building.halfWidth >= MAP_HALF_WIDTH_UNITS ||
      Math.abs(building.z) + building.halfDepth >= MAP_HALF_DEPTH_UNITS ||
      Math.abs(building.entrance.x) >= MAP_HALF_WIDTH_UNITS ||
      Math.abs(building.entrance.z) >= MAP_HALF_DEPTH_UNITS
    ) {
      throw new Error(`Building "${building.id}" footprint and entrance must remain inside the map terrain`);
    }
    if (building.entrance.x !== building.x || building.entrance.z <= building.z) {
      throw new Error(`Building "${building.id}" entrance must remain centered on its north-facing facade`);
    }
  }
  for (const sign of map.map.signSpots) {
    if (
      !Number.isInteger(sign.col) ||
      !Number.isInteger(sign.row) ||
      sign.col < BORDER_TILES ||
      sign.row < BORDER_TILES ||
      sign.col >= MAP_TILES - BORDER_TILES ||
      sign.row >= MAP_TILES - BORDER_TILES
    ) {
      throw new Error(`Sign "${sign.editorId}" must be on an integer tile inside the playable border`);
    }
  }
  for (const tamer of map.map.tamers) {
    assertWorldPosition(tamer.position, `Trainer "${tamer.editorId}" position`);
  }
  for (const zone of map.map.layout.wildZones) {
    assertFiniteNumber(zone.encounterRate, `Encounter zone "${zone.editorId}" encounterRate`);
    if (zone.encounterRate <= 0 || zone.encounterRate > 1) {
      throw new Error(`Encounter zone "${zone.editorId}" encounterRate must be in (0, 1]`);
    }
  }
}

function applyOne(map: SerializedVilla, operation: unknown): void {
  if (!isRecord(operation) || typeof operation.type !== 'string') {
    throw new Error('operation must be an object with a string type');
  }

  switch (operation.type) {
    case 'move_building': {
      const data = assertExactKeys(operation, ['type', 'editorId', 'position'], 'move_building operation');
      if (typeof data.editorId !== 'string') throw new Error('editorId must be a string');
      const building = map.buildings.find(({ id }) => id === data.editorId);
      if (!building) throw new Error(`building ID "${data.editorId}" was not found`);
      assertBuildingPosition(data.position, building);
      const deltaX = data.position.x - building.x;
      const deltaZ = data.position.z - building.z;
      building.x = data.position.x;
      building.z = data.position.z;
      building.entrance.x += deltaX;
      building.entrance.z += deltaZ;
      return;
    }
    case 'move_sign': {
      const data = assertExactKeys(operation, ['type', 'editorId', 'col', 'row'], 'move_sign operation');
      if (typeof data.editorId !== 'string') throw new Error('editorId must be a string');
      assertFiniteNumber(data.col, 'col');
      assertFiniteNumber(data.row, 'row');
      if (
        !Number.isInteger(data.col) ||
        !Number.isInteger(data.row) ||
        data.col < BORDER_TILES ||
        data.row < BORDER_TILES ||
        data.col >= MAP_TILES - BORDER_TILES ||
        data.row >= MAP_TILES - BORDER_TILES
      ) {
        throw new Error('sign coordinates must be integer tiles inside the existing playable border');
      }
      const sign = map.map.signSpots.find(({ editorId }) => editorId === data.editorId);
      if (!sign) throw new Error(`sign ID "${data.editorId}" was not found`);
      sign.col = data.col;
      sign.row = data.row;
      return;
    }
    case 'move_trainer': {
      const data = assertExactKeys(operation, ['type', 'editorId', 'position'], 'move_trainer operation');
      if (typeof data.editorId !== 'string') throw new Error('editorId must be a string');
      assertWorldPosition(data.position, 'position');
      const trainer = map.map.tamers.find(({ editorId }) => editorId === data.editorId);
      if (!trainer) throw new Error(`trainer ID "${data.editorId}" was not found`);
      trainer.position = { x: data.position.x, z: data.position.z };
      return;
    }
    case 'update_encounter_zone': {
      const data = assertExactKeys(
        operation,
        ['type', 'editorId', 'property', 'value'],
        'update_encounter_zone operation'
      );
      if (typeof data.editorId !== 'string') throw new Error('editorId must be a string');
      if (data.property !== 'encounterRate') {
        throw new Error('only the "encounterRate" property is editable for encounter zones');
      }
      assertFiniteNumber(data.value, 'value');
      if (data.value <= 0 || data.value > 1) {
        throw new Error('encounterRate must be in (0, 1]');
      }
      const zone = map.map.layout.wildZones.find(({ editorId }) => editorId === data.editorId);
      if (!zone) throw new Error(`encounter zone ID "${data.editorId}" was not found`);
      zone.encounterRate = data.value;
      return;
    }
    default:
      throw new Error(`unknown operation type "${operation.type}"`);
  }
}

/**
 * Applies edits to a JSON-safe copy. An empty operation list succeeds with an
 * equal but separate copy; any failed operation discards every staged edit.
 */
export function applyVillaMapOperations(
  input: SerializedVilla,
  operations: readonly unknown[]
): VillaMapOperationResult {
  let workingCopy: SerializedVilla;
  try {
    workingCopy = cloneSerializedVilla(input);
    validateExperimentalVilla(workingCopy);
  } catch (error) {
    return { ok: false, error: `Input map is invalid: ${error instanceof Error ? error.message : String(error)}` };
  }

  if (!Array.isArray(operations)) return { ok: false, error: 'Operations must be an array' };

  for (const [index, operation] of operations.entries()) {
    try {
      const draft = cloneSerializedVilla(workingCopy);
      applyOne(draft, operation);
      validateExperimentalVilla(draft);
      workingCopy = draft;
    } catch (error) {
      const type = isRecord(operation) && typeof operation.type === 'string'
        ? operation.type
        : 'invalid operation';
      const reason = error instanceof Error ? error.message : String(error);
      return { ok: false, error: `Operation ${index + 1} (${type}) failed: ${reason}` };
    }
  }

  return { ok: true, map: workingCopy };
}
