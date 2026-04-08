import { useEffect, useState, useRef } from 'react';
import { api, type AssetItem } from '@/lib/api';
import { useConfirm } from './ConfirmDialog';

interface MediaUploaderProps {
  recursoId: string;
}

export function MediaUploader({ recursoId }: MediaUploaderProps) {
  const confirm = useConfirm();
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadAssets() {
    try {
      const data = await api.getAssets('recurso_turistico', recursoId);
      setAssets(data.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)));
    } catch {
      // silently fail on load
    }
  }

  useEffect(() => {
    if (recursoId) loadAssets();
  }, [recursoId]);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      await api.uploadAsset('recurso_turistico', recursoId, file);
      if (fileRef.current) fileRef.current.value = '';
      await loadAssets();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(assetId: string) {
    const ok = await confirm({
      title: 'Eliminar este archivo?',
      message: 'El archivo se eliminara permanentemente del recurso.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteAsset(assetId);
      await loadAssets();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }

  async function handleDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }

    const reordered = [...assets];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);

    setAssets(reordered);
    setDragIdx(null);
    setDragOverIdx(null);

    // Persist new order
    try {
      await api.reorderAssets(reordered.map((a, i) => ({ id: a.id, orden: i })));
    } catch (err: unknown) {
      setError((err as Error).message);
      await loadAssets(); // revert on error
    }
  }

  return (
    <fieldset>
      <legend>Multimedia</legend>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Upload */}
      <div className="media-upload-row">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleUpload}
          disabled={uploading}
        />
        {uploading && <span style={{ fontSize: '0.8rem', color: 'var(--cms-text-light)' }}>Subiendo...</span>}
      </div>

      {assets.length > 0 && (
        <p style={{ fontSize: '0.72rem', color: 'var(--cms-text-light)', margin: '0.5rem 0' }}>
          Arrastra para reordenar
        </p>
      )}

      {/* Gallery with drag & drop */}
      {assets.length > 0 && (
        <div className="media-gallery">
          {assets.map((a, i) => (
            <div
              key={a.id}
              className={`media-item ${dragIdx === i ? 'media-item--dragging' : ''} ${dragOverIdx === i ? 'media-item--dragover' : ''}`}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
            >
              <div className="media-item__order">{i + 1}</div>
              {a.tipo === 'imagen' ? (
                <img src={a.url} alt="" />
              ) : (
                <div className="media-placeholder">{a.mime_type}</div>
              )}
              <button
                className="media-delete-btn"
                onClick={() => handleDelete(a.id)}
                title="Eliminar"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {assets.length === 0 && !uploading && (
        <p style={{ fontSize: '0.8rem', color: 'var(--cms-text-light)', marginTop: '0.5rem' }}>Sin archivos multimedia</p>
      )}
    </fieldset>
  );
}
