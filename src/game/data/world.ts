export type MapId = 'villa_marionette' | 'ruta_1';

export interface MapWildZone {
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  encounterRate: number;
  speciesPool: { speciesId: string; minLevel: number; maxLevel: number; weight: number }[];
}

export interface MapConnection {
  at: { x: number; z: number };
  toMap: MapId;
  arrival: { x: number; z: number };
}

export interface MapLayoutDefinition {
  wildZones: MapWildZone[];
  plaza: { x: number; z: number; radius: number } | null;
  roadXs: number[];
  roadZs: number[];
  roadPath?: { x: number; z: number }[];
  roadHalfWidth: number;
  flowerDensity: number;
  decorations: {
    tallTrees: number;
    shortTrees: number;
    bushes: number;
    rocks: number;
    flowers: number;
    tufts: number;
  };
  buildingFootprints?: { x: number; z: number; halfWidth: number; halfDepth: number }[];
}

export interface WorldMapDefinition {
  id: MapId;
  name: string;
  palette: { background: string; fog: string };
  connections: MapConnection[];
  layout: MapLayoutDefinition;
  clearPoints: { x: number; z: number; r: number }[];
  signSpots: [number, number][];
}
