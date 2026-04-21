/**
 * DocumentsBlock — documentos descargables del recurso (Paso 5)
 *
 * Soporta PDFs con metadata editorial (título, tipo, idioma). Decisión
 * 4-A del usuario.
 *
 * Los documentos se guardan en la tabla `resource_documents` y en el
 * bucket de storage `resource-documents`.
 */

import { useMemo, useRef, useState } from 'react';
import {
  MEDIA_LIMITS,
  DOCUMENT_KIND_LABELS,
  DOCUMENT_LANG_LABELS,
  type DocumentItem,
  type DocumentKind,
  type DocumentLang,
} from '@osalnes/shared/data/media';
import { STEP5_COPY } from '../pages/step5-multimedia.copy';

const COPY = STEP5_COPY.documents;

export interface DocumentsBlockProps {
  documents: DocumentItem[];

  /** Sube fichero + valores iniciales de metadata */
  onUpload: (
    file: File,
    initial: { title: string; kind: DocumentKind; lang: DocumentLang },
  ) => Promise<DocumentItem>;

  onUpdateMeta: (
    docId: string,
    patch: Partial<Pick<DocumentItem, 'title' | 'kind' | 'lang'>>,
  ) => Promise<void>;

  onRemove: (docId: string) => Promise<void>;
}

export default function DocumentsBlock({
  documents,
  onUpload,
  onUpdateMeta,
  onRemove,
}: DocumentsBlockProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const pickFiles = () => fileInputRef.current?.click();

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploadError(null);

    if (documents.length + list.length > MEDIA_LIMITS.document.maxPerResource) {
      setUploadError(COPY.uploadErrorTooMany);
      return;
    }

    setUploading(list.length);
    try {
      for (const file of list) {
        if (file.size > MEDIA_LIMITS.document.maxBytes) {
          setUploadError(COPY.uploadErrorTooBig);
          continue;
        }
        if (!MEDIA_LIMITS.document.acceptedMimes.includes(file.type as typeof MEDIA_LIMITS.document.acceptedMimes[number])) {
          setUploadError(COPY.uploadErrorWrongType);
          continue;
        }
        try {
          // Título inicial sugerido: nombre del fichero sin extensión
          const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
          await onUpload(file, {
            title: baseName || file.name,
            kind: 'otro',
            lang: 'es',
          });
        } catch {
          setUploadError(COPY.uploadErrorGeneric);
        }
      }
    } finally {
      setUploading(0);
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
  };

  return (
    <section className="documents-block">
      <header>
        <h3>{COPY.sectionTitle}</h3>
        <p className="muted">{COPY.sectionDesc}</p>
      </header>

      <div
        className={`dropzone dropzone-documents ${dragActive ? 'is-active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={pickFiles}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            pickFiles();
          }
        }}
        aria-label={COPY.dropzoneLabel}
      >
        <input
          ref={fileInputRef}
          type="file"
          hidden
          multiple
          accept={MEDIA_LIMITS.document.acceptedExtensions.join(',')}
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="dropzone-icon" aria-hidden>
          📄
        </div>
        <div className="dropzone-label">
          <strong>{COPY.dropzoneLabel}</strong>
          <span>{COPY.dropzoneHint}</span>
        </div>
        <div className="dropzone-accepted muted">{COPY.dropzoneAccepted}</div>
        {uploading > 0 && (
          <div className="dropzone-progress" aria-live="polite">
            Subiendo… ({uploading})
          </div>
        )}
      </div>

      {uploadError && (
        <p role="alert" className="documents-error">
          ⚠️ {uploadError}
        </p>
      )}

      {documents.length > 0 && (
        <ul className="documents-list" role="list">
          {documents.map((d) => (
            <DocumentRow
              key={d.id}
              doc={d}
              onUpdateMeta={onUpdateMeta}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function DocumentRow({
  doc,
  onUpdateMeta,
  onRemove,
}: {
  doc: DocumentItem;
  onUpdateMeta: DocumentsBlockProps['onUpdateMeta'];
  onRemove: (id: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(doc.title);
  const [kind, setKind] = useState<DocumentKind>(doc.kind);
  const [lang, setLang] = useState<DocumentLang>(doc.lang);

  const commitTitle = async () => {
    if (title.trim() === doc.title) return;
    await onUpdateMeta(doc.id, { title: title.trim() });
  };

  const commitKind = async (next: DocumentKind) => {
    setKind(next);
    if (next !== doc.kind) await onUpdateMeta(doc.id, { kind: next });
  };

  const commitLang = async (next: DocumentLang) => {
    setLang(next);
    if (next !== doc.lang) await onUpdateMeta(doc.id, { lang: next });
  };

  const handleRemove = () => {
    if (window.confirm(COPY.removeConfirm)) void onRemove(doc.id);
  };

  const sizeLabel = useMemo(() => formatBytes(doc.sizeBytes), [doc.sizeBytes]);

  return (
    <li className="document-row">
      <div className="document-icon" aria-hidden>
        📄
      </div>

      <div className="document-fields">
        <label className="document-field document-field-title">
          <span className="document-field-label">{COPY.titleLabel}</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            placeholder={COPY.titlePlaceholder}
          />
        </label>

        <label className="document-field">
          <span className="document-field-label">{COPY.kindLabel}</span>
          <select value={kind} onChange={(e) => void commitKind(e.target.value as DocumentKind)}>
            {(Object.keys(DOCUMENT_KIND_LABELS) as DocumentKind[]).map((k) => (
              <option key={k} value={k}>
                {DOCUMENT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>

        <label className="document-field">
          <span className="document-field-label">{COPY.langLabel}</span>
          <select value={lang} onChange={(e) => void commitLang(e.target.value as DocumentLang)}>
            {(Object.keys(DOCUMENT_LANG_LABELS) as DocumentLang[]).map((l) => (
              <option key={l} value={l}>
                {DOCUMENT_LANG_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="document-meta">
        <span className="muted">{sizeLabel}</span>
      </div>

      <button
        type="button"
        className="document-remove"
        onClick={handleRemove}
        aria-label={COPY.removeLabel}
        title={COPY.removeLabel}
      >
        ×
      </button>
    </li>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
