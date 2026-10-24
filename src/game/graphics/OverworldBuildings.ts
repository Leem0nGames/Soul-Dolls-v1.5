import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FacilityKind } from './FacilityInterior';

export interface VillaBuilding {
  id: string;
  file: string;
  x: number;
  z: number;
  rotation: number;
  scale: number;
  /** World-space half extents of the blocked footprint. */
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

export class OverworldBuildings {
  readonly group = new THREE.Group();
  private disposed = false;
  private loader = new GLTFLoader();

  public async load(baseUrl: string): Promise<void> {
    const files = [...new Set(VILLA_BUILDINGS.map((building) => building.file))];
    const models = await Promise.all(
      files.map(async (file) => {
        try {
          const gltf = await this.loader.loadAsync(`${baseUrl}/${file}`);
          return [file, gltf.scene] as const;
        } catch (error) {
          console.error(`[Villa Marionette] No se pudo cargar el edificio ${file}:`, error);
          throw error;
        }
      })
    );

    if (this.disposed) {
      models.forEach(([, model]) => this.disposeModel(model));
      return;
    }

    const modelByFile = new Map(models);
    for (const building of VILLA_BUILDINGS) {
      const model = modelByFile.get(building.file);
      if (!model) throw new Error(`Falta el modelo descargado ${building.file}`);
      const instance = model.clone(true);
      instance.name = building.id;
      instance.position.set(building.x, 0, building.z);
      instance.rotation.y = building.rotation;
      instance.scale.setScalar(building.scale);
      instance.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      this.group.add(instance);
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose();
          material.dispose();
        });
      }
    });
    this.group.clear();
  }

  private disposeModel(model: THREE.Object3D): void {
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose();
          material.dispose();
        });
      }
    });
  }
}
