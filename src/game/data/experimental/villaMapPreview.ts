import {
  MAP_HALF_DEPTH_UNITS,
  MAP_HALF_WIDTH_UNITS,
} from '../worldGeometry';
import type { SerializedVilla } from './villaMapTypes';
import { defaultRoadId, normalizeVillaRoadEditorIds } from './villaMapIdentity';

export interface VillaPreviewPoint {
  x: number;
  z: number;
}

export interface VillaPreviewRoad {
  editorId: string;
  axis: 'x' | 'z';
  coordinate: number;
  points: VillaPreviewPoint[];
}

export interface VillaPreviewScene {
  mapId: string;
  name: string;
  background: string;
  fog: string;
  width: number;
  depth: number;
  roads: VillaPreviewRoad[];
  roadPath: { editorId: string; points: VillaPreviewPoint[] } | null;
  roadHalfWidth: number;
  plaza: { x: number; z: number; radius: number } | null;
  wildZones: {
    editorId: string;
    name: string;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  }[];
  buildings: {
    editorId: string;
    file: string;
    x: number;
    z: number;
    rotation: number;
    halfWidth: number;
    halfDepth: number;
    entrance: VillaPreviewPoint;
  }[];
  trainers: { editorId: string; name: string; x: number; z: number }[];
  signs: { editorId: string; col: number; row: number }[];
  connections: {
    editorId: string;
    x: number;
    z: number;
    toMap: string;
  }[];
  clearPointReservations: {
    editorId: string;
    x: number;
    z: number;
    radius: number;
  }[];
  notRepresented: { label: string; reason: string }[];
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
}

function assertPoint(point: VillaPreviewPoint, label: string): void {
  assertFinite(point.x, `${label}.x`);
  assertFinite(point.z, `${label}.z`);
}

