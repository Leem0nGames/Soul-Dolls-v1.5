/**
 * Overworld tilemap
 * ---------------------------------------------------------------------------
 * The overworld ground is baked from the modern Kenney Roguelike tileset
 * (CC0, 16x16 tiles, cut into individual pngs by tools/bake-modern-tiles.py)
 * into a single canvas that is used as the texture of one plane: one draw call
 * for the whole map.
 *
 * The tiles are 16x16 pixels drawn at scale 1, and the world is 60x60 units,
 * so one tile covers 1.5 world units (the same pixel density as the rest of
 * the art, which is ~10.7 px per world unit).
 *
 * Map-specific content is registered in src/game/data/maps; this module owns
 * the shared grid generation, collision, validation, and texture baking.
 */
import * as THREE from 'three';
import { MAP_IDS, MAP_NAMES, WORLD_MAPS } from '../data/maps';
import { MapId, MapLayoutDefinition, MapWildZone } from '../data/world';

/** Source size of a tile (Kenney Roguelike tiles are 16x16). */
const TILE_PX = 16;
/** Pixel scale used when the map is baked. */
const SCALE = 1;
/** World units covered by one tile. */
export const TILE_UNITS = 1.5;
/** Map size in tiles (40 * 1.5 = 60 world units, the size of the terrain). */
export const MAP_TILES = 40;
/** Tiles of void framing the playable area. */
const BORDER_TILES = 2;

const TILE_BASE = `${import.meta.env?.BASE_URL ?? '/'}tilesets/overworld/modern`.replace(
  '//tilesets',
  '/tilesets'
);

export type TileKind = 'void' | 'grass' | 'tallgrass' | 'path' | 'gravel' | 'sand' | 'water';

/** Flat base tiles: grass is also the base of the 9-patch kinds below. */
const FLAT_FILES: Partial<Record<TileKind, string>> = {
  grass: 'Grass.png',
  path: 'Path.png',
  sand: 'Sand.png',
};

/** 9-patch overlays keyed by relative neighbour (t = neighbour out of kind). */
const TUFT_PARTS: Record<string, string> = {
  tl: 'TallTuft-TL.png', t: 'TallTuft-T.png', tr: 'TallTuft-TR.png',
  l: 'TallTuft-L.png', c: 'TallTuft-C.png', r: 'TallTuft-R.png',
  bl: 'TallTuft-BL.png', b: 'TallTuft-B.png', br: 'TallTuft-BR.png',
};

const ISLAND_PARTS: Record<string, string> = {
  tl: 'Island-TL.png', t: 'Island-T.png', tr: 'Island-TR.png',
  l: 'Island-L.png', c: 'Island-C.png', r: 'Island-R.png',
  bl: 'Island-BL.png', b: 'Island-B.png', br: 'Island-BR.png',
};

const WATER_PARTS: Record<string, string> = {
  tl: 'Water-TL.png', t: 'Water-T.png', tr: 'Water-TR.png',
  l: 'Water-L.png', c: 'Water-C.png', r: 'Water-R.png',
  bl: 'Water-BL.png', b: 'Water-B.png', br: 'Water-BR.png',
};

/** Colour of the void frame (matches the Gen2 Void tile the map used before). */
const VOID_COLOR = '#393939';

// ---------------------------------------------------------------------------
// Villa Marionette
// ---------------------------------------------------------------------------

export type { MapId };

export type DecorationKind =
  | 'tree-short'
  | 'tree-tall'
  | 'bush'
  | 'flower-a'
  | 'flower-b'
  | 'rock'
  | 'grass-tuft'
  | 'sign';

interface Decoration {
  kind: DecorationKind;
  /** Tile coordinates (top left of the sprite). */
  col: number;
  row: number;
}

