import * as THREE from 'three';

/**
 * Facility interiors for the overworld (visual layer only).
 * Phase 2 of the "Pokémon Red style map engine": 3D interiors with
 * toon shading + pixel-art palette, fed by the facility models found on GitHub
 * (Blender Pokémon Center scenes) adapted to the game's 3D pipeline.
 */

export const FACILITY_INTERIORS = ['pokemon_center'] as const;
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

/**
 * Builds a 3D facility interior. Currently implements the Pokémon Center
 * (healing sanctuary interior): floor, walls, ceiling, counter, door, window
 * and lamp with toon materials so it matches the pixel-art aesthetic.
 */
export function buildFacilityInterior(kind: FacilityKind): THREE.Group {
  const group = new THREE.Group();
  if (kind !== 'pokemon_center') return group;

  const w = 12;
  const d = 8;
  const h = 6;

  // Floor
  addBox(group, w, 0.2, d, 0x7a5230, 0, -0.1, 0);
  // Back wall + ceiling
  addBox(group, w, h, 0.2, 0xd9cfc0, 0, h / 2, -d / 2 + 0.1);
  addBox(group, w, 0.2, d, 0xc9bfa8, 0, h - 0.1, 0);
  // Side walls
  addBox(group, 0.2, h, d, 0xd9cfc0, -w / 2 + 0.1, h / 2, 0);
  addBox(group, 0.2, h, d, 0xd9cfc0, w / 2 - 0.1, h / 2, 0);

  // Reception counter (back wall, near the door side)
  addBox(group, 6, 1.2, 2, 0x5d3d22, -2, 0.6, -d / 2 + 2);
  addBox(group, 6, 0.2, 2.2, 0x4a2f1a, -2, 1.3, -d / 2 + 2);

  // Door (front)
  addBox(group, 2, 3, 0.2, 0x6b4423, 4, 1.5, -d / 2);

  // Window (front)
  addBox(group, 2, 2, 0.1, 0xbfdbfe, 1.5, 2.5, -d / 2);

  // Lamp + lights
  const lampLight = new THREE.PointLight('#fff7e0', 30, 18, 1.6);
  lampLight.position.set(0, h - 0.5, -1);
  group.add(lampLight);
  const lampGlow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), toonMaterial(0xffe9b8, 0.4));
  lampGlow.position.set(0, h - 0.5, -1);
  group.add(lampGlow);
  const ambientLight = new THREE.PointLight('#cfe8ff', 8, 20, 2);
  ambientLight.position.set(0, 3, 2);
  group.add(ambientLight);

  return group;
}
