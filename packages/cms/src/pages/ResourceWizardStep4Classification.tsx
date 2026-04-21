/**
 * ResourceWizardStep4Classification — Paso 4 del wizard de recursos
 *
 * Dos grandes bloques:
 *
 *   1. Datos del establecimiento (condicional a la tipología)
 *      - Estrellas / tenedores / categoría
 *      - Aforo
 *      - Tipos de cocina (multi-select UNE)
 *
 *   2. Características y servicios (TagSelector existente)
 *      - Con botón "Sugerir etiquetas con IA" arriba
 *      - Con el grupo "Curaduría editorial" visualmente separado
 *
 * Este componente:
 *   - Recibe el estado desde el wizard padre y lo emite vía callbacks
 *   - No gestiona su propio estado (salvo el del panel IA interno)
 *   - Delega al TagSelector existente del repo (paso 0) que ya renderiza
 *     los badges PID/SOLO CMS según decisión 1-C
 */

import HelpBlock from '../components/HelpBlock';
import EstablishmentDetails, {
  type EstablishmentData,
} from '../components/EstablishmentDetails';
import SuggestTagsButton from '../components/SuggestTagsButton';
import TagSelector from '../components/TagSelector';
import { hasAnyEstablishmentField } from '@osalnes/shared/data/establishment-fields';
import { TAGS_BY_KEY } from '@osalnes/shared/data/tag-catalog';
import { STEP4_COPY } from './step4-classification.copy';

// ─── Props ─────────────────────────────────────────────────────────────

export interface ResourceWizardStep4ClassificationProps {
  /** Tipología principal del paso 1 */
  mainTypeKey: string | null;

  /** Datos de establecimiento */
  establishment: EstablishmentData;
  onChangeEstablishment: (next: EstablishmentData) => void;

  /** Tags seleccionados (array de keys) */
  selectedTagKeys: string[];
  onChangeSelectedTagKeys: (next: string[]) => void;

  /** Descripción ES del paso 2, para el sugeridor IA */
  descriptionEs: string;

  /** Municipio del paso 1, para contexto de la IA */
  municipio?: string | null;
}

// ─── Componente ────────────────────────────────────────────────────────

export default function ResourceWizardStep4Classification({
  mainTypeKey,
  establishment,
  onChangeEstablishment,
  selectedTagKeys,
  onChangeSelectedTagKeys,
  descriptionEs,
  municipio,
}: ResourceWizardStep4ClassificationProps) {
  const COPY = STEP4_COPY;

  const showEstablishment = hasAnyEstablishmentField(mainTypeKey);

  function handleApplyTags(newKeys: string[]) {
    // Añade sin duplicar
    const merged = Array.from(new Set([...selectedTagKeys, ...newKeys]));
    onChangeSelectedTagKeys(merged);
  }

  return (
    <div className="step4-content">
      <header className="step4-header">
        <h2>{COPY.header.title}</h2>
        <p>{COPY.header.subtitle}</p>
      </header>

      <HelpBlock
        storageKey="resource-wizard-step4"
        title={COPY.helpBlock.title}
        toggleHideLabel={COPY.helpBlock.toggleHide}
        toggleShowLabel={COPY.helpBlock.toggleShow}
      >
        <ul>
          {COPY.helpBlock.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p className="help-block-note">{COPY.helpBlock.note}</p>
      </HelpBlock>

      {/* ═══════════ 1. DATOS DEL ESTABLECIMIENTO (condicional) ═════ */}
      {showEstablishment && (
        <EstablishmentDetails
          mainTypeKey={mainTypeKey}
          data={establishment}
          onChange={onChangeEstablishment}
        />
      )}

      {/* ═══════════ 2. CARACTERÍSTICAS Y SERVICIOS ═════════════════ */}
      <section className="step4-tags-section">
        <header>
          <h3>{COPY.tags.sectionTitle}</h3>
          <p className="muted">{COPY.tags.sectionDesc}</p>
        </header>

        {/* Sugeridor IA (arriba del selector) */}
        <SuggestTagsButton
          descriptionEs={descriptionEs}
          mainTypeKey={mainTypeKey}
          municipio={municipio}
          currentTagKeys={selectedTagKeys}
          onApplyTags={handleApplyTags}
        />

        {/* TagSelector existente (paso 0) — recibe mainTypeKey para filtrar
            grupos aplicables y `selectedKeys` para el estado marcado.

            NOTA: las props concretas del TagSelector dependen de cómo lo
            haya implementado Claude Code en el paso 0. Si las props no
            coinciden con estas, ajustar en la integración. El contrato
            mínimo que asumimos es:

              - `mainTypeKey` para filtrar grupos visibles
              - `selectedKeys` o equivalente (array)
              - `onChange(next: string[])` como callback
              - Render interno con grupos "curaduria-editorial" separado
                visualmente (requiere que el CSS del grupo tenga
                className="tag-group tag-group-editorial"). */}
        {/* Adaptación al contrato real del TagSelector del paso 0:
            `resourceTypeLabel` es la xlsxLabel (p.ej. "Hotel") que se
            deriva del value schema.org del mainTag UNE. `value` en vez
            de `selectedKeys`. includeMunicipio=false porque el municipio
            ya se pide en el paso 1. */}
        <TagSelector
          resourceTypeLabel={mainTypeKey ? TAGS_BY_KEY[mainTypeKey]?.value ?? null : null}
          value={selectedTagKeys}
          onChange={onChangeSelectedTagKeys}
          includeMunicipio={false}
        />
      </section>
    </div>
  );
}
