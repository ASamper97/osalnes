/**
 * ResourceWizardStep8Relations — paso 8 del wizard (nuevo)
 *
 * Ubicado entre el paso 6 (SEO) y el paso 7 (Revisión). Opcional pero
 * accesible desde el stepper del wizard-global.
 *
 * Gestiona las relaciones del recurso con otros recursos, respetando
 * las 6 predicados de UNE 178503 (decisión 2-B), con bidireccionalidad
 * automática (3-A), autocomplete + modal avanzado (4-C), warnings
 * semánticos (6-C), validación de ciclos en jerárquicas (7-C), y
 * vista previa del JSON-LD para exportación al PID (5-C).
 */

import { useState, useCallback } from 'react';
import {
  type RelationPredicate,
  type RelationSearchResult,
  PREDICATES,
  detectSemanticWarning,
} from '@osalnes/shared/data/resource-relations';
import PredicatePicker from '../components/PredicatePicker';
import TargetAutocomplete from '../components/TargetAutocomplete';
import AdvancedRelationSearchModal, {
  type MunicipalityOption,
  type TypologyOption,
} from '../components/AdvancedRelationSearchModal';
import RelationsList from '../components/RelationsList';
import type { UseRelationsState } from '../hooks/useRelations';
import { STEP8_COPY } from './step8-relations.copy';

export interface ResourceWizardStep8RelationsProps {
  state: UseRelationsState;

  /** ID del recurso que se está editando (null si es nuevo sin guardar) */
  resourceId: string | null;

  /** Tipo del recurso fuente (para detectar warnings semánticos) */
  sourceType: string | null;

  /** Catálogos para el modal avanzado */
  typologies: TypologyOption[];
  municipalities: MunicipalityOption[];

  /** Navegación */
  onOpenResource: (id: string) => void;

  /** Fetch del JSON-LD (opcional, para la vista previa) */
  onFetchJsonldPreview?: () => Promise<unknown>;
}

