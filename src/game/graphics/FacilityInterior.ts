import * as THREE from 'three';

/**
 * Facility interiors for the overworld (visual layer only).
 * Phase 2 of the "Pokémon Red style map engine": 3D interiors with
 * toon shading + pixel-art palette, fed by the facility models found on GitHub
 * (Blender Pokémon Center scenes) adapted to the game's 3D pipeline.
 */

export const FACILITY_INTERIORS = ['pokemon_center', 'poke_mart', 'research_lab', 'house', 'gym'] as const;
export type FacilityKind = (typeof FACILITY_INTERIORS)[number];

/** Shared interior room dimensions (all facility rooms use the same shell). */
export const INTERIOR_W = 12;
export const INTERIOR_D = 8;

/** Local-space position of the exit door plate (front, -Z side). */
export const INTERIOR_DOOR_LOCAL = { x: 4, z: -INTERIOR_D / 2 };

/** Local-space service interaction hotspots (counter / desk / table). */
export const INTERIOR_SERVICE_LOCAL: Record<FacilityKind, { x: number; z: number }> = {
  pokemon_center: { x: -2, z: -INTERIOR_D / 2 + 2 },
  poke_mart: { x: -2.5, z: -INTERIOR_D / 2 + 2 },
  research_lab: { x: 0, z: -INTERIOR_D / 2 + 2 },
  house: { x: 2, z: -INTERIOR_D / 2 + 2 },
  gym: { x: -2, z: -INTERIOR_D / 2 + 2 },
};

const TOON_MATERIALS = new Map<string, THREE.MeshToonMaterial>();

function toonMaterial(
  hex: number,
  emissive?: number,
  emissiveIntensity = 0
): THREE.MeshToonMaterial {
  const key = `${hex}-${emissive ?? hex}-${emissiveIntensity}`;
  let mat = TOON_MATERIALS.get(key);
  if (!mat) {
    mat = new THREE.MeshToonMaterial({
      color: new THREE.Color(hex),
      emissive: new THREE.Color(emissive ?? hex),
      emissiveIntensity: emissive === undefined ? 0 : emissiveIntensity,
    });
    TOON_MATERIALS.set(key, mat);
  }
  return mat;
}

function addBox(
  group: THREE.Group,
  w: number,
  h: number,
  d: number,
  color: number,
  x = 0,
  y = 0,
  z = 0
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toonMaterial(color));
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function addEmissiveBox(
  group: THREE.Group,
  w: number,
  h: number,
  d: number,
  color: number,
  x: number,
  y: number,
  z: number,
  intensity = 0.9
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toonMaterial(color, color, intensity));
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function addEmissiveCylinder(
  group: THREE.Group,
  r: number,
  h: number,
  color: number,
  x: number,
  y: number,
  z: number
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), toonMaterial(color, color, 1));
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function addShell(
  group: THREE.Group,
  w: number,
  d: number,
  h: number,
  wallColor: number,
  floorColor: number,
  ceilingColor: number
) {
  addBox(group, w, 0.2, d, floorColor, 0, -0.1, 0);
  const doorX = INTERIOR_DOOR_LOCAL.x;
  const doorWidth = 2;
  const doorHeight = 3.2;
  const wallZ = -d / 2 + 0.1;
  const leftWallWidth = doorX - doorWidth / 2 + w / 2;
  const rightWallWidth = w / 2 - doorX - doorWidth / 2;
  addBox(group, leftWallWidth, h, 0.2, wallColor, -w / 2 + leftWallWidth / 2, h / 2, wallZ);
  addBox(group, rightWallWidth, h, 0.2, wallColor, doorX + doorWidth / 2 + rightWallWidth / 2, h / 2, wallZ);
  addBox(group, doorWidth, h - doorHeight, 0.2, wallColor, doorX, doorHeight + (h - doorHeight) / 2, wallZ);
  addBox(group, 0.2, doorHeight + 0.2, 0.3, 0x4a2f1a, doorX - doorWidth / 2, (doorHeight + 0.2) / 2, wallZ + 0.1);
  addBox(group, 0.2, doorHeight + 0.2, 0.3, 0x4a2f1a, doorX + doorWidth / 2, (doorHeight + 0.2) / 2, wallZ + 0.1);
  addBox(group, doorWidth + 0.2, 0.2, 0.3, 0x4a2f1a, doorX, doorHeight + 0.1, wallZ + 0.1);
  addBox(group, doorWidth - 0.3, doorHeight - 0.2, 0.12, 0x704626, doorX, (doorHeight - 0.2) / 2, wallZ + 0.24);
  addBox(group, doorWidth - 0.55, 0.08, 0.04, 0x9a7042, doorX, 2.2, wallZ + 0.17);
  addBox(group, doorWidth - 0.55, 0.08, 0.04, 0x9a7042, doorX, 0.85, wallZ + 0.17);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), toonMaterial(0xf3c969, 0xf3c969, 0.25));
  knob.position.set(doorX + 0.62, 1.55, wallZ + 0.34);
  group.add(knob);
  addBox(group, 0.2, h, d, wallColor, -w / 2 + 0.1, h / 2, 0);
  addBox(group, 0.2, h, d, wallColor, w / 2 - 0.1, h / 2, 0);
  // Keep a colored wall cap, but leave the roof open for the top-down camera.
  addBox(group, w, 0.18, 0.12, ceilingColor, 0, h - 0.09, -d / 2 + 0.16);
  addBox(group, 0.12, 0.18, d, ceilingColor, -w / 2 + 0.16, h - 0.09, 0);
  addBox(group, 0.12, 0.18, d, ceilingColor, w / 2 - 0.16, h - 0.09, 0);
}

