/**
 * Overworld tilemap
 * ---------------------------------------------------------------------------
 * The overworld ground is baked from the Gen 2 inspired tileset
 * (nikouu/Pokemon-gen-2-style-tilemap, MIT licence) into a single canvas
 * that is used as the texture of one plane: one draw call for the whole map.
 *
 * The tiles are 8x8 pixels and the world is 60x60 units, so one tile covers
 * 1.5 world units (the same pixel density as the rest of the art, which is
 * ~10.7 px per world unit).
 *
 * Option B (Kanto clone): the world is a set of connected areas
 * (Pueblo Paleta <-> Ruta 1 <-> Ciudad Verde). Each area has its own layout,
 * decorations and collisions, cached and baked on demand. The renderer swaps
 * them through MAP_EXITS when the player walks into a border gap.
 */
import * as THREE from 'three';

/** Source size of a tile in the tileset (Game Boy tiles are 8x8). */
const TILE_PX = 8;
/** Pixel scale used when the map is baked. */
const SCALE = 2;
/** World units covered by one tile. */
export const TILE_UNITS = 1.5;
/** Map size in tiles (40 * 1.5 = 60 world units, the size of the terrain). */
export const MAP_TILES = 40;
/** Tiles of void framing the playable area. */
const BORDER_TILES = 2;

const TILE_BASE = `${import.meta.env?.BASE_URL ?? '/'}tilesets/overworld`.replace('//tilesets', '/tilesets');

export type TileKind = 'void' | 'grass' | 'tallgrass' | 'path' | 'gravel';

const TILE_FILES: Record<TileKind, string> = {
  void: 'Void.png',
  grass: 'Grass-flat.png',
  tallgrass: 'Grass-tall.png',
  path: 'Path.png',
  gravel: 'Path-Gravel.png',
};

// ---------------------------------------------------------------------------
// World areas (Kanto clone, Option B)
// ---------------------------------------------------------------------------

/** Playable area ids of the world. */
export type MapId = 'pallet_town' | 'route_1' | 'viridian_city';

/** Display names shown by the HUD when the player crosses a border. */
export const MAP_NAMES: Record<MapId, string> = {
  pallet_town: 'Pueblo Paleta',
  route_1: 'Ruta 1',
  viridian_city: 'Ciudad Verde',
};

interface MapLayoutDef {
  /** Patches of spirit grass where wild SoulDolls appear. */
  wildZones: { minX: number; maxX: number; minZ: number; maxZ: number }[];
  /** Central plaza (gravel circle) or null for pure route areas. */
  plaza: { x: number; z: number; radius: number } | null;
  /** Half width of the crossroads. */
  pathHalfWidth: number;
  /** Fraction of plain grass tiles that get a baked flower patch. */
  flowerDensity: number;
}

const MAP_LAYOUTS: Record<MapId, MapLayoutDef> = {
  pallet_town: {
    // Pallet Town: a quiet village, no wild grass (like Kanto's starter town).
    wildZones: [],
    plaza: { x: 0, z: 0, radius: 5.5 },
    pathHalfWidth: 1.75,
    flowerDensity: 0.09,
  },
  route_1: {
    // Route 1: north-south corridor flanked by spirit grass bands.
    wildZones: [
      { minX: -10, maxX: -4, minZ: -20, maxZ: 16 },
      { minX: 4, maxX: 10, minZ: -16, maxZ: 20 },
    ],
    plaza: null,
    pathHalfWidth: 1.6,
    flowerDensity: 0.03,
  },
  viridian_city: {
    // Green leaf city: bigger plaza, no wild grass inside.
    wildZones: [],
    plaza: { x: 0, z: 0, radius: 6 },
    pathHalfWidth: 1.75,
    flowerDensity: 0.07,
  },
};

