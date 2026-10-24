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
    rotation: Math.PI / 2,
    scale: 3.7,
    halfWidth: 2.55,
    halfDepth: 2.45,
    facility: 'pokemon_center',
    entrance: { x: -13, z: -12 },
  },
  {
    id: 'marionette-market',
    file: 'building-type-b.glb',
    x: 17,
    z: -12,
    rotation: -Math.PI / 2,
    scale: 3.7,
    halfWidth: 2.2,
    halfDepth: 3.5,
    facility: 'poke_mart',
    entrance: { x: 13, z: -12 },
  },
  {
    id: 'research-house',
    file: 'building-type-c.glb',
    x: -17,
    z: 12,
    rotation: Math.PI / 2,
    scale: 3.7,
    halfWidth: 2.55,
    halfDepth: 2.45,
    facility: 'research_lab',
    entrance: { x: -13, z: 12 },
  },
  {
    id: 'dojo',
    file: 'building-type-d.glb',
    x: 17,
    z: 12,
    rotation: -Math.PI / 2,
    scale: 3.7,
    halfWidth: 2.2,
    halfDepth: 3.5,
    facility: 'gym',
    entrance: { x: 13, z: 12 },
  },
  {
    id: 'garden-home',
    file: 'building-type-e.glb',
    x: -17,
    z: 0,
    rotation: 0,
    scale: 3.5,
    halfWidth: 2.5,
    halfDepth: 2.4,
    facility: 'house',
    entrance: { x: -17, z: 3.3 },
  },
  {
    id: 'north-home',
    file: 'building-type-f.glb',
    x: -17,
    z: -22,
    rotation: 0,
    scale: 3.5,
    halfWidth: 2.5,
    halfDepth: 2.7,
    entrance: { x: -17, z: -17.9 },
  },
  {
    id: 'east-home',
    file: 'building-type-g.glb',
    x: 17,
    z: 0,
    rotation: 0,
    scale: 3.5,
    halfWidth: 2.6,
    halfDepth: 2.5,
    entrance: { x: 17, z: 3.6 },
  },
  {
    id: 'south-home',
    file: 'building-type-h.glb',
    x: 17,
    z: 22,
    rotation: Math.PI,
    scale: 3.5,
    halfWidth: 2.5,
    halfDepth: 2.4,
    entrance: { x: 17, z: 18.8 },
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
