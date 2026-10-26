import type { VillaBuilding } from '../maps/villaBuildings';
import type {
  MapConnection,
  MapTamerDefinition,
  MapWildZone,
  WorldMapDefinition,
} from '../world';

export interface EditorConnection extends MapConnection {
  editorId: string;
}

export interface EditorWildZone extends MapWildZone {
  editorId: string;
}

export interface EditorTamer extends MapTamerDefinition {
  editorId: string;
}

export interface EditorVillaMap
  extends Omit<WorldMapDefinition, 'connections' | 'layout' | 'clearPoints' | 'signSpots' | 'tamers'> {
  connections: EditorConnection[];
  layout: Omit<WorldMapDefinition['layout'], 'wildZones' | 'buildingFootprints'> & {
    wildZones: EditorWildZone[];
  };
  clearPointReservations: ({ editorId: string } & WorldMapDefinition['clearPoints'][number])[];
  signSpots: { editorId: string; col: number; row: number }[];
  tamers: EditorTamer[];
}

export interface SerializedVilla {
  schemaVersion: number;
  geometry: {
    tileUnits: number;
    tilesWide: number;
    tilesDeep: number;
    borderTiles: number;
    source: string;
  };
  map: EditorVillaMap;
  buildings: VillaBuilding[];
}
