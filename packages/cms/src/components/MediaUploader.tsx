import { useEffect, useState, useRef } from 'react';
import { api, type AssetItem } from '@/lib/api';

interface MediaUploaderProps {
  recursoId: string;
}

export function MediaUploader({ recursoId }: MediaUploaderProps) {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadAssets() {
    try {
      const data = await api.getAssets('recurso_turistico', recursoId);
      setAssets(data);
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
    if (!confirm('Eliminar este archivo?')) return;
    try {
      await api.deleteAsset(assetId);
      await loadAssets();
    } catch (err: unknown) {
      setError((err as Error).message);
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

      {/* Gallery */}
      {assets.length > 0 && (
        <div className="media-gallery">
          {assets.map((a) => (
            <div key={a.id} className="media-item">
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
