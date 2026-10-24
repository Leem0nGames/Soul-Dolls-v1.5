import { MapId, WorldMapDefinition } from '../world';
import { ruta1 } from './ruta1';
import { villaMarionette } from './villaMarionette';

export const WORLD_MAPS: Record<MapId, WorldMapDefinition> = {
  villa_marionette: villaMarionette,
  ruta_1: ruta1,
};

export const MAP_IDS = Object.keys(WORLD_MAPS) as MapId[];
export const MAP_NAMES = Object.fromEntries(
  MAP_IDS.map((id) => [id, WORLD_MAPS[id].name])
) as Record<MapId, string>;

export const MAP_PALETTES = Object.fromEntries(
  MAP_IDS.map((id) => [id, WORLD_MAPS[id].palette])
) as Record<MapId, WorldMapDefinition['palette']>;

export const MAP_CONNECTIONS = Object.fromEntries(
  MAP_IDS.map((id) => [id, WORLD_MAPS[id].connections])
) as Record<MapId, WorldMapDefinition['connections']>;
