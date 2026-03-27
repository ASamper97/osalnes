import { useEffect, useState, type FormEvent } from 'react';
import { api, type PageItem } from '@/lib/api';

const STATUS_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  revision: 'Revision',
  publicado: 'Publicado',
  archivado: 'Archivado',
};

const STATUS_COLORS: Record<string, string> = {
  borrador: '#f39c12',
  revision: '#3498db',
  publicado: '#27ae60',
  archivado: '#95a5a6',
};

const STATE_TRANSITIONS: Record<string, { target: string; label: string; style?: string }[]> = {
  borrador:  [{ target: 'revision', label: 'Enviar a revision' }],
  revision:  [{ target: 'publicado', label: 'Publicar', style: 'btn-primary' }, { target: 'borrador', label: 'Devolver' }],
  publicado: [{ target: 'archivado', label: 'Archivar' }],
  archivado: [{ target: 'borrador', label: 'Reactivar' }],
};

const TEMPLATES = ['default', 'landing', 'info', 'experiencia'];

const WEB_BASE = import.meta.env.VITE_WEB_URL || 'http://localhost:3000';

export function PagesPage() {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [template, setTemplate] = useState('default');
  const [titleEs, setTitleEs] = useState('');
  const [titleGl, setTitleGl] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [titleFr, setTitleFr] = useState('');
  const [titlePt, setTitlePt] = useState('');
  const [bodyEs, setBodyEs] = useState('');
  const [bodyGl, setBodyGl] = useState('');
  const [seoTitleEs, setSeoTitleEs] = useState('');
  const [seoTitleGl, setSeoTitleGl] = useState('');
  const [seoDescEs, setSeoDescEs] = useState('');
  const [seoDescGl, setSeoDescGl] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function loadPages() {
    api.getAdminPages().then(setPages).catch((e) => setError(e.message));
  }

  useEffect(() => { loadPages(); }, []);

  function resetForm() {
    setEditingId(null);
    setSlug(''); setTemplate('default');
    setTitleEs(''); setTitleGl('');
    setTitleEn(''); setTitleFr(''); setTitlePt('');
    setBodyEs(''); setBodyGl('');
    setSeoTitleEs(''); setSeoTitleGl('');
    setSeoDescEs(''); setSeoDescGl('');
  }

  async function startEdit(id: string) {
    try {
      const p = await api.getAdminPage(id);
      setEditingId(p.id);
      setSlug(p.slug);
      setTemplate(p.template || 'default');
      setTitleEs(p.title?.es || ''); setTitleGl(p.title?.gl || '');
      setTitleEn(p.title?.en || ''); setTitleFr(p.title?.fr || ''); setTitlePt(p.title?.pt || '');
      setBodyEs(p.body?.es || ''); setBodyGl(p.body?.gl || '');
      setSeoTitleEs(p.seoTitle?.es || ''); setSeoTitleGl(p.seoTitle?.gl || '');
      setSeoDescEs(p.seoDescription?.es || ''); setSeoDescGl(p.seoDescription?.gl || '');
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side validation
    const errs: string[] = [];
    if (!slug.trim()) errs.push('Slug es obligatorio');
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errs.push('Slug solo admite letras minusculas, numeros y guiones');
    if (!titleEs.trim()) errs.push('Titulo (ES) es obligatorio');
    if (seoDescEs.length > 300) errs.push('SEO Descripcion (ES) demasiado larga (max 300)');
    if (seoDescGl.length > 300) errs.push('SEO Descripcion (GL) demasiado larga (max 300)');
    if (errs.length > 0) { setError(errs.join('\n')); return; }

    setSaving(true);

    const body = {
      slug,
      template,
      title: { es: titleEs, gl: titleGl, ...(titleEn && { en: titleEn }), ...(titleFr && { fr: titleFr }), ...(titlePt && { pt: titlePt }) },
      body: { es: bodyEs, gl: bodyGl },
      seo_title: { es: seoTitleEs, gl: seoTitleGl },
      seo_description: { es: seoDescEs, gl: seoDescGl },
    };

    try {
      if (editingId) {
        await api.updatePage(editingId, body);
      } else {
        await api.createPage(body);
      }
      resetForm();
      loadPages();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Eliminar pagina "${title}"? Esta accion no se puede deshacer.`)) return;
    setBusyId(id);
    try {
      await api.deletePage(id);
      if (editingId === id) resetForm();
      loadPages();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    const label = STATUS_LABELS[newStatus] || newStatus;
    if (!confirm(`Cambiar estado a "${label}"?`)) return;
    setBusyId(id);
    try {
      await api.updatePageStatus(id, newStatus);
      loadPages();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Paginas editoriales</h1>
      </div>

      {error && <div className="alert alert-error" style={{ whiteSpace: 'pre-line' }}>{error}</div>}

      {/* Form */}
      <form onSubmit={handleSubmit} className="resource-form" style={{ marginBottom: '2rem' }}>
        <fieldset>
          <legend>{editingId ? 'Editar pagina' : 'Nueva pagina'}</legend>

          <div className="form-row">
            <div className="form-field">
              <label>Slug *</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="info-practica" />
            </div>
            <div className="form-field">
              <label>Template</label>
              <select value={template} onChange={(e) => setTemplate(e.target.value)}>
                {TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Titulo (ES) *</label>
              <input value={titleEs} onChange={(e) => setTitleEs(e.target.value)} required />
            </div>
            <div className="form-field">
              <label>Titulo (GL)</label>
              <input value={titleGl} onChange={(e) => setTitleGl(e.target.value)} />
            </div>
          </div>

          <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="form-field">
              <label>Titulo (EN)</label>
              <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Titulo (FR)</label>
              <input value={titleFr} onChange={(e) => setTitleFr(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Titulo (PT)</label>
              <input value={titlePt} onChange={(e) => setTitlePt(e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Contenido (ES)</label>
              <textarea rows={6} value={bodyEs} onChange={(e) => setBodyEs(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Contenido (GL)</label>
              <textarea rows={6} value={bodyGl} onChange={(e) => setBodyGl(e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>SEO Titulo (ES)</label>
              <input value={seoTitleEs} onChange={(e) => setSeoTitleEs(e.target.value)} />
            </div>
            <div className="form-field">
              <label>SEO Titulo (GL)</label>
              <input value={seoTitleGl} onChange={(e) => setSeoTitleGl(e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>SEO Descripcion (ES)</label>
              <textarea rows={2} value={seoDescEs} onChange={(e) => setSeoDescEs(e.target.value)} maxLength={300} />
              <span className={`field-hint ${seoDescEs.length > 160 ? 'field-hint--warn' : ''}`}>{seoDescEs.length}/160</span>
            </div>
            <div className="form-field">
              <label>SEO Descripcion (GL)</label>
              <textarea rows={2} value={seoDescGl} onChange={(e) => setSeoDescGl(e.target.value)} maxLength={300} />
              <span className={`field-hint ${seoDescGl.length > 160 ? 'field-hint--warn' : ''}`}>{seoDescGl.length}/160</span>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear pagina'}
            </button>
            {editingId && <button type="button" className="btn" onClick={resetForm}>Cancelar</button>}
          </div>
        </fieldset>
      </form>

      {/* Table */}
      <table className="data-table">
        <thead>
          <tr>
            <th>Titulo</th>
            <th>Slug</th>
            <th>Template</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {pages.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>Sin paginas</td></tr>
          )}
          {pages.map((p) => (
            <tr key={p.id}>
              <td><strong>{p.title?.es || p.slug}</strong></td>
              <td style={{ fontSize: '0.8rem' }}>{p.slug}</td>
              <td>{p.template}</td>
              <td>
                <span className="status-badge" style={{ background: STATUS_COLORS[p.status] || '#999' }}>
                  {STATUS_LABELS[p.status] || p.status}
                </span>
              </td>
              <td>
                <div className="action-btns">
                  <button className="btn btn-sm" onClick={() => startEdit(p.id)} disabled={busyId === p.id}>Editar</button>
                  {p.status === 'publicado' && (
                    <a href={`${WEB_BASE}/es/${p.slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline">Ver</a>
                  )}
                  {(STATE_TRANSITIONS[p.status] || []).map((t) => (
                    <button key={t.target} className={`btn btn-sm ${t.style || 'btn-outline'}`} onClick={() => handleStatusChange(p.id, t.target)} disabled={busyId === p.id}>
                      {busyId === p.id ? '...' : t.label}
                    </button>
                  ))}
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id, p.title?.es || p.slug)} disabled={busyId === p.id}>
                    {busyId === p.id ? '...' : 'Eliminar'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