/** Decoration kinds that stop the player. */
const SOLID_DECORATIONS: DecorationKind[] = ['tree-short', 'tree-tall'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic RNG so every map is always the same. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** FNV-1a so a text id maps to a stable seed. */
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
  const t = lengthSquared === 0
    ? 0
    : THREE.MathUtils.clamp(((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (start.x + t * dx), point.z - (start.z + t * dz));
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar el tile: ${url}`));
    img.src = url;
  });
}

/** Kind of tile at the given tile coordinates for a specific area layout. */
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

  if (layout.plaza && Math.hypot(wx - layout.plaza.x, wz - layout.plaza.z) <= layout.plaza.radius) {
    return 'gravel';
  }
  const onRoad = layout.roadPath
    ? layout.roadPath.slice(1).some((end, index) =>
        distanceToSegment({ x: wx, z: wz }, layout.roadPath![index], end) <= layout.roadHalfWidth
      )
    : layout.roadXs.some((x) => Math.abs(wx - x) <= layout.roadHalfWidth) ||
      layout.roadZs.some((z) => Math.abs(wz - z) <= layout.roadHalfWidth);
  if (onRoad) {
    return 'path';
  }

  for (const zone of layout.wildZones) {
    if (wx >= zone.minX && wx <= zone.maxX && wz >= zone.minZ && wz <= zone.maxZ) {
      return 'tallgrass';
    }
  }

  return 'grass';
}

/**
 * Copies a tile keeping only the pixels selected by the mask, so a border can
 * be dithered over the neighbour tile (the classic Pokemon grass/path edge).
 */
function maskedTile(
  img: HTMLImageElement,
  size: number,
  mask: (x: number, y: number) => boolean
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const source = document.createElement('canvas');
  source.width = TILE_PX;
  source.height = TILE_PX;
  const sctx = source.getContext('2d');
  if (!sctx) return canvas;
  sctx.drawImage(img, 0, 0, TILE_PX, TILE_PX);

  const data = sctx.getImageData(0, 0, TILE_PX, TILE_PX);
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      if (!mask(x, y)) data.data[(y * TILE_PX + x) * 4 + 3] = 0;
    }
  }
  sctx.putImageData(data, 0, 0);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, TILE_PX, TILE_PX, 0, 0, size, size);
  return canvas;
}

// ---------------------------------------------------------------------------
// Map generation (one cached layout per area)
// ---------------------------------------------------------------------------

interface MapLayout {
  grid: TileKind[][];
  decorations: Decoration[];
  /** Tiles occupied by buildings, water, or solid trees. */
  blocked: Set<string>;
}

const LAYOUT_CACHE = new Map<MapId, MapLayout>();

function buildLayout(map: MapId): MapLayout {
  const mapDefinition = WORLD_MAPS[map];
  const def = mapDefinition.layout;
  const grid = buildTileGrid(def);
  const blocked = new Set<string>();
  // Keep building footprints solid and plant props out of their yards.
  for (let row = 0; row < MAP_TILES; row++) {
    for (let col = 0; col < MAP_TILES; col++) {
      const x = tileCenter(col);
      const z = tileCenter(row);
      if (grid[row][col] === 'water') blocked.add(`${col},${row}`);
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
  return { grid, decorations, blocked };
}

function getLayout(map: MapId): MapLayout {
  let layout = LAYOUT_CACHE.get(map);
  if (!layout) {
    layout = buildLayout(map);
    LAYOUT_CACHE.set(map, layout);
  }
  return layout;
}

/** A decoration placed in the world, ready to become a billboard. */
export interface PlacedDecoration {
  kind: DecorationKind;
  /** World position of the prop (its base). */
  x: number;
  z: number;
}

/** Every decoration of an area, in world coordinates. */
export function getDecorations(map: MapId = 'villa_marionette'): PlacedDecoration[] {
  return getLayout(map).decorations.map((decor) => ({
    kind: decor.kind,
    x: tileCenter(decor.col),
    z: tileCenter(decor.row),
  }));
}

/** True when a world position intersects a solid obstacle in the given area. */
export function isBlocked(worldX: number, worldZ: number, map: MapId = 'villa_marionette'): boolean {
  const col = Math.floor(worldX / TILE_UNITS + MAP_TILES / 2);
  const row = Math.floor(worldZ / TILE_UNITS + MAP_TILES / 2);
  return getLayout(map).blocked.has(`${col},${row}`);
}

/** Wild encounter areas and their species are authored once per map. */
export function getMapWildZones(map: MapId): readonly MapWildZone[] {
  return WORLD_MAPS[map].layout.wildZones;
}

/** Checks map connections and verifies that encounters are reachable on foot. */
export function validateWorldMaps(): string[] {
  const errors: string[] = [];
  const mapIds = MAP_IDS;
  const halfMap = (MAP_TILES * TILE_UNITS) / 2;
  const inBounds = (point: { x: number; z: number }) =>
    Math.abs(point.x) < halfMap - TILE_UNITS && Math.abs(point.z) < halfMap - TILE_UNITS;
  const isReachable = (map: MapId, from: { x: number; z: number }, to: { x: number; z: number }) => {
    const layout = getLayout(map);
    const toCol = Math.floor(to.x / TILE_UNITS + MAP_TILES / 2);
    const toRow = Math.floor(to.z / TILE_UNITS + MAP_TILES / 2);
    const startCol = Math.floor(from.x / TILE_UNITS + MAP_TILES / 2);
    const startRow = Math.floor(from.z / TILE_UNITS + MAP_TILES / 2);
    const queue: [number, number][] = [[startCol, startRow]];
    const visited = new Set([`${startCol},${startRow}`]);
    const offsets: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

    for (let index = 0; index < queue.length; index++) {
      const [col, row] = queue[index];
      if (col === toCol && row === toRow) return true;
      for (const [dc, dr] of offsets) {
        const nextCol = col + dc;
        const nextRow = row + dr;
        const key = `${nextCol},${nextRow}`;
        if (
          nextCol < BORDER_TILES ||
          nextRow < BORDER_TILES ||
          nextCol >= MAP_TILES - BORDER_TILES ||
          nextRow >= MAP_TILES - BORDER_TILES ||
          visited.has(key) ||
          layout.blocked.has(key)
        ) continue;
        visited.add(key);
        queue.push([nextCol, nextRow]);
      }
    }
    return false;
  };

  for (const map of mapIds) {
    const definition = WORLD_MAPS[map];
    if (definition.id !== map) errors.push(`${map} has mismatched definition id "${definition.id}"`);
    if (definition.name.trim().length === 0) errors.push(`${map} has no display name`);
    const connections = WORLD_MAPS[map].connections;
    if (connections.length === 0) errors.push(`${map} has no connection to another area`);
    for (const connection of connections) {
      if (!MAP_NAMES[connection.toMap]) {
        errors.push(`${map} connects to unknown area "${connection.toMap}"`);
        continue;
      }
      if (!inBounds(connection.at) || !inBounds(connection.arrival)) {
        errors.push(`${map} has an out-of-bounds connection to ${connection.toMap}`);
        continue;
      }
      if (isBlocked(connection.at.x, connection.at.z, map)) {
        errors.push(`${map} connection to ${connection.toMap} is blocked`);
      }
      if (isBlocked(connection.arrival.x, connection.arrival.z, connection.toMap)) {
        errors.push(`${connection.toMap} arrival from ${map} is blocked`);
      }
      const reciprocal = WORLD_MAPS[connection.toMap].connections.some(
        (candidate) =>
          candidate.toMap === map &&
          Math.hypot(candidate.at.x - connection.arrival.x, candidate.at.z - connection.arrival.z) <= 1 &&
          Math.hypot(candidate.arrival.x - connection.at.x, candidate.arrival.z - connection.at.z) <= 1
      );
      if (!reciprocal) errors.push(`${map} connection to ${connection.toMap} has no matching return`);
    }

    for (const zone of WORLD_MAPS[map].layout.wildZones) {
      if (zone.minX > zone.maxX || zone.minZ > zone.maxZ) {
        errors.push(`${zone.name} has invalid bounds`);
        continue;
      }
      const center = { x: (zone.minX + zone.maxX) / 2, z: (zone.minZ + zone.maxZ) / 2 };
      if (!inBounds(center)) errors.push(`${zone.name} is outside ${map}`);
      if (!connections.some((connection) => isReachable(map, connection.at, center))) {
        errors.push(`${zone.name} is unreachable from every map entrance`);
      }
    }

    for (const tamer of definition.tamers) {
      const { x, z } = tamer.position;
      if (!inBounds(tamer.position)) {
        errors.push(`${tamer.name} is outside ${map}`);
        continue;
      }
      if (isBlocked(x, z, map)) errors.push(`${tamer.name} is placed on a blocked tile in ${map}`);
      if (!definition.clearPoints.some((point) => Math.hypot(x - point.x, z - point.z) <= point.r)) {
        errors.push(`${tamer.name} has no clear-point reservation in ${map}`);
      }
      if (!connections.some((connection) => isReachable(map, connection.at, tamer.position))) {
        errors.push(`${tamer.name} is unreachable from every map entrance`);
      }
    }

    for (const [col, row] of definition.signSpots) {
      if (
        col < BORDER_TILES ||
        row < BORDER_TILES ||
        col >= MAP_TILES - BORDER_TILES ||
        row >= MAP_TILES - BORDER_TILES
      ) {
        errors.push(`${map} has an out-of-bounds sign at ${col},${row}`);
      }
    }
  }
  return errors;
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
    // Keep the important places free.
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

  // Each area owns a deterministic decoration budget suited to its identity.
  for (let i = 0; i < profile.tallTrees; i++) place('tree-tall', 2, 4);
  for (let i = 0; i < profile.shortTrees; i++) place('tree-short', 2, 2);
  for (let i = 0; i < profile.bushes; i++) place('bush', 1, 1);
  for (let i = 0; i < profile.rocks; i++) place('rock', 1, 1);
  for (let i = 0; i < profile.flowers; i++) place(random() < 0.5 ? 'flower-a' : 'flower-b', 1, 1);
  for (let i = 0; i < profile.tufts; i++) place('grass-tuft', 1, 1, 'tallgrass');

  // Signposts mark the incoming and outgoing trail at each area's edge.
  for (const [col, row] of signSpots) {
    if (col < 0 || row < 0 || col >= MAP_TILES || row >= MAP_TILES) continue;
    if (grid[row][col] !== 'grass' || taken.has(key(col, row))) continue;
    taken.add(key(col, row));
    decorations.push({ kind: 'sign', col, row });
  }

  return decorations;
}

// ---------------------------------------------------------------------------
// Baking
// ---------------------------------------------------------------------------

export interface OverworldMap {
  /** Texture of the whole baked map. */
  texture: THREE.CanvasTexture;
  /** Size of the map in world units. */
  worldSize: number;
}

/**
 * Bakes the whole overworld of an area: loads the tiles, bakes the ground with
 * its transitions, the 9-patch overlays and the flowers into a single texture.
 */
export async function buildOverworldMap(map: MapId = 'villa_marionette'): Promise<OverworldMap> {
  const grid = getLayout(map).grid;

  // Load every image the bake can use.
  const sources = [
    ...Object.values(FLAT_FILES),
    ...Object.values(TUFT_PARTS),
    ...Object.values(ISLAND_PARTS),
    ...Object.values(WATER_PARTS),
    'Flower-orange-0.png',
    'Flower-orange-1.png',
    'Flower-white-0.png',
    'Flower-white-1.png',
  ] as string[];
  const images = new Map<string, HTMLImageElement>();
  await Promise.all(
    sources.map(async (file) => {
      images.set(file, await loadImage(`${TILE_BASE}/${file}`));
    })
  );

  const px = TILE_PX * SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = MAP_TILES * px;
  canvas.height = MAP_TILES * px;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el contexto 2D del mapa');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = VOID_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 1. Base layer: flat tiles; the 9-patch kinds keep a grass floor beneath.
  for (let row = 0; row < MAP_TILES; row++) {
    for (let col = 0; col < MAP_TILES; col++) {
      const kind = grid[row][col];
      if (kind === 'void') continue;
      const file =
        kind === 'water' && row > 0 && grid[row - 1][col] === 'sand'
          ? 'Sand.png'
          : FLAT_FILES[kind] ?? 'Grass.png';
      ctx.drawImage(images.get(file)!, 0, 0, TILE_PX, TILE_PX, col * px, row * px, px, px);
    }
  }

  // 2. 9-patch overlays: water, spirit grass tufts and the gravel island.
  const PART_SETS: Partial<Record<TileKind, Record<string, string>>> = {
    water: WATER_PARTS,
    tallgrass: TUFT_PARTS,
    gravel: ISLAND_PARTS,
  };
  const neighbours: { dc: number; dr: number }[] = [
    { dc: 0, dr: -1 },
    { dc: 0, dr: 1 },
    { dc: -1, dr: 0 },
    { dc: 1, dr: 0 },
  ];

  for (let row = 0; row < MAP_TILES; row++) {
    for (let col = 0; col < MAP_TILES; col++) {
      const kind = grid[row][col];
      const parts = PART_SETS[kind];
      if (!parts) continue;

      const same = (dc: number, dr: number) => {
        const c = col + dc;
        const r = row + dr;
        return c >= 0 && r >= 0 && c < MAP_TILES && r < MAP_TILES && grid[r][c] === kind;
      };
      const nOut = !same(0, -1);
      const sOut = !same(0, 1);
      const wOut = !same(-1, 0);
      const eOut = !same(1, 0);

      // Piece matching the exposed edges of this tile.
      const key =
        nOut && wOut ? 'tl'
        : nOut && eOut ? 'tr'
        : sOut && wOut ? 'bl'
        : sOut && eOut ? 'br'
        : nOut ? 't'
        : sOut ? 'b'
        : wOut ? 'l'
        : eOut ? 'r'
        : 'c';
      const file = parts[key];
      if (file) {
        ctx.drawImage(images.get(file)!, 0, 0, TILE_PX, TILE_PX, col * px, row * px, px, px);
      }
    }
  }

  // 3. Transitions: grass sidles over path/sand with the classic dither band.
  //    Water and the gravel island carry their own rounded shore pieces.
  const BAND = 3;
  for (let row = 0; row < MAP_TILES; row++) {
    for (let col = 0; col < MAP_TILES; col++) {
      const current = grid[row][col];
      if (current === 'void' || current === 'water' || current === 'gravel') continue;

      for (const n of neighbours) {
        const nCol = col + n.dc;
        const nRow = row + n.dr;
        if (nCol < 0 || nRow < 0 || nCol >= MAP_TILES || nRow >= MAP_TILES) continue;
        const other = grid[nRow][nCol];
        if (other === current || other === 'void') continue;
        // Only grass (and the tufted spirit grass above it) grows over its
        // neighbours.
        if (other !== 'grass' && other !== 'tallgrass') continue;

        const img = images.get(FLAT_FILES[other] ?? 'Grass.png');
        if (!img) continue;

        const mask = (x: number, y: number) => {
          const inBand =
            n.dc === 0 && n.dr === -1
              ? y < BAND
              : n.dc === 0 && n.dr === 1
              ? y >= TILE_PX - BAND
              : n.dc === -1
              ? x < BAND
              : x >= TILE_PX - BAND;
          return inBand && (x + y) % 2 === 0;
        };

        const masked = maskedTile(img, px, mask);
        ctx.drawImage(masked, col * px, row * px);
      }
    }
  }

  // 4. Flower petals over plain grass (baked in): deterministic per area, so
  // no extra props and no adjacency seams — grass keeps being grass.
  const FLOWER_FILES = ['Flower-orange-0.png', 'Flower-orange-1.png', 'Flower-white-0.png', 'Flower-white-1.png'];
  const flowerDensity = WORLD_MAPS[map].layout.flowerDensity;
  if (flowerDensity > 0) {
    for (let row = BORDER_TILES; row < MAP_TILES - BORDER_TILES; row++) {
      for (let col = BORDER_TILES; col < MAP_TILES - BORDER_TILES; col++) {
        if (grid[row][col] !== 'grass') continue;
        const roll = hashString(`${map}:${col}:${row}`) % 1000;
        if (roll >= flowerDensity * 1000) continue;
        const img = images.get(FLOWER_FILES[roll % FLOWER_FILES.length])!;
        ctx.drawImage(img, 0, 0, TILE_PX, TILE_PX, col * px, row * px, px, px);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 1;

  return { texture, worldSize: MAP_TILES * TILE_UNITS };
}
