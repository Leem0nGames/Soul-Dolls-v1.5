import { useMemo, useState } from 'react';
import pilotDocument from '../data/experimental/villa_marionette.v1.json';
import {
  applyVillaMapOperations,
} from '../data/experimental/villaMapOperations';
import {
  createVillaMapPreview,
  type VillaPreviewScene,
} from '../data/experimental/villaMapPreview';
import type { SerializedVilla } from '../data/experimental/villaMapTypes';
import './villa-map-preview.css';

interface Selection {
  kind: string;
  editorId: string;
  details: string;
}

const sourceDocument = JSON.parse(JSON.stringify(pilotDocument)) as SerializedVilla;
const INITIAL_OPERATIONS = `[
  {
    "type": "move_building",
    "editorId": "garden-home",
    "position": { "x": -15, "z": 1 }
  }
]`;
const PIXELS_PER_WORLD_UNIT = 8;
const SVG_SIZE = 640;
const SVG_CENTER = SVG_SIZE / 2;

function screenX(x: number): number {
  return SVG_CENTER + x * PIXELS_PER_WORLD_UNIT;
}

function screenY(z: number): number {
  return SVG_CENTER - z * PIXELS_PER_WORLD_UNIT;
}

function SceneSvg({
  scene,
  onSelect,
}: {
  scene: VillaPreviewScene;
  onSelect: (selection: Selection) => void;
}) {
  const mapPixelsWide = scene.width * PIXELS_PER_WORLD_UNIT;
  const mapPixelsDeep = scene.depth * PIXELS_PER_WORLD_UNIT;
  const mapLeft = SVG_CENTER - mapPixelsWide / 2;
  const mapTop = SVG_CENTER - mapPixelsDeep / 2;
  const tilePixels = scene.width / 40 * PIXELS_PER_WORLD_UNIT;
  const terrainInset = scene.width / 40 * 2 * PIXELS_PER_WORLD_UNIT;

  const selectable = (
    kind: string,
    editorId: string,
    details: string,
  ) => ({
    onClick: () => onSelect({ kind, editorId, details }),
    onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect({ kind, editorId, details });
      }
    },
    tabIndex: 0,
    role: 'button' as const,
    'aria-label': `${kind}: ${editorId}`,
    'data-editor-id': editorId,
  });

  return (
    <svg
      className="map-preview-svg"
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      role="img"
      aria-label={`Vista esquemática de ${scene.name}`}
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

      {scene.roads.map((road, index) => (
        <polyline
          key={`road-${index}`}
          points={road.points.map(({ x, z }) => `${screenX(x)},${screenY(z)}`).join(' ')}
          strokeWidth={scene.roadHalfWidth * 2 * PIXELS_PER_WORLD_UNIT}
          className="map-preview-road"
        />
      ))}

      {scene.plaza && (
        <circle
          cx={screenX(scene.plaza.x)}
          cy={screenY(scene.plaza.z)}
          r={scene.plaza.radius * PIXELS_PER_WORLD_UNIT}
          className="map-preview-plaza"
        />
      )}

      {scene.wildZones.map((zone) => (
        <g
          key={zone.editorId}
          {...selectable('Zona de encuentro', zone.editorId, zone.name)}
          className="map-preview-selectable"
        >
          <rect
            x={screenX(zone.minX)}
            y={screenY(zone.maxZ)}
            width={(zone.maxX - zone.minX) * PIXELS_PER_WORLD_UNIT}
            height={(zone.maxZ - zone.minZ) * PIXELS_PER_WORLD_UNIT}
            className="map-preview-wild-zone"
          />
          <text x={screenX(zone.minX) + 4} y={screenY(zone.maxZ) + 12} className="map-preview-label">
            {zone.editorId}
          </text>
        </g>
      ))}

      {scene.clearPointReservations.map((reservation) => (
        <g
          key={reservation.editorId}
          {...selectable('Reserva despejada', reservation.editorId, `Radio ${reservation.radius}`)}
          className="map-preview-selectable"
        >
          <circle
            cx={screenX(reservation.x)}
            cy={screenY(reservation.z)}
            r={reservation.radius * PIXELS_PER_WORLD_UNIT}
            className="map-preview-clearance"
          />
          <text
            x={screenX(reservation.x) + 5}
            y={screenY(reservation.z) - 4}
            className="map-preview-tiny-label"
          >
            {reservation.editorId}
          </text>
        </g>
      ))}

      {scene.buildings.map((building) => (
        <g
          key={building.editorId}
          {...selectable('Huella de edificio', building.editorId, `Referencia GLB: ${building.file}`)}
          className="map-preview-selectable"
        >
          <rect
            x={screenX(building.x) - building.halfWidth * PIXELS_PER_WORLD_UNIT}
            y={screenY(building.z) - building.halfDepth * PIXELS_PER_WORLD_UNIT}
            width={building.halfWidth * 2 * PIXELS_PER_WORLD_UNIT}
            height={building.halfDepth * 2 * PIXELS_PER_WORLD_UNIT}
            className="map-preview-building"
          />
          <text
            x={screenX(building.x)}
            y={screenY(building.z)}
            textAnchor="middle"
            dominantBaseline="middle"
            className="map-preview-building-label"
          >
            {building.editorId}
          </text>
          <circle
            cx={screenX(building.entrance.x)}
            cy={screenY(building.entrance.z)}
            r="4"
            className="map-preview-entrance"
          />
        </g>
      ))}

      {scene.trainers.map((trainer) => (
        <g
          key={trainer.editorId}
          {...selectable('Entrenador', trainer.editorId, trainer.name)}
          className="map-preview-selectable"
        >
          <circle cx={screenX(trainer.x)} cy={screenY(trainer.z)} r="8" className="map-preview-trainer" />
          <text x={screenX(trainer.x) + 10} y={screenY(trainer.z) + 3} className="map-preview-label">
            {trainer.editorId}
          </text>
        </g>
      ))}

      {scene.signs.map((sign) => {
        const x = (sign.col - 20 + 0.5) * scene.width / 40;
        const z = (sign.row - 20 + 0.5) * scene.depth / 40;
        return (
          <g
            key={sign.editorId}
            {...selectable('Letrero', sign.editorId, `Cuadrícula ${sign.col}, ${sign.row}`)}
            className="map-preview-selectable"
          >
            <path
              d={`M ${screenX(x)} ${screenY(z) - 7} L ${screenX(x) + 6} ${screenY(z) + 5} L ${screenX(x) - 6} ${screenY(z) + 5} Z`}
              className="map-preview-sign"
            />
            <text x={screenX(x) + 8} y={screenY(z)} className="map-preview-tiny-label">
              {sign.editorId}
            </text>
          </g>
        );
      })}

      {scene.connections.map((connection) => (
        <g
          key={connection.editorId}
          {...selectable('Conexión', connection.editorId, `Salida hacia ${connection.toMap}`)}
          className="map-preview-selectable"
        >
          <circle cx={screenX(connection.x)} cy={screenY(connection.z)} r="7" className="map-preview-connection" />
          <text x={screenX(connection.x) + 9} y={screenY(connection.z) - 8} className="map-preview-label">
            {connection.editorId}
          </text>
        </g>
      ))}

      <text x={mapLeft + 8} y={mapTop + mapPixelsDeep - 8} className="map-preview-scale-label">
        Esquema · no es el terreno texturizado
      </text>
    </svg>
  );
}

