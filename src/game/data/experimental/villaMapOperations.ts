import {
  BORDER_TILES,
  MAP_HALF_DEPTH_UNITS,
  MAP_HALF_WIDTH_UNITS,
  MAP_TILES,
  TILE_UNITS,
} from '../worldGeometry';
import type { SerializedVilla } from './villaMapTypes';
import { defaultRoadId } from './villaMapIdentity';

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

export interface SetRoadCoordinateOperation {
  type: 'set_road_coordinate';
  editorId: string;
  axis: 'x' | 'z';
  value: number;
}

export interface AddRoadOperation {
  type: 'add_road';
  editorId: string;
  axis: 'x' | 'z';
  value: number;
}

export interface RemoveRoadOperation {
  type: 'remove_road';
  editorId: string;
}

export interface SetRoadWidthOperation {
  type: 'set_road_width';
  value: number;
}

export interface AddRoadPathOperation {
  type: 'add_road_path';
  editorId: string;
  points: { x: number; z: number }[];
}

export interface UpdateRoadPathPointOperation {
  type: 'update_road_path_point';
  editorId: string;
  pointIndex: number;
  position: { x: number; z: number };
}

export interface RemoveRoadPathOperation {
  type: 'remove_road_path';
  editorId: string;
}

export interface SetPlazaOperation {
  type: 'set_plaza';
  position: { x: number; z: number };
  radius: number;
}

export interface RemovePlazaOperation {
  type: 'remove_plaza';
}

export interface MoveEncounterZoneOperation {
  type: 'move_encounter_zone';
  editorId: string;
  position: { x: number; z: number };
}

