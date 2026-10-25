type FacilityKind = 'pokemon_center' | 'poke_mart' | 'research_lab' | 'house' | 'gym';

export interface VillaBuilding {
  id: string;
  file: string;
  x: number;
  z: number;
  rotation: number;
  scale: number;
  halfWidth: number;
  halfDepth: number;
  facility?: FacilityKind;
  entrance: { x: number; z: number };
}

export const VILLA_BUILDINGS: readonly VillaBuilding[] = [
  {
    id: 'soul-center',
    file: 'building-type-a.glb',
    x: -17,
    z: -12,
    rotation: 0,
    scale: 4.25,
    halfWidth: 2.82,
    halfDepth: 2.94,
    facility: 'pokemon_center',
    entrance: { x: -17, z: -7.65 },
  },
  {
    id: 'marionette-market',
    file: 'building-type-b.glb',
    x: 17,
    z: -12,
    rotation: 0,
    scale: 4.25,
    halfWidth: 4.02,
    halfDepth: 2.53,
    facility: 'poke_mart',
    entrance: { x: 17, z: -7.67 },
  },
  {
    id: 'research-house',
    file: 'building-type-c.glb',
    x: -17,
    z: 12,
    rotation: 0,
    scale: 4.25,
    halfWidth: 2.82,
    halfDepth: 2.94,
    facility: 'research_lab',
    entrance: { x: -17, z: 16.35 },
  },
  {
    id: 'dojo',
    file: 'building-type-d.glb',
    x: 17,
    z: 12,
    rotation: 0,
    scale: 4.25,
    halfWidth: 4.02,
    halfDepth: 2.53,
    facility: 'gym',
    entrance: { x: 17, z: 16.33 },
  },
  {
    id: 'garden-home',
    file: 'building-type-e.glb',
    x: -17,
    z: 0,
    rotation: 0,
    scale: 4.05,
    halfWidth: 2.9,
    halfDepth: 2.78,
    facility: 'house',
    entrance: { x: -17, z: 4.2 },
  },
  {
    id: 'north-home',
    file: 'building-type-f.glb',
    x: -17,
    z: -22,
    rotation: 0,
    scale: 4.05,
    halfWidth: 2.9,
    halfDepth: 3.13,
    entrance: { x: -17, z: -17.45 },
  },
  {
    id: 'east-home',
    file: 'building-type-g.glb',
    x: 17,
    z: 0,
    rotation: 0,
    scale: 4.05,
    halfWidth: 3.0,
    halfDepth: 2.9,
    entrance: { x: 17, z: 4.3 },
  },
  {
    id: 'south-home',
    file: 'building-type-h.glb',
    x: 17,
    z: 20,
    rotation: 0,
    scale: 4.05,
    halfWidth: 2.9,
    halfDepth: 2.78,
    entrance: { x: 17, z: 24.2 },
  },
];
