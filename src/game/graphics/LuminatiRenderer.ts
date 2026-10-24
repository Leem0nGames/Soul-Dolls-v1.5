import * as THREE from 'three';
import { pixelGenerator } from './PixelArtGenerator';
import { ecs } from '../ecs/World';
import { gameStore, GameState } from '../state/useGameStore';
import { createSoulDoll } from '../data/souldolls';
import { MAP_IDS, MAP_NAMES, MAP_PALETTES, WORLD_MAPS } from '../data/maps';
import { MapId } from '../data/world';
import { sound } from '../audio/SoundEffects';
import { BattleVfxDirector } from './BattleVfxDirector';
import { battleVfx } from './BattleVfx';
import {
  buildOverworldMap,
  getMapWildZones,
  isBlocked,
} from './OverworldTiles';
import { OverworldProps } from './OverworldProps';
import { OverworldBuildings, VILLA_BUILDINGS, VillaBuilding } from './OverworldBuildings';
import { buildFacilityInterior, FacilityKind, INTERIOR_W, INTERIOR_D, INTERIOR_DOOR_LOCAL, INTERIOR_SERVICE_LOCAL } from './FacilityInterior';

export let activeRenderer: LuminatiRenderer | null = null;

type FacilityBuilding = VillaBuilding & { facility: FacilityKind };
const FACILITY_DOORS = VILLA_BUILDINGS.filter(
  (building): building is FacilityBuilding => building.facility !== undefined
);
const FACILITY_SIGN_STYLE: Record<FacilityKind, { label: string; color: string }> = {
  pokemon_center: { label: 'CENTRO SOUL', color: '#d85261' },
  poke_mart: { label: 'MERCADO', color: '#3b82f6' },
  research_lab: { label: 'LABORATORIO', color: '#64748b' },
  house: { label: 'HOGAR', color: '#b4643a' },
  gym: { label: 'DOJO', color: '#d97706' },
};
const NPC_ATLAS_FRAME = { tyler: 0, vesper: 1, merchant: 2, iris: 3, mother: 4 } as const;
const NPC_ATLAS_FRAME_COUNT = Object.keys(NPC_ATLAS_FRAME).length;

/**
 * Interiors live on a hidden rooftop platform (mirroring the battle arena
 * trick at Y = -50): the camera only reaches them when the player teleports in.
 */
const INTERIOR_Y = 80;
const MAP_CONNECTION_RADIUS = 1.4;
const MAP_CONNECTION_REARM_DISTANCE = 2.5;
const INTERIOR_ANCHORS: Record<FacilityKind, { x: number; z: number }> = {
  pokemon_center: { x: 0, z: 0 },
  poke_mart: { x: 20, z: 0 },
  research_lab: { x: -20, z: 0 },
  house: { x: 40, z: 0 },
  gym: { x: 60, z: 0 },
};

export class LuminatiRenderer {
  private container: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private clock: THREE.Clock = new THREE.Clock();
  private frameId = 0;
  private isDestroyed = false;
  private isSoftwareGl = false;

  // Scene Groups
  private worldGroup = new THREE.Group();
  private entitiesGroup = new THREE.Group();
  private battleGroup = new THREE.Group();
  private vfxGroup = new THREE.Group();
  private facilityGroup = new THREE.Group();
  private villaLanternsGroup = new THREE.Group();

  // Battle VFX
  private vfxDirector!: BattleVfxDirector;

  // References
  private playerSprite!: THREE.Sprite;
  private playerShadow!: THREE.Mesh;
  private npcTextures: THREE.Texture[] = [];
  private npcMaterials: THREE.SpriteMaterial[] = [];
  private npcBillboards: {
    frame: number;
    mapId: MapId;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
  }[] = [];
  private unsubscribePlayerSprite?: () => void;
  private unsubscribeSoulDollSprite?: () => void;
  private shrineCrystal!: THREE.Mesh;

  // Battle 3D Sprites
  private battlePlayerDollSprite!: THREE.Sprite;
  private battleOpponentDollSprite!: THREE.Sprite;
  private battleArenaPlatform!: THREE.Group;

  // Overworld
  private groundMaterial!: THREE.MeshLambertMaterial;
  private overworldPropsByMap = new Map<MapId, OverworldProps>();
  private overworldBuildings!: OverworldBuildings;
  private villaLanternGeometries: THREE.BufferGeometry[] = [];
  private villaLanternMaterials: THREE.Material[] = [];

  // Active village map, baked ground, and its landmarks.
  private bakedMapTextures = new Map<MapId, THREE.CanvasTexture>();
  private facilityDoorsGroup = new THREE.Group();
  private villaLandmarksGroup = new THREE.Group();

  // Phase 3: facility interior flow (visual only; input-gated by these flags)
  private activeInteriorKind: FacilityKind | null = null;
  private interiorReturnPos = { x: 0, y: 0.8, z: 0 };
  private mapTransitionLock: { map: MapId; x: number; z: number } | null = null;
  private wildEncounterRequiresGrassExit = false;

  private get activeMapId(): MapId {
    return gameStore.getState().activeMapId;
  }

  // Camera settings
  private targetCameraPos = new THREE.Vector3(0, 8, 11);
  private targetCameraLookAt = new THREE.Vector3(0, 0.8, 0);
  private currentCameraLookAt = new THREE.Vector3(0, 0.8, 0);

  // Input states
  public keys: Record<string, boolean> = {};

  // Touch gesture state for overworld camera panning
  private touchStartX = 0;
  private touchStartY = 0;
  private cameraPanOffset = new THREE.Vector3();
  private targetCameraPanOffset = new THREE.Vector3();

