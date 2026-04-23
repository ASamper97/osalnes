/**
 * TermEditorDialog v2 — editor multi-tab con selector de grupo
 *
 * Cambios v2:
 *   · Selector `grupo` visible solo si CATALOGS[catalog].hasGrupo=true (tipologia)
 *   · Pasa grupo al onSave
 */

import { useEffect, useState } from 'react';
import {
  type TaxonomyCatalog,
  type TaxonomyTerm,
  type TaxonomyTermDetail,
  type TipologiaGrupo,
  CATALOGS,
  GRUPO_LABELS,
  ALL_GRUPOS,
  SCHEMA_ORG_CODES,
  emptyTaxonomyDetail,
  validateSemanticUri,
} from '@osalnes/shared/data/taxonomies';
import { TAXONOMIES_COPY } from '../../pages/taxonomies.copy';

const COPY = TAXONOMIES_COPY.editor;

export interface TermEditorDialogProps {
  catalog: TaxonomyCatalog;
  termId: string | null;
  parentCandidates: TaxonomyTerm[];
  onLoadDetail: (id: string | null) => Promise<TaxonomyTermDetail>;
  onSave: (params: {
    id?: string | null;
    slug: string;
    parentId?: string | null;
    semanticUri?: string | null;
    schemaCode?: string | null;
    grupo?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    nameEs?: string; nameGl?: string; nameEn?: string;
    descriptionEs?: string; descriptionGl?: string; descriptionEn?: string;
  }) => Promise<string>;
  onClose: () => void;
}

type Lang = 'es' | 'gl' | 'en';

