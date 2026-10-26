import type { SerializedVilla } from './villaMapTypes';

function coordinateToken(value: number): string {
  return String(value).replace('-', 'm').replace('.', 'p');
}

export function defaultRoadId(axis: 'x' | 'z', coordinate: number): string {
  return `road-${axis}-${coordinateToken(coordinate)}`;
}

export function normalizeVillaRoadEditorIds(input: SerializedVilla): SerializedVilla {
  const map = JSON.parse(JSON.stringify(input)) as SerializedVilla;
  if (!map.editorMetadata) {
    map.editorMetadata = {
      roadsX: map.map.layout.roadXs.map((coordinate) => defaultRoadId('x', coordinate)),
      roadsZ: map.map.layout.roadZs.map((coordinate) => defaultRoadId('z', coordinate)),
      ...(map.map.layout.roadPath ? { roadPath: 'road-path-main' } : {}),
    };
  }
  return map;
}
