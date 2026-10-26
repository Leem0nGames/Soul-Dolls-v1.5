import {
  BORDER_TILES,
  gridToWorldCenter,
  MAP_TILES,
  worldToGridIndex,
} from '../worldGeometry';
import {
  applyVillaMapOperations,
  type VillaMapEditOperation,
  type VillaMapOperationResult,
} from './villaMapOperations';
import { normalizeVillaRoadEditorIds } from './villaMapIdentity';
import type { SerializedVilla } from './villaMapTypes';

export const VILLA_PREVIEW_VIEWBOX_SIZE = 640;
export const VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT = 8;

export type VillaEditableSelection =
  | { kind: 'building'; editorId: string }
  | { kind: 'trainer'; editorId: string }
  | { kind: 'sign'; editorId: string }
  | { kind: 'encounter-zone'; editorId: string }
  | { kind: 'road'; editorId: string; axis: 'x' | 'z' }
  | { kind: 'road-path'; editorId: string; pointIndex: number }
  | { kind: 'plaza'; editorId: 'plaza' }
  | { kind: 'clear-point'; editorId: string }
  | { kind: 'connection'; editorId: string };

export interface ClientBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface WorldPosition {
  x: number;
  z: number;
}

export interface GridPosition {
  col: number;
  row: number;
}

export interface VillaMapEditorState {
  map: SerializedVilla;
  history: SerializedVilla[];
}

export type VillaMapEditStateResult =
  | { ok: true; state: VillaMapEditorState }
  | { ok: false; error: string };

function cloneMap(map: SerializedVilla): SerializedVilla {
  return JSON.parse(JSON.stringify(map)) as SerializedVilla;
}

export function clientToWorldPosition(
  clientX: number,
  clientY: number,
  bounds: ClientBounds
): WorldPosition {
  if (
    !Number.isFinite(clientX) ||
    !Number.isFinite(clientY) ||
    !Number.isFinite(bounds.left) ||
    !Number.isFinite(bounds.top) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    throw new Error('Pointer coordinates and SVG bounds must be finite with positive dimensions');
  }

  const scale = Math.min(
    bounds.width / VILLA_PREVIEW_VIEWBOX_SIZE,
    bounds.height / VILLA_PREVIEW_VIEWBOX_SIZE
  );
  const renderedWidth = VILLA_PREVIEW_VIEWBOX_SIZE * scale;
  const renderedHeight = VILLA_PREVIEW_VIEWBOX_SIZE * scale;
  const offsetX = (bounds.width - renderedWidth) / 2;
  const offsetY = (bounds.height - renderedHeight) / 2;
  const svgX = (clientX - bounds.left - offsetX) / scale;
  const svgY = (clientY - bounds.top - offsetY) / scale;
  const center = VILLA_PREVIEW_VIEWBOX_SIZE / 2;
  return {
    x: (svgX - center) / VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT,
    z: (center - svgY) / VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT,
  };
}

export function worldPositionToSignGrid(position: WorldPosition): GridPosition {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) {
    throw new Error('Sign pointer position must be finite');
  }
  const col = worldToGridIndex(position.x);
  const row = worldToGridIndex(position.z);
  return { col, row };
}

export function signGridToWorldPosition(position: GridPosition): WorldPosition {
  return {
    x: gridToWorldCenter(position.col),
    z: gridToWorldCenter(position.row),
  };
}

export function isValidSignGridPosition(position: GridPosition): boolean {
  return (
    Number.isInteger(position.col) &&
    Number.isInteger(position.row) &&
    position.col >= BORDER_TILES &&
    position.row >= BORDER_TILES &&
    position.col < MAP_TILES - BORDER_TILES &&
    position.row < MAP_TILES - BORDER_TILES
  );
}

export function createVillaMapEditorState(original: SerializedVilla): VillaMapEditorState {
  return { map: normalizeVillaRoadEditorIds(original), history: [] };
}

