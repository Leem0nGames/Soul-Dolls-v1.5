import { MAP_IDS, MAP_NAMES, WORLD_MAPS } from './maps';
import { VILLA_BUILDINGS } from './maps/villaBuildings';
import { BORDER_TILES, getLayout, isBlocked, MAP_TILES, TILE_UNITS } from './worldMapLayout';
import type { MapId } from './world';

/** Validates map data and reachability without importing rendering modules. */
export function validateWorldMaps(): string[] {
  const errors: string[] = [];
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

  const mazeCellCenter = (
    rows: string[],
    cell: { col: number; row: number }
  ): { x: number; z: number } => {
    const originCol = Math.floor((MAP_TILES - rows[0].length * 2) / 2);
    const originRow = Math.floor((MAP_TILES - rows.length * 2) / 2);
    return {
      x: (originCol + cell.col * 2 + 1) * TILE_UNITS - MAP_TILES * TILE_UNITS / 2,
      z: (originRow + cell.row * 2 + 1) * TILE_UNITS - MAP_TILES * TILE_UNITS / 2,
    };
  };

  for (const map of MAP_IDS) {
    const definition = WORLD_MAPS[map];
    if (definition.id !== map) errors.push(`${map} has mismatched definition id "${definition.id}"`);
    if (definition.name.trim().length === 0) errors.push(`${map} has no display name`);
    const connections = definition.connections;
    const maze = definition.layout.caveMaze;
    if (maze) {
      const width = maze.rows[0]?.length ?? 0;
      if (
        width === 0 ||
        maze.rows.some((line) => line.length !== width || /[^.#]/.test(line)) ||
        width * 2 > MAP_TILES - BORDER_TILES * 2 ||
        maze.rows.length * 2 > MAP_TILES - BORDER_TILES * 2
      ) {
        errors.push(`${map} has malformed or out-of-bounds cave maze rows`);
      } else {
        const isOpenCell = (cell: { col: number; row: number }) =>
          cell.col >= 0 &&
          cell.row >= 0 &&
          cell.row < maze.rows.length &&
          cell.col < width &&
          maze.rows[cell.row][cell.col] === '.';
        if (!isOpenCell(maze.entrance)) errors.push(`${map} cave entrance must be an open maze cell`);
        if (!isOpenCell(maze.goal)) errors.push(`${map} cave goal must be an open maze cell`);
        if (
          isOpenCell(maze.entrance) &&
          isOpenCell(maze.goal) &&
          !isReachable(map, mazeCellCenter(maze.rows, maze.entrance), mazeCellCenter(maze.rows, maze.goal))
        ) {
          errors.push(`${map} cave goal is unreachable from its entrance`);
        }
      }
    }
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

    for (const zone of definition.layout.wildZones) {
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

  const villaLayout = WORLD_MAPS.villa_marionette.layout;
  for (const building of VILLA_BUILDINGS) {
    if (building.rotation !== 0) errors.push(`${building.id} must face north toward the plaza/camera`);
    if (building.entrance.x !== building.x || building.entrance.z <= building.z) {
      errors.push(`${building.id} entrance must be centered on its north-facing (+Z) facade`);
    }
    if (isBlocked(building.entrance.x, building.entrance.z, 'villa_marionette')) {
      errors.push(`${building.id} entrance is blocked by its footprint`);
    }
    if (!villaLayout.roadZs.some((z) => Math.abs(z - building.entrance.z) <= villaLayout.roadHalfWidth)) {
      errors.push(`${building.id} entrance has no approach road`);
    }
  }

  return errors;
}