/** Places that must stay clear of trees (spawn, tamers, doors, map gaps). */
const MAP_CLEAR_POINTS: Record<MapId, { x: number; z: number; r: number }[]> = {
  pallet_town: [
    { x: 0, z: -4, r: 3.4 },
    { x: -3.5, z: -8, r: 3.4 },
    { x: 7.5, z: -7, r: 3.4 },
    { x: 0, z: 2.5, r: 2.2 },
    { x: -10.5, z: 9, r: 3.2 },
    { x: -6, z: 9, r: 3.2 },
    { x: -1.5, z: 9, r: 3.2 },
    { x: 3, z: 9, r: 3.2 },
    { x: 7.5, z: 9, r: 3.2 },
    { x: 0, z: -16, r: 6.5 },
    { x: 0, z: -22, r: 3 },
  ],
  route_1: [
    { x: 0, z: 0, r: 3 },
    { x: 0, z: -14, r: 7 },
    { x: 0, z: 14, r: 7 },
    { x: 0, z: -21.5, r: 4 },
    { x: 0, z: 21.5, r: 4 },
  ],
  viridian_city: [
    { x: 0, z: 0, r: 6.5 },
    { x: 0, z: 14, r: 7 },
    { x: 0, z: 21.5, r: 4 },
    { x: -10.5, z: 9, r: 3.2 },
    { x: -6, z: 9, r: 3.2 },
    { x: -1.5, z: 9, r: 3.2 },
    { x: 3, z: 9, r: 3.2 },
    { x: 7.5, z: 9, r: 3.2 },
  ],
};

/** Border crossings that connect the areas of the world. */
export interface MapExit {
  targetMap: MapId;
  /** Edge of the current map that leads out. */
  edge: 'n' | 's';
  /** Half width of the crossing corridor in world units. */
  halfWidth: number;
  /** Player position right after the swap. */
  spawn: { x: number; z: number };
}