export default function TermEditorDialog({
  catalog, termId, parentCandidates, onLoadDetail, onSave, onClose,
}: TermEditorDialogProps) {
  const meta = CATALOGS[catalog];
  const [detail, setDetail] = useState<TaxonomyTermDetail>(emptyTaxonomyDetail());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [langTab, setLangTab] = useState<Lang>('es');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const d = await onLoadDetail(termId);
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error cargando término');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [termId, onLoadDetail]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [saving, onClose]);

  const updateDetail = (patch: Partial<TaxonomyTermDetail>) => {
    setDetail((d) => ({ ...d, ...patch }));
  };

  const updateTranslation = (field: 'name' | 'description', lang: Lang, value: string) => {
    setDetail((d) => ({
      ...d,
      translations: {
        ...d.translations,
        [field]: { ...d.translations[field], [lang]: value },
      },
    }));
  };

  const handleSave = async () => {
    setError(null);
    if (!detail.slug.trim()) {
      setError(COPY.slugRequired);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: termId,
        slug: detail.slug.trim(),
        parentId: detail.parentId,
        semanticUri: detail.semanticUri?.trim() || null,
        schemaCode: detail.schemaCode?.trim() || null,
        grupo: detail.grupo?.trim() || null,
        sortOrder: detail.sortOrder,
        isActive: detail.isActive,
        nameEs: detail.translations.name.es.trim() || undefined,
        nameGl: detail.translations.name.gl.trim() || undefined,
        nameEn: detail.translations.name.en.trim() || undefined,
        descriptionEs: detail.translations.description.es.trim() || undefined,
        descriptionGl: detail.translations.description.gl.trim() || undefined,
        descriptionEn: detail.translations.description.en.trim() || undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const semanticCheck = validateSemanticUri(detail.semanticUri);
  const validParents = parentCandidates.filter((p) => p.id !== termId && p.isActive);

  return (
    <div
      className="taxo-editor-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div className="taxo-editor-modal" role="dialog" aria-modal="true">
        <header>
          <h2>{termId ? COPY.titleEdit : COPY.titleCreate}</h2>
          <button
            type="button"
            className="taxo-editor-close"
            onClick={onClose}
            disabled={saving}
          >×</button>
        </header>

        <div className="taxo-editor-body">
          {loading ? (
            <div className="taxo-editor-loading muted">Cargando…</div>
          ) : (
            <>
              {/* Identificador + orden */}
              <div className="taxo-editor-row">
                <label className="taxo-editor-field">
                  <span>{COPY.slugLabel}</span>
                  <input
                    type="text"
                    value={detail.slug}
                    onChange={(e) => updateDetail({ slug: e.target.value })}
                    placeholder={catalog === 'tipologia' ? 'Beach' : 'turismo-cultural'}
                    disabled={saving}
                  />
                  <small className="muted">{COPY.slugHint}</small>
                </label>

                <label className="taxo-editor-field taxo-editor-field-short">
                  <span>{COPY.sortOrderLabel}</span>
                  <input
                    type="number"
                    value={detail.sortOrder}
                    onChange={(e) => updateDetail({ sortOrder: Number(e.target.value) || 0 })}
                    disabled={saving}
                  />
                  <small className="muted">{COPY.sortOrderHint}</small>
                </label>
              </div>

              {/* Parent selector */}
              {meta.hierarchical && (
                <label className="taxo-editor-field">
                  <span>{COPY.parentLabel}</span>
                  <select
                    value={detail.parentId ?? ''}
                    onChange={(e) => updateDetail({ parentId: e.target.value || null })}
                    disabled={saving}
                  >
                    <option value="">{COPY.parentNone}</option>
                    {validParents.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
              )}

              {/* Grupo (solo tipologia · v2) */}
              {meta.hasGrupo && (
                <label className="taxo-editor-field">
                  <span>{COPY.grupoLabel}</span>
                  <select
                    value={detail.grupo ?? ''}
                    onChange={(e) => updateDetail({ grupo: e.target.value || null })}
                    disabled={saving}
                  >
                    <option value="">{COPY.grupoPlaceholder}</option>
                    {ALL_GRUPOS.map((g: TipologiaGrupo) => (
                      <option key={g} value={g}>{GRUPO_LABELS[g]}</option>
                    ))}
                  </select>
                  <small className="muted">{COPY.grupoHint}</small>
                </label>
              )}

              {/* URI semántica + schema code */}
              <div className="taxo-editor-row">
                <label className="taxo-editor-field">
                  <span>{COPY.semanticUriLabel}</span>
                  <input
                    type="url"
                    value={detail.semanticUri ?? ''}
                    onChange={(e) => updateDetail({ semanticUri: e.target.value })}
                    placeholder={meta.semanticUriExample ?? 'https://…'}
                    disabled={saving}
                  />
                  <small className={semanticCheck.warning ? 'taxo-warn' : 'muted'}>
                    {semanticCheck.warning ?? COPY.semanticUriHint}
                  </small>
                </label>

                {catalog === 'tipologia' && (
                  <label className="taxo-editor-field taxo-editor-field-short">
                    <span>{COPY.schemaCodeLabel}</span>
                    <input
                      type="text"
                      list="schema-codes-list"
                      value={detail.schemaCode ?? ''}
                      onChange={(e) => updateDetail({ schemaCode: e.target.value })}
                      placeholder="Beach"
                      disabled={saving}
                    />
                    <datalist id="schema-codes-list">
                      {SCHEMA_ORG_CODES.map((c) => <option key={c} value={c} />)}
                    </datalist>
                    <small className="muted">{COPY.schemaCodeHint}</small>
                  </label>
                )}
              </div>

              {/* Traducciones en tabs */}
              <div className="taxo-editor-translations">
                <div className="taxo-editor-translations-header">
                  <strong>{COPY.translationsTitle}</strong>
                  <p className="muted">{COPY.translationsHint}</p>
                </div>

                <div className="taxo-editor-tabs" role="tablist">
                  {(['es', 'gl', 'en'] as Lang[]).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      role="tab"
                      aria-selected={langTab === lang}
                      className={`taxo-editor-tab ${langTab === lang ? 'is-active' : ''}`}
                      onClick={() => setLangTab(lang)}
                    >
                      {lang === 'es' && COPY.tabEs}
                      {lang === 'gl' && COPY.tabGl}
                      {lang === 'en' && COPY.tabEn}
                      {detail.translations.name[lang] && <span className="taxo-editor-tab-dot" />}
                    </button>
                  ))}
                </div>

                <div className="taxo-editor-tab-content">
                  <label className="taxo-editor-field">
                    <span>{COPY.nameLabel}</span>
                    <input
                      type="text"
                      value={detail.translations.name[langTab]}
                      onChange={(e) => updateTranslation('name', langTab, e.target.value)}
                      placeholder={COPY.namePlaceholder}
                      disabled={saving}
                    />
                  </label>
                  <label className="taxo-editor-field">
                    <span>{COPY.descriptionLabel}</span>
                    <textarea
                      value={detail.translations.description[langTab]}
                      onChange={(e) => updateTranslation('description', langTab, e.target.value)}
                      placeholder={COPY.descriptionPlaceholder}
                      rows={3}
                      disabled={saving}
                    />
                  </label>
                </div>
              </div>

              {/* Active */}
              <label className="taxo-editor-toggle">
                <input
                  type="checkbox"
                  checked={detail.isActive}
                  onChange={(e) => updateDetail({ isActive: e.target.checked })}
                  disabled={saving}
                />
                <span>
                  <strong>{COPY.isActiveLabel}</strong>
                  <small className="muted">{COPY.isActiveHint}</small>
                </span>
              </label>

              {error && (
                <div className="taxo-editor-error" role="alert">⚠ {error}</div>
              )}
            </>
          )}
        </div>

        <footer>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={saving}
          >
            {COPY.closeButton}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSave()}
            disabled={saving || loading}
          >
            {saving ? COPY.saving : COPY.saveButton}
          </button>
        </footer>
      </div>
    </div>
  );
}