export function applyVillaMapEditorOperation(
  state: VillaMapEditorState,
  operation: unknown
): VillaMapEditStateResult {
  return applyVillaMapEditorOperations(state, [operation]);
}

export function applyVillaMapEditorOperations(
  state: VillaMapEditorState,
  operations: readonly unknown[]
): VillaMapEditStateResult {
  const result: VillaMapOperationResult = applyVillaMapOperations(state.map, operations);
  if (!result.ok) return result;
  if (JSON.stringify(result.map) === JSON.stringify(state.map)) {
    return { ok: true, state };
  }
  return {
    ok: true,
    state: {
      map: result.map,
      history: [...state.history, cloneMap(state.map)],
    },
  };
}

export function undoVillaMapEditorOperation(state: VillaMapEditorState): VillaMapEditorState {
  if (state.history.length === 0) return state;
  return {
    map: cloneMap(state.history[state.history.length - 1]),
    history: state.history.slice(0, -1),
  };
}

export function resetVillaMapEditorState(original: SerializedVilla): VillaMapEditorState {
  return createVillaMapEditorState(original);
}

export function serializeVillaMapEditorState(state: VillaMapEditorState): string {
  const validation = applyVillaMapOperations(state.map, []);
  if (!validation.ok) throw new Error(`Cannot export map: ${validation.error}`);
  return JSON.stringify(validation.map, null, 2);
}

export function createPositionOperation(
  selection: VillaEditableSelection,
  position: WorldPosition
): VillaMapEditOperation {
  switch (selection.kind) {
    case 'building':
      return { type: 'move_building', editorId: selection.editorId, position };
    case 'trainer':
      return { type: 'move_trainer', editorId: selection.editorId, position };
    case 'sign': {
      const grid = worldPositionToSignGrid(position);
      return { type: 'move_sign', editorId: selection.editorId, ...grid };
    }
    case 'road':
      return {
        type: 'set_road_coordinate',
        editorId: selection.editorId,
        axis: selection.axis,
        value: selection.axis === 'x' ? position.x : position.z,
      };
    case 'road-path':
      return {
        type: 'update_road_path_point',
        editorId: selection.editorId,
        pointIndex: selection.pointIndex,
        position,
      };
    case 'plaza':
      throw new Error('Use set_plaza to edit plaza geometry');
    case 'encounter-zone':
      return {
        type: 'move_encounter_zone',
        editorId: selection.editorId,
        position,
      };
    case 'clear-point': {
      throw new Error('Use update_clear_point_reservation to edit reservation geometry');
    }
    default:
      throw new Error(`Objects of type "${selection.kind}" cannot be moved`);
  }
}

export function createRoadCoordinateOperation(
  editorId: string,
  axis: 'x' | 'z',
  value: number
): VillaMapEditOperation {
  return { type: 'set_road_coordinate', editorId, axis, value };
}

export function createRoadWidthOperation(value: number): VillaMapEditOperation {
  return { type: 'set_road_width', value };
}

export function createPlazaOperation(
  position: WorldPosition,
  radius: number
): VillaMapEditOperation {
  return { type: 'set_plaza', position, radius };
}

export function createClearReservationOperation(
  editorId: string,
  position: WorldPosition,
  radius: number
): VillaMapEditOperation {
  return { type: 'update_clear_point_reservation', editorId, position, radius };
}

export function createEncounterZoneBoundsOperation(
  editorId: string,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
): VillaMapEditOperation {
  return { type: 'resize_encounter_zone', editorId, bounds };
}

export function parseFiniteCoordinate(value: string, label: string): number {
  if (value.trim() === '') throw new Error(`${label} is required`);
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a finite number`);
  return number;
}

export function createEncounterRateOperation(
  selection: VillaEditableSelection,
  value: number
): VillaMapEditOperation {
  if (selection.kind !== 'encounter-zone') {
    throw new Error('Encounter rate can only be edited on an encounter zone');
  }
  return {
    type: 'update_encounter_zone',
    editorId: selection.editorId,
    property: 'encounterRate',
    value,
  };
}