export default function ResourceWizardStep8Relations({
  state,
  resourceId,
  sourceType,
  typologies,
  municipalities,
  onOpenResource,
  onFetchJsonldPreview,
}: ResourceWizardStep8RelationsProps) {
  // Form state
  const [predicate, setPredicate] = useState<RelationPredicate | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<RelationSearchResult | null>(null);
  const [note, setNote] = useState('');

  // Warning semántico pendiente de aceptación
  const [pendingWarning, setPendingWarning] = useState<string | null>(null);

  // Modales
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // JSON-LD preview
  const [jsonldOpen, setJsonldOpen] = useState(false);
  const [jsonldContent, setJsonldContent] = useState<unknown | null>(null);
  const [jsonldLoading, setJsonldLoading] = useState(false);

  // Creating
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const canSubmit =
    resourceId != null &&
    predicate != null &&
    selectedTarget != null &&
    !creating;

  const handleSearch = useCallback(
    async (query: string): Promise<RelationSearchResult[]> => {
      return state.search({ query });
    },
    [state],
  );

  const handleAdvancedSearch = useCallback(
    async (params: {
      query: string;
      typeFilter: string | null;
      municipalityFilter: string | null;
      statusFilter: string | null;
    }): Promise<RelationSearchResult[]> => {
      return state.search(params);
    },
    [state],
  );

  const tryCreateRelation = async () => {
    if (!predicate || !selectedTarget) return;

    // Decisión 6-C: warning no bloqueante por semántica rara
    const warning = detectSemanticWarning(
      sourceType,
      selectedTarget.type,
      predicate,
    );
    if (warning && !pendingWarning) {
      setPendingWarning(warning);
      return;
    }

    // Si ya hay warning visible o no hay warning → crear
    await doCreate();
  };

  const doCreate = async () => {
    if (!predicate || !selectedTarget) return;
    setCreating(true);
    setCreateError(null);
    try {
      await state.createRelation({
        targetId: selectedTarget.id,
        predicate,
        note: note.trim() || null,
      });
      // Reset
      setPredicate(null);
      setSelectedTarget(null);
      setNote('');
      setPendingWarning(null);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'No se pudo crear la relación');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleJsonld = async () => {
    if (jsonldOpen) {
      setJsonldOpen(false);
      return;
    }
    if (!onFetchJsonldPreview) {
      setJsonldOpen(true);
      return;
    }
    setJsonldLoading(true);
    try {
      const content = await onFetchJsonldPreview();
      setJsonldContent(content);
      setJsonldOpen(true);
    } finally {
      setJsonldLoading(false);
    }
  };

  return (
    <div className="step8-container">
      <header className="step8-header">
        <div>
          <h1>{STEP8_COPY.header.title}</h1>
          <p className="muted">{STEP8_COPY.header.subtitle}</p>
        </div>
        <span className="step8-header-badge">{STEP8_COPY.header.badge}</span>
      </header>

      {/* Banner si no hay resourceId todavía */}
      {!resourceId && (
        <div className="step8-banner-warn">
          ⚠️ {STEP8_COPY.header.saveNeededBanner}
        </div>
      )}

      {/* Caja informativa */}
      <div className="step8-info-box">
        <strong>{STEP8_COPY.infoBox.title}</strong>
        <ul>
          {STEP8_COPY.infoBox.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>

      {/* Sección añadir relación */}
      <section className="step8-add-section">
        <h2>{STEP8_COPY.addSection.title}</h2>

        <div className="step8-add-form">
          <div className="step8-add-field">
            <label>{STEP8_COPY.addSection.predicateLabel}</label>
            <PredicatePicker
              value={predicate}
              onChange={(p) => {
                setPredicate(p);
                setPendingWarning(null);
              }}
              placeholder={STEP8_COPY.addSection.predicatePlaceholder}
              disabled={!resourceId}
            />
          </div>

          <div className="step8-add-field">
            <label>{STEP8_COPY.addSection.targetLabel}</label>
            <TargetAutocomplete
              onSearch={handleSearch}
              selected={selectedTarget}
              onSelectionChange={(r) => {
                setSelectedTarget(r);
                setPendingWarning(null);
              }}
              onOpenAdvancedSearch={() => setAdvancedSearchOpen(true)}
              placeholder={STEP8_COPY.addSection.targetPlaceholder}
              disabled={!resourceId}
              advancedSearchLabel={STEP8_COPY.addSection.advancedSearchButton}
            />
          </div>

          <div className="step8-add-field">
            <label>{STEP8_COPY.addSection.noteLabel}</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={STEP8_COPY.addSection.notePlaceholder}
              disabled={!resourceId}
              maxLength={200}
              className="step8-note-input"
            />
          </div>

          {/* Warning semántico (6-C) */}
          {pendingWarning && (
            <div className="step8-semantic-warning" role="alert">
              <strong>⚠️ {STEP8_COPY.warning.title}</strong>
              <p>{pendingWarning}</p>
              <div className="step8-semantic-warning-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPendingWarning(null)}
                >
                  {STEP8_COPY.warning.reconsiderButton}
                </button>
                <button
                  type="button"
                  className="btn btn-warning btn-sm"
                  onClick={() => void doCreate()}
                  disabled={creating}
                >
                  {STEP8_COPY.warning.ignoreButton}
                </button>
              </div>
            </div>
          )}

          {createError && (
            <div className="step8-create-error" role="alert">
              ⚠️ {createError}
            </div>
          )}

          {!pendingWarning && (
            <div className="step8-add-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void tryCreateRelation()}
                disabled={!canSubmit}
              >
                {creating ? '…' : STEP8_COPY.addSection.addButton}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Lista de relaciones existentes */}
      <section className="step8-list-section">
        <RelationsList
          relations={state.relations}
          loading={state.loading}
          onDelete={(id) => setDeleteTarget(id)}
          onVisitTarget={onOpenResource}
        />
      </section>

      {/* Vista previa JSON-LD (decisión 5-C) */}
      {state.relations.length > 0 && (
        <section className="step8-jsonld-section">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void handleToggleJsonld()}
            disabled={jsonldLoading}
          >
            {jsonldLoading
              ? '…'
              : jsonldOpen
                ? STEP8_COPY.jsonldPreview.toggleHide
                : STEP8_COPY.jsonldPreview.toggleShow}
          </button>

          {jsonldOpen && (
            <div className="step8-jsonld-preview">
              <strong>{STEP8_COPY.jsonldPreview.title}</strong>
              <p className="muted">{STEP8_COPY.jsonldPreview.hint}</p>
              <pre className="step8-jsonld-code">
                {jsonldContent
                  ? JSON.stringify(jsonldContent, null, 2)
                  : generateLocalJsonldPreview(state.relations)}
              </pre>
            </div>
          )}
        </section>
      )}

      {/* Modal avanzado */}
      {advancedSearchOpen && (
        <AdvancedRelationSearchModal
          typologies={typologies}
          municipalities={municipalities}
          onSearch={handleAdvancedSearch}
          onSelect={(r) => setSelectedTarget(r)}
          onClose={() => setAdvancedSearchOpen(false)}
        />
      )}

      {/* Confirmación de borrado */}
      {deleteTarget && (
        <div
          className="step8-delete-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
        >
          <div className="step8-delete-modal" role="dialog" aria-modal="true">
            <h3>{STEP8_COPY.list.confirmDeleteTitle}</h3>
            <p>{STEP8_COPY.list.confirmDeleteBody}</p>
            <div className="step8-delete-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDeleteTarget(null)}
              >
                {STEP8_COPY.list.confirmDeleteCancel}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  void state.deleteRelation(deleteTarget).then(() => setDeleteTarget(null));
                }}
              >
                {STEP8_COPY.list.confirmDeleteConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Genera un preview JSON-LD local (cliente) a partir de las relaciones
 * cargadas, por si no hay backend disponible para el preview.
 * El backend real (RPC generate_jsonld_relations) da un resultado más
 * rico con URIs completas.
 */
function generateLocalJsonldPreview(
  relations: Array<{ predicate: string; targetName: string; targetSlug: string; isMirror: boolean }>,
): string {
  const outgoing = relations.filter((r) => !r.isMirror);
  const byPredicate: Record<string, Array<{ '@type': string; '@id': string; name: string }>> = {};

  for (const rel of outgoing) {
    const meta = PREDICATES[rel.predicate as RelationPredicate];
    if (!meta) continue;
    const schemaKey = meta.schemaOrgPredicate;
    if (!byPredicate[schemaKey]) byPredicate[schemaKey] = [];
    byPredicate[schemaKey].push({
      '@type': 'Thing',
      '@id': `https://osalnes.gal/recurso/${rel.targetSlug}`,
      name: rel.targetName,
    });
  }

  return JSON.stringify(byPredicate, null, 2);
}