  private onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 1 && gameStore.getState().view === 'OVERWORLD') {
      const dx = e.touches[0].clientX - this.touchStartX;
      const dy = e.touches[0].clientY - this.touchStartY;
      this.targetCameraPanOffset.set(-dx * 0.025, 0, -dy * 0.025);
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    if (gameStore.getState().view === 'OVERWORLD') {
      const touch = e.changedTouches[0];
      if (touch) {
        const dx = touch.clientX - this.touchStartX;
        const dy = touch.clientY - this.touchStartY;
        const dist = Math.hypot(dx, dy);
        if (dist > 35) {
          sound.playSelect();
          if (Math.abs(dx) > Math.abs(dy)) {
            gameStore.showToast(dx > 0 ? '¡Inspección cósmica: Sector Este!' : '¡Inspección cósmica: Sector Oeste!');
          } else {
            gameStore.showToast(dy > 0 ? '¡Inspección cósmica: Sector Sur!' : '¡Inspección cósmica: Sector Norte!');
          }
        }
      }
    }
    this.targetCameraPanOffset.set(0, 0, 0);
  };

  constructor(container: HTMLElement) {
    activeRenderer = this;
    this.container = container;
    this.init();
  }

  private init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // Detect software WebGL safely
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();
    this.isSoftwareGl = isSoftwareGl;

    // 1. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    // 2. Scene & Fog Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#090d16');
    this.scene.fog = new THREE.FogExp2('#090d16', 0.035);

    // 3. Camera (Isometric 2.5D Angle with responsive mobile FOV)
    const isPortrait = width / height < 1.0;
    this.camera = new THREE.PerspectiveCamera(isPortrait ? 52 : 45, width / height, 0.1, 150);
    const initDist = isPortrait ? 1.7 : 1.15;
    this.camera.position.set(0, 10.5 * initDist, 13.5 * initDist);
    this.camera.lookAt(0, 0.8, 0);

    // 4. Lights Rig (3-point warm/cool balance)
    const hemiLight = new THREE.HemisphereLight('#93c5fd', '#1e293b', 0.85);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#fef08a', 1.4);
    sunLight.position.set(10, 16, 12);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 40;
    const d = 16;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);

    // Assemble Hierarchy
    this.scene.add(this.worldGroup);
    this.scene.add(this.entitiesGroup);
    this.scene.add(this.battleGroup);
    this.scene.add(this.facilityGroup);
    this.worldGroup.add(this.villaLanternsGroup);
    // NOTE: the VFX group is parented to the battle arena (see buildBattleArena)
    // so every effect is authored in arena local space (Y = -50 offset included).
    // The facility group hosts the 3D interiors reached through the village buildings.

    // Build World Geometry & Entities
    this.worldGroup.add(this.villaLandmarksGroup);
    this.worldGroup.add(this.facilityDoorsGroup);
    this.buildTerrain();
    this.buildSanctuaryShrine();
    this.buildBattleArena();
    this.initEcsEntities();
    this.buildOverworldBuildings();
    this.buildVillaLanterns();
    this.buildOverworldProps();
    this.buildFacilityInteriors();
    this.buildFacilityDoors();
    this.applyMapTint(this.activeMapId);
    this.loadOverworldMap(this.activeMapId);

    // Battle visual effects (driven by this renderer's own tick)
    this.vfxDirector = new BattleVfxDirector(
      this.vfxGroup,
      this.battlePlayerDollSprite,
      this.battleOpponentDollSprite,
      this.isSoftwareGl
    );
    battleVfx.registerSink(this.vfxDirector);

    // Resize listener & Touch gesture listeners on canvas
    window.addEventListener('resize', this.onResize);
    const dom = this.renderer.domElement;
    dom.addEventListener('touchstart', this.onTouchStart, { passive: true });
    dom.addEventListener('touchmove', this.onTouchMove, { passive: true });
    dom.addEventListener('touchend', this.onTouchEnd, { passive: true });

    // Animation Loop
    this.tick();
  }

  /**
   * Builds the overworld ground plane. The pixel art map (tiles, transitions
   * and decorations) is baked asynchronously and applied as its texture.
   */
  private buildTerrain() {
    this.groundMaterial = new THREE.MeshLambertMaterial({ color: '#166534' });
    const terrain = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), this.groundMaterial);
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    this.worldGroup.add(terrain);
  }

  /**
   * Mounts a 3D facility interior into the overworld scene. Phase 2 of the
   * Pokémon Red style map engine: 3D interiors (Pokémon Center for now) with
   * toon shading + pixel-art palette. Visual layer only; gameplay logic is
   * untouched.
   */
  public mountFacilityInterior(kind: FacilityKind, position: { x: number; y: number; z: number }) {
    this.facilityGroup.clear();
    const interior = buildFacilityInterior(kind);
    interior.position.set(position.x, position.y, position.z);
    this.facilityGroup.add(interior);
  }

  /**
   * Mounts every facility interior onto its rooftop anchor (see INTERIOR_ANCHORS).
   * Phase 3: one room per building, reachable through its exterior door.
   */
  private buildFacilityInteriors() {
    (Object.keys(INTERIOR_ANCHORS) as FacilityKind[]).forEach((kind) => {
      const interior = buildFacilityInterior(kind);
      interior.position.set(INTERIOR_ANCHORS[kind].x, INTERIOR_Y, INTERIOR_ANCHORS[kind].z);
      this.facilityGroup.add(interior);
    });
  }

  /** Textured wayfinding signs above the doors of the enterable buildings. */
  private buildFacilityDoors() {
    FACILITY_DOORS.forEach((def) => {
      const style = FACILITY_SIGN_STYLE[def.facility];
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo crear el rótulo de un edificio');
      context.fillStyle = '#18212a';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = style.color;
      context.lineWidth = 8;
      context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
      context.fillStyle = '#fff8e7';
      context.font = 'bold 25px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(style.label, canvas.width / 2, canvas.height / 2);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sign = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
      );
      sign.scale.set(3.2, 0.8, 1);
      sign.position.set(def.entrance.x, 5.1, def.entrance.z);
      this.facilityDoorsGroup.add(sign);
    });
  }

  /**
   * Teleports the player into a facility interior. Pure visual flow: the
   * position swap is the entrance mechanic (no battle/ECS logic touched).
   */
  private enterInterior(kind: FacilityKind) {
    const playerEntity = ecs.getPlayerEntity();
    if (!playerEntity || this.activeInteriorKind) return;
    const pos = ecs.positions.get(playerEntity)!;
    const ctl = ecs.playerControls.get(playerEntity)!;

    this.interiorReturnPos = { x: pos.x, y: pos.y, z: pos.z };
    const anchor = INTERIOR_ANCHORS[kind];
    pos.x = anchor.x + INTERIOR_DOOR_LOCAL.x;
    pos.z = anchor.z - INTERIOR_D / 2 + 1.55;
    pos.y = INTERIOR_Y + 0.8;
    ctl.facing = 'up';
    ctl.isMoving = false;
    this.activeInteriorKind = kind;
    sound.playSelect();
    gameStore.wipeScreen('ENTRANDO...');
  }

  /** Returns the player to the overworld position they entered from. */
  private exitInterior() {
    const playerEntity = ecs.getPlayerEntity();
    if (!playerEntity || !this.activeInteriorKind) return;
    const pos = ecs.positions.get(playerEntity)!;
    const ctl = ecs.playerControls.get(playerEntity)!;

    pos.x = this.interiorReturnPos.x;
    pos.y = 0.8;
    pos.z = this.interiorReturnPos.z;
    ctl.facing = 'up';
    ctl.isMoving = false;
    this.activeInteriorKind = null;
    sound.playSelect();
    gameStore.wipeScreen('SALIENDO...');
  }

  /** Service interaction inside each interior (dialogue + existing store actions). */
  private runInteriorService(kind: FacilityKind) {
    switch (kind) {
      case 'pokemon_center':
        gameStore.setDialogue(
          'Enfermera de Almas',
          '¡Bienvenido al Centro Soul! Restauraré la vitalidad de tus SoulDolls con la energía del cristal.',
          () => gameStore.healParty()
        );
        break;
      case 'poke_mart': {
        const shops = ecs.getShops();
        if (shops.length > 0) {
          gameStore.setDialogue('Dependiente', '¡Bienvenido al Mercado Soul! Esta semana hay objetos nuevos para tamers.', () => {
            gameStore.setState({ activeShopId: shops[0] });
            gameStore.setView('SHOP');
          });
        } else {
          gameStore.showToast('El mercado está cerrado por hoy.');
        }
        break;
      }
      case 'research_lab':
        if (!gameStore.getState().selectedStarterId) {
          gameStore.setDialogue(
            'Investigadora Iris',
            '¡Llegas justo a tiempo! Estos SoulDolls buscan un compañero. Elige aquí a quien te acompañará en tu aventura.',
            () => gameStore.setIntroStep('starter_choice')
          );
        } else {
          gameStore.setDialogue(
            'Investigadora Iris',
            'Aquí estudiamos la evolución de las almas... Si tu SoulDoll madura con fuertes vínculos, regresará transformado a tu equipo.'
          );
        }
        break;
      case 'gym':
        if (gameStore.getState().defeatedTrainerIds.has('villa_marionette:gym_fenix')) {
          gameStore.setDialogue('Líder Fénix', 'Tu equipo ya ha demostrado su fuerza. ¡Sigue explorando, Domador!');
        } else {
          const opponent = createSoulDoll('drakonika', 18);
          gameStore.setDialogue(
            'Líder Fénix',
            '¡Soy Fénix, guardián de la llama viva! Escucha tu alma, Domador... ¡Demuestra el vínculo con tus SoulDolls!',
            () => {
              gameStore.startBattle(opponent, true, 'Fénix', {
                party: [opponent],
                id: 'villa_marionette:gym_fenix',
              });
            }
          );
        }
        break;
      case 'house':
        if (gameStore.getState().playerParty.length > 0) {
          gameStore.setDialogue(
            'Mamá',
            'Me alegra que hayas vuelto. Descansa un poco; tus SoulDolls se ven con más energía.',
            () => gameStore.healParty()
          );
        } else {
          gameStore.setDialogue('Mamá', 'Ve al laboratorio de Villa Marionette. La investigadora Iris te está esperando.');
        }
        break;
    }
  }

  private buildOverworldProps() {
    this.ensureOverworldProps(this.activeMapId);
  }

  private ensureOverworldProps(map: MapId) {
    let props = this.overworldPropsByMap.get(map);
    if (!props) {
      props = new OverworldProps(`${import.meta.env?.BASE_URL ?? '/'}assets/props`);
      props.load(map);
      props.group.visible = map === this.activeMapId;
      this.worldGroup.add(props.group);
      this.overworldPropsByMap.set(map, props);
    }
    return props;
  }

  private buildOverworldBuildings() {
    this.overworldBuildings = new OverworldBuildings();
    this.worldGroup.add(this.overworldBuildings.group);
    const baseUrl = `${import.meta.env?.BASE_URL ?? '/'}assets/buildings`;
    void this.overworldBuildings.load(baseUrl).catch((error) => {
      console.error('[Villa Marionette] No se pudieron cargar los edificios 3D:', error);
    });
  }

  private buildVillaLanterns() {
    const lanternCore = new THREE.SphereGeometry(0.16, 8, 6);
    const lanternFrame = new THREE.CylinderGeometry(0.19, 0.24, 0.32, 8);
    const glowMaterial = new THREE.MeshBasicMaterial({ color: '#ffd18a' });
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: '#50351f',
      metalness: 0.55,
      roughness: 0.45,
    });
    this.villaLanternGeometries.push(lanternCore, lanternFrame);
    this.villaLanternMaterials.push(glowMaterial, frameMaterial);

    for (const building of VILLA_BUILDINGS) {
      const side = building.x < 0 ? 1 : -1;
      const x = building.entrance.x + side * (building.halfWidth - 0.25);
      const z = building.z + building.halfDepth * 0.65;
      const fixture = new THREE.Group();
      fixture.position.set(x, 3.5, z);

      const frame = new THREE.Mesh(lanternFrame, frameMaterial);
      const core = new THREE.Mesh(lanternCore, glowMaterial);
      core.position.y = -0.02;
      fixture.add(frame, core);
      fixture.add(new THREE.PointLight('#ffbd72', 4.2, 10, 2));
      this.villaLanternsGroup.add(fixture);
    }
  }

  private addNpcBillboard(
    frame: number,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    mapId: MapId = 'villa_marionette'
  ): void {
    this.npcBillboards.push({ frame, mapId, x, y, z, width, height });
  }

  private loadNpcBillboards(): void {
    const url = `${import.meta.env?.BASE_URL ?? '/'}assets/npcs/npc-atlas.png`;
    const atlas = new THREE.TextureLoader().load(
      url,
      (loadedAtlas) => {
        if (this.isDestroyed) return;
        loadedAtlas.magFilter = THREE.NearestFilter;
        loadedAtlas.minFilter = THREE.NearestFilter;
        loadedAtlas.generateMipmaps = false;
        loadedAtlas.colorSpace = THREE.SRGBColorSpace;

        for (const placement of this.npcBillboards) {
          const texture = loadedAtlas.clone();
          texture.repeat.set(1 / NPC_ATLAS_FRAME_COUNT, 1);
          texture.offset.set(placement.frame / NPC_ATLAS_FRAME_COUNT, 0);
          texture.needsUpdate = true;
          this.npcTextures.push(texture);

          const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1,
            depthWrite: true,
            fog: true,
          });
          this.npcMaterials.push(material);
          const sprite = new THREE.Sprite(material);
          sprite.center.set(0.5, 0);
          sprite.scale.set(placement.width, placement.height, 1);
          sprite.position.set(placement.x, placement.y, placement.z);
          sprite.userData.mapId = placement.mapId;
          sprite.visible = placement.mapId === this.activeMapId;
          this.entitiesGroup.add(sprite);
        }
      },
      undefined,
      (error) => console.error(`[NPC] No se pudo cargar el atlas ${url}:`, error)
    );
    this.npcTextures.push(atlas);
  }

  /**
   * Bakes the active tilemap and applies it to the ground while the rest of the
   * world initializes. Baked textures are cached by map id.
   */
  private async loadOverworldMap(map: MapId): Promise<void> {
    try {
      let texture = this.bakedMapTextures.get(map);
      if (!texture) {
        const baked = await buildOverworldMap(map);
        if (this.isDestroyed) {
          baked.texture.dispose();
          return;
        }
        texture = baked.texture;
        this.bakedMapTextures.set(map, texture);
      }
      if (map !== this.activeMapId || this.isDestroyed) return;
      this.groundMaterial.map = texture;
      this.groundMaterial.color.set('#ffffff');
      this.groundMaterial.needsUpdate = true;
    } catch (error) {
      // Keep the flat green ground if the tiles cannot be loaded.
      console.warn('[Luminati] No se pudo cargar el mapa de tiles:', error);
    }
  }

  /** Applies the scene tint of an area (background + fog). */
  private applyMapTint(map: MapId) {
    const tint = MAP_PALETTES[map];
    this.scene.background = new THREE.Color(tint.background);
    this.scene.fog = new THREE.FogExp2(tint.fog, tint.fogDensity ?? 0.035);
  }

  private transitionMap(
    map: MapId,
    arrival: { x: number; z: number },
    facing: 'down' | 'up' | 'left' | 'right'
  ) {
    const playerEntity = ecs.getPlayerEntity();
    if (!playerEntity) throw new Error('No se puede cambiar de mapa sin jugador');
    const pos = ecs.positions.get(playerEntity)!;
    const controls = ecs.playerControls.get(playerEntity)!;

    this.mapTransitionLock = { map, x: arrival.x, z: arrival.z };
    gameStore.setState({ activeMapId: map, playerPosition: { x: arrival.x, y: 0.8, z: arrival.z } });
    pos.x = arrival.x;
    pos.y = 0.8;
    pos.z = arrival.z;
    controls.facing = facing;
    controls.isMoving = false;
    controls.stepDistanceAccumulator = 0;

    this.villaLandmarksGroup.visible = map === 'villa_marionette';
    this.facilityDoorsGroup.visible = map === 'villa_marionette';
    this.overworldBuildings.group.visible = map === 'villa_marionette';
    this.villaLanternsGroup.visible = map === 'villa_marionette';
    for (const [mapId, props] of this.overworldPropsByMap) {
      props.group.visible = mapId === map;
    }
    this.ensureOverworldProps(map).group.visible = true;
    this.entitiesGroup.children.forEach((child) => {
      if (child.userData.mapId) child.visible = child.userData.mapId === map;
    });

    this.applyMapTint(map);
    void this.loadOverworldMap(map);
    gameStore.wipeScreen(MAP_NAMES[map].toLocaleUpperCase('es'));
  }

  public retreatToSanctuary(): void {
    const center = FACILITY_DOORS.find((building) => building.facility === 'pokemon_center');
    if (!center) throw new Error('Villa Marionette no tiene un Centro Soul para el retorno');
    this.transitionMap('villa_marionette', center.entrance, 'down');
  }

  private tryMapTransition(pos: { x: number; z: number }): boolean {
    if (this.mapTransitionLock) {
      const lock = this.mapTransitionLock;
      if (
        lock.map === this.activeMapId &&
        Math.hypot(pos.x - lock.x, pos.z - lock.z) < MAP_CONNECTION_REARM_DISTANCE
      ) {
        return false;
      }
      this.mapTransitionLock = null;
    }

    const connection = WORLD_MAPS[this.activeMapId].connections.find(
      (candidate) => Math.hypot(pos.x - candidate.at.x, pos.z - candidate.at.z) < MAP_CONNECTION_RADIUS
    );
    if (!connection) return false;
    this.transitionMap(connection.toMap, connection.arrival, connection.facing);
    return true;
  }

  /**
   * Builds the 3D Sanctuary Shrine (Composite 3-12 part procedural model)
   */
  private buildSanctuaryShrine() {
    const shrine = new THREE.Group();
    shrine.position.set(0, 0, 0);
    // Scaled to the tile size of the new overworld (1 tile = 1.5 world units).
    shrine.scale.setScalar(1.35);

    // 1. Stepped Stone Pedestal
    const step1 = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.8, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.75 })
    );
    step1.position.y = 0.2;
    step1.receiveShadow = true;
    step1.castShadow = true;
    shrine.add(step1);

    const step2 = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 2.0, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.7 })
    );
    step2.position.y = 0.55;
    step2.receiveShadow = true;
    step2.castShadow = true;
    shrine.add(step2);

    // 2. Four Ancient Rune Pillars
    const pillarMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.6 });
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const px = Math.cos(ang) * 1.6;
      const pz = Math.sin(ang) * 1.6;

      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.25, 2.2, 6),
        pillarMat
      );
      pillar.position.set(px, 1.6, pz);
      pillar.castShadow = true;
      shrine.add(pillar);

      // Glowing blue gemstone on top of each pillar
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.18),
        new THREE.MeshStandardMaterial({
          color: '#38bdf8',
          emissive: '#0284c7',
          emissiveIntensity: 1.5,
          roughness: 0.2,
        })
      );
      gem.position.set(px, 2.8, pz);
      shrine.add(gem);
    }

    // 3. Central Rotating Floating Animus Crystal (Healing Soul Core)
    const crystalGeo = new THREE.OctahedronGeometry(0.7, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: '#a855f7',
      emissive: '#7e22ce',
      emissiveIntensity: 2.0,
      roughness: 0.1,
      metalness: 0.8,
    });
    this.shrineCrystal = new THREE.Mesh(crystalGeo, crystalMat);
    this.shrineCrystal.position.set(0, 1.8, 0);
    this.shrineCrystal.castShadow = true;
    shrine.add(this.shrineCrystal);

    // Glowing point light from shrine
    const crystalLight = new THREE.PointLight('#c084fc', 2.0, 8);
    crystalLight.position.set(0, 2.0, 0);
    shrine.add(crystalLight);

    this.villaLandmarksGroup.add(shrine);
  }

  /**
   * Builds the 3D Turn-Based Battle Arena
   */
  private buildBattleArena() {
    this.battleArenaPlatform = new THREE.Group();
    this.battleArenaPlatform.position.set(0, -50, 0); // Placed safely out of overworld view

    // Raised Circular Stadium with Dark Ink Stone & Antique Bronze Rim
    const stadium = new THREE.Mesh(
      new THREE.CylinderGeometry(8.5, 9.2, 0.8, 36),
      new THREE.MeshStandardMaterial({ color: '#14101c', roughness: 0.8, metalness: 0.2 })
    );
    stadium.position.y = -0.4;
    stadium.receiveShadow = true;
    this.battleArenaPlatform.add(stadium);

    // Antique Bronze & Gold Outer Ring Rim
    const bronzeRim = new THREE.Mesh(
      new THREE.RingGeometry(8.0, 8.5, 36),
      new THREE.MeshStandardMaterial({
        color: '#8a6a3b',
        emissive: '#59401f',
        emissiveIntensity: 0.35,
        roughness: 0.4,
        metalness: 0.7,
        side: THREE.DoubleSide
      })
    );
    bronzeRim.rotation.x = -Math.PI / 2;
    bronzeRim.position.y = 0.015;
    this.battleArenaPlatform.add(bronzeRim);

    // Outer Soul-Violet Rune Ring
    const violetRuneRing = new THREE.Mesh(
      new THREE.RingGeometry(6.6, 7.6, 36),
      new THREE.MeshStandardMaterial({
        color: '#9b6bff',
        emissive: '#7e22ce',
        emissiveIntensity: 1.1,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
      })
    );
    violetRuneRing.rotation.x = -Math.PI / 2;
    violetRuneRing.position.y = 0.02;
    this.battleArenaPlatform.add(violetRuneRing);

    // Inner Concentric Turquoise Ki Ring
    const kiInnerRing = new THREE.Mesh(
      new THREE.RingGeometry(5.2, 5.6, 36),
      new THREE.MeshStandardMaterial({
        color: '#5fe3d2',
        emissive: '#0d9488',
        emissiveIntensity: 0.85,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide
      })
    );
    kiInnerRing.rotation.x = -Math.PI / 2;
    kiInnerRing.position.y = 0.022;
    this.battleArenaPlatform.add(kiInnerRing);

    // Central Duel Separation Circle (astral boundary between combatants)
    const duelDividerRing = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 2.7, 24),
      new THREE.MeshStandardMaterial({
        color: '#8a6a3b',
        emissive: '#e8b84a',
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
      })
    );
    duelDividerRing.rotation.x = -Math.PI / 2;
    duelDividerRing.position.y = 0.025;
    this.battleArenaPlatform.add(duelDividerRing);

    // Central Astral 8-Point Compass Star Disc
    const centerStarDisc = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 1.8, 8),
      new THREE.MeshStandardMaterial({
        color: '#9b6bff',
        emissive: '#7e22ce',
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
      })
    );
    centerStarDisc.rotation.x = -Math.PI / 2;
    centerStarDisc.rotation.z = Math.PI / 8;
    centerStarDisc.position.y = 0.024;
    this.battleArenaPlatform.add(centerStarDisc);

    // --- PLAYER GLYPH (Left foreground: Concentric Stepped Cyan / Ki Rings) ---
    const playerDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 32),
      new THREE.MeshBasicMaterial({
        color: '#5fe3d2',
        transparent: true,
        opacity: 0.8,
      })
    );
    playerDisc.rotation.x = -Math.PI / 2;
    playerDisc.position.set(-2.8, 0.028, 1.4);
    this.battleArenaPlatform.add(playerDisc);

    const playerMidRing = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1.1, 32),
      new THREE.MeshBasicMaterial({
        color: '#00f0ff',
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
      })
    );
    playerMidRing.rotation.x = -Math.PI / 2;
    playerMidRing.position.set(-2.8, 0.029, 1.4);
    this.battleArenaPlatform.add(playerMidRing);

    const playerOuterRing = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 1.7, 32),
      new THREE.MeshBasicMaterial({
        color: '#5fe3d2',
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      })
    );
    playerOuterRing.rotation.x = -Math.PI / 2;
    playerOuterRing.position.set(-2.8, 0.03, 1.4);
    this.battleArenaPlatform.add(playerOuterRing);

    // Elliptical contact shadow under Player Doll
    const playerDollShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.75, 24),
      new THREE.MeshBasicMaterial({
        color: '#000000',
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      })
    );
    playerDollShadow.rotation.x = -Math.PI / 2;
    playerDollShadow.scale.set(1.3, 0.7, 1);
    playerDollShadow.position.set(-2.85, 0.032, 1.4);
    this.battleArenaPlatform.add(playerDollShadow);

    // --- OPPONENT GLYPH (Right background: Concentric Stepped Crimson / Rift Rings) ---
    const oppDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 32),
      new THREE.MeshBasicMaterial({
        color: '#c2234b',
        transparent: true,
        opacity: 0.8,
      })
    );
    oppDisc.rotation.x = -Math.PI / 2;
    oppDisc.position.set(2.8, 0.028, -1.4);
    this.battleArenaPlatform.add(oppDisc);

    const oppMidRing = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1.1, 32),
      new THREE.MeshBasicMaterial({
        color: '#e11d48',
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
      })
    );
    oppMidRing.rotation.x = -Math.PI / 2;
    oppMidRing.position.set(2.8, 0.029, -1.4);
    this.battleArenaPlatform.add(oppMidRing);

    const oppOuterRing = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 1.7, 32),
      new THREE.MeshBasicMaterial({
        color: '#ff2d55',
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      })
    );
    oppOuterRing.rotation.x = -Math.PI / 2;
    oppOuterRing.position.set(2.8, 0.03, -1.4);
    this.battleArenaPlatform.add(oppOuterRing);

    // Elliptical contact shadow under Opponent Doll
    const oppDollShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.75, 24),
      new THREE.MeshBasicMaterial({
        color: '#000000',
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      })
    );
    oppDollShadow.rotation.x = -Math.PI / 2;
    oppDollShadow.scale.set(1.3, 0.7, 1);
    oppDollShadow.position.set(2.75, 0.032, -1.4);
    this.battleArenaPlatform.add(oppDollShadow);

    // Player Doll Billboard Sprite (Back view)
    const pMat = new THREE.SpriteMaterial({
      map: pixelGenerator.getSoulDollTexture('ignisaur', true),
      transparent: true,
    });
    this.battlePlayerDollSprite = new THREE.Sprite(pMat);
    this.battlePlayerDollSprite.center.set(0.5, 0.0);
    const pAspect = pixelGenerator.getSoulDollAspect('ignisaur', true);
    const baseH = 5.18;
    this.battlePlayerDollSprite.scale.set(baseH * pAspect, baseH, 1);
    this.battlePlayerDollSprite.position.set(-2.8, 0.05, 1.4);
    this.battleArenaPlatform.add(this.battlePlayerDollSprite);

    // Opponent Doll Billboard Sprite (Front view)
    const oMat = new THREE.SpriteMaterial({
      map: pixelGenerator.getSoulDollTexture('aquafox', false),
      transparent: true,
    });
    this.battleOpponentDollSprite = new THREE.Sprite(oMat);
    this.battleOpponentDollSprite.center.set(0.5, 0.0);
    const oAspect = pixelGenerator.getSoulDollAspect('aquafox', false);
    this.battleOpponentDollSprite.scale.set(baseH * oAspect, baseH, 1);
    this.battleOpponentDollSprite.position.set(2.8, 0.05, -1.4);
    this.battleArenaPlatform.add(this.battleOpponentDollSprite);

    // Spotlight in Arena
    const arenaLight = new THREE.PointLight('#a5b4fc', 2.5, 20);
    arenaLight.position.set(0, 8, 0);
    this.battleArenaPlatform.add(arenaLight);

    // Battle VFX live inside the arena group so they share its transform
    // (the arena is offset to Y = -50) and the sprites' local space.
    this.battleArenaPlatform.add(this.vfxGroup);

    this.battleGroup.add(this.battleArenaPlatform);
  }

  /**
   * Initializes ECS entities for Player, NPC Tamers, and Wild Zones
   */
  private initEcsEntities() {
    ecs.clear();

    // 1. Player Entity
    const homeBuilding = FACILITY_DOORS.find((building) => building.facility === 'house');
    if (!homeBuilding) throw new Error('Villa Marionette no tiene una casa inicial');
    const homeAnchor = INTERIOR_ANCHORS.house;
    const playerStart = {
      x: homeAnchor.x + INTERIOR_DOOR_LOCAL.x,
      y: INTERIOR_Y + 0.8,
      z: homeAnchor.z - INTERIOR_D / 2 + 1.55,
    };
    this.activeInteriorKind = 'house';
    this.interiorReturnPos = { x: homeBuilding.entrance.x, y: 0.8, z: homeBuilding.entrance.z };

    const playerEntity = ecs.createEntity();
    ecs.positions.set(playerEntity, { ...playerStart });
    ecs.velocities.set(playerEntity, { vx: 0, vy: 0, vz: 0 });
    ecs.playerControls.set(playerEntity, {
      speed: 4.8,
      isMoving: false,
      facing: 'up',
      isSprinting: false,
      stepDistanceAccumulator: 0,
    });

    const playerTex = pixelGenerator.getPlayerTexture('down', 0);
    const playerMat = new THREE.SpriteMaterial({ map: playerTex, transparent: true });
    this.playerSprite = new THREE.Sprite(playerMat);
    this.playerSprite.scale.set(3.6, 3.6, 1);
    this.playerSprite.position.set(playerStart.x, playerStart.y + 1.0, playerStart.z);
    this.entitiesGroup.add(this.playerSprite);

    // Dynamic ground contact shadow disc for the player
    const shadowGeo = new THREE.CircleGeometry(0.42, 16);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: '#000000',
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    this.playerShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.playerShadow.position.set(playerStart.x, playerStart.y - 0.78, playerStart.z);
    this.worldGroup.add(this.playerShadow);

    // Listen for spritesheet ready event to refresh texture immediately
    this.unsubscribePlayerSprite = pixelGenerator.onPlayerSpritesheetLoaded(() => {
      if (this.playerSprite) {
        this.playerSprite.material.map = pixelGenerator.getPlayerTexture('down', 0);
        this.playerSprite.material.needsUpdate = true;
      }
    });

    // Listen for SoulDoll placeholder spritesheet load to refresh combat doll textures
    this.unsubscribeSoulDollSprite = pixelGenerator.onSoulDollSpritesheetLoaded(() => {
      const state = gameStore.getState();
      const battle = state.battleState;
      const baseH = 5.18;
      if (this.battlePlayerDollSprite && this.battleOpponentDollSprite) {
        const activePlayerDoll = battle ? state.playerParty[battle.playerActiveIndex] : state.playerParty[0];
        if (activePlayerDoll) {
          this.battlePlayerDollSprite.material.map = pixelGenerator.getSoulDollTexture(
            activePlayerDoll.speciesId,
            true
          );
          this.battlePlayerDollSprite.material.needsUpdate = true;
          const pAspect = pixelGenerator.getSoulDollAspect(activePlayerDoll.speciesId, true);
          this.battlePlayerDollSprite.scale.set(baseH * pAspect, baseH, 1);
        }
        const oppSpecies = battle?.opponentDoll ? battle.opponentDoll.speciesId : 'cryopup';
        this.battleOpponentDollSprite.material.map = pixelGenerator.getSoulDollTexture(
          oppSpecies,
          false
        );
        this.battleOpponentDollSprite.material.needsUpdate = true;
        const oAspect = pixelGenerator.getSoulDollAspect(oppSpecies, false);
        this.battleOpponentDollSprite.scale.set(baseH * oAspect, baseH, 1);
      }
    });

    ecs.sprites.set(playerEntity, {
      sprite: this.playerSprite,
      baseScale: 3.6,
      facing: 'down',
      animTimer: 0,
      stepFrame: 0,
      bobOffset: 0,
      flashTimer: 0,
    });

    // 2. Map-authored tamers and encounter areas.
    for (const mapId of MAP_IDS) {
      for (const def of WORLD_MAPS[mapId].tamers) {
        const position = { x: def.position.x, y: 0.8, z: def.position.z };
        const entity = ecs.createEntity();
        ecs.positions.set(entity, position);
        ecs.tamers.set(entity, {
          mapId,
          name: def.name,
          title: def.title,
          tamerType: def.tamerType,
          defeated: gameStore.getState().defeatedTrainerIds.has(`${mapId}:${def.name}`),
          party: def.party.map(({ speciesId, level }) => createSoulDoll(speciesId, level)),
          dialogueIntro: def.dialogueIntro,
          dialogueDefeated: def.dialogueDefeated,
          triggerDistance: def.triggerDistance,
        });
        this.addNpcBillboard(
          NPC_ATLAS_FRAME[def.portrait],
          position.x,
          0.02,
          position.z,
          3,
          4,
          mapId
        );
      }
    }

    // Wild encounters are authored alongside each tilemap definition.
    for (const mapId of MAP_IDS) {
      for (const zone of getMapWildZones(mapId)) {
        const wildZone = ecs.createEntity();
        ecs.wildZones.set(wildZone, { mapId, ...zone });
      }
    }

    // 3. Shrine Interactor
    const shrineEntity = ecs.createEntity();
    ecs.positions.set(shrineEntity, { x: 0, y: 0.8, z: 0 });
    ecs.shrines.set(shrineEntity, {
      type: 'heal',
      name: 'Santuario de las Almas',
      prompt: 'Toca el cristal para restaurar la salud y energía de tus SoulDolls.'
    });

    // 4. Shop NPC
    const shopEntity = ecs.createEntity();
    ecs.positions.set(shopEntity, { x: 18, y: 0.8, z: -7 });
    ecs.shops.set(shopEntity, {
      name: 'Tienda de Objetos',
      items: [
        { id: 'animus_vial', price: 100 },
        { id: 'evolution_prism', price: 500 },
        { id: 'anima_candy', price: 750 },
      ]
    });

    this.addNpcBillboard(NPC_ATLAS_FRAME.merchant, 18, 0.02, -7, 3, 4);

    const labService = INTERIOR_SERVICE_LOCAL.research_lab;
    this.addNpcBillboard(
      NPC_ATLAS_FRAME.iris,
      INTERIOR_ANCHORS.research_lab.x + labService.x,
      INTERIOR_Y + 0.02,
      INTERIOR_ANCHORS.research_lab.z - 3.1,
      2.7,
      3.6
    );
    const homeService = INTERIOR_SERVICE_LOCAL.house;
    this.addNpcBillboard(
      NPC_ATLAS_FRAME.mother,
      INTERIOR_ANCHORS.house.x + homeService.x,
      INTERIOR_Y + 0.02,
      INTERIOR_ANCHORS.house.z,
      2.7,
      3.6
    );
    this.loadNpcBillboards();
  }

  /**
   * Main game tick
   */
  private tick = () => {
    if (this.isDestroyed) return;
    this.frameId = requestAnimationFrame(this.tick);

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const state = gameStore.getState();

    // Rotate healing crystal at shrine
    if (this.shrineCrystal) {
      this.shrineCrystal.rotation.y += delta * 1.2;
      this.shrineCrystal.rotation.x = Math.sin(this.clock.getElapsedTime() * 1.5) * 0.2;
      this.shrineCrystal.position.y = 1.8 + Math.sin(this.clock.getElapsedTime() * 2) * 0.12;
    }

    const time = this.clock.getElapsedTime();

    if (state.view === 'BATTLE') {
      this.updateBattleScene(delta, state);
    } else {
      // Leaving the battle: drop every running effect.
      this.vfxDirector.clear();
      this.updateOverworld(delta, state);
    }

    // Battle VFX share this tick (no extra animation loop).
    this.vfxDirector.update(delta);

    this.renderer.render(this.scene, this.camera);
  };

  /**
   * Overworld Movement & System Updates
   */
  private updateOverworld(delta: number, state: GameState) {
    // Only update movement if no modal or dialogue is open
    const canMove = state.view === 'OVERWORLD' && !state.activeDialogue;

    const playerEntity = ecs.getPlayerEntity();
    if (playerEntity && !canMove) {
      const controls = ecs.playerControls.get(playerEntity);
      if (controls) controls.stepDistanceAccumulator = 0;
      for (const key of [
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'KeyW', 'KeyA', 'KeyS', 'KeyD',
        'ShiftLeft', 'ShiftRight', 'KeyB',
      ]) {
        this.keys[key] = false;
      }
    }

    if (playerEntity && canMove) {
      const pos = ecs.positions.get(playerEntity)!;
      const ctl = ecs.playerControls.get(playerEntity)!;
      const spr = ecs.sprites.get(playerEntity)!;

      // Handle keyboard input
      let dx = 0;
      let dz = 0;

      if (this.keys['ArrowUp'] || this.keys['KeyW']) dz -= 1;
      if (this.keys['ArrowDown'] || this.keys['KeyS']) dz += 1;
      if (this.keys['ArrowLeft'] || this.keys['KeyA']) dx -= 1;
      if (this.keys['ArrowRight'] || this.keys['KeyD']) dx += 1;

      const isSprinting = this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['KeyB'];
      const currentSpeed = (isSprinting ? ctl.speed * 1.6 : ctl.speed) * delta;

      if (dx !== 0 && dz !== 0) {
        dx *= 0.7071;
        dz *= 0.7071;
      }

      const isMoving = dx !== 0 || dz !== 0;
      ctl.isMoving = isMoving;

      if (isMoving) {
        // Update facing
        if (Math.abs(dz) >= Math.abs(dx)) {
          ctl.facing = dz > 0 ? 'down' : 'up';
        } else {
          ctl.facing = dx > 0 ? 'right' : 'left';
        }

        if (this.activeInteriorKind) {
          // Interior rooms: free navigation clamped to the room box
          // (no tilemap collision and no wild/tamers triggers up here).
          const anchor = INTERIOR_ANCHORS[this.activeInteriorKind];
          pos.x = THREE.MathUtils.clamp(
            pos.x + dx * currentSpeed,
            anchor.x - INTERIOR_W / 2 + 1.5,
            anchor.x + INTERIOR_W / 2 - 1.5
          );
          pos.z = THREE.MathUtils.clamp(
            pos.z + dz * currentSpeed,
            anchor.z - INTERIOR_D / 2 + 1.2,
            anchor.z + INTERIOR_D / 2 - 1.2
          );
        } else {
          // Apply movement with bounds clamping and solid map props (slide).
          const nextX = THREE.MathUtils.clamp(pos.x + dx * currentSpeed, -26.8, 26.8);
          const nextZ = THREE.MathUtils.clamp(pos.z + dz * currentSpeed, -26.8, 26.8);
          if (!isBlocked(nextX, nextZ, this.activeMapId)) {
            pos.x = nextX;
            pos.z = nextZ;
          } else {
            if (!isBlocked(nextX, pos.z, this.activeMapId)) pos.x = nextX;
            if (!isBlocked(pos.x, nextZ, this.activeMapId)) pos.z = nextZ;
          }

          const transitioned = this.tryMapTransition(pos);
          this.updateWildEncounterRearm(pos.x, pos.z);
          if (!transitioned) {
            // Step accumulator for wild encounters in spirit grass
            ctl.stepDistanceAccumulator += Math.hypot(dx * currentSpeed, dz * currentSpeed);
            if (ctl.stepDistanceAccumulator > 1.2) {
              ctl.stepDistanceAccumulator = 0;
              this.checkWildGrassEncounter(pos.x, pos.z);
            }

            this.checkTamerTriggers(pos.x, pos.z);
          }

        }

        // Update sprite position & 6-frame walk animation from spritesheet
        spr.animTimer += delta * (isSprinting ? 15 : 10);
        spr.stepFrame = Math.floor(spr.animTimer) % 6;
        spr.sprite.material.map = pixelGenerator.getPlayerTexture(ctl.facing, spr.stepFrame);

        // Ground-level positioning without excessive artificial bounce
        spr.bobOffset = 0;
      } else {
        spr.animTimer = 0;
        spr.stepFrame = 0;
        spr.bobOffset = 0;
        spr.sprite.material.map = pixelGenerator.getPlayerTexture(ctl.facing, 0);
      }

      // Sprite rides on pos.y so it also works on the rooftop interiors.
      this.playerSprite.position.set(pos.x, pos.y + 1.0, pos.z);
      if (this.playerShadow) {
        this.playerShadow.position.set(pos.x, pos.y - 0.78, pos.z);
      }
      state.playerPosition = { x: pos.x, y: pos.y, z: pos.z };

      // Smooth camera follow with touch swipe panning offset
      this.cameraPanOffset.lerp(this.targetCameraPanOffset, 0.1);
      const isPortrait = this.camera.aspect < 1.0;
      const zoomFactor = isPortrait ? 1.4 : 1.05;
      this.targetCameraPos.set(
        pos.x + this.cameraPanOffset.x,
        pos.y + 11.2 * zoomFactor,
        pos.z + 14.2 * zoomFactor + this.cameraPanOffset.z
      );
      this.targetCameraLookAt.set(
        pos.x + this.cameraPanOffset.x * 0.5,
        pos.y + 0.5,
        pos.z + this.cameraPanOffset.z * 0.5
      );

      this.camera.position.lerp(this.targetCameraPos, 0.08);
      this.currentCameraLookAt.lerp(this.targetCameraLookAt, 0.08);
      this.camera.lookAt(this.currentCameraLookAt);
    }
  }

  /**
   * Checks whether the player stepped into Villa Marionette's spirit grass.
   */
  private checkWildGrassEncounter(px: number, pz: number) {
    if (gameStore.getState().playerParty.length === 0) return;
    if (this.wildEncounterRequiresGrassExit) return;
    const zones = ecs.getWildZones();
    for (const zid of zones) {
      const z = ecs.wildZones.get(zid)!;
      if (
        (z.mapId ?? 'villa_marionette') === this.activeMapId &&
        px >= z.minX && px <= z.maxX && pz >= z.minZ && pz <= z.maxZ
      ) {
        // Roll encounter rate
        if (Math.random() < z.encounterRate) {
          // Select species from pool based on weights
          const totalWeight = z.speciesPool.reduce((sum, s) => sum + s.weight, 0);
          let roll = Math.random() * totalWeight;
          let picked = z.speciesPool[0];

          for (const item of z.speciesPool) {
            roll -= item.weight;
            if (roll <= 0) {
              picked = item;
              break;
            }
          }

          const level = Math.floor(Math.random() * (picked.maxLevel - picked.minLevel + 1)) + picked.minLevel;
          const wildDoll = createSoulDoll(picked.speciesId, level, true);
          this.wildEncounterRequiresGrassExit = true;
          gameStore.startBattle(wildDoll, false);
          return;
        }
      }
    }
  }

  private updateWildEncounterRearm(px: number, pz: number): void {
    if (!this.wildEncounterRequiresGrassExit) return;
    const stillInWildGrass = ecs.getWildZones().some((zoneId) => {
      const zone = ecs.wildZones.get(zoneId);
      return zone &&
        (zone.mapId ?? 'villa_marionette') === this.activeMapId &&
        px >= zone.minX && px <= zone.maxX &&
        pz >= zone.minZ && pz <= zone.maxZ;
    });
    if (!stillInWildGrass) this.wildEncounterRequiresGrassExit = false;
  }

  /**
   * Checks proximity to NPC Tamers
   */
  private checkTamerTriggers(px: number, pz: number) {
    if (gameStore.getState().playerParty.length === 0) return;
    const tamers = ecs.getTamers();
    for (const tid of tamers) {
      const tamer = ecs.tamers.get(tid)!;
      const pos = ecs.positions.get(tid)!;
      const dist = Math.hypot(px - pos.x, pz - pos.z);

      if ((tamer.mapId ?? 'villa_marionette') === this.activeMapId && dist < tamer.triggerDistance && !tamer.defeated) {
        // Stop player and trigger challenger dialogue
        gameStore.setDialogue(
          `${tamer.title} ${tamer.name}`,
          tamer.dialogueIntro,
          () => {
            // Initiate trainer battle
            const firstOpponent = tamer.party[0];
            gameStore.startBattle(firstOpponent, true, tamer.name, {
              party: tamer.party,
              entityId: tid,
              id: `${tamer.mapId ?? this.activeMapId}:${tamer.name}`,
            });
          }
        );
        return;
      }
    }
  }

  /**
   * Updates Battle Arena Camera & Doll sprites
   */
  private updateBattleScene(delta: number, state: GameState) {
    const battle = state.battleState;
    if (!battle) return;

    // Position camera dynamically in battle arena with wide framing for both combatants
    const isPortrait = this.camera.aspect < 1.0;
    if (isPortrait) {
      this.targetCameraPos.set(0, -50 + 12.5, 14.8);
      this.targetCameraLookAt.set(0, -50 + 1.2, 0);
    } else {
      this.targetCameraPos.set(0, -50 + 9.5, 12.2);
      this.targetCameraLookAt.set(0, -50 + 1.2, 0);
    }

    this.camera.position.lerp(this.targetCameraPos, 0.1);
    this.currentCameraLookAt.lerp(this.targetCameraLookAt, 0.1);
    this.camera.lookAt(this.currentCameraLookAt);

    // Update Player & Opponent doll textures and animations
    // Notice: Sprites are children of battleArenaPlatform (at Y = -50), so their local Y is ~1.95
    const activePlayerDoll = state.playerParty[battle.playerActiveIndex];
    const baseH = 5.18;
    if (activePlayerDoll) {
      this.battlePlayerDollSprite.material.map = pixelGenerator.getSoulDollTexture(
        activePlayerDoll.speciesId,
        true
      );
      this.battlePlayerDollSprite.material.needsUpdate = true;
      const pAspect = pixelGenerator.getSoulDollAspect(activePlayerDoll.speciesId, true);
      const breath = Math.sin(this.clock.getElapsedTime() * 4) * 0.04;
      this.battlePlayerDollSprite.scale.set(baseH * pAspect * (1 - breath * 0.5), baseH * (1 + breath), 1);
      this.battlePlayerDollSprite.position.y = 0.05;
    }

    if (battle.opponentDoll) {
      this.battleOpponentDollSprite.material.map = pixelGenerator.getSoulDollTexture(
        battle.opponentDoll.speciesId,
        false
      );
      this.battleOpponentDollSprite.material.needsUpdate = true;
      const oAspect = pixelGenerator.getSoulDollAspect(battle.opponentDoll.speciesId, false);
      const oppBreath = Math.sin(this.clock.getElapsedTime() * 4 + 1) * 0.04;
      this.battleOpponentDollSprite.scale.set(baseH * oAspect * (1 - oppBreath * 0.5), baseH * (1 + oppBreath), 1);
      this.battleOpponentDollSprite.position.y = 0.05;
    }
  }

  /**
   * Interact button pressed (E / Space / Action button)
   */
  public handleInteraction() {
    const state = gameStore.getState();
    if (state.activeDialogue) {
      gameStore.clearDialogue();
      return;
    }

    const playerEntity = ecs.getPlayerEntity();
    if (!playerEntity) return;
    const pos = ecs.positions.get(playerEntity)!;

    // Phase 3: facility interior flow (exit door + service counters)
    if (this.activeInteriorKind) {
      const kind = this.activeInteriorKind;
      const anchor = INTERIOR_ANCHORS[kind];
      const doorWorld = { x: anchor.x + INTERIOR_DOOR_LOCAL.x, z: anchor.z + INTERIOR_DOOR_LOCAL.z };
      if (Math.hypot(pos.x - doorWorld.x, pos.z - doorWorld.z) < 1.35) {
        this.exitInterior();
        return;
      }
      const service = INTERIOR_SERVICE_LOCAL[kind];
      const serviceWorld = { x: anchor.x + service.x, z: anchor.z + service.z };
      if (Math.hypot(pos.x - serviceWorld.x, pos.z - serviceWorld.z) < 2.2) {
        this.runInteriorService(kind);
      }
      return;
    }

    // Exterior facility doors: press the Action key near one to enter.
    if (this.activeMapId === 'villa_marionette') {
      for (const def of FACILITY_DOORS) {
        if (Math.hypot(pos.x - def.entrance.x, pos.z - def.entrance.z) < 2.2) {
          this.enterInterior(def.facility);
          return;
        }
      }
    }

    // Check Sanctuary Shrine healing
    const shrines = ecs.getShrines();
    for (const sid of shrines) {
      const shrinePos = ecs.positions.get(sid)!;
      const shrine = ecs.shrines.get(sid)!;
      const dist = Math.hypot(pos.x - shrinePos.x, pos.z - shrinePos.z);

      if (this.activeMapId === 'villa_marionette' && dist < 3.0) {
        gameStore.setDialogue(
          shrine.name,
          `${shrine.prompt}\n\n¡La energía primordial del cristal fluye hacia tus SoulDolls!`,
          () => gameStore.healParty()
        );
        return;
      }
    }

    // Check NPC Tamers interaction
    const tamers = ecs.getTamers();
    for (const tid of tamers) {
      const tpos = ecs.positions.get(tid)!;
      const tamer = ecs.tamers.get(tid)!;
      const dist = Math.hypot(pos.x - tpos.x, pos.z - tpos.z);

      if ((tamer.mapId ?? 'villa_marionette') === this.activeMapId && dist < 2.5) {
        if (state.playerParty.length === 0) {
          gameStore.setDialogue(
            `${tamer.title} ${tamer.name}`,
            'Primero elige un SoulDoll compañero en el laboratorio de Villa Marionette.'
          );
          return;
        }
        const text = tamer.defeated ? tamer.dialogueDefeated : tamer.dialogueIntro;
        gameStore.setDialogue(`${tamer.title} ${tamer.name}`, text, () => {
          if (!tamer.defeated) {
            gameStore.startBattle(tamer.party[0], true, tamer.name, {
              party: tamer.party,
              entityId: tid,
              id: `${tamer.mapId ?? this.activeMapId}:${tamer.name}`,
            });
          }
        });
        return;
      }
    }

    // Check Shop interaction
    const shops = ecs.getShops();
    for (const sid of shops) {
      const spos = ecs.positions.get(sid)!;
      const shop = ecs.shops.get(sid)!;
      const dist = Math.hypot(pos.x - spos.x, pos.z - spos.z);

      if (this.activeMapId === 'villa_marionette' && dist < 2.5) {
         gameStore.setDialogue(shop.name, '¡Bienvenido! ¿Qué buscas hoy?', () => {
             gameStore.setState({ activeShopId: sid });
             gameStore.setView('SHOP');
         });
         return;
      }
    }
  }

  private onResize = () => {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.fov = this.camera.aspect < 1.0 ? 52 : 45;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  /**
   * Projects the 3D position above a battle doll to 2D screen coordinates (px)
   */
  public getDollScreenPosition(side: 'player' | 'opponent'): { x: number; y: number } | null {
    if (!this.camera || !this.renderer) return null;
    const sprite = side === 'player' ? this.battlePlayerDollSprite : this.battleOpponentDollSprite;
    if (!sprite) return null;

    const v = new THREE.Vector3();
    sprite.getWorldPosition(v);
    // Position comfortably above the doll's head
    v.y += 2.6;
    v.project(this.camera);

    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const x = Math.round((v.x * 0.5 + 0.5) * width);
    const y = Math.round((-(v.y * 0.5) + 0.5) * height);

    return { x, y };
  }

  public destroy() {
    if (activeRenderer === this) {
      activeRenderer = null;
    }
    this.isDestroyed = true;
    cancelAnimationFrame(this.frameId);
    if (this.unsubscribePlayerSprite) {
      this.unsubscribePlayerSprite();
    }
    window.removeEventListener('resize', this.onResize);
    const dom = this.renderer.domElement;
    dom.removeEventListener('touchstart', this.onTouchStart);
    dom.removeEventListener('touchmove', this.onTouchMove);
    dom.removeEventListener('touchend', this.onTouchEnd);
    battleVfx.unregisterSink(this.vfxDirector);
    this.vfxDirector.dispose();
    this.overworldBuildings.dispose();
    this.overworldPropsByMap.forEach((props) => props.dispose());
    this.overworldPropsByMap.clear();
    this.villaLanternGeometries.forEach((geometry) => geometry.dispose());
    this.villaLanternMaterials.forEach((material) => material.dispose());
    this.villaLanternGeometries.length = 0;
    this.villaLanternMaterials.length = 0;
    this.npcMaterials.forEach((material) => material.dispose());
    this.npcTextures.forEach((texture) => texture.dispose());
    this.npcMaterials.length = 0;
    this.npcTextures.length = 0;
    this.bakedMapTextures.forEach((texture) => texture.dispose());
    this.bakedMapTextures.clear();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