function addRug(group: THREE.Group, w: number, h: number, d: number, color: number, x: number, y: number, z: number) {
  addBox(group, w, h, d, color, x, y, z);
}

function addPlant(group: THREE.Group, x: number, z: number) {
  addBox(group, 1, 1.6, 1, 0x6b4423, x, 0.8, z);
  addBox(group, 1.2, 0.8, 1.2, 0x2f6b33, x, 1.8, z);
  addBox(group, 1, 0.7, 1, 0x3a8a3f, x, 2.3, z);
}

function addShelf(group: THREE.Group, x: number, boardY: number, z: number, products: number[]) {
  addBox(group, 8, 0.15, 1.2, 0x6b4423, x, boardY, z);
  const slot = 1.7;
  const startX = x - ((products.length - 1) * slot) / 2;
  products.forEach((c, i) => {
    addBox(group, 1.5, 0.9, 1, c, startX + i * slot, boardY - 0.45, z);
  });
}

function addBed(group: THREE.Group, x: number, z: number) {
  addBox(group, 4, 0.5, 2, 0x5d3d22, x, 0.25, z);
  addBox(group, 3.6, 0.3, 1.8, 0x8b5a2b, x, 0.65, z);
  addBox(group, 1.6, 0.25, 1.8, 0xe8dcc8, x, 0.9, z);
}

function addTable(group: THREE.Group, x: number, z: number) {
  addBox(group, 2, 0.1, 2, 0x6b4423, x, 0.95, z);
  addBox(group, 0.15, 0.9, 0.15, 0x4a2f1a, x - 0.8, 0.45, z - 0.8);
  addBox(group, 0.15, 0.9, 0.15, 0x4a2f1a, x + 0.8, 0.45, z - 0.8);
  addBox(group, 0.15, 0.9, 0.15, 0x4a2f1a, x - 0.8, 0.45, z + 0.8);
  addBox(group, 0.15, 0.9, 0.15, 0x4a2f1a, x + 0.8, 0.45, z + 0.8);
  addBox(group, 2, 0.05, 0.15, 0x4a2f1a, x, 1.0, z + 0.9);
}

function addInteriorLight(group: THREE.Group, y: number, z: number, color: string, intensity: number) {
  const lampLight = new THREE.PointLight(color, intensity, 18, 1.6);
  lampLight.position.set(0, y, z);
  group.add(lampLight);
  const lampGlow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), toonMaterial(0xffe9b8, 0xffe9b8, 0.9));
  lampGlow.position.set(0, y, z);
  group.add(lampGlow);
}

