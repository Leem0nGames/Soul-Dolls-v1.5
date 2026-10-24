import { WorldMapDefinition } from '../world';

export const ruta1: WorldMapDefinition = {
  id: 'ruta_1',
  name: 'Ruta 1 · Sendero de los Susurros',
  palette: { background: '#d5e6ce', fog: '#d5e6ce' },
  connections: [{ at: { x: 0, z: 26 }, toMap: 'villa_marionette', arrival: { x: 0, z: -25.5 } }],
  layout: {
    wildZones: [
      {
        name: 'Ruta 1 · Prado del arroyo',
        minX: -12,
        maxX: -7,
        minZ: -12,
        maxZ: -4,
        encounterRate: 0.1,
        speciesPool: [
          { speciesId: 'florabun', minLevel: 8, maxLevel: 11, weight: 30 },
          { speciesId: 'sparkit', minLevel: 8, maxLevel: 12, weight: 30 },
          { speciesId: 'aerochick', minLevel: 8, maxLevel: 11, weight: 25 },
          { speciesId: 'geotort', minLevel: 9, maxLevel: 12, weight: 15 },
        ],
      },
      {
        name: 'Ruta 1 · Prado del claro',
        minX: 4,
        maxX: 10,
        minZ: 7,
        maxZ: 17,
        encounterRate: 0.1,
        speciesPool: [
          { speciesId: 'cryopup', minLevel: 8, maxLevel: 12, weight: 35 },
          { speciesId: 'aquafox', minLevel: 9, maxLevel: 12, weight: 30 },
          { speciesId: 'runika', minLevel: 9, maxLevel: 13, weight: 25 },
          { speciesId: 'lumiwisp', minLevel: 10, maxLevel: 13, weight: 10 },
        ],
      },
    ],
    plaza: null,
    roadXs: [],
    roadZs: [],
    roadPath: [
      { x: 0, z: 27 },
      { x: 0, z: 8 },
      { x: -4.5, z: 3 },
      { x: -4.5, z: -10 },
      { x: 0, z: -17 },
      { x: 0, z: -27 },
    ],
    roadHalfWidth: 1.5,
    flowerDensity: 0.025,
    decorations: { tallTrees: 20, shortTrees: 28, bushes: 26, rocks: 18, flowers: 10, tufts: 16 },
  },
  clearPoints: [
    { x: 0, z: 25, r: 4 },
    { x: 0, z: -25, r: 4 },
    { x: 0, z: -18, r: 4 },
    { x: 0, z: 0, r: 3.5 },
    { x: 0, z: 26, r: 4 },
    { x: 0, z: -26, r: 4 },
    { x: 3, z: -15, r: 3 },
  ],
  signSpots: [[17, 36], [23, 4]],
};
