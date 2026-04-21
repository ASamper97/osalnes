/**
 * ResourceWizardStep7Review — Paso 7 del wizard (7a)
 *
 * Orquesta el resumen final:
 *   1. HelpBlock
 *   2. ScoreDashboard (global score grande)
 *   3. Grid de 6 StepCards con checkmarks honestos
 *   4. PidCompletenessCard (plegada por defecto)
 *   5. Opciones de publicación (checkbox "visible en mapa")
 *   6. Botones: guardar borrador / publicar
 *   7. PublishModal de confirmación si hay problemas
 *
 * Orden según decisión 2-A del usuario: resumen arriba, publicación abajo.
 *
 * El motor de calidad se ejecuta con `useMemo` cada vez que cambia el
 * snapshot, sin llamadas IA.
 */

import { useMemo, useState } from 'react';
import HelpBlock from '../components/HelpBlock';
import ScoreDashboard from '../components/ScoreDashboard';
import StepCard from '../components/StepCard';
import PidCompletenessCard, { type PidGroup } from '../components/PidCompletenessCard';
import PublishModal from '../components/PublishModal';
import {
  auditResource,
  type QualityStep,
  type ResourceSnapshot,
} from '@osalnes/shared/data/quality-engine';
import { STEP7_COPY } from './step7-review.copy';

// ─── Props ─────────────────────────────────────────────────────────────

export interface ResourceWizardStep7ReviewProps {
  /** Snapshot completo del recurso (estado del wizard) */
  snapshot: ResourceSnapshot;

  /** Saltar al paso N para editar */
  onGoToStep: (step: QualityStep) => void;

  /** Cambiar el estado "visible en mapa público" */
  onChangeVisibleOnMap: (next: boolean) => void;

  /** Persistir como borrador */
  onSaveDraft: () => Promise<void>;

  /** Publicar (cambia publication_status → published) */
  onPublish: () => Promise<void>;

  /** Callback al pulsar anterior */
  onPrevious: () => void;
}

const STEPS: QualityStep[] = [
  'identification',
  'content',
  'location',
  'classification',
  'multimedia',
  'seo',
];

export default function ResourceWizardStep7Review({
  snapshot,
  onGoToStep,
  onChangeVisibleOnMap,
  onSaveDraft,
  onPublish,
  onPrevious,
}: ResourceWizardStep7ReviewProps) {
  const COPY = STEP7_COPY;
  const [modalOpen, setModalOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auditoría reactiva
  const report = useMemo(() => auditResource(snapshot), [snapshot]);

  // ─── Compute PID groups desde snapshot ──────────────────────────────
  const pidGroups = useMemo<PidGroup[]>(() => {
    const tagKeys = snapshot.tagKeys;
    const count = (prefix: string) =>
      tagKeys.filter((k) => k.startsWith(prefix)).length;

    return [
      {
        key: 'schemaType',
        count: snapshot.mainTypeKey ? 1 : 0,
        isMandatory: true,
        isFilled: snapshot.mainTypeKey != null,
      },
      {
        key: 'mainType',
        count: count('tipo-turismo.'),
        isMandatory: false,
      },
      {
        key: 'amenities',
        count: count('caracteristicas.') + count('servicios.'),
        isMandatory: false,
      },
      {
        key: 'accessibility',
        count: count('caracteristicas.accesible-') + count('caracteristicas.aseo-adaptado') +
               count('caracteristicas.aparcamiento-reservado') + count('caracteristicas.perro-guia-permitido') +
               count('caracteristicas.bucle-magnetico'),
        isMandatory: false,
      },
      {
        key: 'municipio',
        count: snapshot.municipioId ? 1 : 0,
        isMandatory: true,
        isFilled: snapshot.municipioId != null,
      },
      {
        key: 'gastronomy',
        count: snapshot.servesCuisine.length + count('gastronomia.'),
        isMandatory: false,
      },
      {
        key: 'editorial',
        count: count('curaduria-editorial.'),
        isMandatory: false,
      },
    ];
  }, [snapshot.tagKeys, snapshot.mainTypeKey, snapshot.municipioId, snapshot.servesCuisine]);

  // Total exportable (sin curaduría editorial, que es solo CMS)
  const totalExportable = useMemo(() => {
    return snapshot.tagKeys.filter((k) => !k.startsWith('curaduria-editorial.')).length;
  }, [snapshot.tagKeys]);

  // ─── Handlers ─────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    setErrorMsg(null);
    setSavingDraft(true);
    try {
      await onSaveDraft();
    } catch {
      setErrorMsg(COPY.errors.saveDraft);
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePublishClick = () => {
    // Modal siempre (decisión 6-A), incluso si está todo limpio
    setModalOpen(true);
  };

  const handleConfirmPublish = async () => {
    setErrorMsg(null);
    setPublishing(true);
    try {
      await onPublish();
      setModalOpen(false);
    } catch {
      setErrorMsg(COPY.errors.publish);
      setPublishing(false);
    }
  };

  return (
    <div className="step7-content">
      <header className="step7-header">
        <h2>{COPY.header.title}</h2>
        <p>{COPY.header.subtitle}</p>
      </header>

      <HelpBlock
        storageKey="resource-wizard-step7"
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

      {/* ═══════════ 1. Score dashboard ═══════════ */}
      <ScoreDashboard report={report} />

      {/* ═══════════ 2. Grid de tarjetas por paso ═══════════ */}
      <div className="step7-cards-grid">
        {STEPS.map((step) => (
          <StepCard
            key={step}
            step={step}
            aggregate={report.byStep[step]}
            report={report}
            onEdit={onGoToStep}
          />
        ))}
      </div>

      {/* ═══════════ 3. PID (plegada) ═══════════ */}
      <PidCompletenessCard groups={pidGroups} totalExportable={totalExportable} />

      {/* ═══════════ 4. Opciones de publicación ═══════════ */}
      <section className="step7-publish-options">
        <h3>{COPY.publicationOptions.title}</h3>

        <label className="step7-visible-check">
          <input
            type="checkbox"
            checked={snapshot.visibleOnMap}
            onChange={(e) => onChangeVisibleOnMap(e.target.checked)}
          />
          <div>
            <span className="step7-visible-check-label">
              {COPY.publicationOptions.visibleOnMap.label}
            </span>
            <small className="muted">
              {COPY.publicationOptions.visibleOnMap.hint}
            </small>
          </div>
        </label>

        <p className="step7-visible-note muted">
          💡 {COPY.publicationOptions.visibleOnMap.note}
        </p>

        <p className="step7-visible-note muted">
          {COPY.publicationOptions.indexableHint}
        </p>
      </section>

      {errorMsg && (
        <p role="alert" className="step7-error">
          ⚠️ {errorMsg}
        </p>
      )}

      {/* ═══════════ 5. Acciones ═══════════ */}
      <footer className="step7-actions">
        <button type="button" className="btn btn-ghost" onClick={onPrevious}>
          {COPY.actions.previous}
        </button>
        <div className="step7-actions-right">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleSaveDraft}
            disabled={savingDraft || publishing}
          >
            {savingDraft ? COPY.actions.saveDraftLoading : COPY.actions.saveDraft}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePublishClick}
            disabled={publishing || savingDraft}
          >
            {COPY.actions.publish}
          </button>
        </div>
      </footer>

      {/* ═══════════ Modal de publicación ═══════════ */}
      {modalOpen && (
        <PublishModal
          report={report}
          onConfirm={handleConfirmPublish}
          onCancel={() => !publishing && setModalOpen(false)}
          loading={publishing}
        />
      )}
    </div>
  );
}
