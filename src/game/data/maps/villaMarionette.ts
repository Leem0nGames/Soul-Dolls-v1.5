import { WorldMapDefinition } from '../world';
import { VILLA_BUILDINGS } from '../../graphics/OverworldBuildings';

export const villaMarionette: WorldMapDefinition = {
  id: 'villa_marionette',
  name: 'Villa Marionette',
  palette: { background: '#c9dfcf', fog: '#c9dfcf' },
  connections: [{ at: { x: 0, z: -26 }, toMap: 'ruta_1', arrival: { x: 0, z: 25.5 } }],
  layout: {
    wildZones: [
      {
        name: 'Villa Marionette · Prado Oeste',
        minX: -8,
        maxX: -3,
        minZ: -25,
        maxZ: -20,
        encounterRate: 0.08,
        speciesPool: [
          { speciesId: 'florabun', minLevel: 6, maxLevel: 10, weight: 30 },
          { speciesId: 'runika', minLevel: 7, maxLevel: 11, weight: 25 },
          { speciesId: 'sparkit', minLevel: 7, maxLevel: 10, weight: 25 },
          { speciesId: 'geotort', minLevel: 6, maxLevel: 9, weight: 20 },
        ],
      },
      {
        name: 'Villa Marionette · Prado Este',
        minX: 3,
        maxX: 8,
        minZ: -25,
        maxZ: -20,
        encounterRate: 0.08,
        speciesPool: [
          { speciesId: 'aquafox', minLevel: 7, maxLevel: 11, weight: 35 },
          { speciesId: 'cryopup', minLevel: 7, maxLevel: 10, weight: 30 },
          { speciesId: 'aerochick', minLevel: 6, maxLevel: 10, weight: 25 },
          { speciesId: 'lumiwisp', minLevel: 8, maxLevel: 12, weight: 10 },
        ],
      },
    ],
    plaza: { x: 0, z: 0, radius: 5.5 },
    roadXs: [-12, 0, 12],
    roadZs: [-21, -12, 0, 12, 21],
    roadHalfWidth: 1.5,
    flowerDensity: 0.08,
    decorations: { tallTrees: 12, shortTrees: 18, bushes: 22, rocks: 8, flowers: 32, tufts: 12 },
    buildingFootprints: VILLA_BUILDINGS.map(({ x, z, halfWidth, halfDepth }) => ({
      x,
      z,
      halfWidth,
      halfDepth,
    })),
  },
  clearPoints: [
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
  signSpots: [[18, 36], [22, 4]],
};
