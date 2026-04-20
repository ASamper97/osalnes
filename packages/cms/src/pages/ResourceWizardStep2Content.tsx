/**
 * ResourceWizardStep2Content — Paso 2 del wizard de recursos
 *
 * Rediseño 2026-04 (v2) para el perfil de funcionario público infrecuente.
 *
 * Tres decisiones de producto aplicadas:
 *   1. Preview IA antes de aplicar (AiPreview) — la IA nunca pisa lo que
 *      escribe el usuario; siempre propone y el usuario decide.
 *   2. WordCountBadge solo en el editor ES; el editor GL muestra una
 *      línea de estado descriptiva sin semáforo (empty / translated /
 *      edited).
 *   3. Traducción automática en background al avanzar al paso siguiente,
 *      controlada por el wizard padre vía flag `isBackgroundTranslating`.
 *      Ver `useBackgroundTranslation.ts` para el hook que lanza la
 *      traducción.
 */

import { useEffect, useState } from 'react';
import RichTextEditor, { type RichTextEditorProps } from '../components/RichTextEditor';
import HelpBlock from '../components/HelpBlock';
import WordCountBadge from '../components/WordCountBadge';
import AiPreview from '../components/AiPreview';
import {
  STEP2_COPY,
  formatGlStatus,
  type GlStatus,
} from './step2-content.copy';
import { aiImprove, aiDraft, aiTranslate } from '../lib/ai';

export interface ResourceWizardStep2ContentProps {
  descriptionEs: string;
  onChangeDescriptionEs: (next: string) => void;
  descriptionGl: string;
  onChangeDescriptionGl: (next: string) => void;

  context: {
    name: string;
    mainTypeKey: string | null;
    municipio: string | null;
  };

  /** Estado del editor GL; se guarda en el padre para persistir entre pasos */
  glStatus: GlStatus;
  onChangeGlStatus: (next: GlStatus) => void;

  /** Flag del padre cuando la traducción background está corriendo */
  isBackgroundTranslating?: boolean;
}

type AiPendingOp =
  | { target: 'es'; action: 'draft' | 'improve'; suggested: string }
  | { target: 'gl'; action: 'translate' | 'improve'; suggested: string };

