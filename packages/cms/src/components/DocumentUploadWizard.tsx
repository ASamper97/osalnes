import { useState, useRef, useCallback, type DragEvent } from 'react';
import { api } from '@/lib/api';

/* ==========================================================================
   DocumentUploadWizard — Subida de documentos guiada con drag & drop
   ========================================================================== */

interface DocumentUploadWizardProps {
  entidadTipo: string;
  entidadId: string;
  onComplete?: () => void;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'text/csv',
];

const ACCEPTED_EXTENSIONS = '.pdf, .doc, .docx, .xls, .xlsx, .zip, .csv';

const TYPE_HINTS: Record<string, { icon: string; label: string; desc: string }> = {
  'application/pdf': { icon: '📕', label: 'PDF', desc: 'Documento PDF' },
  'application/msword': { icon: '📘', label: 'DOC', desc: 'Microsoft Word' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: '📘', label: 'DOCX', desc: 'Microsoft Word' },
  'application/vnd.ms-excel': { icon: '📗', label: 'XLS', desc: 'Microsoft Excel' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: '📗', label: 'XLSX', desc: 'Microsoft Excel' },
  'application/zip': { icon: '📦', label: 'ZIP', desc: 'Archivo comprimido' },
  'text/csv': { icon: '📊', label: 'CSV', desc: 'Datos tabulares' },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function cleanFileName(name: string): string {
  return name
    .replace(/\.[^/.]+$/, '')     // Remove extension
    .replace(/[-_]+/g, ' ')       // Replace dashes/underscores with spaces
    .replace(/\s+/g, ' ')         // Collapse spaces
    .trim();
}

type WizardStep = 'drop' | 'metadata' | 'uploading' | 'done';

export function DocumentUploadWizard({ entidadTipo, entidadId, onComplete }: DocumentUploadWizardProps) {
  const [step, setStep] = useState<WizardStep>('drop');
  const [file, setFile] = useState<File | null>(null);
  const [nameEs, setNameEs] = useState('');
  const [nameGl, setNameGl] = useState('');
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (f.size > 10 * 1024 * 1024) {
      setError('El archivo excede el tamano maximo de 10 MB');
      return;
    }

    setFile(f);
    setNameEs(cleanFileName(f.name));
    setNameGl(cleanFileName(f.name));
    setError(null);
    setStep('metadata');
  }, []);

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleFileSelect() {
    const f = fileRef.current?.files?.[0];
    if (f) handleFile(f);
  }

  async function handleUpload() {
    if (!file) return;
    setStep('uploading');
    setUploadProgress(20);

    try {
      setUploadProgress(50);
      await api.uploadDocument(entidadTipo, entidadId, file, { es: nameEs, gl: nameGl });
      setUploadProgress(100);
      setStep('done');
    } catch (err: any) {
      setError(err.message);
      setStep('metadata');
    }
  }

  function handleReset() {
    setFile(null);
    setNameEs('');
    setNameGl('');
    setError(null);
    setStep('drop');
    setUploadProgress(0);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleDone() {
    handleReset();
    onComplete?.();
  }

  const typeHint = file ? TYPE_HINTS[file.type] || { icon: '📎', label: 'Archivo', desc: file.type } : null;

  return (
    <div className="doc-wizard">
      {error && <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>{error}</div>}

      {/* Step 1: Drop zone */}
      {step === 'drop' && (
        <div
          className={`doc-wizard__dropzone ${dragging ? 'doc-wizard__dropzone--active' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <div className="doc-wizard__dropzone-icon">📂</div>
          <p className="doc-wizard__dropzone-title">
            {dragging ? 'Suelta el archivo aqui' : 'Arrastra un documento o haz clic para seleccionar'}
          </p>
          <p className="doc-wizard__dropzone-hint">
            Formatos: PDF, Word, Excel, ZIP, CSV — Max. 10 MB
          </p>
        </div>
      )}

      {/* Step 2: Metadata */}
      {step === 'metadata' && file && (
        <div className="doc-wizard__metadata">
          <div className="doc-wizard__file-preview">
            <span className="doc-wizard__file-icon">{typeHint?.icon}</span>
            <div>
              <strong>{file.name}</strong>
              <span className="doc-wizard__file-meta">{typeHint?.label} — {formatSize(file.size)}</span>
            </div>
            <button type="button" className="btn btn-sm" onClick={handleReset}>Cambiar</button>
          </div>

          <div className="doc-wizard__names">
            <p className="doc-wizard__names-hint">
              Dale un nombre descriptivo al documento. Se ha generado uno automaticamente a partir del nombre del archivo.
            </p>
            <div className="form-row">
              <div className="form-field">
                <label>Nombre visible (ES)</label>
                <input value={nameEs} onChange={(e) => setNameEs(e.target.value)} placeholder="Ej: Folleto informativo 2024" />
              </div>
              <div className="form-field">
                <label>Nombre visible (GL)</label>
                <input value={nameGl} onChange={(e) => setNameGl(e.target.value)} placeholder="Ej: Folleto informativo 2024" />
              </div>
            </div>
          </div>

          <div className="doc-wizard__actions">
            <button type="button" className="btn" onClick={handleReset}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={handleUpload} disabled={!nameEs.trim()}>
              Subir documento
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Uploading */}
      {step === 'uploading' && (
        <div className="doc-wizard__uploading">
          <div className="doc-wizard__uploading-icon">📤</div>
          <p>Subiendo documento...</p>
          <div className="wizard__progress-bar" style={{ maxWidth: '300px', margin: '0.75rem auto' }}>
            <div className="wizard__progress-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 'done' && (
        <div className="doc-wizard__done">
          <div className="doc-wizard__done-icon">✅</div>
          <p><strong>Documento subido correctamente</strong></p>
          <p className="doc-wizard__done-name">{nameEs}</p>
          <div className="doc-wizard__actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn" onClick={handleDone}>Cerrar</button>
            <button type="button" className="btn btn-primary" onClick={handleReset}>Subir otro</button>
          </div>
        </div>
      )}
    </div>
  );
}
