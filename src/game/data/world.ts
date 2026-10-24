export type MapId = 'villa_marionette' | 'ruta_1' | 'bosque_del_eco';

export type DecorationKind =
  | 'tree-short'
  | 'tree-tall'
  | 'bush'
  | 'flower-a'
  | 'flower-b'
  | 'rock'
  | 'grass-tuft'
  | 'sign'
  | 'craftpix-fern'
  | 'craftpix-flowering-bush'
  | 'craftpix-autumn-bush';

export type MapDecorationBudget = {
  tallTrees: number;
  shortTrees: number;
  bushes: number;
  rocks: number;
  flowers: number;
  tufts: number;
} & Partial<Record<DecorationKind, number>>;

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
  facing: 'down' | 'up' | 'left' | 'right';
}

export interface MapLayoutDefinition {
  wildZones: MapWildZone[];
  plaza: { x: number; z: number; radius: number } | null;
  roadXs: number[];
  roadZs: number[];
  roadPath?: { x: number; z: number }[];
  roadHalfWidth: number;
  flowerDensity: number;
  decorations: MapDecorationBudget;
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
  tamers: MapTamerDefinition[];
}

export interface MapTamerDefinition {
  name: string;
  title: string;
  tamerType: 'apprentice' | 'master' | 'sage';
  portrait: 'tyler' | 'vesper';
  position: { x: number; z: number };
  triggerDistance: number;
  party: { speciesId: string; level: number }[];
  dialogueIntro: string;
  dialogueDefeated: string;
}
