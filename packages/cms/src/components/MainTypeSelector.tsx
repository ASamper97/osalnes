/**
 * MainTypeSelector — selector de tipología principal (paso 1 del wizard)
 *
 * Sustituye al desplegable legacy con ~40 valores inventados y a la lista
 * de "tipologías secundarias" por un único selector visual basado en los
 * 18 tags del grupo `tipo-de-recurso.*` del catálogo UNE 178503.
 *
 * Es la ÚNICA fuente de tipología del sistema. Si no encaja ninguna de las
 * 18, se añade al catálogo (tag-catalog.ts) con su mapping schema.org
 * correspondiente — nunca se añaden valores libres aquí.
 *
 * Acepta el valor actual como `value` (tag_key completo) y emite cambios
 * vía `onChange`. El padre guarda ese tag en `resource_tags` (como tag
 * con field='type') al hacer submit del wizard.
 */

import { useMemo, useState } from 'react';
import { TAGS_BY_GROUP, type Tag } from '@osalnes/shared/data/tag-catalog';

export interface MainTypeSelectorProps {
  /** tag_key del catálogo (p.ej. 'tipo-de-recurso.hotel') o null si sin elegir */
  value: string | null;
  onChange: (nextKey: string | null) => void;
  /** texto de ayuda opcional debajo del título */
  helperText?: string;
}

// Metadata visual por tipología (icono + descripción corta)
// Los iconos son emojis para mantener cero dependencias; si el proyecto
// usa lucide-react se pueden sustituir uno a uno sin tocar la lógica.
const TYPE_META: Record<string, { icon: string; hint: string }> = {
  'tipo-de-recurso.playa':            { icon: '🏖️', hint: 'Playa, cala o zona de baño' },
  'tipo-de-recurso.mirador':          { icon: '🔭', hint: 'Mirador, punto panorámico' },
  'tipo-de-recurso.museo':            { icon: '🏛️', hint: 'Museo o centro de interpretación' },
  'tipo-de-recurso.iglesia-capilla':  { icon: '⛪', hint: 'Iglesia, capilla, ermita, convento' },
  'tipo-de-recurso.pazo-arq-civil':   { icon: '🏰', hint: 'Pazo o edificio civil histórico' },
  'tipo-de-recurso.yacimiento-ruina': { icon: '🏺', hint: 'Yacimiento arqueológico o ruina' },
  'tipo-de-recurso.molino':           { icon: '⚙️', hint: 'Molino, aceña, elemento etnográfico' },
  'tipo-de-recurso.puerto-lonja':     { icon: '⚓', hint: 'Puerto pesquero o deportivo, lonja' },
  'tipo-de-recurso.espacio-natural':  { icon: '🌲', hint: 'Parque natural, espacio protegido' },
  'tipo-de-recurso.paseo-maritimo':   { icon: '🌊', hint: 'Paseo marítimo o atractivo costero' },
  'tipo-de-recurso.ruta':             { icon: '🥾', hint: 'Ruta de senderismo, BTT o itinerario' },
  'tipo-de-recurso.bodega':           { icon: '🍷', hint: 'Bodega DO Rías Baixas' },
  'tipo-de-recurso.restaurante':      { icon: '🍽️', hint: 'Restaurante, marisquería, taberna' },
  'tipo-de-recurso.hotel':            { icon: '🏨', hint: 'Hotel, hostal, pensión, parador' },
  'tipo-de-recurso.alojamiento-rural':{ icon: '🏡', hint: 'Casa rural, turismo verde, apartamento' },
  'tipo-de-recurso.camping':          { icon: '🏕️', hint: 'Camping o área de acampada' },
  'tipo-de-recurso.fiesta-festival':  { icon: '🎉', hint: 'Fiesta popular, festival, mercado' },
  'tipo-de-recurso.leyenda':          { icon: '📖', hint: 'Leyenda o tradición local (solo CMS)' },
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export default function MainTypeSelector({
  value,
  onChange,
  helperText,
}: MainTypeSelectorProps) {
  const [query, setQuery] = useState('');

  const types = useMemo(() => {
    const all = TAGS_BY_GROUP['tipo-de-recurso'] ?? [];
    if (!query.trim()) return all;
    const q = normalize(query);
    return all.filter(
      (t) => normalize(t.label).includes(q) || normalize(t.value).includes(q),
    );
  }, [query]);

  return (
    <div className="main-type-selector">
      <div className="main-type-selector-head">
        <div>
          <label className="main-type-selector-label">
            Tipología principal <span aria-hidden>*</span>
          </label>
          {helperText && <p className="main-type-selector-help">{helperText}</p>}
        </div>
        <input
          type="search"
          className="main-type-selector-search"
          placeholder="Buscar tipología…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar tipología"
        />
      </div>

      <div className="main-type-grid" role="radiogroup" aria-label="Tipología principal">
        {types.map((t: Tag) => {
          const meta = TYPE_META[t.key] ?? { icon: '📌', hint: '' };
          const selected = value === t.key;
          return (
            <button
              type="button"
              key={t.key}
              role="radio"
              aria-checked={selected}
              className={`main-type-card${selected ? ' main-type-card--on' : ''}`}
              onClick={() => onChange(selected ? null : t.key)}
            >
              <span className="main-type-card-icon" aria-hidden>
                {meta.icon}
              </span>
              <span className="main-type-card-body">
                <span className="main-type-card-title">{t.label}</span>
                {meta.hint && <span className="main-type-card-hint">{meta.hint}</span>}
              </span>
              {!t.pidExportable && (
                <span className="main-type-card-cms" title="Solo CMS — no se exporta a PID">
                  solo CMS
                </span>
              )}
            </button>
          );
        })}
        {types.length === 0 && (
          <p className="main-type-empty">
            Ninguna tipología coincide con "{query}". Prueba con otro término.
          </p>
        )}
      </div>
    </div>
  );
}
