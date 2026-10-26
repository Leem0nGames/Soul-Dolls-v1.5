/** World units covered by one tile. */
export const TILE_UNITS = 1.5;
/** Number of tiles along each side of the square overworld maps. */
export const MAP_TILES = 40;
/** Tiles of void framing the playable area. */
export const BORDER_TILES = 2;
export const MAP_WIDTH_UNITS = MAP_TILES * TILE_UNITS;
export const MAP_DEPTH_UNITS = MAP_TILES * TILE_UNITS;
export const MAP_HALF_WIDTH_UNITS = MAP_WIDTH_UNITS / 2;
export const MAP_HALF_DEPTH_UNITS = MAP_DEPTH_UNITS / 2;
/** Existing player movement clamp; distinct from the terrain edge and tile border. */
export const OVERWORLD_MOVEMENT_LIMIT = 26.8;

/** World-space center of a tile index; fractional indices are used by maze walls. */
export function gridToWorldCenter(index: number): number {
  return (index - MAP_TILES / 2 + 0.5) * TILE_UNITS;
}

/** World-space boundary at the start of a grid index, including map edges 0 and MAP_TILES. */
export function gridToWorldBoundary(index: number): number {
  return (index - MAP_TILES / 2) * TILE_UNITS;
}

/** Converts a world coordinate to its containing tile, preserving the existing floor convention. */
export function worldToGridIndex(coordinate: number): number {
  return Math.floor(coordinate / TILE_UNITS + MAP_TILES / 2);
}

export function worldToGrid(position: { x: number; z: number }): { col: number; row: number } {
  return {
    col: worldToGridIndex(position.x),
    row: worldToGridIndex(position.z),
  };
}