export interface ResizeEncounterZoneOperation {
  type: 'resize_encounter_zone';
  editorId: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export interface UpdateClearPointReservationOperation {
  type: 'update_clear_point_reservation';
  editorId: string;
  position: { x: number; z: number };
  radius: number;
}

export type VillaMapEditOperation =
  | MoveBuildingOperation
  | MoveSignOperation
  | MoveTrainerOperation
  | UpdateEncounterZoneOperation
  | SetRoadCoordinateOperation
  | AddRoadOperation
  | RemoveRoadOperation
  | SetRoadWidthOperation
  | AddRoadPathOperation
  | UpdateRoadPathPointOperation
  | RemoveRoadPathOperation
  | SetPlazaOperation
  | RemovePlazaOperation
  | MoveEncounterZoneOperation
  | ResizeEncounterZoneOperation
  | UpdateClearPointReservationOperation;

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

function assertMapPoint(value: unknown, label: string): asserts value is { x: number; z: number } {
  const position = assertExactKeys(value, ['x', 'z'], label);
  assertFiniteNumber(position.x, `${label}.x`);
  assertFiniteNumber(position.z, `${label}.z`);
  if (
    Math.abs(position.x) >= MAP_HALF_WIDTH_UNITS ||
    Math.abs(position.z) >= MAP_HALF_DEPTH_UNITS
  ) {
    throw new Error(`${label} must remain inside the map terrain`);
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
  const roadIdsX = map.editorMetadata?.roadsX ??
    map.map.layout.roadXs.map((coordinate) => defaultRoadId('x', coordinate));
  const roadIdsZ = map.editorMetadata?.roadsZ ??
    map.map.layout.roadZs.map((coordinate) => defaultRoadId('z', coordinate));
  const roadPathId = map.editorMetadata?.roadPath ??
    (map.map.layout.roadPath ? 'road-path-main' : undefined);
  return [
    ...map.map.connections.map(({ editorId }) => editorId),
    ...map.map.layout.wildZones.map(({ editorId }) => editorId),
    ...map.map.tamers.map(({ editorId }) => editorId),
    ...map.map.clearPointReservations.map(({ editorId }) => editorId),
    ...map.map.signSpots.map(({ editorId }) => editorId),
    ...map.buildings.map(({ id }) => id),
    ...roadIdsX,
    ...roadIdsZ,
    ...(roadPathId ? [roadPathId] : []),
  ];
}

function ensureRoadMetadata(map: SerializedVilla): NonNullable<SerializedVilla['editorMetadata']> {
  if (!map.editorMetadata) {
    map.editorMetadata = {
      roadsX: map.map.layout.roadXs.map((coordinate) => defaultRoadId('x', coordinate)),
      roadsZ: map.map.layout.roadZs.map((coordinate) => defaultRoadId('z', coordinate)),
      ...(map.map.layout.roadPath ? { roadPath: 'road-path-main' } : {}),
    };
  }
  return map.editorMetadata;
}

function roadAxisForId(map: SerializedVilla, editorId: string): 'x' | 'z' | null {
  const metadata = map.editorMetadata;
  const roadsX = metadata?.roadsX ?? map.map.layout.roadXs.map((coordinate) => defaultRoadId('x', coordinate));
  const roadsZ = metadata?.roadsZ ?? map.map.layout.roadZs.map((coordinate) => defaultRoadId('z', coordinate));
  if (roadsX.includes(editorId)) return 'x';
  if (roadsZ.includes(editorId)) return 'z';
  return null;
}

function validateRoadCoordinate(value: unknown, axis: 'x' | 'z'): asserts value is number {
  assertFiniteNumber(value, 'road coordinate');
  const limit = axis === 'x' ? MAP_HALF_WIDTH_UNITS : MAP_HALF_DEPTH_UNITS;
  if (Math.abs(value) >= limit) throw new Error(`road ${axis} coordinate must be inside map bounds`);
}

function validateZoneBounds(bounds: unknown): asserts bounds is {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  const value = assertExactKeys(bounds, ['minX', 'maxX', 'minZ', 'maxZ'], 'bounds');
  assertFiniteNumber(value.minX, 'bounds.minX');
  assertFiniteNumber(value.maxX, 'bounds.maxX');
  assertFiniteNumber(value.minZ, 'bounds.minZ');
  assertFiniteNumber(value.maxZ, 'bounds.maxZ');
  if (value.minX >= value.maxX || value.minZ >= value.maxZ) {
    throw new Error('encounter zone bounds must have positive width and depth');
  }
  if (
    value.minX < -MAP_HALF_WIDTH_UNITS ||
    value.maxX > MAP_HALF_WIDTH_UNITS ||
    value.minZ < -MAP_HALF_DEPTH_UNITS ||
    value.maxZ > MAP_HALF_DEPTH_UNITS
  ) {
    throw new Error('encounter zone bounds must remain inside map bounds');
  }
}

function validateReservation(position: unknown, radius: unknown): asserts position is { x: number; z: number } {
  assertMapPoint(position, 'position');
  assertFiniteNumber(radius, 'radius');
  if (radius <= 0) throw new Error('reservation radius must be positive');
  if (
    Math.abs(position.x) + radius > MAP_HALF_WIDTH_UNITS ||
    Math.abs(position.z) + radius > MAP_HALF_DEPTH_UNITS
  ) {
    throw new Error('reservation must remain inside map bounds');
  }
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

  if (!Array.isArray(map.map.layout.roadXs) || !Array.isArray(map.map.layout.roadZs)) {
    throw new Error('Road coordinates must be arrays');
  }
  if (!Number.isFinite(map.map.layout.roadHalfWidth) || map.map.layout.roadHalfWidth <= 0) {
    throw new Error('Road half-width must be a positive finite number');
  }
  const roadMeta = map.editorMetadata;
  if (roadMeta && (!Array.isArray(roadMeta.roadsX) || !Array.isArray(roadMeta.roadsZ))) {
    throw new Error('Road editorial IDs must be arrays');
  }
  if (roadMeta && (roadMeta.roadsX.length !== map.map.layout.roadXs.length ||
      roadMeta.roadsZ.length !== map.map.layout.roadZs.length)) {
    throw new Error('Road editorial IDs must match the road coordinate arrays');
  }
  if (roadMeta && (
    roadMeta.roadsX.some((id) => typeof id !== 'string' || !id.trim()) ||
    roadMeta.roadsZ.some((id) => typeof id !== 'string' || !id.trim()) ||
    (roadMeta.roadPath !== undefined && (typeof roadMeta.roadPath !== 'string' || !roadMeta.roadPath.trim()))
  )) {
    throw new Error('Road editorial IDs must be non-empty strings');
  }
  if (roadMeta && Boolean(map.map.layout.roadPath) !== Boolean(roadMeta.roadPath)) {
    throw new Error('Road path geometry and its editorial ID must be defined together');
  }
  for (const [index, coordinate] of map.map.layout.roadXs.entries()) {
    validateRoadCoordinate(coordinate, 'x');
    const other = map.map.layout.roadXs.findIndex((value, otherIndex) => otherIndex !== index && value === coordinate);
    if (other >= 0) throw new Error(`Duplicate vertical road coordinate "${coordinate}"`);
  }
  for (const [index, coordinate] of map.map.layout.roadZs.entries()) {
    validateRoadCoordinate(coordinate, 'z');
    const other = map.map.layout.roadZs.findIndex((value, otherIndex) => otherIndex !== index && value === coordinate);
    if (other >= 0) throw new Error(`Duplicate horizontal road coordinate "${coordinate}"`);
  }
  if (map.map.layout.roadPath) {
    if (map.map.layout.roadPath.length < 2) throw new Error('Road path must contain at least two points');
    map.map.layout.roadPath.forEach((point, index) => assertMapPoint(point, `roadPath[${index}]`));
  }

  for (const zone of map.map.layout.wildZones) {
    validateZoneBounds({
      minX: zone.minX,
      maxX: zone.maxX,
      minZ: zone.minZ,
      maxZ: zone.maxZ,
    });
  }
  for (const reservation of map.map.clearPointReservations) {
    validateReservation({ x: reservation.x, z: reservation.z }, reservation.r);
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
    case 'set_road_coordinate': {
      const data = assertExactKeys(operation, ['type', 'editorId', 'axis', 'value'], 'set_road_coordinate operation');
      if (typeof data.editorId !== 'string' || (data.axis !== 'x' && data.axis !== 'z')) {
        throw new Error('road editorId and axis are required');
      }
      const metadata = ensureRoadMetadata(map);
      const axis = roadAxisForId(map, data.editorId);
      if (axis !== data.axis) throw new Error(`road ID "${data.editorId}" was not found on axis "${data.axis}"`);
      const coordinate = data.value;
      validateRoadCoordinate(coordinate, axis);
      const ids = axis === 'x' ? metadata.roadsX : metadata.roadsZ;
      const coordinates = axis === 'x' ? map.map.layout.roadXs : map.map.layout.roadZs;
      const index = ids.indexOf(data.editorId);
      if (coordinates.some((current, coordinateIndex) => coordinateIndex !== index && current === coordinate)) {
        throw new Error(`A road already exists at ${data.axis}=${coordinate}`);
      }
      coordinates[index] = coordinate;
      return;
    }
    case 'add_road': {
      const data = assertExactKeys(operation, ['type', 'editorId', 'axis', 'value'], 'add_road operation');
      if (typeof data.editorId !== 'string' || !data.editorId.trim() || (data.axis !== 'x' && data.axis !== 'z')) {
        throw new Error('new road requires a non-empty editorId and axis "x" or "z"');
      }
      const coordinate = data.value;
      validateRoadCoordinate(coordinate, data.axis);
      const metadata = ensureRoadMetadata(map);
      const ids = data.axis === 'x' ? metadata.roadsX : metadata.roadsZ;
      const coordinates = data.axis === 'x' ? map.map.layout.roadXs : map.map.layout.roadZs;
      if (allEditorIds(map).includes(data.editorId)) throw new Error(`editor ID "${data.editorId}" already exists`);
      if (coordinates.includes(coordinate)) throw new Error(`A road already exists at ${data.axis}=${coordinate}`);
      ids.push(data.editorId);
      coordinates.push(coordinate);
      return;
    }
    case 'remove_road': {
      const data = assertExactKeys(operation, ['type', 'editorId'], 'remove_road operation');
      if (typeof data.editorId !== 'string') throw new Error('editorId must be a string');
      const metadata = ensureRoadMetadata(map);
      const axis = roadAxisForId(map, data.editorId);
      if (!axis) throw new Error(`road ID "${data.editorId}" was not found`);
      const ids = axis === 'x' ? metadata.roadsX : metadata.roadsZ;
      const coordinates = axis === 'x' ? map.map.layout.roadXs : map.map.layout.roadZs;
      const index = ids.indexOf(data.editorId);
      ids.splice(index, 1);
      coordinates.splice(index, 1);
      return;
    }
    case 'set_road_width': {
      const data = assertExactKeys(operation, ['type', 'value'], 'set_road_width operation');
      const width = data.value;
      assertFiniteNumber(width, 'road half-width');
      if (width <= 0 || width > Math.min(MAP_HALF_WIDTH_UNITS, MAP_HALF_DEPTH_UNITS)) {
        throw new Error('road half-width must be positive and no wider than half the map');
      }
      map.map.layout.roadHalfWidth = width;
      return;
    }
    case 'add_road_path': {
      const data = assertExactKeys(operation, ['type', 'editorId', 'points'], 'add_road_path operation');
      if (typeof data.editorId !== 'string' || !data.editorId.trim()) throw new Error('road path requires a non-empty editorId');
      const metadata = ensureRoadMetadata(map);
      if (map.map.layout.roadPath || metadata.roadPath) throw new Error('a road path already exists');
      if (!Array.isArray(data.points) || data.points.length < 2) throw new Error('road path requires at least two points');
      data.points.forEach((point, index) => assertMapPoint(point, `points[${index}]`));
      if (allEditorIds(map).includes(data.editorId)) throw new Error(`editor ID "${data.editorId}" already exists`);
      map.map.layout.roadPath = data.points.map((point) => ({ x: point.x, z: point.z }));
      metadata.roadPath = data.editorId;
      return;
    }
    case 'update_road_path_point': {
      const data = assertExactKeys(
        operation,
        ['type', 'editorId', 'pointIndex', 'position'],
        'update_road_path_point operation'
      );
      const metadata = ensureRoadMetadata(map);
      if (typeof data.editorId !== 'string' || data.editorId !== metadata.roadPath) {
        throw new Error(`road path ID "${String(data.editorId)}" was not found`);
      }
      if (!map.map.layout.roadPath) throw new Error('road path data is missing');
      const pointIndex = data.pointIndex;
      if (typeof pointIndex !== 'number' || !Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex >= map.map.layout.roadPath.length) {
        throw new Error('road path pointIndex is out of range');
      }
      assertMapPoint(data.position, 'position');
      map.map.layout.roadPath[pointIndex] = { x: data.position.x, z: data.position.z };
      return;
    }
    case 'remove_road_path': {
      const data = assertExactKeys(operation, ['type', 'editorId'], 'remove_road_path operation');
      const metadata = ensureRoadMetadata(map);
      if (typeof data.editorId !== 'string' || data.editorId !== metadata.roadPath) {
        throw new Error(`road path ID "${String(data.editorId)}" was not found`);
      }
      delete map.map.layout.roadPath;
      delete metadata.roadPath;
      return;
    }
    case 'set_plaza': {
      const data = assertExactKeys(operation, ['type', 'position', 'radius'], 'set_plaza operation');
      const position = data.position;
      const radius = data.radius;
      assertMapPoint(position, 'position');
      assertFiniteNumber(radius, 'radius');
      if (radius <= 0 || radius > Math.min(MAP_HALF_WIDTH_UNITS, MAP_HALF_DEPTH_UNITS)) {
        throw new Error('plaza radius must be positive and fit inside the map');
      }
      if (
        Math.abs(position.x) + radius > MAP_HALF_WIDTH_UNITS ||
        Math.abs(position.z) + radius > MAP_HALF_DEPTH_UNITS
      ) {
        throw new Error('plaza geometry must remain inside map bounds');
      }
      map.map.layout.plaza = { x: position.x, z: position.z, radius };
      return;
    }
    case 'remove_plaza': {
      assertExactKeys(operation, ['type'], 'remove_plaza operation');
      map.map.layout.plaza = null;
      return;
    }
    case 'move_encounter_zone': {
      const data = assertExactKeys(operation, ['type', 'editorId', 'position'], 'move_encounter_zone operation');
      if (typeof data.editorId !== 'string') throw new Error('editorId must be a string');
      assertMapPoint(data.position, 'position');
      const zone = map.map.layout.wildZones.find(({ editorId }) => editorId === data.editorId);
      if (!zone) throw new Error(`encounter zone ID "${data.editorId}" was not found`);
      const centerX = (zone.minX + zone.maxX) / 2;
      const centerZ = (zone.minZ + zone.maxZ) / 2;
      const deltaX = data.position.x - centerX;
      const deltaZ = data.position.z - centerZ;
      validateZoneBounds({
        minX: zone.minX + deltaX,
        maxX: zone.maxX + deltaX,
        minZ: zone.minZ + deltaZ,
        maxZ: zone.maxZ + deltaZ,
      });
      zone.minX += deltaX;
      zone.maxX += deltaX;
      zone.minZ += deltaZ;
      zone.maxZ += deltaZ;
      return;
    }
    case 'resize_encounter_zone': {
      const data = assertExactKeys(operation, ['type', 'editorId', 'bounds'], 'resize_encounter_zone operation');
      if (typeof data.editorId !== 'string') throw new Error('editorId must be a string');
      validateZoneBounds(data.bounds);
      const zone = map.map.layout.wildZones.find(({ editorId }) => editorId === data.editorId);
      if (!zone) throw new Error(`encounter zone ID "${data.editorId}" was not found`);
      zone.minX = data.bounds.minX;
      zone.maxX = data.bounds.maxX;
      zone.minZ = data.bounds.minZ;
      zone.maxZ = data.bounds.maxZ;
      return;
    }
    case 'update_clear_point_reservation': {
      const data = assertExactKeys(
        operation,
        ['type', 'editorId', 'position', 'radius'],
        'update_clear_point_reservation operation'
      );
      if (typeof data.editorId !== 'string') throw new Error('editorId must be a string');
      const position = data.position;
      const radius = data.radius;
      assertFiniteNumber(radius, 'radius');
      validateReservation(position, radius);
      const reservation = map.map.clearPointReservations.find(({ editorId }) => editorId === data.editorId);
      if (!reservation) throw new Error(`clear-point reservation ID "${data.editorId}" was not found`);
      reservation.x = position.x;
      reservation.z = position.z;
      reservation.r = radius;
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
