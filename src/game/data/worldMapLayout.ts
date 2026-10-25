import { WORLD_MAPS } from './maps';
import type { DecorationKind, MapId, MapLayoutDefinition, MapWildZone } from './world';

/** World units covered by one tile. */
export const TILE_UNITS = 1.5;
/** Map size in tiles (40 * 1.5 = 60 world units, the size of the terrain). */
export const MAP_TILES = 40;
/** Tiles of void framing the playable area. */
export const BORDER_TILES = 2;

export type TileKind =
  | 'void'
  | 'grass'
  | 'tallgrass'
  | 'path'
  | 'gravel'
  | 'sand'
  | 'water'
  | 'cave-floor'
  | 'cave-moss'
  | 'cave-wall';

interface Decoration {
  kind: DecorationKind;
  col: number;
  row: number;
  position?: { x: number; z: number };
}

export interface MapLayout {
  grid: TileKind[][];
  decorations: Decoration[];
  blocked: Set<string>;
}

export interface PlacedDecoration {
  kind: DecorationKind;
  x: number;
  z: number;
}

const SOLID_DECORATIONS: DecorationKind[] = ['tree-short', 'tree-tall'];
const LAYOUT_CACHE = new Map<MapId, MapLayout>();

export function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const tileCenter = (index: number): number => (index - MAP_TILES / 2 + 0.5) * TILE_UNITS;

function distanceToSegment(
  point: { x: number; z: number },
  start: { x: number; z: number },
  end: { x: number; z: number }
): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  const projection = lengthSquared === 0
    ? 0
    : ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared;
  const t = Math.max(0, Math.min(1, projection));
  return Math.hypot(point.x - (start.x + t * dx), point.z - (start.z + t * dz));
}

function kindAt(col: number, row: number, layout: MapLayoutDefinition): TileKind {
  if (
    col < BORDER_TILES ||
    row < BORDER_TILES ||
    col >= MAP_TILES - BORDER_TILES ||
    row >= MAP_TILES - BORDER_TILES
  ) {
    return 'void';
  }

  const wx = tileCenter(col);
  const wz = tileCenter(row);

  if (layout.caveMaze) {
    const { rows, entrance } = layout.caveMaze;
    const originCol = Math.floor((MAP_TILES - rows[0].length * 2) / 2);
    const originRow = Math.floor((MAP_TILES - rows.length * 2) / 2);
    const mazeCol = Math.floor((col - originCol) / 2);
    const mazeRow = Math.floor((row - originRow) / 2);
    if (mazeRow < 0 || mazeCol < 0 || mazeRow >= rows.length || mazeCol >= rows[0].length) {
      return mazeCol === entrance.col && mazeRow === entrance.row + 1 ? 'cave-floor' : 'cave-wall';
    }
    if (rows[mazeRow][mazeCol] === '#') return 'cave-wall';
    return layout.wildZones.some(
      (zone) => wx >= zone.minX && wx <= zone.maxX && wz >= zone.minZ && wz <= zone.maxZ
    )
      ? 'cave-moss'
      : 'cave-floor';
  }

  if (layout.plaza && Math.hypot(wx - layout.plaza.x, wz - layout.plaza.z) <= layout.plaza.radius) {
    return 'gravel';
  }
  const onRoad = layout.roadPath
    ? layout.roadPath.slice(1).some((end, index) =>
        distanceToSegment({ x: wx, z: wz }, layout.roadPath![index], end) <= layout.roadHalfWidth
      )
    : layout.roadXs.some((x) => Math.abs(wx - x) <= layout.roadHalfWidth) ||
      layout.roadZs.some((z) => Math.abs(wz - z) <= layout.roadHalfWidth);
  if (onRoad) return 'path';

  for (const zone of layout.wildZones) {
    if (wx >= zone.minX && wx <= zone.maxX && wz >= zone.minZ && wz <= zone.maxZ) {
      return 'tallgrass';
    }
  }
  return 'grass';
}

function buildTileGrid(layout: MapLayoutDefinition): TileKind[][] {
  const grid: TileKind[][] = [];
  for (let row = 0; row < MAP_TILES; row++) {
    const line: TileKind[] = [];
    for (let col = 0; col < MAP_TILES; col++) line.push(kindAt(col, row, layout));
    grid.push(line);
  }
  return grid;
}