function addCeilingLight(group: THREE.Group, x: number, y: number, z: number, color: number, intensity: number) {
  addEmissiveBox(group, 5, 0.3, 3, color, x, y, z);
  const light = new THREE.PointLight('#ffffff', intensity, 20, 1.8);
  light.position.set(x, y - 1, z);
  group.add(light);
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
      addShell(group, w, d, h, 0xd9cfc0, 0x7a5230, 0xc9bfa8);
      // Wooden ceiling beam
      addBox(group, w, 0.5, 0.6, 0x6b4423, 0, h - 0.25, -d / 2 + 0.1);
      // Reception counter with lighter top
      addBox(group, 6, 1.2, 2, 0x5d3d22, -2, 0.6, -d / 2 + 2);
      addBox(group, 6.2, 0.2, 2.2, 0xffedd0, -2, 1.3, -d / 2 + 2);
      // Window with frame (front, -Z side)
      addBox(group, 2.4, 2.4, 0.25, 0x4a2f1a, 1.5, 2.5, -d / 2 + 0.1);
      addBox(group, 2, 2, 0.15, 0xbfdbfe, 1.5, 2.5, -d / 2);
      // Healing sigil on the floor
      addEmissiveCylinder(group, 0.9, 0.05, 0xffd166, -2, 0.13, -d / 2 + 2);
      // Central rug
      addRug(group, 6, 0.06, 4, 0xa16207, 0, 0.03, -d / 2 + 2);
      addPlant(group, -w / 2 + 1.5, -d / 2 + 1.5);
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
      addShell(group, w, d, h, 0xd9cfc0, 0x7a5230, 0xc9bfa8);
      // Product shelf with colorful stock
      addShelf(group, -2, 4.3, -d / 2 + 2, [0xe63946, 0x2a9d8f, 0xf4a261, 0x8ecae6, 0x90be6d, 0x00a896]);
      // Wide retail counter with lighter top
      addBox(group, 8, 1.2, 3, 0x5d3d22, -2.5, 0.6, -d / 2 + 2);
      addBox(group, 8.2, 0.2, 3.2, 0xffedd0, -2.5, 1.3, -d / 2 + 2);
      addBox(group, 2.4, 2.4, 0.25, 0x4a2f1a, 1.5, 2.5, -d / 2 + 0.1);
      addBox(group, 2, 2, 0.15, 0xbfdbfe, 1.5, 2.5, -d / 2);
      // Sale poster on the back wall
      addEmissiveBox(group, 3, 3, 0.1, 0xe63946, 0, 3, -d / 2 + 0.05, 0.35);
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
      addShell(group, w, d, h, 0xe2ecf0, 0x8d99a6, 0xf0f4f6);
      // Tall equipment racks with emissive screens
      addEmissiveBox(group, 3, 4, 2, 0x1e293b, -3, 2, -d / 2 + 2);
      addEmissiveBox(group, 3, 3.5, 2, 0x38bdf8, -3, 2.2, -d / 2 + 2);
      addEmissiveBox(group, 3, 4, 2, 0x1e293b, 3, 2, -d / 2 + 2);
      addEmissiveBox(group, 3, 3.5, 2, 0x38bdf8, 3, 2.2, -d / 2 + 2);
      // Ceiling light panel
      addCeilingLight(group, 0, h - 0.1, -d / 2 + 2, 0xf8fafc, 25);
      const ambientLight = new THREE.PointLight('#dbeafe', 8, 20, 2);
      ambientLight.position.set(0, 3, 2);
      group.add(ambientLight);
      return group;
    }
    case 'house': {
      const w = 12;
      const d = 8;
      const h = 6;
      addShell(group, w, d, h, 0xd9cfc0, 0x7a5230, 0xc9bfa8);
      // Living quarters: bed, table, rug, lamp, wall art
      addBed(group, -2, -d / 2 + 2);
      addTable(group, 2, -d / 2 + 2);
      addRug(group, 6, 0.06, 4, 0xa16207, 0, 0.03, -d / 2 + 2);
      addInteriorLight(group, h - 0.5, -1, '#fff7e0', 25);
      const ambientLight = new THREE.PointLight('#cfe8ff', 6, 18, 2);
      ambientLight.position.set(0, 3, 2);
      group.add(ambientLight);
      addBox(group, 2, 2, 0.1, 0x94a3b8, -3, 3, -d / 2 + 0.05);
      addBox(group, 2, 2, 0.1, 0x94a3b8, 3, 3, -d / 2 + 0.05);
      return group;
    }
    case 'gym': {
      const w = 12;
      const d = 8;
      const h = 7;
      addShell(group, w, d, h, 0xd6d3d1, 0x8a5a2b, 0xcabfb2);
      // Battle totem pillars with embers on top
      addBox(group, 2.2, 6.2, 2.2, 0xb45309, -w / 2 + 2.4, 3.1, -d / 2 + 2);
      addEmissiveBox(group, 2.2, 0.4, 2.2, 0xf97316, -w / 2 + 2.4, 6.1, -d / 2 + 2, 0.75);
      addBox(group, 2.2, 6.2, 2.2, 0xb45309, w / 2 - 2.4, 3.1, -d / 2 + 2);
      addEmissiveBox(group, 2.2, 0.4, 2.2, 0xf97316, w / 2 - 2.4, 6.1, -d / 2 + 2, 0.75);
      // Leader's pedestal with lighter top
      addBox(group, 3, 1.1, 2.4, 0x7c3f16, -2, 0.55, -d / 2 + 2);
      addBox(group, 3.2, 0.2, 2.6, 0xffedd0, -2, 1.2, -d / 2 + 2);
      // Flaming gym emblem on the back wall
      addEmissiveBox(group, 2.4, 2.4, 0.35, 0xf97316, -2, 4.4, -d / 2 + 0.15, 0.85);
      addInteriorLight(group, h - 0.5, -1, '#ffe19b', 26);
      const ambientLight = new THREE.PointLight('#fde8c8', 8, 20, 2);
      ambientLight.position.set(0, 4, 2);
      group.add(ambientLight);
      return group;
    }
    default:
      return group;
  }
}
