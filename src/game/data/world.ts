export type MapId = 'villa_marionette' | 'ruta_1';

export const MAP_IDS: readonly MapId[] = ['villa_marionette', 'ruta_1'];

export const MAP_NAMES: Record<MapId, string> = {
  villa_marionette: 'Villa Marionette',
  ruta_1: 'Ruta 1 · Sendero de los Susurros',
};

export const MAP_PALETTES: Record<MapId, { background: string; fog: string }> = {
  villa_marionette: { background: '#c9dfcf', fog: '#c9dfcf' },
  ruta_1: { background: '#d5e6ce', fog: '#d5e6ce' },
};
