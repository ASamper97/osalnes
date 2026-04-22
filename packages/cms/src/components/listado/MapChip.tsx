/**
 * MapChip — indicador de visibilidad en mapa + estado de coordenadas
 *
 * 3 estados:
 *   - visible + con coords → verde "Visible" con icono 📍
 *   - visible + sin coords → rojo "Sin coordenadas" (configuración rota)
 *   - no visible → gris "Oculto"
 */

import { LIST_COPY } from '../../pages/listado.copy';

const COPY = LIST_COPY.mapChip;

export default function MapChip({
  visibleOnMap,
  hasCoordinates,
}: {
  visibleOnMap: boolean;
  hasCoordinates: boolean;
}) {
  if (!visibleOnMap) {
    return (
      <span className="list-map-chip list-map-chip-hidden" title="Oculto en el mapa público">
        {COPY.hidden}
      </span>
    );
  }
  if (!hasCoordinates) {
    return (
      <span
        className="list-map-chip list-map-chip-missing"
        title="Marcado como visible pero sin coordenadas — no aparecerá en el mapa"
      >
        ⚠ {COPY.missingCoords}
      </span>
    );
  }
  return (
    <span className="list-map-chip list-map-chip-visible" title="Visible en el mapa público">
      📍 {COPY.visible}
    </span>
  );
}
