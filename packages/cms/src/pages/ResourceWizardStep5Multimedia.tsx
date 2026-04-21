/**
 * ResourceWizardStep5Multimedia — Paso 5 del wizard de recursos
 *
 * Orquesta tres bloques: imágenes, vídeos, documentos.
 *
 * Estado condicional:
 *   - Si `resourceId == null` (recurso aún no guardado): muestra panel
 *     "Guarda primero el recurso" con botón "Guardar borrador y continuar"
 *     que llama a `onSaveDraft()` del padre (decisión 1-B del usuario).
 *   - Si `resourceId != null`: muestra los 3 bloques normalmente.
 *
 * Todos los handlers de subida/actualización/eliminación son
 * responsabilidad del padre (ResourceWizardPage), que los implementa
 * contra Supabase Storage + las 3 tablas media.
 */

import { useState } from 'react';
import HelpBlock from '../components/HelpBlock';
import ImagesBlock, { type ImagesBlockProps } from '../components/ImagesBlock';
import VideosBlock, { type VideosBlockProps } from '../components/VideosBlock';
import DocumentsBlock, { type DocumentsBlockProps } from '../components/DocumentsBlock';
import type { ImageItem, VideoItem, DocumentItem } from '@osalnes/shared/data/media';
import { STEP5_COPY } from './step5-multimedia.copy';

// ─── Props ─────────────────────────────────────────────────────────────

export interface ResourceWizardStep5MultimediaProps {
  /**
   * ID del recurso. Si es null/undefined → recurso aún no guardado y
   * mostramos el estado "guarda primero".
   */
  resourceId: string | null;

  /**
   * Callback cuando el usuario pulsa "Guardar borrador y continuar".
   * El padre persiste el recurso con publication_status='draft' y devuelve
   * el resourceId nuevo (o lanza error si algo falla).
   */
  onSaveDraft: () => Promise<string>;

  /** Callback cuando el usuario pulsa "Saltar este paso" */
  onSkip: () => void;

  // ─── Estado de los tres bloques ──────────────────────────────────
  images: ImageItem[];
  videos: VideoItem[];
  documents: DocumentItem[];

  // ─── Handlers de imágenes ────────────────────────────────────────
  onUploadImage: ImagesBlockProps['onUpload'];
  onUpdateImageAlt: ImagesBlockProps['onUpdateAlt'];
  onSetImagePrimary: ImagesBlockProps['onSetPrimary'];
  onRemoveImage: ImagesBlockProps['onRemove'];
  onGenerateImageAlt: ImagesBlockProps['onGenerateAlt'];

  // ─── Handlers de vídeos ──────────────────────────────────────────
  onAddVideo: VideosBlockProps['onAdd'];
  onRemoveVideo: VideosBlockProps['onRemove'];
  onUpdateVideoTitle: VideosBlockProps['onUpdateTitle'];

  // ─── Handlers de documentos ──────────────────────────────────────
  onUploadDocument: DocumentsBlockProps['onUpload'];
  onUpdateDocumentMeta: DocumentsBlockProps['onUpdateMeta'];
  onRemoveDocument: DocumentsBlockProps['onRemove'];
}

// ─── Componente ────────────────────────────────────────────────────────

export default function ResourceWizardStep5Multimedia(
  props: ResourceWizardStep5MultimediaProps,
) {
  const { resourceId, onSaveDraft, onSkip } = props;
  const COPY = STEP5_COPY;

  const [savingDraft, setSavingDraft] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSaveDraft = async () => {
    setSaveError(null);
    setSavingDraft(true);
    try {
      await onSaveDraft();
    } catch {
      setSaveError(COPY.unsavedState.errorGeneric);
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <div className="step5-content">
      <header className="step5-header">
        <h2>{COPY.header.title}</h2>
        <p>{COPY.header.subtitle}</p>
      </header>

      <HelpBlock
        storageKey="resource-wizard-step5"
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

      {/* Estado 1: recurso aún no guardado */}
      {!resourceId ? (
        <div className="step5-unsaved">
          <div className="step5-unsaved-icon" aria-hidden>
            📷✨
          </div>
          <h3>{COPY.unsavedState.title}</h3>
          <p>{COPY.unsavedState.description}</p>

          <div className="step5-unsaved-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveDraft}
              disabled={savingDraft}
            >
              {savingDraft
                ? COPY.unsavedState.saveDraftLoading
                : COPY.unsavedState.saveDraftButton}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onSkip}
              disabled={savingDraft}
            >
              {COPY.unsavedState.skipButton}
            </button>
          </div>

          <p className="step5-unsaved-hint">{COPY.unsavedState.skipHint}</p>

          {saveError && (
            <p role="alert" className="images-error">
              ⚠️ {saveError}
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Estado 2: recurso guardado, los 3 bloques activos */}
          <ImagesBlock
            images={props.images}
            onUpload={props.onUploadImage}
            onUpdateAlt={props.onUpdateImageAlt}
            onSetPrimary={props.onSetImagePrimary}
            onRemove={props.onRemoveImage}
            onGenerateAlt={props.onGenerateImageAlt}
          />

          <VideosBlock
            videos={props.videos}
            onAdd={props.onAddVideo}
            onRemove={props.onRemoveVideo}
            onUpdateTitle={props.onUpdateVideoTitle}
          />

          <DocumentsBlock
            documents={props.documents}
            onUpload={props.onUploadDocument}
            onUpdateMeta={props.onUpdateDocumentMeta}
            onRemove={props.onRemoveDocument}
          />
        </>
      )}
    </div>
  );
}
