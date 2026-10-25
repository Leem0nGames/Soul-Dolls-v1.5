import { WorldMapDefinition } from '../world';
import { VILLA_BUILDINGS } from './villaBuildings';

const VILLA_TAMERS: WorldMapDefinition['tamers'] = [
  {
    name: 'Tyler',
    title: 'Aprendiz de Almas',
    tamerType: 'apprentice',
    portrait: 'tyler',
    position: { x: -8, z: -7 },
    triggerDistance: 3.2,
    party: [
      { speciesId: 'sparkit', level: 9 },
      { speciesId: 'florabun', level: 10 },
    ],
    dialogueIntro: '¡Alto ahí, forastero! ¡Demuéstrame el vínculo que tienes con tus SoulDolls!',
    dialogueDefeated: '¡Increíble sintonía! Tus almas combaten con una armonía admirable.',
  },
  {
    name: 'Vesper',
    title: 'Maestro del Éter',
    tamerType: 'master',
    portrait: 'vesper',
    position: { x: 8, z: 7 },
    triggerDistance: 3.2,
    party: [
      { speciesId: 'umbraling', level: 13 },
      { speciesId: 'cryopup', level: 14 },
    ],
    dialogueIntro: 'Las sombras y la escarcha responden a mi voluntad. ¿Podrá tu llama resistir?',
    dialogueDefeated: 'Fascinante... Tus SoulDolls poseen un brillo que desafía la penumbra.',
  },
];

export const villaMarionette: WorldMapDefinition = {
  id: 'villa_marionette',
  name: 'Villa Marionette',
  palette: { background: '#c9dfcf', fog: '#c9dfcf' },
  connections: [
    { at: { x: 0, z: -26 }, toMap: 'ruta_1', arrival: { x: 0, z: 25.5 }, facing: 'up' },
  ],
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
    roadZs: [-17, -8, 4, 17, 24],
    roadHalfWidth: 1.8,
    flowerDensity: 0.08,
    decorations: { tallTrees: 12, shortTrees: 18, bushes: 22, rocks: 8, flowers: 32, tufts: 12 },
    buildingFootprints: VILLA_BUILDINGS.map(({ x, z, halfWidth, halfDepth }) => ({
      x,
      z,
      halfWidth,
      halfDepth,
    })),
  },
  tamers: VILLA_TAMERS,
  clearPoints: [
    { x: 0, z: 22, r: 4.5 },
    { x: 0, z: 0, r: 8 },
    { x: 17, z: -8, r: 3.5 },
    ...VILLA_TAMERS.map(({ position }) => ({ ...position, r: 3.5 })),
    ...VILLA_BUILDINGS.flatMap((building) => [
      { x: building.x, z: building.z, r: 4.5 },
      { x: building.entrance.x, z: building.entrance.z, r: 3.5 },
    ]),
  ],
  signSpots: [[18, 36], [22, 4]],
};
