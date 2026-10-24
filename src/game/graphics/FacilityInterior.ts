import * as THREE from 'three';

/**
 * Facility interiors for the overworld (visual layer only).
 * Phase 2 of the "Pokémon Red style map engine": 3D interiors with
 * toon shading + pixel-art palette, fed by the facility models found on GitHub
 * (Blender Pokémon Center scenes) adapted to the game's 3D pipeline.
 */

export const FACILITY_INTERIORS = ['pokemon_center', 'poke_mart', 'research_lab', 'house'] as const;
export type FacilityKind = (typeof FACILITY_INTERIORS)[number];

const TOON_MATERIALS = new Map<string, THREE.MeshStandardMaterial>();

function toonMaterial(hex: number, roughness = 1): THREE.MeshStandardMaterial {
  const key = `${hex}-${roughness}`;
  let mat = TOON_MATERIALS.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness, metalness: 0 });
    TOON_MATERIALS.set(key, mat);
  }
  return mat;
}

function addBox(group: THREE.Group, w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toonMaterial(color));
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function addInteriorShell(group: THREE.Group, w: number, d: number, h: number, wallColor: number, floorColor: number, ceilingColor: number) {
  addBox(group, w, 0.2, d, floorColor, 0, -0.1, 0);
  addBox(group, w, h, 0.2, wallColor, 0, h / 2, -d / 2 + 0.1);
  addBox(group, w, 0.2, d, ceilingColor, 0, h - 0.1, 0);
  addBox(group, 0.2, h, d, wallColor, -w / 2 + 0.1, h / 2, 0);
  addBox(group, 0.2, h, d, wallColor, w / 2 - 0.1, h / 2, 0);
}

function addInteriorLight(group: THREE.Group, y: number, z: number, color: string, intensity: number) {
  const lampLight = new THREE.PointLight(color, intensity, 18, 1.6);
  lampLight.position.set(0, y, z);
  group.add(lampLight);
  const lampGlow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), toonMaterial(0xffe9b8, 0.4));
  lampGlow.position.set(0, y, z);
  group.add(lampGlow);
}

/**
 * Builds a 3D facility interior. Currently implements:
 * - pokemon_center: healing sanctuary interior
 * - poke_mart: retail counter interior
 * - research_lab: tall lab with equipment
 * - house: living quarters
 */
export function buildFacilityInterior(kind: FacilityKind): THREE.Group {
  const group = new THREE.Group();
  switch (kind) {
    case 'pokemon_center': {
      const w = 12;
      const d = 8;
      const h = 6;
      addInteriorShell(group, w, d, h, 0xd9cfc0, 0x7a5230, 0xc9bfa8);
      // Reception counter (back wall, near the door side)
      addBox(group, 6, 1.2, 2, 0x5d3d22, -2, 0.6, -d / 2 + 2);
      addBox(group, 6, 0.2, 2.2, 0x4a2f1a, -2, 1.3, -d / 2 + 2);
      // Door (front)
      addBox(group, 2, 3, 0.2, 0x6b4423, 4, 1.5, -d / 2);
      // Window (front)
      addBox(group, 2, 2, 0.1, 0xbfdbfe, 1.5, 2.5, -d / 2);
      addInteriorLight(group, h - 0.5, -1, '#fff7e0', 30);
      const ambientLight = new THREE.PointLight('#cfe8ff', 8, 20, 2);
      ambientLight.position.set(0, 3, 2);
      group.add(ambientLight);
      return group;
    }
    case 'poke_mart': {
      const w = 12;
      const d = 8;
      const h = 6;
      addInteriorShell(group, w, d, h, 0xd9cfc0, 0x7a5230, 0xc9bfa8);
      // Wide retail counter along the back wall
      addBox(group, 8, 1.2, 3, 0x5d3d22, -2.5, 0.6, -d / 2 + 2);
      addBox(group, 8, 0.2, 3.2, 0x4a2f1a, -2.5, 1.3, -d / 2 + 2);
      addBox(group, 2, 3, 0.2, 0x6b4423, 4, 1.5, -d / 2);
      addBox(group, 2, 2, 0.1, 0xbfdbfe, 1.5, 2.5, -d / 2);
      addInteriorLight(group, h - 0.5, -1, '#fff7e0', 25);
      const ambientLight = new THREE.PointLight('#cfe8ff', 6, 18, 2);
      ambientLight.position.set(0, 3, 2);
      group.add(ambientLight);
      return group;
    }
    case 'research_lab': {
      const w = 12;
      const d = 8;
      const h = 7;
      addInteriorShell(group, w, d, h, 0xd9cfc0, 0x7a5230, 0xc9bfa8);
      // Tall lab equipment blocks with emissive screens
      addBox(group, 3, 4, 2, 0x334155, -3, 2, -d / 2 + 2);
      addBox(group, 3, 3, 2, 0x1e293b, -3, 1.5, -d / 2 + 2);
      addBox(group, 3, 4, 2, 0x334155, 3, 2, -d / 2 + 2);
      addBox(group, 3, 3, 2, 0x1e293b, 3, 1.5, -d / 2 + 2);
      addBox(group, 2, 2, 0.1, 0x93c5fd, 0, 3, -d / 2);
      addInteriorLight(group, h - 0.5, -1, '#dbeafe', 35);
      const ambientLight = new THREE.PointLight('#dbeafe', 8, 20, 2);
      ambientLight.position.set(0, 3, 2);
      group.add(ambientLight);
      return group;
    }
    case 'house': {
      const w = 12;
      const d = 8;
      const h = 6;
      addInteriorShell(group, w, d, h, 0xd9cfc0, 0x7a5230, 0xc9bfa8);
      // Living quarters: bed + table + lamp
      addBox(group, 3, 1.2, 4, 0x8b5a2b, -2, 0.6, -d / 2 + 2);
      addBox(group, 2, 0.2, 2, 0x6b4423, -2, 1.2, -d / 2 + 2);
      addBox(group, 2, 2, 2, 0x5d3d22, 2, 1, -d / 2 + 2);
      addInteriorLight(group, h - 0.5, -1, '#fff7e0', 25);
      const ambientLight = new THREE.PointLight('#cfe8ff', 6, 18, 2);
      ambientLight.position.set(0, 3, 2);
      group.add(ambientLight);
      return group;
    }
    default:
      return group;
  }
}
