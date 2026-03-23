import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

interface Asset {
  id: string;
  url: string;
  tipo: string;
  mime_type: string;
  orden: number;
}

interface MediaUploaderProps {
  recursoId: string;
}

export function MediaUploader({ recursoId }: MediaUploaderProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  }

  async function loadAssets() {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/assets?entidad_tipo=recurso_turistico&entidad_id=${recursoId}`, { headers });
      if (res.ok) setAssets(await res.json());
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
      const headers = await getAuthHeaders();
      const form = new FormData();
      form.append('file', file);
      form.append('entidad_tipo', 'recurso_turistico');
      form.append('entidad_id', recursoId);
      form.append('tipo', file.type.startsWith('video') ? 'video' : 'imagen');

      const res = await fetch(`${API_BASE}/admin/assets`, {
        method: 'POST',
        headers,
        body: form,
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Upload failed');
      }

      if (fileRef.current) fileRef.current.value = '';
      await loadAssets();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(assetId: string) {
    if (!confirm('Eliminar este archivo?')) return;
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_BASE}/admin/assets/${assetId}`, { method: 'DELETE', headers });
      await loadAssets();
    } catch (err: any) {
      setError(err.message);
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
        {uploading && <span style={{ fontSize: '0.8rem', color: '#999' }}>Subiendo...</span>}
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
        <p style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.5rem' }}>Sin archivos multimedia</p>
      )}
    </fieldset>
  );
}