export default function ResourceWizardStep2Content({
  descriptionEs,
  onChangeDescriptionEs,
  descriptionGl,
  onChangeDescriptionGl,
  context,
  glStatus,
  onChangeGlStatus,
  isBackgroundTranslating = false,
}: ResourceWizardStep2ContentProps) {
  const [loading, setLoading] = useState<
    null | 'draft-es' | 'improve-es' | 'translate-gl' | 'improve-gl'
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<AiPendingOp | null>(null);

  const canTranslate = descriptionEs.trim().length > 0;

  // Cambios manuales del editor GL: cambiar glStatus según contexto
  const handleGlChange = (next: string) => {
    onChangeDescriptionGl(next);
    if (next.trim().length === 0) {
      onChangeGlStatus('empty');
    } else if (glStatus === 'translated' && next !== descriptionGl) {
      onChangeGlStatus('edited');
    } else if (glStatus === 'empty' && next.trim().length > 0) {
      onChangeGlStatus('edited');
    }
  };

  // ─── Acciones IA ────────────────────────────────────────────────────

  async function handleDraftEs() {
    setLoading('draft-es');
    setError(null);
    try {
      const suggested = await aiDraft({
        name: context.name,
        typeKey: context.mainTypeKey,
        municipio: context.municipio,
        targetLang: 'es',
      });
      setPending({ target: 'es', action: 'draft', suggested });
    } catch {
      setError(STEP2_COPY.aiErrors.generic);
    } finally {
      setLoading(null);
    }
  }

  async function handleImproveEs() {
    if (!descriptionEs.trim()) return;
    setLoading('improve-es');
    setError(null);
    try {
      const suggested = await aiImprove({
        text: descriptionEs,
        lang: 'es',
        context: { name: context.name, typeKey: context.mainTypeKey },
      });
      setPending({ target: 'es', action: 'improve', suggested });
    } catch {
      setError(STEP2_COPY.aiErrors.generic);
    } finally {
      setLoading(null);
    }
  }

  async function handleTranslateGl() {
    if (!canTranslate) return;
    setLoading('translate-gl');
    setError(null);
    try {
      const suggested = await aiTranslate({
        text: descriptionEs,
        from: 'es',
        to: 'gl',
      });
      setPending({ target: 'gl', action: 'translate', suggested });
    } catch {
      setError(STEP2_COPY.aiErrors.generic);
    } finally {
      setLoading(null);
    }
  }

  async function handleImproveGl() {
    if (!descriptionGl.trim()) return;
    setLoading('improve-gl');
    setError(null);
    try {
      const suggested = await aiImprove({
        text: descriptionGl,
        lang: 'gl',
        context: { name: context.name, typeKey: context.mainTypeKey },
      });
      setPending({ target: 'gl', action: 'improve', suggested });
    } catch {
      setError(STEP2_COPY.aiErrors.generic);
    } finally {
      setLoading(null);
    }
  }

  function applyPending() {
    if (!pending) return;
    if (pending.target === 'es') {
      onChangeDescriptionEs(pending.suggested);
    } else {
      onChangeDescriptionGl(pending.suggested);
      onChangeGlStatus(pending.action === 'translate' ? 'translated' : 'edited');
    }
    setPending(null);
  }

  function discardPending() {
    setPending(null);
  }

  // Sincronizar glStatus=translated cuando la traducción en background
  // acaba de rellenar descriptionGl
  useEffect(() => {
    if (
      !isBackgroundTranslating &&
      glStatus === 'empty' &&
      descriptionGl.trim().length > 0
    ) {
      onChangeGlStatus('translated');
    }
  }, [isBackgroundTranslating, descriptionGl, glStatus, onChangeGlStatus]);

  const commonEditorProps: Partial<RichTextEditorProps> = {
    toolbar: ['bold', 'italic', 'h2', 'h3', 'ul', 'ol', 'link', 'quote', 'undo', 'redo'],
  };

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div className="step2-content">
      <header className="step2-header">
        <h2>{STEP2_COPY.header.title}</h2>
        <p>{STEP2_COPY.header.subtitle}</p>
      </header>

      <HelpBlock
        storageKey="resource-wizard-step2"
        title={STEP2_COPY.helpBlock.title}
        toggleHideLabel={STEP2_COPY.helpBlock.toggleHide}
        toggleShowLabel={STEP2_COPY.helpBlock.toggleShow}
      >
        <p>{STEP2_COPY.helpBlock.intro}</p>
        <ul>
          {STEP2_COPY.helpBlock.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p className="help-block-note">{STEP2_COPY.helpBlock.galFlow}</p>
      </HelpBlock>

      {error && (
        <div role="alert" className="step2-error-banner">
          <span>⚠️ {error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      )}

      {/* ── Editor Castellano (con WordCountBadge) ────────────────── */}
      <section className="step2-block">
        <div className="step2-block-head">
          <h3 className="step2-block-title">{STEP2_COPY.editorEs.label}</h3>
          <WordCountBadge text={descriptionEs} />
        </div>

        <RichTextEditor
          {...commonEditorProps}
          value={descriptionEs}
          onChange={onChangeDescriptionEs}
          placeholder={STEP2_COPY.editorEs.placeholder}
          disabled={loading === 'improve-es' || loading === 'draft-es'}
        />

        {pending?.target === 'es' && (
          <AiPreview
            heading={STEP2_COPY.aiPreview.heading}
            disclaimer={STEP2_COPY.aiPreview.disclaimer}
            text={pending.suggested}
            applyLabel={STEP2_COPY.aiPreview.applyButton}
            discardLabel={STEP2_COPY.aiPreview.discardButton}
            onApply={applyPending}
            onDiscard={discardPending}
          />
        )}

        {!pending && (
          <div className="step2-ai-actions">
            {!descriptionEs.trim() ? (
              <div className="step2-ai-action">
                <div>
                  <h4>{STEP2_COPY.editorEs.aiStartTitle}</h4>
                  <p>{STEP2_COPY.editorEs.aiStartHint}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-ai-primary"
                  onClick={handleDraftEs}
                  disabled={loading !== null}
                >
                  ✨ {loading === 'draft-es' ? 'Escribiendo…' : STEP2_COPY.editorEs.aiStartButton}
                </button>
              </div>
            ) : (
              <div className="step2-ai-action">
                <div>
                  <h4>{STEP2_COPY.editorEs.aiImproveTitle}</h4>
                  <p>{STEP2_COPY.editorEs.aiImproveHint}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-ai-secondary"
                  onClick={handleImproveEs}
                  disabled={loading !== null}
                >
                  ✨ {loading === 'improve-es' ? 'Mejorando…' : STEP2_COPY.editorEs.aiImproveButton}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Bloque de traducción ──────────────────────────────────── */}
      <section className="step2-translation-block">
        <div className="step2-translation-head">
          <h3 className="step2-block-title">{STEP2_COPY.translation.title}</h3>
          {isBackgroundTranslating && (
            <span className="step2-translation-inflight" aria-live="polite">
              <span className="step2-translation-spinner" aria-hidden />
              {STEP2_COPY.translation.autoInFlight.badge}
            </span>
          )}
        </div>
        <p className="step2-translation-desc">{STEP2_COPY.translation.description}</p>

        <div className="step2-translation-cta">
          <button
            type="button"
            className="btn btn-ai-primary"
            onClick={handleTranslateGl}
            disabled={!canTranslate || loading !== null || isBackgroundTranslating}
            title={!canTranslate ? STEP2_COPY.translation.buttonDisabledHint : undefined}
          >
            ⚡{' '}
            {loading === 'translate-gl'
              ? 'Traduciendo…'
              : descriptionGl.trim().length > 0
              ? STEP2_COPY.translation.buttonRetranslate
              : STEP2_COPY.translation.button}
          </button>
          {!canTranslate && (
            <span className="step2-translation-disabled-hint">
              {STEP2_COPY.translation.buttonDisabledHint}
            </span>
          )}
        </div>

        {canTranslate && descriptionGl.trim().length === 0 && !isBackgroundTranslating && (
          <p className="step2-translation-auto-note">
            💡 {STEP2_COPY.translation.autoOnNextBody}
          </p>
        )}
      </section>

      {/* ── Editor Gallego (línea de estado en lugar de badge) ────── */}
      <section className="step2-block">
        <div className="step2-block-head">
          <h3 className="step2-block-title">{STEP2_COPY.editorGl.label}</h3>
          {/* intencional: sin WordCountBadge */}
        </div>

        <RichTextEditor
          {...commonEditorProps}
          value={descriptionGl}
          onChange={handleGlChange}
          placeholder={
            descriptionGl.trim().length === 0
              ? STEP2_COPY.editorGl.placeholderEmpty
              : STEP2_COPY.editorGl.placeholderAfterTranslation
          }
          disabled={
            loading === 'improve-gl' ||
            loading === 'translate-gl' ||
            isBackgroundTranslating
          }
        />

        <p className={`step2-gl-status step2-gl-status--${glStatus}`}>
          {formatGlStatus(glStatus, descriptionGl)}
        </p>

        {pending?.target === 'gl' && (
          <AiPreview
            heading={STEP2_COPY.aiPreview.heading}
            disclaimer={STEP2_COPY.aiPreview.disclaimer}
            text={pending.suggested}
            applyLabel={STEP2_COPY.aiPreview.applyButton}
            discardLabel={STEP2_COPY.aiPreview.discardButton}
            onApply={applyPending}
            onDiscard={discardPending}
          />
        )}

        {!pending && descriptionGl.trim().length > 0 && (
          <div className="step2-ai-actions">
            <div className="step2-ai-action">
              <div>
                <h4>{STEP2_COPY.editorGl.aiImproveTitle}</h4>
              </div>
              <button
                type="button"
                className="btn btn-ai-secondary"
                onClick={handleImproveGl}
                disabled={loading !== null}
              >
                ✨ {loading === 'improve-gl' ? 'Mejorando…' : STEP2_COPY.editorGl.aiImproveButton}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
