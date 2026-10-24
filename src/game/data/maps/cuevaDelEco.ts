import { WorldMapDefinition } from '../world';

const CAVE_MAZE_ROWS = [
  '#######...#######',
  '#.............#.#',
  '#.#####.#.#.#.#.#',
  '#.#...#.#.#.#...#',
  '#.#.#.#.#.#.###.#',
  '#.#.#...#.#...#.#',
  '###.#####.###.###',
  '#...#...#.#.#...#',
  '#.#.#.#.#.#.###.#',
  '#.#.#.#.......#.#',
  '#.#.#.#########.#',
  '#.#.#.#.......#.#',
  '#.#.#.#.#####.#.#',
  '#.#.#.#.#...#...#',
  '#.###.#.#.#.###.#',
  '#.....#...#.....#',
  '########.########',
];

export const cuevaDelEco: WorldMapDefinition = {
  id: 'cueva_del_eco',
  name: 'Cueva del Eco',
  palette: { background: '#100f18', fog: '#17151d', fogDensity: 0.024 },
  connections: [
    { at: { x: 0, z: 26 }, toMap: 'bosque_del_eco', arrival: { x: 0, z: -24 }, facing: 'down' },
  ],
  layout: {
    wildZones: [
      {
        name: 'Cueva del Eco · Galería de hongos',
        minX: -17,
        maxX: -13,
        minZ: 7,
        maxZ: 11,
        encounterRate: 0.11,
        speciesPool: [
          { speciesId: 'venomantis', minLevel: 16, maxLevel: 19, weight: 30 },
          { speciesId: 'umbraling', minLevel: 16, maxLevel: 19, weight: 25 },
          { speciesId: 'geotort', minLevel: 16, maxLevel: 19, weight: 25 },
          { speciesId: 'lumiwisp', minLevel: 17, maxLevel: 20, weight: 20 },
        ],
      },
      {
        name: 'Cueva del Eco · Cámara de cristales',
        minX: 13,
        maxX: 17,
        minZ: -11,
        maxZ: -7,
        encounterRate: 0.11,
        speciesPool: [
          { speciesId: 'geotort', minLevel: 16, maxLevel: 19, weight: 30 },
          { speciesId: 'lumiwisp', minLevel: 17, maxLevel: 20, weight: 30 },
          { speciesId: 'venomantis', minLevel: 17, maxLevel: 20, weight: 25 },
          { speciesId: 'umbraling', minLevel: 18, maxLevel: 20, weight: 15 },
        ],
      },
    ],
    plaza: null,
    roadXs: [],
    roadZs: [],
    roadHalfWidth: 0,
    flowerDensity: 0,
    caveMaze: {
      rows: CAVE_MAZE_ROWS,
      entrance: { col: 8, row: 16 },
      goal: { col: 8, row: 0 },
    },
    fixedDecorations: [{ kind: 'cave-cache', x: 0, z: -24 }],
    decorations: { tallTrees: 0, shortTrees: 0, bushes: 0, rocks: 0, flowers: 0, tufts: 0 },
  },
  tamers: [],
  clearPoints: [
    { x: 0, z: 24, r: 3 },
    { x: 0, z: 26, r: 3 },
    { x: 0, z: -24, r: 4 },
    { x: 0, z: -26, r: 3 },
    { x: -15, z: 9, r: 3 },
    { x: 15, z: -9, r: 3 },
  ],
  signSpots: [],
};
