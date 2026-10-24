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
 * Villa Marionette is the first authored area of the new overworld. Its road
 * plan, gardens, building footprints, and tile texture are generated locally.
 */
import * as THREE from 'three';
import { VILLA_BUILDINGS } from './OverworldBuildings';

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

export type MapId = 'villa_marionette';

export const MAP_NAMES: Record<MapId, string> = {
  villa_marionette: 'Villa Marionette',
};

interface MapLayoutDef {
  /** Patches of spirit grass where wild SoulDolls appear. */
  wildZones: { minX: number; maxX: number; minZ: number; maxZ: number }[];
  /** The town's central stone plaza. */
  plaza: { x: number; z: number; radius: number };
  /** Centers of the main roads, in world units. */
  roadXs: number[];
  roadZs: number[];
  /** Half width of each road. */
  roadHalfWidth: number;
  /** Fraction of plain grass tiles that get a baked flower patch. */
  flowerDensity: number;
}

const MAP_LAYOUTS: Record<MapId, MapLayoutDef> = {
  villa_marionette: {
    // A compact hillside village with a central square and branching lanes.
    wildZones: [
      { minX: -8, maxX: -3, minZ: -25, maxZ: -20 },
      { minX: 3, maxX: 8, minZ: -25, maxZ: -20 },
    ],
    plaza: { x: 0, z: 0, radius: 5.5 },
    roadXs: [-12, 0, 12],
    roadZs: [-21, -12, 0, 12, 21],
    roadHalfWidth: 1.5,
    flowerDensity: 0.08,
  },
};

/** Places that must stay clear of decorative props and building footprints. */
const MAP_CLEAR_POINTS: Record<MapId, { x: number; z: number; r: number }[]> = {
  villa_marionette: [
    { x: 0, z: 22, r: 4.5 },
    { x: 0, z: 0, r: 8 },
    { x: -8, z: -7, r: 3.5 },
    { x: 8, z: 7, r: 3.5 },
    { x: 17, z: -7, r: 3.5 },
    ...VILLA_BUILDINGS.flatMap((building) => [
      { x: building.x, z: building.z, r: 4.5 },
      { x: building.entrance.x, z: building.entrance.z, r: 3.5 },
    ]),
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

  if (Math.hypot(wx - layout.plaza.x, wz - layout.plaza.z) <= layout.plaza.radius) {
    return 'gravel';
  }
  if (
    layout.roadXs.some((x) => Math.abs(wx - x) <= layout.roadHalfWidth) ||
    layout.roadZs.some((z) => Math.abs(wz - z) <= layout.roadHalfWidth)
  ) {
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
  const def = MAP_LAYOUTS[map];
  const grid = buildTileGrid(def);
  const blocked = new Set<string>();
  // Keep building footprints solid and plant props out of their yards.
  for (let row = 0; row < MAP_TILES; row++) {
    for (let col = 0; col < MAP_TILES; col++) {
      const x = tileCenter(col);
      const z = tileCenter(row);
      if (grid[row][col] === 'water') blocked.add(`${col},${row}`);
      if (
        VILLA_BUILDINGS.some(
          (building) =>
            Math.abs(x - building.x) <= building.halfWidth &&
            Math.abs(z - building.z) <= building.halfDepth
        )
      ) {
        blocked.add(`${col},${row}`);
      }
    }
  }
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

  // Small garden trees and planted borders around the walkable lanes.
  for (let i = 0; i < 12; i++) place('tree-tall', 2, 4);
  for (let i = 0; i < 18; i++) place('tree-short', 2, 2);
  for (let i = 0; i < 22; i++) place('bush', 1, 1);
  for (let i = 0; i < 8; i++) place('rock', 1, 1);
  for (let i = 0; i < 32; i++) place(random() < 0.5 ? 'flower-a' : 'flower-b', 1, 1);
  for (let i = 0; i < 12; i++) place('grass-tuft', 1, 1, 'tallgrass');

  // Signposts mark the village entrance lanes.
  const signSpots: [number, number][] = [
    [MAP_TILES / 2 - 2, MAP_TILES - BORDER_TILES - 2],
    [MAP_TILES / 2 + 2, BORDER_TILES + 2],
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
  const flowerDensity = MAP_LAYOUTS[map].flowerDensity;
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
