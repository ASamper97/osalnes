/**
 * ResourceWizardStep7Review — versión 7b
 *
 * Amplía la versión del paso 7a con:
 *   - Selector modo publicación en el modal (ahora vs programar)
 *   - Panel de sugerencias IA (antes del dashboard de score)
 *   - Panel historial de cambios (plegable, al final)
 *   - Badge de estado actual (draft / scheduled / published)
 */

import { useMemo, useState } from 'react';
import HelpBlock from '../components/HelpBlock';
import ScoreDashboard from '../components/ScoreDashboard';
import StepCard from '../components/StepCard';
import PidCompletenessCard, { type PidGroup } from '../components/PidCompletenessCard';
import PublishModal from '../components/PublishModal';
import ImprovementSuggestions, {
  type ImprovementSuggestion,
} from '../components/ImprovementSuggestions';
import AuditLogPanel, { type AuditEntry } from '../components/AuditLogPanel';
import {
  auditResource,
  type QualityStep,
  type ResourceSnapshot,
} from '@osalnes/shared/data/quality-engine';
import {
  type PublicationStatus,
  PUBLICATION_STATUS_LABELS,
  formatScheduleForDisplay,
} from '@osalnes/shared/data/publication-status';
import { STEP7_COPY } from './step7-review.copy';

const STEPS: QualityStep[] = [
  'identification',
  'content',
  'location',
  'classification',
  'multimedia',
  'seo',
];

export interface ResourceWizardStep7ReviewProps {
  snapshot: ResourceSnapshot;

  /** Estado de publicación actual (7b) */
  publicationStatus: PublicationStatus;
  /** Fecha programada si aplica (7b) */
  scheduledPublishAt: string | null;
  /** Fecha de última publicación si la hubo (7b) */
  publishedAt: string | null;

  onGoToStep: (step: QualityStep) => void;
  onChangeVisibleOnMap: (next: boolean) => void;
  onSaveDraft: () => Promise<void>;

  /** Publicar inmediatamente */
  onPublishNow: () => Promise<void>;

  /** Programar publicación en una fecha UTC ISO (7b) */
  onSchedulePublish: (utcIso: string) => Promise<void>;

  /** Solicitar sugerencias IA (7b) */
  onRequestAiSuggestions: () => Promise<ImprovementSuggestion[]>;

  /** Cargar historial desde audit_log (7b) */
  onLoadAuditLog: () => Promise<AuditEntry[]>;

  onPrevious: () => void;
}

export default function ResourceWizardStep7Review({
  snapshot,
  publicationStatus,
  scheduledPublishAt,
  publishedAt,
  onGoToStep,
  onChangeVisibleOnMap,
  onSaveDraft,
  onPublishNow,
  onSchedulePublish,
  onRequestAiSuggestions,
  onLoadAuditLog,
  onPrevious,
}: ResourceWizardStep7ReviewProps) {
  const COPY = STEP7_COPY;
  const [modalOpen, setModalOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const report = useMemo(() => auditResource(snapshot), [snapshot]);

  // ─── PID groups desde snapshot (sin cambios vs 7a) ─────────────────
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
      { key: 'mainType', count: count('tipo-turismo.'), isMandatory: false },
      {
        key: 'amenities',
        count: count('caracteristicas.') + count('servicios.'),
        isMandatory: false,
      },
      {
        key: 'accessibility',
        count:
          count('caracteristicas.accesible-') +
          count('caracteristicas.aseo-adaptado') +
          count('caracteristicas.aparcamiento-reservado') +
          count('caracteristicas.perro-guia-permitido') +
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
      { key: 'editorial', count: count('curaduria-editorial.'), isMandatory: false },
    ];
  }, [snapshot.tagKeys, snapshot.mainTypeKey, snapshot.municipioId, snapshot.servesCuisine]);

  const totalExportable = useMemo(
    () => snapshot.tagKeys.filter((k) => !k.startsWith('curaduria-editorial.')).length,
    [snapshot.tagKeys],
  );

  // ─── Handlers ───────────────────────────────────────────────────────
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

  const handleConfirmPublishNow = async () => {
    setErrorMsg(null);
    setPublishing(true);
    try {
      await onPublishNow();
      setModalOpen(false);
    } catch {
      setErrorMsg(COPY.errors.publish);
      setPublishing(false);
    }
  };

  const handleConfirmSchedule = async (utcIso: string) => {
    setErrorMsg(null);
    setPublishing(true);
    try {
      await onSchedulePublish(utcIso);
      setModalOpen(false);
    } catch {
      setErrorMsg(COPY.errors.schedule);
      setPublishing(false);
    }
  };

  return (
    <div className="step7-content">
      <header className="step7-header">
        <h2>{COPY.header.title}</h2>
        <p>{COPY.header.subtitle}</p>
        <StatusBadge
          status={publicationStatus}
          scheduledAt={scheduledPublishAt}
          publishedAt={publishedAt}
        />
      </header>

      <HelpBlock
        storageKey="resource-wizard-step7"
        title={COPY.helpBlock.title}
        toggleHideLabel={COPY.helpBlock.toggleHide}
        toggleShowLabel={COPY.helpBlock.toggleShow}
      >
        <ul>
          {COPY.helpBlock.bullets.map((b) => <li key={b}>{b}</li>)}
        </ul>
        <p className="help-block-note">{COPY.helpBlock.note}</p>
      </HelpBlock>

      {/* 1. Dashboard global */}
      <ScoreDashboard report={report} />

      {/* 2. Sugerencias IA (nuevo 7b) */}
      <ImprovementSuggestions
        onRequestSuggestions={onRequestAiSuggestions}
        onGoToStep={onGoToStep}
        hasEnoughContent={snapshot.descriptionEs.trim().length > 50}
      />

      {/* 3. Grid de tarjetas por paso */}
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

      {/* 4. PID (plegada) */}
      <PidCompletenessCard groups={pidGroups} totalExportable={totalExportable} />

      {/* 5. Opciones de publicación */}
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
            <small className="muted">{COPY.publicationOptions.visibleOnMap.hint}</small>
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
        <p role="alert" className="step7-error">⚠️ {errorMsg}</p>
      )}

      {/* 6. Acciones */}
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
            onClick={() => setModalOpen(true)}
            disabled={publishing || savingDraft}
          >
            {COPY.actions.publish}
          </button>
        </div>
      </footer>

      {/* 7. Historial de cambios (plegable, nuevo 7b) */}
      <AuditLogPanel onLoadEntries={onLoadAuditLog} />

      {/* Modal */}
      {modalOpen && (
        <PublishModal
          report={report}
          onConfirmPublishNow={handleConfirmPublishNow}
          onConfirmSchedule={handleConfirmSchedule}
          onCancel={() => !publishing && setModalOpen(false)}
          loading={publishing}
        />
      )}
    </div>
  );
}

// ─── Sub-componente: badge de estado actual ───────────────────────────

function StatusBadge({
  status,
  scheduledAt,
  publishedAt,
}: {
  status: PublicationStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
}) {
  const label = (() => {
    if (status === 'scheduled' && scheduledAt) {
      return STEP7_COPY.statusBadge.scheduled.replace('{date}', formatScheduleForDisplay(scheduledAt));
    }
    if (status === 'published' && publishedAt) {
      return STEP7_COPY.statusBadge.published.replace('{date}', formatScheduleForDisplay(publishedAt));
    }
    return PUBLICATION_STATUS_LABELS[status];
  })();

  return (
    <div className={`step7-status-badge step7-status-badge-${status}`}>
      <span className="step7-status-badge-dot" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
