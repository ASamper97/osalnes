/**
 * ResourceWizardStep6Seo — Paso 6 del wizard de recursos
 *
 * Orquesta todos los bloques SEO con preview en vivo de Google y Open Graph.
 *
 * Composición (arriba a abajo):
 *   1. HelpBlock (reutilizado de paso 2)
 *   2. Tabs de idioma para SEO: [ES] [GL]
 *   3. Campos SEO del idioma activo (título + descripción con contadores)
 *      + botón "Generar SEO con IA"
 *   4. Preview de Google (reacciona al idioma activo)
 *   5. Preview de tarjeta de compartir (Open Graph)
 *   6. Slug editable
 *   7. Control de indexación
 *   8. Imagen Open Graph
 *   9. Keywords con IA
 *  10. Traducciones adicionales
 *  11. Auditoría SEO en vivo
 */

import { useMemo, useState } from 'react';
import HelpBlock from '../components/HelpBlock';
import GoogleSearchPreview from '../components/GoogleSearchPreview';
import SocialCardPreview from '../components/SocialCardPreview';
import SlugEditor, { type SlugEditorProps } from '../components/SlugEditor';
import IndexationToggle from '../components/IndexationToggle';
import OgImageBlock, { type OgImageBlockProps } from '../components/OgImageBlock';
import KeywordsEditor, { type KeywordsEditorProps } from '../components/KeywordsEditor';
import TranslationsBlock, { type TranslationsBlockProps } from '../components/TranslationsBlock';
import SeoAuditPanel from '../components/SeoAuditPanel';

import {
  type ResourceSeo,
  type AnyLang,
  type SeoByLang,
  SEO_LIMITS,
  getLengthStatus,
  countVisibleChars,
} from '@osalnes/shared/data/seo';
import { auditSeo } from '@osalnes/shared/data/seo-audit';
import { STEP6_COPY } from './step6-seo.copy';

// ─── Props ─────────────────────────────────────────────────────────────

export interface ResourceWizardStep6SeoProps {
  seo: ResourceSeo;
  onChange: (next: ResourceSeo) => void;

  /** Nombre del recurso (paso 1), usado en previews y fallbacks */
  resourceName: string;

  /** Descripción ES (paso 2) — fuente para IA y auditoría */
  descriptionEs: string;

  /** ¿Hay imagen principal en el paso 5? */
  hasPrimaryImage: boolean;

  /** URL pública de la imagen principal (para previews) */
  primaryImageUrl: string | null;

  /** URL pública de la override Open Graph (si hay) */
  ogOverrideUrl: string | null;

  /** Estado de publicación del recurso (para bloquear slug si publicado) */
  isPublished: boolean;

  // ─── Handlers IA ──────────────────────────────────────────────────
  onGenerateSeoAi: (lang: AnyLang) => Promise<SeoByLang | null>;
  onSuggestKeywordsAi: KeywordsEditorProps['onSuggestAi'];
  onTranslateOne: TranslationsBlockProps['onTranslateOne'];
  onTranslateAll: TranslationsBlockProps['onTranslateAll'];

  // ─── Handlers slug ────────────────────────────────────────────────
  onCheckSlugDuplicate: SlugEditorProps['checkDuplicate'];
  currentResourceId?: string | null;

  // ─── Handlers Open Graph ──────────────────────────────────────────
  onUploadOgOverride: OgImageBlockProps['onUploadOverride'];
  onRemoveOgOverride: OgImageBlockProps['onRemoveOverride'];
}

// ─── Componente ────────────────────────────────────────────────────────