export default function VillaMapPreviewApp() {
  const [map, setMap] = useState<SerializedVilla>(() =>
    JSON.parse(JSON.stringify(sourceDocument)) as SerializedVilla
  );
  const [operationText, setOperationText] = useState(INITIAL_OPERATIONS);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [notice, setNotice] = useState('Vista cargada desde una copia del documento experimental.');

  const preview = useMemo(() => {
    try {
      return { scene: createVillaMapPreview(map), error: '' };
    } catch (previewError) {
      return {
        scene: null,
        error: previewError instanceof Error ? previewError.message : String(previewError),
      };
    }
  }, [map]);

  const applyOperations = () => {
    setError('');
    setNotice('');
    let operations: unknown;
    try {
      operations = JSON.parse(operationText);
    } catch (parseError) {
      setError(`JSON de operaciones inválido: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      return;
    }
    if (!Array.isArray(operations)) {
      setError('Las operaciones deben ser un array JSON.');
      return;
    }

    const result = applyVillaMapOperations(sourceDocument, operations);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMap(result.map);
    setSelection(null);
    setNotice(`Vista actualizada con ${operations.length} operación(es) sobre una copia.`);
  };

  const resetPreview = () => {
    setMap(JSON.parse(JSON.stringify(sourceDocument)) as SerializedVilla);
    setSelection(null);
    setError('');
    setNotice('Vista restablecida desde el documento experimental original.');
  };

  return (
    <main className="map-preview-page">
      <header className="map-preview-header">
        <div>
          <p className="map-preview-eyebrow">Soul Dolls v1.5 · Fase 7</p>
          <h1>Vista previa experimental</h1>
          <p className="map-preview-subtitle">
            {preview.scene?.name ?? 'Villa Marionette'} · esquema de datos, no render del juego
          </p>
        </div>
        <span className="map-preview-badge">AISLADA DEL RUNTIME</span>
      </header>

      <div className="map-preview-layout">
        <section className="map-preview-canvas-panel" aria-label="Plano esquemático">
          {preview.scene ? (
            <SceneSvg scene={preview.scene} onSelect={setSelection} />
          ) : (
            <div className="map-preview-error" role="alert">
              Error al generar vista previa: {preview.error}
            </div>
          )}
          <div className="map-preview-legend">
            <span><i className="legend-road" /> Caminos</span>
            <span><i className="legend-zone" /> Encuentros</span>
            <span><i className="legend-building" /> Huellas</span>
            <span><i className="legend-trainer" /> Entrenadores</span>
            <span><i className="legend-sign" /> Letreros</span>
          </div>
          {selection && (
            <div className="map-preview-selection" aria-live="polite">
              <strong>{selection.kind}: {selection.editorId}</strong>
              <span>{selection.details}</span>
            </div>
          )}
        </section>

        <aside className="map-preview-sidebar">
          <section className="map-preview-card">
            <h2>Aplicar operaciones</h2>
            <p>Se aplican siempre a una copia nueva del JSON experimental. No se guarda ningún cambio.</p>
            <label htmlFor="map-preview-operations">Array JSON de operaciones</label>
            <textarea
              id="map-preview-operations"
              spellCheck={false}
              value={operationText}
              onChange={(event) => setOperationText(event.target.value)}
            />
            <div className="map-preview-actions">
              <button type="button" onClick={applyOperations}>Aplicar a la vista</button>
              <button
                type="button"
                className="map-preview-secondary"
                onClick={() => setOperationText('[]')}
              >
                Vaciar
              </button>
              <button type="button" className="map-preview-secondary" onClick={resetPreview}>
                Restablecer
              </button>
            </div>
            {error && <p className="map-preview-error" role="alert">{error}</p>}
            {notice && <p className="map-preview-notice" role="status">{notice}</p>}
          </section>

          <section className="map-preview-card">
            <h2>Contrato visible</h2>
            <p>Los marcadores son identificables por ID editorial. Selecciona uno para ver sus datos.</p>
            <ul className="map-preview-visible-list">
              <li>Geometría, caminos y plaza</li>
              <li>Zonas de encuentro: {preview.scene?.wildZones.length ?? 0}</li>
              <li>Huella y referencia GLB de edificios: {preview.scene?.buildings.length ?? 0}</li>
              <li>Entrenadores, letreros, salidas y reservas</li>
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
