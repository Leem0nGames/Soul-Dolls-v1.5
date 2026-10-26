import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import pilotDocument from '../data/experimental/villa_marionette.v1.json';
import {
  applyVillaMapEditorOperation,
  applyVillaMapEditorOperations,
  createClearReservationOperation,
  createEncounterZoneBoundsOperation,
  createEncounterRateOperation,
  createPlazaOperation,
  createPositionOperation,
  createRoadCoordinateOperation,
  createRoadWidthOperation,
  createVillaMapEditorState,
  isValidSignGridPosition,
  parseFiniteCoordinate,
  resetVillaMapEditorState,
  serializeVillaMapEditorState,
  signGridToWorldPosition,
  undoVillaMapEditorOperation,
  worldPositionToSignGrid,
  clientToWorldPosition,
  VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT,
  VILLA_PREVIEW_VIEWBOX_SIZE,
  type VillaEditableSelection,
  type VillaMapEditorState,
  type WorldPosition,
} from '../data/experimental/villaMapEditor';
import {
  createVillaMapPreview,
  type VillaPreviewScene,
} from '../data/experimental/villaMapPreview';
import type { SerializedVilla } from '../data/experimental/villaMapTypes';
import './villa-map-preview.css';

const sourceDocument = JSON.parse(JSON.stringify(pilotDocument)) as SerializedVilla;
const SVG_SIZE = VILLA_PREVIEW_VIEWBOX_SIZE;
const SVG_CENTER = SVG_SIZE / 2;

interface DraftFields {
  x: string;
  z: string;
  encounterRate: string;
  radius: string;
  roadWidth: string;
  minX: string;
  maxX: string;
  minZ: string;
  maxZ: string;
}

interface DragState {
  pointerId: number;
  selection: VillaEditableSelection;
  position: WorldPosition;
  pointerOffset: WorldPosition;
}

interface SelectionDetails {
  label: string;
  x?: number;
  z?: number;
  col?: number;
  row?: number;
  encounterRate?: number;
  radius?: number;
  roadWidth?: number;
  minX?: number;
  maxX?: number;
  minZ?: number;
  maxZ?: number;
  axis?: 'x' | 'z';
  readOnlyReason?: string;
}

function screenX(x: number): number {
  return SVG_CENTER + x * VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT;
}

function screenY(z: number): number {
  return SVG_CENTER - z * VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT;
}

function sameSelection(
  first: VillaEditableSelection | null,
  second: VillaEditableSelection
): boolean {
  return first?.kind === second.kind &&
    first.editorId === second.editorId &&
    (first.kind !== 'road-path' || second.kind !== 'road-path' || first.pointIndex === second.pointIndex);
}

function getSelectionDetails(
  map: SerializedVilla,
  selection: VillaEditableSelection
): SelectionDetails | null {
  switch (selection.kind) {
    case 'building': {
      const object = map.buildings.find(({ id }) => id === selection.editorId);
      return object
        ? { label: 'Edificio (huella esquemática)', x: object.x, z: object.z }
        : null;
    }
    case 'trainer': {
      const object = map.map.tamers.find(({ editorId }) => editorId === selection.editorId);
      return object
        ? { label: 'Entrenador', x: object.position.x, z: object.position.z }
        : null;
    }
    case 'sign': {
      const object = map.map.signSpots.find(({ editorId }) => editorId === selection.editorId);
      return object
        ? { label: 'Letrero', col: object.col, row: object.row }
        : null;
    }
    case 'encounter-zone': {
      const object = map.map.layout.wildZones.find(({ editorId }) => editorId === selection.editorId);
      return object
        ? {
            label: 'Zona de encuentro',
            x: (object.minX + object.maxX) / 2,
            z: (object.minZ + object.maxZ) / 2,
            minX: object.minX,
            maxX: object.maxX,
            minZ: object.minZ,
            maxZ: object.maxZ,
            encounterRate: object.encounterRate,
          }
        : null;
    }
    case 'road': {
      const metadata = map.editorMetadata;
      const index = selection.axis === 'x'
        ? metadata?.roadsX.indexOf(selection.editorId) ?? -1
        : metadata?.roadsZ.indexOf(selection.editorId) ?? -1;
      const coordinate = index < 0
        ? undefined
        : selection.axis === 'x'
          ? map.map.layout.roadXs[index]
          : map.map.layout.roadZs[index];
      return coordinate === undefined
        ? null
        : {
            label: selection.axis === 'x' ? 'Camino vertical' : 'Camino horizontal',
            x: selection.axis === 'x' ? coordinate : undefined,
            z: selection.axis === 'z' ? coordinate : undefined,
            axis: selection.axis,
            roadWidth: map.map.layout.roadHalfWidth,
          };
    }
    case 'road-path':
      return map.editorMetadata?.roadPath === selection.editorId && map.map.layout.roadPath
        ? {
            label: `Polilínea · punto ${selection.pointIndex + 1}`,
            x: map.map.layout.roadPath[selection.pointIndex]?.x,
            z: map.map.layout.roadPath[selection.pointIndex]?.z,
          }
        : null;
    case 'plaza':
      return map.map.layout.plaza
        ? {
            label: 'Plaza',
            x: map.map.layout.plaza.x,
            z: map.map.layout.plaza.z,
            radius: map.map.layout.plaza.radius,
          }
        : null;
    case 'clear-point': {
      const object = map.map.clearPointReservations.find(({ editorId }) => editorId === selection.editorId);
      return object
        ? { label: 'Reserva de espacio', x: object.x, z: object.z, radius: object.r }
        : null;
    }
    case 'connection':
      return map.map.connections.some(({ editorId }) => editorId === selection.editorId)
        ? { label: 'Conexión', readOnlyReason: 'Las conexiones no tienen una operación de edición disponible.' }
        : null;
    case 'clear-point':
      return map.map.clearPointReservations.some(({ editorId }) => editorId === selection.editorId)
        ? { label: 'Reserva despejada', readOnlyReason: 'Las reservas no tienen una operación de edición disponible.' }
        : null;
  }
}