function buildDecorations(
  grid: TileKind[][],
  clearPoints: { x: number; z: number; r: number }[],
  blocked: Set<string>,
  seed: number,
  profile: MapLayoutDefinition['decorations'],
  signSpots: [number, number][]
): Decoration[] {
  const random = makeRandom(seed);
  const decorations: Decoration[] = [];
  const taken = new Set<string>();
  const key = (col: number, row: number) => `${col},${row}`;

  const isFree = (
    col: number,
    row: number,
    width: number,
    height: number,
    onKind: TileKind = 'grass'
  ) => {
    for (let c = col; c < col + width; c++) {
      for (let r = row; r < row + height; r++) {
        if (c < 0 || r < 0 || c >= MAP_TILES || r >= MAP_TILES) return false;
        if (grid[r][c] !== onKind || blocked.has(key(c, r)) || taken.has(key(c, r))) return false;
      }
    }
    const cx = tileCenter(col + (width - 1) / 2);
    const cz = tileCenter(row + (height - 1) / 2);
    for (const clear of clearPoints) {
      if (Math.hypot(cx - clear.x, cz - clear.z) < clear.r) return false;
    }
    return true;
  };

  const place = (kind: DecorationKind, width: number, height: number, onKind: TileKind = 'grass') => {
    for (let attempt = 0; attempt < 400; attempt++) {
      const col = BORDER_TILES + Math.floor(random() * (MAP_TILES - BORDER_TILES * 2 - width));
      const row = BORDER_TILES + Math.floor(random() * (MAP_TILES - BORDER_TILES * 2 - height));
      if (!isFree(col, row, width, height, onKind)) continue;
      for (let c = col; c < col + width; c++) {
        for (let r = row; r < row + height; r++) taken.add(key(c, r));
      }
      if (SOLID_DECORATIONS.includes(kind)) {
        for (let c = col; c < col + width; c++) {
          for (let r = row; r < row + height; r++) blocked.add(key(c, r));
        }
      }
      decorations.push({ kind, col, row });
      return true;
    }
    return false;
  };

  for (let i = 0; i < profile.tallTrees; i++) place('tree-tall', 2, 4);
  for (let i = 0; i < profile.shortTrees; i++) place('tree-short', 2, 2);
  for (let i = 0; i < profile.bushes; i++) place('bush', 1, 1);
  for (let i = 0; i < profile.rocks; i++) place('rock', 1, 1);
  for (let i = 0; i < profile.flowers; i++) place(random() < 0.5 ? 'flower-a' : 'flower-b', 1, 1);
  for (let i = 0; i < profile.tufts; i++) place('grass-tuft', 1, 1, 'tallgrass');
  for (let i = 0; i < (profile['craftpix-fern'] ?? 0); i++) place('craftpix-fern', 1, 1);
  for (let i = 0; i < (profile['craftpix-flowering-bush'] ?? 0); i++) {
    place('craftpix-flowering-bush', 1, 1);
  }
  for (let i = 0; i < (profile['craftpix-autumn-bush'] ?? 0); i++) {
    place('craftpix-autumn-bush', 1, 1);
  }

  for (const [col, row] of signSpots) {
    if (col < 0 || row < 0 || col >= MAP_TILES || row >= MAP_TILES) continue;
    if (grid[row][col] !== 'grass' || taken.has(key(col, row))) continue;
    taken.add(key(col, row));
    decorations.push({ kind: 'sign', col, row });
  }
  return decorations;
}

function buildLayout(map: MapId): MapLayout {
  const mapDefinition = WORLD_MAPS[map];
  const def = mapDefinition.layout;
  const grid = buildTileGrid(def);
  const blocked = new Set<string>();
  for (let row = 0; row < MAP_TILES; row++) {
    for (let col = 0; col < MAP_TILES; col++) {
      const x = tileCenter(col);
      const z = tileCenter(row);
      if (grid[row][col] === 'water' || grid[row][col] === 'cave-wall') blocked.add(`${col},${row}`);
      if (def.buildingFootprints?.some((building) =>
        Math.abs(x - building.x) <= building.halfWidth + TILE_UNITS / 2 &&
        Math.abs(z - building.z) <= building.halfDepth + TILE_UNITS / 2
      )) {
        blocked.add(`${col},${row}`);
      }
    }
  }
  const decorations = buildDecorations(
    grid,
    mapDefinition.clearPoints,
    blocked,
    hashString(map),
    def.decorations,
    mapDefinition.signSpots
  );
  if (def.caveMaze) {
    const originCol = Math.floor((MAP_TILES - def.caveMaze.rows[0].length * 2) / 2);
    const originRow = Math.floor((MAP_TILES - def.caveMaze.rows.length * 2) / 2);
    for (let mazeRow = 0; mazeRow < def.caveMaze.rows.length; mazeRow++) {
      for (let mazeCol = 0; mazeCol < def.caveMaze.rows[mazeRow].length; mazeCol++) {
        if (def.caveMaze.rows[mazeRow][mazeCol] !== '#') continue;
        decorations.push({
          kind: 'cave-wall',
          col: originCol + mazeCol * 2 + 0.5,
          row: originRow + mazeRow * 2 + 0.5,
        });
      }
    }
  }
  for (const decoration of def.fixedDecorations ?? []) {
    decorations.push({
      kind: decoration.kind,
      col: 0,
      row: 0,
      position: { x: decoration.x, z: decoration.z },
    });
  }
  return { grid, decorations, blocked };
}

export function getLayout(map: MapId): MapLayout {
  let layout = LAYOUT_CACHE.get(map);
  if (!layout) {
    layout = buildLayout(map);
    LAYOUT_CACHE.set(map, layout);
  }
  return layout;
}

export function getDecorations(map: MapId = 'villa_marionette'): PlacedDecoration[] {
  return getLayout(map).decorations.map((decor) => ({
    kind: decor.kind,
    x: decor.position?.x ?? tileCenter(decor.col),
    z: decor.position?.z ?? tileCenter(decor.row),
  }));
}

export function isBlocked(worldX: number, worldZ: number, map: MapId = 'villa_marionette'): boolean {
  const col = Math.floor(worldX / TILE_UNITS + MAP_TILES / 2);
  const row = Math.floor(worldZ / TILE_UNITS + MAP_TILES / 2);
  return getLayout(map).blocked.has(`${col},${row}`);
}

export function getMapWildZones(map: MapId): readonly MapWildZone[] {
  return WORLD_MAPS[map].layout.wildZones;
}

export { hashString, tileCenter };
