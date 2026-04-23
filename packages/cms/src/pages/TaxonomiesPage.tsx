/**
 * TaxonomiesPage — orquestador master-detail del gestor SCR-10
 *
 * Layout (decisión 8-C):
 *   ┌─────────────┬────────────────────────────────────┐
 *   │             │                                    │
 *   │  Catálogos  │    Lista de términos               │
 *   │  (master)   │    (detail)                        │
 *   │             │                                    │
 *   └─────────────┴────────────────────────────────────┘
 *
 * Con overlays superpuestos:
 *   · TermEditorDialog (crear / editar)
 *   · UsageDrawer (ver uso)
 *   · ConfirmToggleDialog (soft-delete)
 */

import { useCallback, useMemo, useState } from 'react';
import type { UseTaxonomiesState } from '../hooks/useTaxonomies';
import { CATALOGS } from '@osalnes/shared/data/taxonomies';
import CatalogSelector from '../components/taxonomies/CatalogSelector';
import TermsList from '../components/taxonomies/TermsList';
import TermEditorDialog from '../components/taxonomies/TermEditorDialog';
import UsageDrawer from '../components/taxonomies/UsageDrawer';
import ConfirmToggleDialog from '../components/taxonomies/ConfirmToggleDialog';
import { TAXONOMIES_COPY } from './taxonomies.copy';

export interface TaxonomiesPageProps {
  state: UseTaxonomiesState;
  /** Rol del usuario actual · para RBAC (decisión 7-C) */
  userRole: 'admin' | 'platform' | 'tourist_manager' | 'operator' | 'unknown';
  /** Callback para abrir un recurso desde el usage drawer */
  onOpenResource?: (resourceId: string) => void;
}

type Overlay =
  | { kind: 'none' }
  | { kind: 'editor'; termId: string | null }
  | { kind: 'usage'; termId: string }
  | { kind: 'toggle'; termId: string; nextActive: boolean };

export default function TaxonomiesPage({
  state,
  userRole,
  onOpenResource,
}: TaxonomiesPageProps) {
  const [overlay, setOverlay] = useState<Overlay>({ kind: 'none' });
  const [toggling, setToggling] = useState(false);

  const catalogMeta = CATALOGS[state.catalog];

  // Decisión 7-C: RBAC por catálogo
  const canEdit = useMemo(() => {
    if (catalogMeta.readonly) return false;
    if (catalogMeta.rolesCanEdit.length === 0) return false;
    return catalogMeta.rolesCanEdit.includes(userRole as 'admin' | 'platform' | 'tourist_manager');
  }, [catalogMeta, userRole]);

  // Término seleccionado para los overlays
  const overlayTerm = useMemo(() => {
    if (overlay.kind === 'none') return null;
    if (overlay.kind === 'editor' && overlay.termId === null) return null;
    const id = overlay.kind === 'editor' ? overlay.termId : overlay.termId;
    return state.terms.find((t) => t.id === id) ?? null;
  }, [overlay, state.terms]);

  const handleEdit = useCallback((id: string) => {
    setOverlay({ kind: 'editor', termId: id });
  }, []);

  const handleNewTerm = useCallback(() => {
    setOverlay({ kind: 'editor', termId: null });
  }, []);

  const handleViewUsage = useCallback((id: string) => {
    setOverlay({ kind: 'usage', termId: id });
  }, []);

  const handleToggle = useCallback((id: string, nextActive: boolean) => {
    setOverlay({ kind: 'toggle', termId: id, nextActive });
  }, []);

  const handleConfirmToggle = useCallback(async () => {
    if (overlay.kind !== 'toggle') return;
    setToggling(true);
    try {
      await state.toggleActive(overlay.termId, overlay.nextActive);
      setOverlay({ kind: 'none' });
    } finally {
      setToggling(false);
    }
  }, [overlay, state]);

  const handleSaveTerm = useCallback<Parameters<typeof TermEditorDialog>[0]['onSave']>(
    async (params) => {
      const newId = await state.upsert(params);
      setOverlay({ kind: 'none' });
      return newId;
    },
    [state],
  );

  return (
    <div className="taxo-page">
      <header className="taxo-page-header">
        <h1>{TAXONOMIES_COPY.header.title}</h1>
        <p className="muted">{TAXONOMIES_COPY.header.subtitle}</p>
      </header>

      {state.error && (
        <div className="taxo-page-error" role="alert">
          ⚠ {state.error}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void state.refetch()}
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="taxo-page-grid">
        <aside className="taxo-page-master">
          <CatalogSelector
            current={state.catalog}
            onChange={state.setCatalog}
          />
        </aside>

        <main className="taxo-page-detail">
          <TermsList
            catalog={state.catalog}
            terms={state.terms}
            loading={state.loading}
            canEdit={canEdit}
            onEdit={handleEdit}
            onToggleActive={handleToggle}
            onViewUsage={handleViewUsage}
            includeInactive={state.includeInactive}
            onToggleIncludeInactive={state.setIncludeInactive}
            onNewTerm={handleNewTerm}
          />
        </main>
      </div>

      {/* Overlays */}
      {overlay.kind === 'editor' && (
        <TermEditorDialog
          catalog={state.catalog}
          termId={overlay.termId}
          parentCandidates={state.terms}
          onLoadDetail={state.getDetail}
          onSave={handleSaveTerm}
          onClose={() => setOverlay({ kind: 'none' })}
        />
      )}

      {overlay.kind === 'usage' && overlayTerm && (
        <UsageDrawer
          catalog={state.catalog}
          termId={overlay.termId}
          termName={overlayTerm.name}
          onFetch={state.getUsage}
          onOpenResource={onOpenResource}
          onClose={() => setOverlay({ kind: 'none' })}
        />
      )}

      {overlay.kind === 'toggle' && overlayTerm && (
        <ConfirmToggleDialog
          termName={overlayTerm.name}
          usageCount={overlayTerm.usageCount}
          isActivating={overlay.nextActive}
          confirming={toggling}
          onConfirm={handleConfirmToggle}
          onClose={() => setOverlay({ kind: 'none' })}
        />
      )}
    </div>
  );
}