function SelectionGroup({
  selection,
  selected,
  className,
  children,
  onSelect,
  onBeginDrag,
}: {
  selection: VillaEditableSelection;
  selected: boolean;
  className: string;
  children: ReactNode;
  onSelect: (selection: VillaEditableSelection) => void;
  onBeginDrag?: (selection: VillaEditableSelection, event: ReactPointerEvent<SVGGElement>) => void;
}) {
  return (
    <g
      className={`map-preview-selectable ${className}${selected ? ' is-selected' : ''}${onBeginDrag ? ' is-draggable' : ''}`}
      data-editor-id={selection.editorId}
      data-object-kind={selection.kind}
      aria-label={`${selection.kind}: ${selection.editorId}`}
      tabIndex={0}
      role="button"
      onClick={() => onSelect(selection)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(selection);
        }
      }}
      onPointerDown={(event) => {
        if (!onBeginDrag || event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
        onBeginDrag(selection, event);
      }}
    >
      {children}
    </g>
  );
}

function SceneSvg({
  scene,
  selected,
  drag,
  onSelect,
  onBeginDrag,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: {
  scene: VillaPreviewScene;
  selected: VillaEditableSelection | null;
  drag: DragState | null;
  onSelect: (selection: VillaEditableSelection) => void;
  onBeginDrag: (selection: VillaEditableSelection, event: ReactPointerEvent<SVGGElement>) => void;
  onDragMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onDragEnd: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onDragCancel: () => void;
}) {
  const mapPixelsWide = scene.width * VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT;
  const mapPixelsDeep = scene.depth * VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT;
  const mapLeft = SVG_CENTER - mapPixelsWide / 2;
  const mapTop = SVG_CENTER - mapPixelsDeep / 2;
  const tilePixels = scene.width / 40 * VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT;
  const terrainInset = scene.width / 40 * 2 * VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT;
  const signDragPosition = drag?.selection.kind === 'sign'
    ? worldPositionToSignGrid(drag.position)
    : null;
  const snappedSignWorld = signDragPosition
    ? signGridToWorldPosition(signDragPosition)
    : null;
  const dragIsValid = !signDragPosition || isValidSignGridPosition(signDragPosition);

  return (
    <svg
      className={`map-preview-svg${drag ? ' is-dragging' : ''}`}
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      role="img"
      aria-label={`Vista esquemática editable de ${scene.name}`}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragCancel}
    >
      <rect x="0" y="0" width={SVG_SIZE} height={SVG_SIZE} rx="16" className="map-preview-outside" />
      <rect
        x={mapLeft}
        y={mapTop}
        width={mapPixelsWide}
        height={mapPixelsDeep}
        fill="#393939"
        stroke="#1a1b1a"
        strokeWidth="2"
      />
      <rect
        x={mapLeft + terrainInset}
        y={mapTop + terrainInset}
        width={mapPixelsWide - terrainInset * 2}
        height={mapPixelsDeep - terrainInset * 2}
        fill={scene.background}
      />

      <g className="map-preview-grid" aria-hidden="true">
        {Array.from({ length: 41 }, (_, index) => (
          <g key={index}>
            <line
              x1={mapLeft + index * tilePixels}
              y1={mapTop}
              x2={mapLeft + index * tilePixels}
              y2={mapTop + mapPixelsDeep}
            />
            <line
              x1={mapLeft}
              y1={mapTop + index * tilePixels}
              x2={mapLeft + mapPixelsWide}
              y2={mapTop + index * tilePixels}
            />
          </g>
        ))}
      </g>

      {scene.roads.map((road) => {
        const selection: VillaEditableSelection = { kind: 'road', editorId: road.editorId, axis: road.axis };
        const isDragged = drag?.selection.kind === 'road' && drag.selection.editorId === road.editorId;
        const coordinate = isDragged
          ? road.axis === 'x' ? drag.position.x : drag.position.z
          : road.coordinate;
        const points = road.axis === 'x'
          ? [{ x: coordinate, z: -scene.depth / 2 }, { x: coordinate, z: scene.depth / 2 }]
          : [{ x: -scene.width / 2, z: coordinate }, { x: scene.width / 2, z: coordinate }];
        return (
          <SelectionGroup
            key={road.editorId}
            selection={selection}
            selected={sameSelection(selected, selection)}
            className="map-preview-road-select"
            onSelect={onSelect}
            onBeginDrag={onBeginDrag}
          >
            <polyline
              points={points.map(({ x, z }) => `${screenX(x)},${screenY(z)}`).join(' ')}
              strokeWidth={Math.max(scene.roadHalfWidth * 2 * VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT, 16)}
              className="map-preview-road-hit"
            />
            <polyline
              points={points.map(({ x, z }) => `${screenX(x)},${screenY(z)}`).join(' ')}
              strokeWidth={scene.roadHalfWidth * 2 * VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT}
              className="map-preview-road"
            />
            <text
              x={screenX(points[0].x) + 4}
              y={screenY(points[0].z) + 4}
              className="map-preview-road-label"
            >
              {road.editorId}
            </text>
          </SelectionGroup>
        );
      })}

      {scene.roadPath && scene.roadPath.points.slice(1).map((point, index) => {
        const start = scene.roadPath!.points[index];
        const selection: VillaEditableSelection = {
          kind: 'road-path',
          editorId: scene.roadPath!.editorId,
          pointIndex: index + 1,
        };
        const isDragged = drag?.selection.kind === 'road-path' &&
          drag.selection.editorId === selection.editorId &&
          drag.selection.pointIndex === selection.pointIndex;
        const displayed = isDragged ? drag.position : point;
        return (
          <g key={`${selection.editorId}-${selection.pointIndex}`}>
            <line
              x1={screenX(start.x)}
              y1={screenY(start.z)}
              x2={screenX(displayed.x)}
              y2={screenY(displayed.z)}
              strokeWidth={scene.roadHalfWidth * 2 * VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT}
              className="map-preview-road"
              pointerEvents="none"
            />
          </g>
        );
      })}
      {scene.roadPath?.points.map((point, pointIndex) => {
        const selection: VillaEditableSelection = {
          kind: 'road-path',
          editorId: scene.roadPath!.editorId,
          pointIndex,
        };
        const isDragged = drag?.selection.kind === 'road-path' &&
          drag.selection.editorId === selection.editorId &&
          drag.selection.pointIndex === pointIndex;
        const displayed = isDragged ? drag.position : point;
        return (
          <SelectionGroup
            key={`${selection.editorId}-handle-${pointIndex}`}
            selection={selection}
            selected={sameSelection(selected, selection)}
            className="map-preview-road-path-point"
            onSelect={onSelect}
            onBeginDrag={onBeginDrag}
          >
            <circle cx={screenX(displayed.x)} cy={screenY(displayed.z)} r="7" className="map-preview-road-point" />
            <text x={screenX(displayed.x) + 8} y={screenY(displayed.z) - 7} className="map-preview-road-label">
              P{pointIndex + 1}
            </text>
          </SelectionGroup>
        );
      })}

      {scene.plaza && (
        <SelectionGroup
          selection={{ kind: 'plaza', editorId: 'plaza' }}
          selected={sameSelection(selected, { kind: 'plaza', editorId: 'plaza' })}
          className="map-preview-plaza-select"
          onSelect={onSelect}
          onBeginDrag={onBeginDrag}
        >
          <circle
            cx={screenX(drag?.selection.kind === 'plaza' ? drag.position.x : scene.plaza.x)}
            cy={screenY(drag?.selection.kind === 'plaza' ? drag.position.z : scene.plaza.z)}
            r={scene.plaza.radius * VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT}
            className="map-preview-plaza"
          />
        </SelectionGroup>
      )}

      {scene.wildZones.map((zone) => {
        const selection: VillaEditableSelection = { kind: 'encounter-zone', editorId: zone.editorId };
        return (
          <SelectionGroup
            key={zone.editorId}
            selection={selection}
            selected={sameSelection(selected, selection)}
            className="map-preview-zone-select"
            onSelect={onSelect}
            onBeginDrag={onBeginDrag}
          >
            <rect
              x={screenX(zone.minX + (drag?.selection.kind === 'encounter-zone' && drag.selection.editorId === zone.editorId ? drag.position.x - (zone.minX + zone.maxX) / 2 : 0))}
              y={screenY(zone.maxZ + (drag?.selection.kind === 'encounter-zone' && drag.selection.editorId === zone.editorId ? drag.position.z - (zone.minZ + zone.maxZ) / 2 : 0))}
              width={(zone.maxX - zone.minX) * VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT}
              height={(zone.maxZ - zone.minZ) * VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT}
              className="map-preview-wild-zone"
            />
            <text x={screenX(zone.minX) + 4} y={screenY(zone.maxZ) + 12} className="map-preview-label">
              {zone.editorId}
            </text>
          </SelectionGroup>
        );
      })}

      {scene.clearPointReservations.map((reservation) => {
        const selection: VillaEditableSelection = { kind: 'clear-point', editorId: reservation.editorId };
        return (
          <SelectionGroup
            key={reservation.editorId}
            selection={selection}
            selected={sameSelection(selected, selection)}
            className="map-preview-clearance-select"
            onSelect={onSelect}
            onBeginDrag={onBeginDrag}
          >
            <circle
              cx={screenX(reservation.x + (drag?.selection.kind === 'clear-point' && drag.selection.editorId === reservation.editorId ? drag.position.x - reservation.x : 0))}
              cy={screenY(reservation.z + (drag?.selection.kind === 'clear-point' && drag.selection.editorId === reservation.editorId ? drag.position.z - reservation.z : 0))}
              r={reservation.radius * VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT}
              className="map-preview-clearance"
            />
            <text
              x={screenX(reservation.x) + 5}
              y={screenY(reservation.z) - 4}
              className="map-preview-tiny-label"
            >
              {reservation.editorId}
            </text>
          </SelectionGroup>
        );
      })}

      {scene.buildings.map((building) => {
        const selection: VillaEditableSelection = { kind: 'building', editorId: building.editorId };
        const isDragged = drag?.selection.kind === 'building' && drag.selection.editorId === building.editorId;
        const x = isDragged ? drag.position.x : building.x;
        const z = isDragged ? drag.position.z : building.z;
        const entranceX = isDragged ? building.entrance.x + x - building.x : building.entrance.x;
        const entranceZ = isDragged ? building.entrance.z + z - building.z : building.entrance.z;
        return (
          <SelectionGroup
            key={building.editorId}
            selection={selection}
            selected={sameSelection(selected, selection)}
            className="map-preview-building-select"
            onSelect={onSelect}
            onBeginDrag={onBeginDrag}
          >
            <rect
              x={screenX(x) - building.halfWidth * VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT}
              y={screenY(z) - building.halfDepth * VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT}
              width={building.halfWidth * 2 * VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT}
              height={building.halfDepth * 2 * VILLA_PREVIEW_PIXELS_PER_WORLD_UNIT}
              className="map-preview-building"
            />
            <text
              x={screenX(x)}
              y={screenY(z)}
              textAnchor="middle"
              dominantBaseline="middle"
              className="map-preview-building-label"
            >
              {building.editorId}
            </text>
            <circle
              cx={screenX(entranceX)}
              cy={screenY(entranceZ)}
              r="4"
              className="map-preview-entrance"
            />
          </SelectionGroup>
        );
      })}

      {scene.trainers.map((trainer) => {
        const selection: VillaEditableSelection = { kind: 'trainer', editorId: trainer.editorId };
        const isDragged = drag?.selection.kind === 'trainer' && drag.selection.editorId === trainer.editorId;
        const x = isDragged ? drag.position.x : trainer.x;
        const z = isDragged ? drag.position.z : trainer.z;
        return (
          <SelectionGroup
            key={trainer.editorId}
            selection={selection}
            selected={sameSelection(selected, selection)}
            className="map-preview-trainer-select"
            onSelect={onSelect}
            onBeginDrag={onBeginDrag}
          >
            <circle cx={screenX(x)} cy={screenY(z)} r="8" className="map-preview-trainer" />
            <text x={screenX(x) + 10} y={screenY(z) + 3} className="map-preview-label">
              {trainer.editorId}
            </text>
          </SelectionGroup>
        );
      })}

      {scene.signs.map((sign) => {
        const selection: VillaEditableSelection = { kind: 'sign', editorId: sign.editorId };
        const isDragged = drag?.selection.kind === 'sign' && drag.selection.editorId === sign.editorId;
        const grid = isDragged ? signDragPosition! : { col: sign.col, row: sign.row };
        const position = isDragged && snappedSignWorld
          ? snappedSignWorld
          : signGridToWorldPosition(grid);
        return (
          <SelectionGroup
            key={sign.editorId}
            selection={selection}
            selected={sameSelection(selected, selection)}
            className={`map-preview-sign-select${isDragged && !dragIsValid ? ' is-invalid' : ''}`}
            onSelect={onSelect}
            onBeginDrag={onBeginDrag}
          >
            <path
              d={`M ${screenX(position.x)} ${screenY(position.z) - 7} L ${screenX(position.x) + 6} ${screenY(position.z) + 5} L ${screenX(position.x) - 6} ${screenY(position.z) + 5} Z`}
              className="map-preview-sign"
            />
            <text x={screenX(position.x) + 8} y={screenY(position.z)} className="map-preview-tiny-label">
              {sign.editorId}
            </text>
          </SelectionGroup>
        );
      })}

      {scene.connections.map((connection) => {
        const selection: VillaEditableSelection = { kind: 'connection', editorId: connection.editorId };
        return (
          <SelectionGroup
            key={connection.editorId}
            selection={selection}
            selected={sameSelection(selected, selection)}
            className="map-preview-connection-select"
            onSelect={onSelect}
          >
            <circle cx={screenX(connection.x)} cy={screenY(connection.z)} r="7" className="map-preview-connection" />
            <text x={screenX(connection.x) + 9} y={screenY(connection.z) - 8} className="map-preview-label">
              {connection.editorId}
            </text>
          </SelectionGroup>
        );
      })}

      {drag && (
        <g pointerEvents="none" className={dragIsValid ? 'map-preview-position-indicator' : 'map-preview-position-indicator is-invalid'}>
          <line x1={screenX(drag.position.x) - 10} y1={screenY(drag.position.z)} x2={screenX(drag.position.x) + 10} y2={screenY(drag.position.z)} />
          <line x1={screenX(drag.position.x)} y1={screenY(drag.position.z) - 10} x2={screenX(drag.position.x)} y2={screenY(drag.position.z) + 10} />
          <text x={screenX(drag.position.x) + 10} y={screenY(drag.position.z) - 10}>
            X {drag.position.x.toFixed(2)} · Z {drag.position.z.toFixed(2)}
          </text>
        </g>
      )}

      <text x={mapLeft + 8} y={mapTop + mapPixelsDeep - 8} className="map-preview-scale-label">
        Esquema · no es el terreno texturizado
      </text>
      <text x={SVG_CENTER} y="18" textAnchor="middle" className="map-preview-axis-label">N · Z+</text>
      <text x={SVG_CENTER} y={SVG_SIZE - 8} textAnchor="middle" className="map-preview-axis-label">S · Z-</text>
      <text x="16" y={SVG_CENTER} textAnchor="middle" transform={`rotate(-90 16 ${SVG_CENTER})`} className="map-preview-axis-label">O · X-</text>
      <text x={SVG_SIZE - 16} y={SVG_CENTER} textAnchor="middle" transform={`rotate(90 ${SVG_SIZE - 16} ${SVG_CENTER})`} className="map-preview-axis-label">E · X+</text>
    </svg>
  );
}