export const MAP_EXITS: Record<MapId, MapExit[]> = {
  pallet_town: [
    { targetMap: 'route_1', edge: 'n', halfWidth: 3.5, spawn: { x: 0, z: 21.5 } },
  ],
  route_1: [
    { targetMap: 'pallet_town', edge: 's', halfWidth: 3.5, spawn: { x: 0, z: -21.5 } },
    { targetMap: 'viridian_city', edge: 'n', halfWidth: 3.5, spawn: { x: 0, z: 21.5 } },
  ],
  viridian_city: [
    { targetMap: 'route_1', edge: 's', halfWidth: 3.5, spawn: { x: 0, z: -21.5 } },
  ],
};

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

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar el tile: ${url}`));
    img.src = url;
  });
}

/** Kind of tile at the given tile coordinates for a specific area layout. */
function kindAt(col: number, row: number, layout: MapLayoutDef): TileKind {
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

  for (const zone of layout.wildZones) {
    if (wx >= zone.minX && wx <= zone.maxX && wz >= zone.minZ && wz <= zone.maxZ) {
      return 'tallgrass';
    }
  }

  if (layout.plaza && Math.hypot(wx - layout.plaza.x, wz - layout.plaza.z) <= layout.plaza.radius) {
    return 'gravel';
  }
  if (
    Math.abs(wx - (layout.plaza?.x ?? 0)) <= layout.pathHalfWidth ||
    Math.abs(wz - (layout.plaza?.z ?? 0)) <= layout.pathHalfWidth
  ) {
    return 'path';
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
  /** Tiles occupied by a tree, the player cannot walk through them. */
  blocked: Set<string>;
}

const LAYOUT_CACHE = new Map<MapId, MapLayout>();

function buildLayout(map: MapId): MapLayout {
  const def = MAP_LAYOUTS[map];
  const grid = buildTileGrid(def);
  const blocked = new Set<string>();
  const decorations = buildDecorations(grid, MAP_CLEAR_POINTS[map], blocked, hashString(map));
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
export function getDecorations(map: MapId = 'pallet_town'): PlacedDecoration[] {
  return getLayout(map).decorations.map((decor) => ({
    kind: decor.kind,
    x: tileCenter(decor.col),
    z: tileCenter(decor.row),
  }));
}

/** True when a world position is inside a tree of the given area. */
export function isBlocked(worldX: number, worldZ: number, map: MapId = 'pallet_town'): boolean {
  const col = Math.floor(worldX / TILE_UNITS + MAP_TILES / 2);
  const row = Math.floor(worldZ / TILE_UNITS + MAP_TILES / 2);
  return getLayout(map).blocked.has(`${col},${row}`);
}

function buildTileGrid(layout: MapLayoutDef): TileKind[][] {
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
  seed: number
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
        if (grid[r][c] !== onKind) return false;
        if (taken.has(key(c, r))) return false;
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

  // A forest belt on the north side and around the edges.
  for (let i = 0; i < 20; i++) place('tree-tall', 2, 4);
  for (let i = 0; i < 24; i++) place('tree-short', 2, 2);
  // Bushes and rocks fill the gaps between the trees.
  for (let i = 0; i < 18; i++) place('bush', 1, 1);
  for (let i = 0; i < 10; i++) place('rock', 1, 1);
  for (let i = 0; i < 26; i++) place(random() < 0.5 ? 'flower-a' : 'flower-b', 1, 1);
  // Tufts of grass inside the spirit grass patches.
  for (let i = 0; i < 26; i++) place('grass-tuft', 1, 1, 'tallgrass');

  // Signposts next to the crossroads.
  const signSpots: [number, number][] = [
    [MAP_TILES / 2 + 2, MAP_TILES / 2 - 3],
    [MAP_TILES / 2 - 3, MAP_TILES / 2 + 2],
    [MAP_TILES / 2 - 12, MAP_TILES / 2 + 2],
    [MAP_TILES / 2 + 11, MAP_TILES / 2 - 3],
  ];
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
 * its transitions and the decorations into a single texture.
 */
export async function buildOverworldMap(map: MapId = 'pallet_town'): Promise<OverworldMap> {
  const grid = getLayout(map).grid;

  const tileImages: Partial<Record<TileKind, HTMLImageElement>> = {};
  await Promise.all(
    (Object.keys(TILE_FILES) as TileKind[]).map(async (kind) => {
      tileImages[kind] = await loadImage(`${TILE_BASE}/${TILE_FILES[kind]}`);
    })
  );

  const px = TILE_PX * SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = MAP_TILES * px;
  canvas.height = MAP_TILES * px;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el contexto 2D del mapa');
  ctx.imageSmoothingEnabled = false;

  // 1. Base layer.
  for (let row = 0; row < MAP_TILES; row++) {
    for (let col = 0; col < MAP_TILES; col++) {
      const img = tileImages[grid[row][col]];
      if (img) ctx.drawImage(img, 0, 0, TILE_PX, TILE_PX, col * px, row * px, px, px);
    }
  }

  // 2. Transitions: the neighbour "eats" into the tile with a 50% dither.
  const BAND = 2;
  const neighbours: { dc: number; dr: number; edge: 'n' | 's' | 'e' | 'w' }[] = [
    { dc: 0, dr: -1, edge: 'n' },
    { dc: 0, dr: 1, edge: 's' },
    { dc: -1, dr: 0, edge: 'w' },
    { dc: 1, dr: 0, edge: 'e' },
  ];

  for (let row = 0; row < MAP_TILES; row++) {
    for (let col = 0; col < MAP_TILES; col++) {
      const current = grid[row][col];
      if (current === 'void') continue;

      for (const n of neighbours) {
        const nCol = col + n.dc;
        const nRow = row + n.dr;
        if (nCol < 0 || nRow < 0 || nCol >= MAP_TILES || nRow >= MAP_TILES) continue;
        const other = grid[nRow][nCol];
        if (other === current || other === 'void') continue;
        // Only grass grows over its neighbours.
        if (other !== 'grass' && other !== 'tallgrass') continue;

        const img = tileImages[other];
        if (!img) continue;

        const mask = (x: number, y: number) => {
          const inBand =
            n.edge === 'n'
              ? y < BAND
              : n.edge === 's'
              ? y >= TILE_PX - BAND
              : n.edge === 'w'
              ? x < BAND
              : x >= TILE_PX - BAND;
          return inBand && (x + y) % 2 === 0;
        };

        const masked = maskedTile(img, px, mask);
        ctx.drawImage(masked, col * px, row * px);
      }
    }
  }

  // 3. Flower patches over plain grass (baked in): deterministic per area, so
  // no extra props and no adjacency seams — grass keeps being grass.
  const FLOWER_FILES = ['Flower-johto-00.png', 'Flower-johto-01.png'];
  const flowerDensity = MAP_LAYOUTS[map].flowerDensity;
  if (flowerDensity > 0) {
    const flowerImgs = await Promise.all(FLOWER_FILES.map((file) => loadImage(`${TILE_BASE}/${file}`)));
    for (let row = BORDER_TILES; row < MAP_TILES - BORDER_TILES; row++) {
      for (let col = BORDER_TILES; col < MAP_TILES - BORDER_TILES; col++) {
        if (grid[row][col] !== 'grass') continue;
        const roll = hashString(`${map}:${col}:${row}`) % 1000;
        if (roll >= flowerDensity * 1000) continue;
        ctx.drawImage(flowerImgs[roll % 2], 0, 0, TILE_PX, TILE_PX, col * px, row * px, px, px);
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
