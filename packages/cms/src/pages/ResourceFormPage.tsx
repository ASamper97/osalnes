import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { MediaUploader } from '@/components/MediaUploader';
import { DocumentUploader } from '@/components/DocumentUploader';
import { RelationsManager } from '@/components/RelationsManager';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function ResourceFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  const [typologies, setTypologies] = useState<any[]>([]);
  const [municipalities, setMunicipalities] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [rdfType, setRdfType] = useState('TouristAttraction');
  const [slug, setSlug] = useState('');
  const [nameEs, setNameEs] = useState('');
  const [nameGl, setNameGl] = useState('');
  const [descEs, setDescEs] = useState('');
  const [descGl, setDescGl] = useState('');
  const [municipioId, setMunicipioId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressPostal, setAddressPostal] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [url, setUrl] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [isAccessibleForFree, setIsAccessibleForFree] = useState(false);
  const [publicAccess, setPublicAccess] = useState(false);
  const [visibleOnMap, setVisibleOnMap] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [seoTitleEs, setSeoTitleEs] = useState('');
  const [seoTitleGl, setSeoTitleGl] = useState('');
  const [seoDescEs, setSeoDescEs] = useState('');
  const [seoDescGl, setSeoDescGl] = useState('');

  // Load reference data
  useEffect(() => {
    api.getTypologies().then(setTypologies).catch(() => {});
    api.getMunicipalities().then(setMunicipalities).catch(() => {});
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  // Load existing resource
  useEffect(() => {
    if (isNew) return;
    api.getResource(id!)
      .then((r: any) => {
        setRdfType(r.rdfType || '');
        setSlug(r.slug || '');
        setNameEs(r.name?.es || '');
        setNameGl(r.name?.gl || '');
        setDescEs(r.description?.es || '');
        setDescGl(r.description?.gl || '');
        setMunicipioId(r.municipioId || '');
        setLatitude(r.location?.latitude?.toString() || '');
        setLongitude(r.location?.longitude?.toString() || '');
        setAddressStreet(r.location?.streetAddress || '');
        setAddressPostal(r.location?.postalCode || '');
        setTelephone((r.contact?.telephone || []).join(', '));
        setEmail((r.contact?.email || []).join(', '));
        setUrl(r.contact?.url || '');
        setOpeningHours(r.openingHours || '');
        setIsAccessibleForFree(r.isAccessibleForFree || false);
        setPublicAccess(r.publicAccess || false);
        setVisibleOnMap(r.visibleOnMap ?? true);
        setSelectedCategories(r.categoryIds || []);
        setSeoTitleEs(r.seoTitle?.es || '');
        setSeoTitleGl(r.seoTitle?.gl || '');
        setSeoDescEs(r.seoDescription?.es || '');
        setSeoDescGl(r.seoDescription?.gl || '');
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id, isNew]);

  // Auto-generate slug from name
  function handleNameEsChange(value: string) {
    setNameEs(value);
    if (isNew) setSlug(slugify(value));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const body = {
      rdf_type: rdfType,
      slug,
      municipio_id: municipioId || null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      address_street: addressStreet || null,
      address_postal: addressPostal || null,
      telephone: telephone ? telephone.split(',').map((t) => t.trim()).filter(Boolean) : [],
      email: email ? email.split(',').map((e) => e.trim()).filter(Boolean) : [],
      url: url || null,
      opening_hours: openingHours || null,
      is_accessible_for_free: isAccessibleForFree,
      public_access: publicAccess,
      visible_en_mapa: visibleOnMap,
      name: { es: nameEs, gl: nameGl },
      description: { es: descEs, gl: descGl },
      seo_title: { es: seoTitleEs, gl: seoTitleGl },
      seo_description: { es: seoDescEs, gl: seoDescGl },
      category_ids: selectedCategories,
    };

    try {
      if (isNew) {
        await api.createResource(body);
      } else {
        await api.updateResource(id!, body);
      }
      navigate('/resources');
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  function toggleCategory(catId: string) {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId],
    );
  }

  if (loading) return <p>Cargando...</p>;

  const rootCategories = categories.filter((c) => !c.parentId);
  const subCategories = (parentId: string) => categories.filter((c) => c.parentId === parentId);

  return (
    <div>
      <div className="page-header">
        <h1>{isNew ? 'Nuevo recurso turistico' : 'Editar recurso'}</h1>
        <button className="btn" onClick={() => navigate('/resources')}>Volver</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit} className="resource-form">
        {/* --- Tipo y slug --- */}
        <fieldset>
          <legend>Identificacion</legend>

          <div className="form-row">
            <div className="form-field">
              <label>Tipologia *</label>
              <select value={rdfType} onChange={(e) => setRdfType(e.target.value)} required>
                {typologies.map((t) => (
                  <option key={t.typeCode} value={t.typeCode}>
                    {t.name?.es || t.typeCode} ({t.grupo})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Slug *</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="mirador-a-lanzada" />
            </div>
          </div>

          <div className="form-field">
            <label>Municipio</label>
            <select value={municipioId} onChange={(e) => setMunicipioId(e.target.value)}>
              <option value="">-- Sin municipio --</option>
              {municipalities.map((m) => (
                <option key={m.id} value={m.id}>{m.name?.es || m.slug}</option>
              ))}
            </select>
          </div>
        </fieldset>

        {/* --- Nombre y descripcion --- */}
        <fieldset>
          <legend>Contenido (traducciones)</legend>

          <div className="form-row">
            <div className="form-field">
              <label>Nombre (ES) *</label>
              <input value={nameEs} onChange={(e) => handleNameEsChange(e.target.value)} required placeholder="Mirador de A Lanzada" />
            </div>
            <div className="form-field">
              <label>Nombre (GL)</label>
              <input value={nameGl} onChange={(e) => setNameGl(e.target.value)} placeholder="Miradoiro de A Lanzada" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Descripcion (ES)</label>
              <textarea rows={4} value={descEs} onChange={(e) => setDescEs(e.target.value)} placeholder="Descripcion del recurso..." />
            </div>
            <div className="form-field">
              <label>Descripcion (GL)</label>
              <textarea rows={4} value={descGl} onChange={(e) => setDescGl(e.target.value)} placeholder="Descricion do recurso..." />
            </div>
          </div>
        </fieldset>

        {/* --- Ubicacion --- */}
        <fieldset>
          <legend>Ubicacion</legend>

          <div className="form-row">
            <div className="form-field">
              <label>Latitud</label>
              <input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="42.4345" />
            </div>
            <div className="form-field">
              <label>Longitud</label>
              <input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="-8.8712" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Direccion</label>
              <input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} placeholder="Rua do Porto, 1" />
            </div>
            <div className="form-field">
              <label>Codigo postal</label>
              <input value={addressPostal} onChange={(e) => setAddressPostal(e.target.value)} placeholder="36989" />
            </div>
          </div>
        </fieldset>

        {/* --- Contacto --- */}
        <fieldset>
          <legend>Contacto</legend>

          <div className="form-row">
            <div className="form-field">
              <label>Telefono(s)</label>
              <input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+34986720075, +34986720076" />
              <span className="field-hint">Separados por comas</span>
            </div>
            <div className="form-field">
              <label>Email(s)</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@ejemplo.gal" />
              <span className="field-hint">Separados por comas</span>
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Web</label>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://turismo.sanxenxo.gal" />
            </div>
            <div className="form-field">
              <label>Horario</label>
              <input value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} placeholder="Mo-Su 09:00-20:00" />
            </div>
          </div>
        </fieldset>

        {/* --- Categorias --- */}
        <fieldset>
          <legend>Categorias</legend>
          <div className="categories-grid">
            {rootCategories.map((root) => (
              <div key={root.id} className="category-group">
                <strong>{root.name?.es || root.slug}</strong>
                {subCategories(root.id).map((sub) => (
                  <label key={sub.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(sub.id)}
                      onChange={() => toggleCategory(sub.id)}
                    />
                    {sub.name?.es || sub.slug}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </fieldset>

        {/* --- SEO --- */}
        <fieldset>
          <legend>SEO</legend>

          <div className="form-row">
            <div className="form-field">
              <label>Titulo SEO (ES)</label>
              <input value={seoTitleEs} onChange={(e) => setSeoTitleEs(e.target.value)} placeholder="Titulo para buscadores" />
            </div>
            <div className="form-field">
              <label>Titulo SEO (GL)</label>
              <input value={seoTitleGl} onChange={(e) => setSeoTitleGl(e.target.value)} placeholder="Titulo para buscadores" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Descripcion SEO (ES)</label>
              <textarea rows={2} value={seoDescEs} onChange={(e) => setSeoDescEs(e.target.value)} placeholder="Descripcion para buscadores (max 160 chars)" />
            </div>
            <div className="form-field">
              <label>Descripcion SEO (GL)</label>
              <textarea rows={2} value={seoDescGl} onChange={(e) => setSeoDescGl(e.target.value)} placeholder="Descricion para buscadores (max 160 chars)" />
            </div>
          </div>
        </fieldset>

        {/* --- Multimedia (only in edit mode) --- */}
        {!isNew && id && <MediaUploader recursoId={id} />}

        {/* --- Documents (only in edit mode) --- */}
        {!isNew && id && <DocumentUploader entidadTipo="recurso_turistico" entidadId={id} />}

        {/* --- Relations (only in edit mode) --- */}
        {!isNew && id && <RelationsManager recursoId={id} />}

        {/* --- Opciones --- */}
        <fieldset>
          <legend>Opciones</legend>
          <div className="form-row">
            <label className="checkbox-label">
              <input type="checkbox" checked={isAccessibleForFree} onChange={(e) => setIsAccessibleForFree(e.target.checked)} />
              Acceso gratuito
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={publicAccess} onChange={(e) => setPublicAccess(e.target.checked)} />
              Acceso publico
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={visibleOnMap} onChange={(e) => setVisibleOnMap(e.target.checked)} />
              Visible en mapa
            </label>
          </div>
        </fieldset>

        {/* --- Submit --- */}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : isNew ? 'Crear recurso' : 'Guardar cambios'}
          </button>
          <button type="button" className="btn" onClick={() => navigate('/resources')}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