export default function ResourceWizardStep6Seo({
  seo,
  onChange,
  resourceName,
  descriptionEs,
  hasPrimaryImage,
  primaryImageUrl,
  ogOverrideUrl,
  isPublished,
  onGenerateSeoAi,
  onSuggestKeywordsAi,
  onTranslateOne,
  onTranslateAll,
  onCheckSlugDuplicate,
  onUploadOgOverride,
  onRemoveOgOverride,
}: ResourceWizardStep6SeoProps) {
  const COPY = STEP6_COPY;

  // Idioma activo en los campos SEO (ES por defecto)
  const [activeLang, setActiveLang] = useState<'es' | 'gl'>('es');

  const [aiSeoLoading, setAiSeoLoading] = useState(false);
  const [aiSeoError, setAiSeoError] = useState<string | null>(null);

  // Valor del SEO del idioma activo (con fallback)
  const currentSeo: SeoByLang = seo.byLang[activeLang] ?? { title: '', description: '' };

  const updateSeoForLang = (patch: Partial<SeoByLang>) => {
    const curr = seo.byLang[activeLang] ?? { title: '', description: '' };
    onChange({
      ...seo,
      byLang: {
        ...seo.byLang,
        [activeLang]: { ...curr, ...patch },
      },
    });
  };

  const handleGenerateSeoAi = async () => {
    setAiSeoError(null);
    setAiSeoLoading(true);
    try {
      const result = await onGenerateSeoAi(activeLang);
      if (result) {
        updateSeoForLang(result);
      }
    } catch {
      setAiSeoError(COPY.seoFields.aiSuggestError);
    } finally {
      setAiSeoLoading(false);
    }
  };

  // ─── Imagen activa para preview social (override > principal) ─────
  const socialPreviewImage = seo.ogImageOverridePath ? ogOverrideUrl : primaryImageUrl;

  // ─── Auditoría reactiva (memoizada) ──────────────────────────────
  const auditReport = useMemo(
    () =>
      auditSeo(seo, {
        resourceName,
        descriptionEs,
        hasPrimaryImage: hasPrimaryImage || seo.ogImageOverridePath != null,
      }),
    [seo, resourceName, descriptionEs, hasPrimaryImage],
  );

  // ─── Helpers de contador ─────────────────────────────────────────
  const titleStatus = getLengthStatus(currentSeo.title, SEO_LIMITS.title);
  const descStatus = getLengthStatus(currentSeo.description, SEO_LIMITS.description);

  return (
    <div className="step6-content">
      <header className="step6-header">
        <h2>{COPY.header.title}</h2>
        <p>{COPY.header.subtitle}</p>
      </header>

      <HelpBlock
        storageKey="resource-wizard-step6"
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

      {/* ═══════════ TABS DE IDIOMA + CAMPOS SEO ═════════════════════ */}
      <section className="step6-seo-section">
        <header>
          <h3>{COPY.seoFields.sectionTitle}</h3>
          <p className="muted">{COPY.seoFields.sectionDesc}</p>
        </header>

        <div role="tablist" className="step6-lang-tabs">
          <button
            role="tab"
            aria-selected={activeLang === 'es'}
            className={`step6-lang-tab ${activeLang === 'es' ? 'active' : ''}`}
            onClick={() => setActiveLang('es')}
            type="button"
          >
            Castellano
          </button>
          <button
            role="tab"
            aria-selected={activeLang === 'gl'}
            className={`step6-lang-tab ${activeLang === 'gl' ? 'active' : ''}`}
            onClick={() => setActiveLang('gl')}
            type="button"
          >
            Gallego
          </button>
        </div>

        <div className="step6-ai-row">
          <button
            type="button"
            className="btn btn-ai-primary btn-sm"
            onClick={handleGenerateSeoAi}
            disabled={aiSeoLoading || !descriptionEs.trim()}
            title={!descriptionEs.trim() ? 'Añade una descripción en el paso 2 primero' : undefined}
          >
            {aiSeoLoading ? COPY.seoFields.aiSuggestLoading : COPY.seoFields.aiSuggestButton}
          </button>
          <span className="muted step6-ai-hint">{COPY.seoFields.aiSuggestHint}</span>
        </div>
        {aiSeoError && (
          <p role="alert" className="step6-error">
            ⚠️ {aiSeoError}
          </p>
        )}

        <div className="step6-seo-fields">
          <label className="step6-field">
            <span className="step6-field-label">
              {activeLang === 'es' ? COPY.seoFields.titleLabelEs : COPY.seoFields.titleLabelGl}
            </span>
            <input
              type="text"
              value={currentSeo.title}
              onChange={(e) => updateSeoForLang({ title: e.target.value })}
              placeholder={COPY.seoFields.titlePlaceholder}
              maxLength={SEO_LIMITS.title.hardMax + 20}
            />
            <CounterHint
              value={currentSeo.title}
              status={titleStatus}
              limits={SEO_LIMITS.title}
            />
          </label>

          <label className="step6-field">
            <span className="step6-field-label">
              {activeLang === 'es' ? COPY.seoFields.descLabelEs : COPY.seoFields.descLabelGl}
            </span>
            <textarea
              value={currentSeo.description}
              onChange={(e) => updateSeoForLang({ description: e.target.value })}
              placeholder={COPY.seoFields.descPlaceholder}
              rows={3}
              maxLength={SEO_LIMITS.description.hardMax + 50}
            />
            <CounterHint
              value={currentSeo.description}
              status={descStatus}
              limits={SEO_LIMITS.description}
            />
          </label>
        </div>
      </section>

      {/* ═══════════ PREVIEWS EN VIVO ═════════════════════════════════ */}
      <div className="step6-previews">
        <GoogleSearchPreview
          title={currentSeo.title}
          description={currentSeo.description}
          resourceName={resourceName}
          slug={seo.slug}
        />

        <SocialCardPreview
          title={currentSeo.title}
          description={currentSeo.description}
          imageUrl={socialPreviewImage}
          resourceName={resourceName}
        />
      </div>

      {/* ═══════════ SLUG ═════════════════════════════════════════════ */}
      <SlugEditor
        value={seo.slug}
        onChange={(next) => onChange({ ...seo, slug: next })}
        resourceName={resourceName}
        isPublished={isPublished}
        checkDuplicate={onCheckSlugDuplicate}
      />

      {/* ═══════════ INDEXACIÓN ═══════════════════════════════════════ */}
      <IndexationToggle
        value={seo.indexable}
        onChange={(next) => onChange({ ...seo, indexable: next })}
      />

      {/* ═══════════ IMAGEN OPEN GRAPH ═══════════════════════════════ */}
      <OgImageBlock
        primaryImageUrl={primaryImageUrl}
        overridePath={seo.ogImageOverridePath}
        overrideUrl={ogOverrideUrl}
        onUploadOverride={async (f) => {
          const path = await onUploadOgOverride(f);
          onChange({ ...seo, ogImageOverridePath: path });
          return path;
        }}
        onRemoveOverride={async () => {
          await onRemoveOgOverride();
          onChange({ ...seo, ogImageOverridePath: null });
        }}
      />

      {/* ═══════════ KEYWORDS ═════════════════════════════════════════ */}
      <KeywordsEditor
        value={seo.keywords}
        onChange={(next) => onChange({ ...seo, keywords: next })}
        descriptionEs={descriptionEs}
        onSuggestAi={onSuggestKeywordsAi}
      />

      {/* ═══════════ TRADUCCIONES ═════════════════════════════════════ */}
      <TranslationsBlock
        translations={seo.translations}
        onChange={(next) => onChange({ ...seo, translations: next })}
        onTranslateOne={onTranslateOne}
        onTranslateAll={onTranslateAll}
        hasSourceContent={descriptionEs.trim().length > 0}
      />

      {/* ═══════════ AUDITORÍA ════════════════════════════════════════ */}
      <SeoAuditPanel report={auditReport} />
    </div>
  );
}

// ─── Sub-componente: contador con hint contextual ────────────────────

function CounterHint({
  value,
  status,
  limits,
}: {
  value: string;
  status: ReturnType<typeof getLengthStatus>;
  limits: { recommendedMin: number; recommendedMax: number; hardMax: number };
}) {
  const COPY = STEP6_COPY.seoFields;
  const n = countVisibleChars(value);

  const text = (() => {
    switch (status) {
      case 'empty':
        return COPY.counterEmpty;
      case 'too-short':
        return COPY.counterShort
          .replace('{current}', String(n))
          .replace('{recommendedMin}', String(limits.recommendedMin));
      case 'ok':
        return COPY.counterOk.replace('{current}', String(n));
      case 'too-long':
        return COPY.counterLong
          .replace('{current}', String(n))
          .replace('{recommendedMax}', String(limits.recommendedMax));
      case 'over-hard':
        return COPY.counterOverHard
          .replace('{current}', String(n))
          .replace('{hardMax}', String(limits.hardMax));
    }
  })();

  return (
    <small className={`step6-counter step6-counter-${status}`}>
      {n} / {limits.recommendedMax} · {text}
    </small>
  );
}