export default function VillaMapPreviewApp() {
  const [editor, setEditor] = useState<VillaMapEditorState>(() =>
    createVillaMapEditorState(sourceDocument)
  );
  const [selected, setSelected] = useState<VillaEditableSelection | null>(null);
  const [draft, setDraft] = useState<DraftFields>({
    x: '',
    z: '',
    encounterRate: '',
    radius: '',
    roadWidth: '',
    minX: '',
    maxX: '',
    minZ: '',
    maxZ: '',
  });
  const [roadPathPoints, setRoadPathPoints] = useState('[{"x":-6,"z":0},{"x":6,"z":0}]');
  const [newRoadCoordinate, setNewRoadCoordinate] = useState('0');
  const [drag, setDrag] = useState<DragState | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('Selecciona un marcador o arrastra un objeto editable.');
  const dragRef = useRef<DragState | null>(null);

  const preview = useMemo(() => {
    try {
      return { scene: createVillaMapPreview(editor.map), error: '' };
    } catch (previewError) {
      return {
        scene: null,
        error: previewError instanceof Error ? previewError.message : String(previewError),
      };
    }
  }, [editor.map]);
  const selectedDetails = selected ? getSelectionDetails(editor.map, selected) : null;

  const resetDraft = (selection: VillaEditableSelection | null, map = editor.map) => {
    const details = selection ? getSelectionDetails(map, selection) : null;
    setDraft({
      x: details?.x !== undefined ? String(details.x) : details?.col !== undefined ? String(details.col) : '',
      z: details?.z !== undefined ? String(details.z) : details?.row !== undefined ? String(details.row) : '',
      encounterRate: details?.encounterRate !== undefined ? String(details.encounterRate) : '',
      radius: details?.radius !== undefined ? String(details.radius) : '',
      roadWidth: details?.roadWidth !== undefined ? String(details.roadWidth) : '',
      minX: details?.minX !== undefined ? String(details.minX) : '',
      maxX: details?.maxX !== undefined ? String(details.maxX) : '',
      minZ: details?.minZ !== undefined ? String(details.minZ) : '',
      maxZ: details?.maxZ !== undefined ? String(details.maxZ) : '',
    });
  };

  const commitOperation = (operation: unknown): VillaMapEditorState | null => {
    return commitOperations([operation]);
  };

  const commitOperations = (operations: readonly unknown[]): VillaMapEditorState | null => {
    const result = applyVillaMapEditorOperations(editor, operations);
    if (!result.ok) {
      setError(result.error);
      setNotice('');
      return null;
    }
    setEditor(result.state);
    setError('');
    return result.state;
  };

  const selectObject = (selection: VillaEditableSelection) => {
    setSelected(selection);
    resetDraft(selection);
    setError('');
    setNotice('');
  };

  const applyDraft = () => {
    if (!selected || !selectedDetails) return;
    try {
      if (selected.kind === 'building' || selected.kind === 'trainer') {
        const position = {
          x: parseFiniteCoordinate(draft.x, 'X'),
          z: parseFiniteCoordinate(draft.z, 'Z'),
        };
        const operation = createPositionOperation(selected, position);
        if (commitOperation(operation)) setNotice('Cambios aplicados a la copia experimental.');
      } else if (selected.kind === 'sign') {
        const col = parseFiniteCoordinate(draft.x, 'Columna');
        const row = parseFiniteCoordinate(draft.z, 'Fila');
        if (!Number.isInteger(col) || !Number.isInteger(row)) {
          throw new Error('Columna y fila deben ser números enteros.');
        }
        if (commitOperation({ type: 'move_sign', editorId: selected.editorId, col, row })) {
          setNotice('Letrero movido a la celda indicada.');
        }
      } else if (selected.kind === 'encounter-zone') {
        const operations = [
          createEncounterZoneBoundsOperation(selected.editorId, {
            minX: parseFiniteCoordinate(draft.minX, 'X mínima'),
            maxX: parseFiniteCoordinate(draft.maxX, 'X máxima'),
            minZ: parseFiniteCoordinate(draft.minZ, 'Z mínima'),
            maxZ: parseFiniteCoordinate(draft.maxZ, 'Z máxima'),
          }),
          createEncounterRateOperation(
            selected,
            parseFiniteCoordinate(draft.encounterRate, 'Tasa de encuentro')
          ),
        ];
        if (commitOperations(operations)) setNotice('Geometría y tasa de la zona actualizadas.');
      } else if (selected.kind === 'road') {
        const coordinate = parseFiniteCoordinate(
          selected.axis === 'x' ? draft.x : draft.z,
          selected.axis === 'x' ? 'X del camino' : 'Z del camino'
        );
        const operations = [
          createRoadCoordinateOperation(selected.editorId, selected.axis, coordinate),
          createRoadWidthOperation(parseFiniteCoordinate(draft.roadWidth, 'Ancho del camino')),
        ];
        if (commitOperations(operations)) setNotice('Camino actualizado.');
      } else if (selected.kind === 'plaza') {
        const position = {
          x: parseFiniteCoordinate(draft.x, 'X de la plaza'),
          z: parseFiniteCoordinate(draft.z, 'Z de la plaza'),
        };
        const radius = parseFiniteCoordinate(draft.radius, 'Radio de la plaza');
        if (commitOperation(createPlazaOperation(position, radius))) setNotice('Plaza actualizada.');
      } else if (selected.kind === 'clear-point') {
        const position = {
          x: parseFiniteCoordinate(draft.x, 'X de la reserva'),
          z: parseFiniteCoordinate(draft.z, 'Z de la reserva'),
        };
        const radius = parseFiniteCoordinate(draft.radius, 'Radio de la reserva');
        if (commitOperation(createClearReservationOperation(selected.editorId, position, radius))) {
          setNotice('Reserva de espacio actualizada.');
        }
      } else if (selected.kind === 'road-path') {
        const position = {
          x: parseFiniteCoordinate(draft.x, 'X del punto'),
          z: parseFiniteCoordinate(draft.z, 'Z del punto'),
        };
        if (commitOperation(createPositionOperation(selected, position))) setNotice('Punto de camino actualizado.');
      }
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : String(applyError));
      setNotice('');
    }
  };

  const beginDrag = (
    selection: VillaEditableSelection,
    event: ReactPointerEvent<SVGGElement>
  ) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const bounds = svg.getBoundingClientRect();
    const pointerPosition = clientToWorldPosition(event.clientX, event.clientY, bounds);
    const details = getSelectionDetails(editor.map, selection);
    if (!details) return;
    const objectPosition = selection.kind === 'sign'
      ? signGridToWorldPosition({ col: details.col!, row: details.row! })
      : selection.kind === 'road'
        ? selection.axis === 'x'
          ? { x: details.x!, z: 0 }
          : { x: 0, z: details.z! }
        : { x: details.x!, z: details.z! };
    const nextDrag: DragState = {
      pointerId: event.pointerId,
      selection,
      position: objectPosition,
      pointerOffset: {
        x: objectPosition.x - pointerPosition.x,
        z: objectPosition.z - pointerPosition.z,
      },
    };
    setSelected(selection);
    resetDraft(selection);
    setError('');
    setNotice('Arrastra y suelta para confirmar una única acción.');
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  };

  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    const currentDrag = dragRef.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    try {
      const pointerPosition = clientToWorldPosition(event.clientX, event.clientY, bounds);
      const nextDrag = {
        ...currentDrag,
        position: {
          x: pointerPosition.x + currentDrag.pointerOffset.x,
          z: pointerPosition.z + currentDrag.pointerOffset.z,
        },
      };
      dragRef.current = nextDrag;
      setDrag(nextDrag);
    } catch (dragError) {
      setError(dragError instanceof Error ? dragError.message : String(dragError));
    }
  };

  const finishDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    const currentDrag = dragRef.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    try {
      const pointerPosition = clientToWorldPosition(event.clientX, event.clientY, bounds);
      const position = {
        x: pointerPosition.x + currentDrag.pointerOffset.x,
        z: pointerPosition.z + currentDrag.pointerOffset.z,
      };
      const operation = currentDrag.selection.kind === 'plaza'
        ? createPlazaOperation(position, getSelectionDetails(editor.map, currentDrag.selection)!.radius!)
        : currentDrag.selection.kind === 'clear-point'
          ? createClearReservationOperation(
              currentDrag.selection.editorId,
              position,
              getSelectionDetails(editor.map, currentDrag.selection)!.radius!
            )
          : createPositionOperation(currentDrag.selection, position);
      dragRef.current = null;
      setDrag(null);
      const nextState = commitOperation(operation);
      if (nextState) {
        resetDraft(currentDrag.selection, nextState.map);
        setNotice(`Movimiento de ${currentDrag.selection.editorId} confirmado como una sola acción.`);
      }
    } catch (dragError) {
      dragRef.current = null;
      setDrag(null);
      setError(dragError instanceof Error ? dragError.message : String(dragError));
      setNotice('');
    }
  };

  const cancelDrag = () => {
    const currentDrag = dragRef.current;
    if (!currentDrag) return;
    dragRef.current = null;
    setDrag(null);
    resetDraft(currentDrag.selection);
    setNotice('Movimiento cancelado; el mapa conserva el último estado confirmado.');
  };

  const undo = () => {
    if (editor.history.length === 0) return;
    const next = undoVillaMapEditorOperation(editor);
    setEditor(next);
    resetDraft(selected, next.map);
    setError('');
    setNotice('Se deshizo el último cambio confirmado.');
  };

  const reset = () => {
    const next = resetVillaMapEditorState(sourceDocument);
    setEditor(next);
    dragRef.current = null;
    setDrag(null);
    resetDraft(selected, next.map);
    setError('');
    setNotice('Copia restablecida; historial vacío. El JSON fuente no se modificó.');
  };

  const exportJson = () => {
    try {
      const json = serializeVillaMapEditorState(editor);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'villa_marionette.editado.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setError('');
      setNotice('JSON experimental descargado; no es una fuente oficial del juego.');
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : String(exportError));
      setNotice('');
    }
  };

  const addRoad = (axis: 'x' | 'z') => {
    try {
      const coordinate = parseFiniteCoordinate(newRoadCoordinate, 'Coordenada del camino');
      const existingIds = [
        ...(editor.map.editorMetadata?.roadsX ?? []),
        ...(editor.map.editorMetadata?.roadsZ ?? []),
      ];
      let suffix = 1;
      let editorId = `road-${axis}-added-${suffix}`;
      while (existingIds.includes(editorId)) {
        suffix += 1;
        editorId = `road-${axis}-added-${suffix}`;
      }
      const result = commitOperation({ type: 'add_road', editorId, axis, value: coordinate });
      if (result) {
        setSelected({ kind: 'road', editorId, axis });
        resetDraft({ kind: 'road', editorId, axis }, result.map);
        setNotice(`Camino ${axis.toUpperCase()} agregado con ID ${editorId}.`);
      }
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : String(addError));
      setNotice('');
    }
  };

  const addRoadPath = () => {
    try {
      const points: unknown = JSON.parse(roadPathPoints);
      const existingIds = [
        ...(editor.map.editorMetadata?.roadsX ?? []),
        ...(editor.map.editorMetadata?.roadsZ ?? []),
        ...(editor.map.editorMetadata?.roadPath ? [editor.map.editorMetadata.roadPath] : []),
      ];
      let suffix = 1;
      let editorId = `road-path-added-${suffix}`;
      while (existingIds.includes(editorId)) {
        suffix += 1;
        editorId = `road-path-added-${suffix}`;
      }
      const result = commitOperation({ type: 'add_road_path', editorId, points });
      if (result) {
        setSelected({ kind: 'road-path', editorId, pointIndex: 0 });
        resetDraft({ kind: 'road-path', editorId, pointIndex: 0 }, result.map);
        setNotice(`Polilínea agregada con ${Array.isArray(points) ? points.length : 0} punto(s).`);
      }
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : String(addError));
      setNotice('');
    }
  };

  const removeSelectedRoad = () => {
    if (!selected || selected.kind !== 'road') return;
    const result = commitOperation({ type: 'remove_road', editorId: selected.editorId });
    if (result) {
      setSelected(null);
      setNotice(`Camino ${selected.editorId} eliminado de la copia.`);
    }
  };

  const removeRoadPath = () => {
    const editorId = editor.map.editorMetadata?.roadPath;
    if (!editorId) return;
    const result = commitOperation({ type: 'remove_road_path', editorId });
    if (result) {
      setSelected(null);
      setNotice(`Polilínea ${editorId} eliminada de la copia.`);
    }
  };

  const togglePlaza = () => {
    if (editor.map.map.layout.plaza) {
      const result = commitOperation({ type: 'remove_plaza' });
      if (result) {
        setSelected(null);
        setNotice('Plaza eliminada de la copia experimental.');
      }
    } else {
      const result = commitOperation({ type: 'set_plaza', position: { x: 0, z: 0 }, radius: 5.5 });
      if (result) {
        const plaza: VillaEditableSelection = { kind: 'plaza', editorId: 'plaza' };
        setSelected(plaza);
        resetDraft(plaza, result.map);
        setNotice('Plaza creada en el centro del mapa.');
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelDrag();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const selectedIsEditable = selected?.kind === 'building' ||
    selected?.kind === 'trainer' ||
    selected?.kind === 'sign' ||
    selected?.kind === 'encounter-zone' ||
    selected?.kind === 'road' ||
    selected?.kind === 'road-path' ||
    selected?.kind === 'plaza' ||
    selected?.kind === 'clear-point';
  return (
    <main className="map-preview-page map-editor-page">
      <header className="map-preview-header map-editor-header">
        <div>
          <p className="map-preview-eyebrow">Soul Dolls v1.5 · Editor experimental</p>
          <h1>Villa Marionette</h1>
          <p className="map-preview-subtitle">Edición local sobre una copia · no conectado al runtime</p>
        </div>
        <div className="map-editor-toolbar">
          <span className="map-preview-badge">COPIA EXPERIMENTAL</span>
          <span className="map-editor-pending" aria-live="polite">
            {editor.history.length} cambio{editor.history.length === 1 ? '' : 's'} pendiente{editor.history.length === 1 ? '' : 's'}
          </span>
          <button type="button" disabled={editor.history.length === 0} onClick={undo}>Deshacer</button>
          <button type="button" className="map-preview-secondary" onClick={reset}>Restablecer</button>
          <button type="button" onClick={exportJson}>Exportar JSON</button>
        </div>
      </header>

      <div className="map-preview-layout map-editor-layout">
        <section className="map-preview-canvas-panel map-editor-canvas-panel" aria-label="Editor del mapa">
          {preview.scene ? (
            <SceneSvg
              scene={preview.scene}
              selected={selected}
              drag={drag}
              onSelect={selectObject}
              onBeginDrag={beginDrag}
              onDragMove={moveDrag}
              onDragEnd={finishDrag}
              onDragCancel={cancelDrag}
            />
          ) : (
            <div className="map-preview-error" role="alert">
              Error al generar vista previa: {preview.error}
            </div>
          )}
          <div className="map-preview-legend">
            <span><i className="legend-road" /> Caminos</span>
            <span><i className="legend-zone" /> Encuentros</span>
            <span><i className="legend-building" /> Huellas, no GLB</span>
            <span><i className="legend-trainer" /> Entrenadores</span>
            <span><i className="legend-sign" /> Letreros</span>
          </div>
          {drag && (
            <div className="map-preview-notice" role="status">
              Posición provisional: X {drag.position.x.toFixed(2)}, Z {drag.position.z.toFixed(2)}. Suelta para confirmar o pulsa Escape para cancelar.
            </div>
          )}
          {error && <p className="map-preview-error" role="alert">{error}</p>}
          {notice && <p className="map-preview-notice" role="status">{notice}</p>}
        </section>

        <aside className="map-preview-sidebar map-editor-sidebar">
          <section className="map-preview-card">
            <h2>Propiedades</h2>
            {selected && selectedDetails ? (
              <div className="map-editor-properties">
                <span className="map-editor-object-type">{selectedDetails.label}</span>
                <strong className="map-editor-object-id">{selected.editorId}</strong>
                {(selected.kind === 'building' ||
                  selected.kind === 'trainer' ||
                  selected.kind === 'sign' ||
                  selected.kind === 'road-path') && (
                  <>
                    <label htmlFor="editor-x">{selected.kind === 'sign' ? 'Columna' : 'X · mundo'}</label>
                    <input
                      id="editor-x"
                      inputMode="decimal"
                      value={draft.x}
                      onChange={(event) => setDraft({ ...draft, x: event.target.value })}
                    />
                    <label htmlFor="editor-z">{selected.kind === 'sign' ? 'Fila' : 'Z · mundo'}</label>
                    <input
                      id="editor-z"
                      inputMode="decimal"
                      value={draft.z}
                      onChange={(event) => setDraft({ ...draft, z: event.target.value })}
                    />
                  </>
                )}
                {selected.kind === 'road' && (
                  <>
                    <label htmlFor="editor-road-coordinate">{selected.axis === 'x' ? 'Coordenada X' : 'Coordenada Z'}</label>
                    <input
                      id="editor-road-coordinate"
                      inputMode="decimal"
                      value={selected.axis === 'x' ? draft.x : draft.z}
                      onChange={(event) => setDraft({
                        ...draft,
                        [selected.axis === 'x' ? 'x' : 'z']: event.target.value,
                      })}
                    />
                    <label htmlFor="editor-road-width">Semiancho del camino</label>
                    <input
                      id="editor-road-width"
                      inputMode="decimal"
                      value={draft.roadWidth}
                      onChange={(event) => setDraft({ ...draft, roadWidth: event.target.value })}
                    />
                  </>
                )}
                {selected.kind === 'encounter-zone' && (
                  <>
                    <label htmlFor="editor-zone-min-x">X mínima</label>
                    <input id="editor-zone-min-x" inputMode="decimal" value={draft.minX} onChange={(event) => setDraft({ ...draft, minX: event.target.value })} />
                    <label htmlFor="editor-zone-max-x">X máxima</label>
                    <input id="editor-zone-max-x" inputMode="decimal" value={draft.maxX} onChange={(event) => setDraft({ ...draft, maxX: event.target.value })} />
                    <label htmlFor="editor-zone-min-z">Z mínima</label>
                    <input id="editor-zone-min-z" inputMode="decimal" value={draft.minZ} onChange={(event) => setDraft({ ...draft, minZ: event.target.value })} />
                    <label htmlFor="editor-zone-max-z">Z máxima</label>
                    <input id="editor-zone-max-z" inputMode="decimal" value={draft.maxZ} onChange={(event) => setDraft({ ...draft, maxZ: event.target.value })} />
                    <label htmlFor="editor-rate">Tasa de encuentro</label>
                    <input
                      id="editor-rate"
                      inputMode="decimal"
                      value={draft.encounterRate}
                      onChange={(event) => setDraft({ ...draft, encounterRate: event.target.value })}
                    />
                  </>
                )}
                {(selected.kind === 'plaza' || selected.kind === 'clear-point') && (
                  <>
                    <label htmlFor="editor-x">X · mundo</label>
                    <input id="editor-x" inputMode="decimal" value={draft.x} onChange={(event) => setDraft({ ...draft, x: event.target.value })} />
                    <label htmlFor="editor-z">Z · mundo</label>
                    <input id="editor-z" inputMode="decimal" value={draft.z} onChange={(event) => setDraft({ ...draft, z: event.target.value })} />
                    <label htmlFor="editor-radius">{selected.kind === 'plaza' ? 'Radio' : 'Radio reservado'}</label>
                    <input id="editor-radius" inputMode="decimal" value={draft.radius} onChange={(event) => setDraft({ ...draft, radius: event.target.value })} />
                  </>
                )}
                {selectedDetails.readOnlyReason && (
                  <p className="map-editor-readonly">{selectedDetails.readOnlyReason}</p>
                )}
                {selectedIsEditable && (
                  <div className="map-preview-actions">
                    <button type="button" onClick={applyDraft}>Aplicar</button>
                    <button
                      type="button"
                      className="map-preview-secondary"
                      onClick={() => {
                        resetDraft(selected);
                        setError('');
                      }}
                    >
                      Cancelar edición
                    </button>
                    {selected.kind === 'road' && (
                      <button type="button" className="map-preview-danger" onClick={removeSelectedRoad}>
                        Eliminar camino
                      </button>
                    )}
                    {selected.kind === 'plaza' && (
                      <button type="button" className="map-preview-danger" onClick={togglePlaza}>
                        Eliminar plaza
                      </button>
                    )}
                    {selected.kind === 'road-path' && (
                      <button type="button" className="map-preview-danger" onClick={removeRoadPath}>
                        Eliminar polilínea
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p>Selecciona un objeto del mapa para ver sus propiedades. Arrastra edificios, entrenadores o letreros para moverlos.</p>
            )}
          </section>

          <section className="map-preview-card">
            <h2>Estructura del mapa</h2>
            <p>Los caminos rectos conservan su ID aunque se muevan. La polilínea se edita seleccionando y arrastrando sus vértices numerados.</p>
            <label htmlFor="new-road-coordinate">Coordenada para nuevo camino</label>
            <input
              id="new-road-coordinate"
              inputMode="decimal"
              value={newRoadCoordinate}
              onChange={(event) => setNewRoadCoordinate(event.target.value)}
            />
            <div className="map-preview-actions">
              <button type="button" onClick={() => addRoad('x')}>Agregar camino X</button>
              <button type="button" onClick={() => addRoad('z')}>Agregar camino Z</button>
              <button type="button" className="map-preview-secondary" onClick={togglePlaza}>
                {editor.map.map.layout.plaza ? 'Plaza presente' : 'Crear plaza'}
              </button>
            </div>
            {!editor.map.map.layout.roadPath && (
              <>
                <label htmlFor="road-path-points">Puntos iniciales de polilínea (JSON)</label>
                <textarea
                  id="road-path-points"
                  spellCheck={false}
                  value={roadPathPoints}
                  onChange={(event) => setRoadPathPoints(event.target.value)}
                />
                <div className="map-preview-actions">
                  <button type="button" onClick={addRoadPath}>Crear polilínea</button>
                </div>
              </>
            )}
          </section>

          <section className="map-preview-card">
            <h2>Controles</h2>
            <ul className="map-preview-visible-list">
              <li>Arrastra caminos rectos, vértices de polilínea, zonas, reservas, plaza, edificios, entrenadores y letreros.</li>
              <li>Los letreros se ajustan a celdas válidas.</li>
              <li>Usa el panel para introducir coordenadas y pulsa Aplicar.</li>
              <li>Escape cancela un arrastre; Ctrl/Cmd+Z deshace.</li>
              <li>Un cambio pendiente equivale a una acción confirmada desde el documento inicial.</li>
            </ul>
          </section>

          <section className="map-preview-card map-preview-omissions">
            <h2>No representado</h2>
            <ul>
              {preview.scene?.notRepresented.map((item) => (
                <li key={item.label}>
                  <strong>{item.label}</strong>
                  <span>{item.reason}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
