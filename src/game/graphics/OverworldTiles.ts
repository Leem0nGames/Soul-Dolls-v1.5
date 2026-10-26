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
 * Map-specific content and pure layout calculations live in src/game/data;
 * this module owns the canvas-based ground texture baking.
 */
import * as THREE from 'three';
import { WORLD_MAPS } from '../data/maps';
import type { DecorationKind, MapId } from '../data/world';
import {
  BORDER_TILES,
  MAP_TILES,
  MAP_WIDTH_UNITS,
  TILE_UNITS,
} from '../data/worldGeometry';
import {
  getDecorations,
  getLayout,
  getMapWildZones,
  hashString,
  isBlocked,
  makeRandom,
} from '../data/worldMapLayout';
import type { TileKind } from '../data/worldMapLayout';

/** Source size of a tile (Kenney Roguelike tiles are 16x16). */
const TILE_PX = 16;
/** Pixel scale used when the map is baked. */
const SCALE = 1;
const TILE_BASE = `${import.meta.env?.BASE_URL ?? '/'}tilesets/overworld/modern`.replace(
  '//tilesets',
  '/tilesets'
);

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

export type { DecorationKind, MapId, TileKind };
export type { PlacedDecoration } from '../data/worldMapLayout';
export { getDecorations, getMapWildZones, isBlocked, MAP_TILES, TILE_UNITS };
export { validateWorldMaps } from '../data/worldValidation';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar el tile: ${url}`));
    img.src = url;
  });
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

function drawTallGrassDetails(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  seed: number
): void {
  const random = makeRandom(seed ^ Math.imul(col + 1, 73856093) ^ Math.imul(row + 1, 19349663));
  const blades = 4 + Math.floor(random() * 3);

  for (let i = 0; i < blades; i++) {
    const x = 2 + Math.floor(random() * (TILE_PX - 4));
    const y = 9 + Math.floor(random() * 5);
    const height = 3 + Math.floor(random() * 4);
    const lean = random() < 0.5 ? -1 : 1;
    ctx.fillStyle = random() < 0.55 ? '#347b32' : '#4d9d36';
    ctx.fillRect(x, y - height, 1, height);
    ctx.fillRect(x + lean, y - height - 1, 1, 2);
    if (random() < 0.6) {
      ctx.fillStyle = '#9bd84b';
      ctx.fillRect(x + lean, y - height - 1, 1, 1);
    }
  }

  ctx.fillStyle = '#286a32';
  ctx.fillRect(5, 14, 2, 1);
  ctx.fillRect(10, 14, 2, 1);
}

function drawCaveTile(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  kind: 'cave-floor' | 'cave-moss' | 'cave-wall',
  seed: number
): void {
  const random = makeRandom(seed ^ Math.imul(col + 1, 73856093) ^ Math.imul(row + 1, 19349663));
  const base = kind === 'cave-wall' ? '#34323b' : kind === 'cave-moss' ? '#26352d' : '#24232b';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);

  if (kind === 'cave-wall') {
    ctx.fillStyle = '#201f27';
    ctx.fillRect(0, 13, TILE_PX, 3);
    ctx.fillStyle = '#494650';
    ctx.fillRect(1, 1, 14, 2);
    ctx.fillRect(1, 3, 2, 9);
    ctx.fillStyle = '#292730';
    ctx.fillRect(3, 4, 11, 7);
    ctx.fillStyle = '#5b5760';
    ctx.fillRect(4, 4, 4, 1);
    ctx.fillRect(10, 8, 3, 1);
    ctx.fillStyle = '#1c1b22';
    ctx.fillRect(7, 5, 1, 3);
    ctx.fillRect(11, 9, 1, 2);
    return;
  }

  for (let i = 0; i < 7; i++) {
    const x = 1 + Math.floor(random() * 14);
    const y = 1 + Math.floor(random() * 14);
    ctx.fillStyle = kind === 'cave-moss'
      ? (random() < 0.6 ? '#405b3c' : '#547143')
      : (random() < 0.5 ? '#34323b' : '#1c1b23');
    ctx.fillRect(x, y, 1 + Math.floor(random() * 2), 1);
  }
  if (kind === 'cave-moss') {
    ctx.fillStyle = '#91b75b';
    ctx.fillRect(5, 5, 1, 1);
    ctx.fillRect(11, 10, 1, 1);
  }
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
  ctx.fillStyle = WORLD_MAPS[map].layout.caveMaze ? '#17161d' : VOID_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 1. Base layer: flat tiles; the 9-patch kinds keep a grass floor beneath.
  for (let row = 0; row < MAP_TILES; row++) {
    for (let col = 0; col < MAP_TILES; col++) {
      const kind = grid[row][col];
      if (kind === 'void') continue;
      if (kind === 'cave-floor' || kind === 'cave-moss' || kind === 'cave-wall') {
        ctx.save();
        ctx.translate(col * px, row * px);
        drawCaveTile(ctx, col, row, kind, hashString(map));
        ctx.restore();
        continue;
      }
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

  // Give encounter patches distinct, pixel-crisp blades instead of a flat fill.
  const detailSeed = hashString(map);
  for (let row = 0; row < MAP_TILES; row++) {
    for (let col = 0; col < MAP_TILES; col++) {
      if (grid[row][col] !== 'tallgrass') continue;
      ctx.save();
      ctx.translate(col * px, row * px);
      drawTallGrassDetails(ctx, col, row, detailSeed);
      ctx.restore();
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

  return { texture, worldSize: MAP_WIDTH_UNITS };
}