export function createVillaMapPreview(map: SerializedVilla): VillaPreviewScene {
  if (!map || typeof map !== 'object') throw new Error('Preview input must be a map document');
  if (map.schemaVersion !== 1) throw new Error(`Unsupported preview schema version "${map.schemaVersion}"`);
  if (!map.geometry || typeof map.geometry !== 'object') {
    throw new Error('Preview document is missing geometry');
  }
  if (!map.map || typeof map.map !== 'object') {
    throw new Error('Preview document is missing map data');
  }
  if (map.map?.id !== 'villa_marionette') throw new Error('Preview requires a Villa Marionette document');
  if (
    map.geometry?.tilesWide !== 40 ||
    map.geometry.tilesDeep !== 40 ||
    map.geometry.tileUnits !== 1.5
  ) {
    throw new Error('Preview geometry is incompatible with the current world dimensions');
  }
  if (
    !map.map.palette ||
    typeof map.map.palette.background !== 'string' ||
    typeof map.map.palette.fog !== 'string'
  ) {
    throw new Error('Preview map palette must define background and fog colors');
  }
  if (!Array.isArray(map.buildings) || !Array.isArray(map.map.connections)) {
    throw new Error('Preview document is missing required buildings or connections');
  }

  const layout = map.map.layout;
  const roadsMap = normalizeVillaRoadEditorIds(map);
  const editorMetadata = roadsMap.editorMetadata!;
  if (!layout || typeof layout !== 'object') throw new Error('Preview document is missing layout data');
  if (!Array.isArray(layout.wildZones) || !Array.isArray(map.map.tamers) || !Array.isArray(map.map.signSpots)) {
    throw new Error('Preview document is missing zones, trainers or signs');
  }
  if (
    !Array.isArray(layout.roadXs) ||
    !Array.isArray(layout.roadZs) ||
    !Array.isArray(map.map.clearPointReservations)
  ) {
    throw new Error('Preview document is missing roads or clear-point reservations');
  }

  const roads: VillaPreviewRoad[] = [
    ...layout.roadXs.map((x, index) => {
      assertFinite(x, 'road x');
      return {
        editorId: editorMetadata.roadsX[index] ?? defaultRoadId('x', x),
        axis: 'x' as const,
        coordinate: x,
        points: [{ x, z: -MAP_HALF_DEPTH_UNITS }, { x, z: MAP_HALF_DEPTH_UNITS }],
      };
    }),
    ...layout.roadZs.map((z, index) => {
      assertFinite(z, 'road z');
      return {
        editorId: editorMetadata.roadsZ[index] ?? defaultRoadId('z', z),
        axis: 'z' as const,
        coordinate: z,
        points: [{ x: -MAP_HALF_WIDTH_UNITS, z }, { x: MAP_HALF_WIDTH_UNITS, z }],
      };
    }),
  ];
  let roadPath: VillaPreviewScene['roadPath'] = null;
  if (layout.roadPath && layout.roadPath.length > 1) {
    layout.roadPath.forEach((point, index) => assertPoint(point, `roadPath[${index}]`));
    roadPath = {
      editorId: editorMetadata.roadPath ?? 'road-path-main',
      points: layout.roadPath.map(({ x, z }) => ({ x, z })),
    };
  }

  const wildZones = layout.wildZones.map((zone) => {
    assertFinite(zone.minX, `zone "${zone.editorId}" minX`);
    assertFinite(zone.maxX, `zone "${zone.editorId}" maxX`);
    assertFinite(zone.minZ, `zone "${zone.editorId}" minZ`);
    assertFinite(zone.maxZ, `zone "${zone.editorId}" maxZ`);
    if (zone.minX > zone.maxX || zone.minZ > zone.maxZ) {
      throw new Error(`Zone "${zone.editorId}" has inverted preview bounds`);
    }
    return {
      editorId: zone.editorId,
      name: zone.name,
      minX: zone.minX,
      maxX: zone.maxX,
      minZ: zone.minZ,
      maxZ: zone.maxZ,
    };
  });

  const buildings = map.buildings.map((building) => {
    assertFinite(building.x, `building "${building.id}" x`);
    assertFinite(building.z, `building "${building.id}" z`);
    assertFinite(building.rotation, `building "${building.id}" rotation`);
    assertFinite(building.halfWidth, `building "${building.id}" halfWidth`);
    assertFinite(building.halfDepth, `building "${building.id}" halfDepth`);
    assertPoint(building.entrance, `building "${building.id}" entrance`);
    return {
      editorId: building.id,
      file: building.file,
      x: building.x,
      z: building.z,
      rotation: building.rotation,
      halfWidth: building.halfWidth,
      halfDepth: building.halfDepth,
      entrance: { ...building.entrance },
    };
  });

  const trainers = map.map.tamers.map((trainer) => {
    assertPoint(trainer.position, `trainer "${trainer.editorId}" position`);
    return {
      editorId: trainer.editorId,
      name: trainer.name,
      x: trainer.position.x,
      z: trainer.position.z,
    };
  });

  const signs = map.map.signSpots.map((sign) => {
    assertFinite(sign.col, `sign "${sign.editorId}" col`);
    assertFinite(sign.row, `sign "${sign.editorId}" row`);
    return { editorId: sign.editorId, col: sign.col, row: sign.row };
  });

  const connections = map.map.connections.map((connection) => {
    assertPoint(connection.at, `connection "${connection.editorId}" position`);
    return {
      editorId: connection.editorId,
      x: connection.at.x,
      z: connection.at.z,
      toMap: connection.toMap,
    };
  });

  const clearPointReservations = map.map.clearPointReservations.map((reservation) => {
    assertPoint(reservation, `clear reservation "${reservation.editorId}"`);
    assertFinite(reservation.r, `clear reservation "${reservation.editorId}" radius`);
    return {
      editorId: reservation.editorId,
      x: reservation.x,
      z: reservation.z,
      radius: reservation.r,
    };
  });

  if (layout.plaza) {
    assertPoint(layout.plaza, 'plaza');
    assertFinite(layout.plaza.radius, 'plaza radius');
  }
  assertFinite(layout.roadHalfWidth, 'roadHalfWidth');

  return {
    mapId: map.map.id,
    name: map.map.name,
    background: map.map.palette.background,
    fog: map.map.palette.fog,
    width: map.geometry.tilesWide * map.geometry.tileUnits,
    depth: map.geometry.tilesDeep * map.geometry.tileUnits,
    roads,
    roadPath,
    roadHalfWidth: layout.roadHalfWidth,
    plaza: layout.plaza ? { ...layout.plaza } : null,
    wildZones,
    buildings,
    trainers,
    signs,
    connections,
    clearPointReservations,
    notRepresented: [
      {
        label: 'Texturas y transiciones del terreno',
        reason: 'El contrato contiene geometría, no el horneado de tiles ni los archivos de textura.',
      },
      {
        label: 'Modelos 3D de edificios',
        reason: 'Se muestra la huella y la referencia GLB; no se instancia ni se presenta el modelo.',
      },
      {
        label: 'Decoración procedural',
        reason: 'El JSON contiene presupuestos, no las posiciones deterministas de árboles, flores, rocas y arbustos.',
      },
      {
        label: 'Sprites de entrenadores y letreros',
        reason: 'Se muestran marcadores editoriales, no sus recursos gráficos ni su orientación visual.',
      },
      {
        label: 'Colisiones, accesibilidad e interiores',
        reason: 'La proyección no ejecuta validación física ni sistemas del runtime.',
      },
      {
        label: 'Entidades creadas directamente por runtime',
        reason: 'NPCs auxiliares, santuario, lámparas y otros elementos ausentes del contrato no se inventan.',
      },
    ],
  };
}
