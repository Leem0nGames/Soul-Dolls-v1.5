import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VILLA_BUILDINGS } from '../data/maps/villaBuildings';

export { VILLA_BUILDINGS };
export type { VillaBuilding } from '../data/maps/villaBuildings';

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
