/**
 * Overworld props
 * ---------------------------------------------------------------------------
 * The trees, bushes, flowers, rocks and signposts of the map are billboards
 * (sprites) instead of being painted into the ground texture, so the player
 * walks behind them and they get the depth of the diorama.
 *
 * Most sprites are baked from the modern Kenney Roguelike tileset; the round
 * shrub is from Kenney Tiny Town. Their CC0 sources are in LICENSE.txt.
 */
import * as THREE from 'three';
import { DecorationKind, MapId, PlacedDecoration, getDecorations } from './OverworldTiles';

interface PropDefinition {
  /** File inside /assets/props. */
  file: string;
  /** Size of the billboard in world units. */
  width: number;
  height: number;
}

const PROP_DEFS: Partial<Record<DecorationKind, PropDefinition>> = {
  'tree-tall': { file: 'tree-tall.png', width: 3, height: 3 },
  'tree-short': { file: 'tree-short.png', width: 2.25, height: 2.25 },
  bush: { file: 'bush-round.png', width: 2.25, height: 2.25 },
  'flower-a': { file: 'flower-a.png', width: 1.5, height: 1.5 },
  'flower-b': { file: 'flower-b.png', width: 1.5, height: 1.5 },
  rock: { file: 'rock.png', width: 2.25, height: 2.25 },
  'grass-tuft': { file: 'grass-tuft.png', width: 1.5, height: 1.5 },
  sign: { file: 'sign.png', width: 1.5, height: 1.5 },
  'craftpix-fern': { file: 'craftpix-bushes/Fern1_1.png', width: 2.25, height: 2.25 },
  'craftpix-flowering-bush': {
    file: 'craftpix-bushes/Bush_red_flowers1.png',
    width: 2.25,
    height: 2.25,
  },
  'craftpix-autumn-bush': {
    file: 'craftpix-bushes/Autumn_bush1.png',
    width: 2.25,
    height: 2.25,
  },
  'cave-cache': {
    file: 'craftpix-dungeon/CaveSupplyCache.png',
    width: 4.2,
    height: 3.8,
  },
};

/** Slight lift so the base of the prop does not fight with the ground plane. */
const BASE_LIFT = 0.03;
const CAVE_WALL_HEIGHT = 2.8;

export class OverworldProps {
  readonly group = new THREE.Group();
  private sprites: THREE.Sprite[] = [];
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private disposed = false;

  constructor(private baseUrl: string) {}

  /** Loads every prop texture and spawns the billboards of the given area. */
  public load(map: MapId = 'villa_marionette'): void {
    const loader = new THREE.TextureLoader();
    const byKind = new Map<DecorationKind, PlacedDecoration[]>();
    for (const decor of getDecorations(map)) {
      const list = byKind.get(decor.kind);
      if (list) list.push(decor);
      else byKind.set(decor.kind, [decor]);
    }

    for (const [kind, placements] of byKind) {
      if (kind === 'cave-wall') {
        this.spawnCaveWalls(placements);
        continue;
      }
      const def = PROP_DEFS[kind];
      if (!def) continue;
      loader.load(`${this.baseUrl}/${def.file}`, (texture) => {
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        if (this.disposed) {
          texture.dispose();
          return;
        }
        this.spawn(kind, def, texture, placements);
      });
    }
  }

  private spawn(
    kind: DecorationKind,
    def: PropDefinition,
    texture: THREE.Texture,
    placements: PlacedDecoration[]
  ): void {
    // One shared material per kind: fewer GPU state switches than one
    // material per sprite (the map can have hundreds of billboards).
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.35,
      depthWrite: true,
      fog: true,
    });
    this.materials.push(material);
    this.textures.push(texture);
    const spriteProto = new THREE.Sprite(material);

    for (const placement of placements) {
      const sprite = spriteProto.clone();
      // The anchor is the bottom of the billboard: the prop stands on the ground.
      sprite.center.set(0.5, 0);
      sprite.scale.set(def.width, def.height, 1);
      sprite.position.set(placement.x, BASE_LIFT, placement.z);
      sprite.userData.kind = kind;
      this.group.add(sprite);
      this.sprites.push(sprite);
    }
  }

  private spawnCaveWalls(placements: PlacedDecoration[]): void {
    if (placements.length === 0) return;
    const geometry = new THREE.BoxGeometry(3, CAVE_WALL_HEIGHT, 3);
    const material = new THREE.MeshStandardMaterial({
      color: '#77727d',
      roughness: 1,
      flatShading: true,
    });
    const walls = new THREE.InstancedMesh(geometry, material, placements.length);
    const transform = new THREE.Object3D();

    placements.forEach((placement, index) => {
      transform.position.set(placement.x, CAVE_WALL_HEIGHT / 2, placement.z);
      transform.updateMatrix();
      walls.setMatrixAt(index, transform.matrix);
      const shade = 0.82 + ((index * 37) % 18) / 100;
      walls.setColorAt(index, new THREE.Color(shade, shade, shade));
    });
    walls.instanceMatrix.needsUpdate = true;
    walls.castShadow = true;
    walls.receiveShadow = true;
    this.group.add(walls);
    this.geometries.push(geometry);
    this.materials.push(material);
  }

  /** Removes every billboard (used when the scene is rebuilt). */
  public dispose(): void {
    this.disposed = true;
    this.group.clear();
    this.sprites.length = 0;
    for (const material of this.materials) {
      material.dispose();
    }
    this.materials.length = 0;
    for (const texture of this.textures) texture.dispose();
    this.textures.length = 0;
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries.length = 0;
  }
}
