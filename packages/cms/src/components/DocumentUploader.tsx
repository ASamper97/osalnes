import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { useConfirm } from './ConfirmDialog';

interface Document {
  id: string;
  url: string;
  nombre: Record<string, string>;
  mime_type: string;
  size_bytes: number;
  orden: number;
}

interface DocumentUploaderProps {
  entidadTipo: string;
  entidadId: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentUploader({ entidadTipo, entidadId }: DocumentUploaderProps) {
  const confirm = useConfirm();
  const [docs, setDocs] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameEs, setEditNameEs] = useState('');
  const [editNameGl, setEditNameGl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadDocs() {
    try {
      const data = await api.getDocuments(entidadTipo, entidadId);
      setDocs(data);
    } catch {
      // silently fail on load
    }
  }

  useEffect(() => {
    if (entidadId) loadDocs();
  }, [entidadId]);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      await api.uploadDocument(entidadTipo, entidadId, file, { es: file.name, gl: file.name });
      if (fileRef.current) fileRef.current.value = '';
      await loadDocs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    const ok = await confirm({
      title: 'Eliminar este documento?',
      message: 'El documento se eliminara permanentemente del recurso.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteDocument(docId);
      await loadDocs();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function startEdit(doc: Document) {
    setEditingId(doc.id);
    setEditNameEs(doc.nombre?.es || '');
    setEditNameGl(doc.nombre?.gl || '');
  }

  async function saveEdit() {
    if (!editingId) return;
    try {
      await api.updateDocument(editingId, { nombre: { es: editNameEs, gl: editNameGl } });
      setEditingId(null);
      await loadDocs();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <fieldset>
      <legend>Documentos descargables</legend>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="media-upload-row">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.csv"
          onChange={handleUpload}
          disabled={uploading}
        />
        {uploading && <span style={{ fontSize: '0.8rem', color: '#999' }}>Subiendo...</span>}
      </div>

      {docs.length > 0 && (
        <table className="data-table" style={{ marginTop: '0.5rem' }}>
          <thead>
            <tr>
              <th>Nombre (ES)</th>
              <th>Nombre (GL)</th>
              <th>Tipo</th>
              <th>Tamano</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                {editingId === d.id ? (
                  <>
                    <td><input value={editNameEs} onChange={(e) => setEditNameEs(e.target.value)} style={{ width: '100%' }} /></td>
                    <td><input value={editNameGl} onChange={(e) => setEditNameGl(e.target.value)} style={{ width: '100%' }} /></td>
                    <td>{d.mime_type}</td>
                    <td>{formatSize(d.size_bytes)}</td>
                    <td>
                      <div className="action-btns">
                        <button className="btn btn-sm btn-primary" onClick={saveEdit}>Guardar</button>
                        <button className="btn btn-sm" onClick={() => setEditingId(null)}>Cancelar</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td><a href={d.url} target="_blank" rel="noopener noreferrer">{d.nombre?.es || 'Sin nombre'}</a></td>
                    <td>{d.nombre?.gl || '-'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{d.mime_type}</td>
                    <td style={{ fontSize: '0.8rem' }}>{formatSize(d.size_bytes)}</td>
                    <td>
                      <div className="action-btns">
                        <button className="btn btn-sm" onClick={() => startEdit(d)}>Editar</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(d.id)}>Eliminar</button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {docs.length === 0 && !uploading && (
        <p style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.5rem' }}>Sin documentos</p>
      )}
    </fieldset>
  );
}
