import { useEffect, useState, useRef, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type TypologyItem, type MunicipalityItem, type CategoryItem } from '@/lib/api';
import { MediaUploader } from '@/components/MediaUploader';
import { DocumentUploader } from '@/components/DocumentUploader';
import { RelationsManager } from '@/components/RelationsManager';

const WEB_BASE = import.meta.env.VITE_WEB_URL || 'http://localhost:3000';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/** Simple ES→target translation via auto-translate Edge Function */
async function translateText(text: string, from: string, to: string): Promise<string> {
  if (!text.trim()) return '';
  const res = await fetch(`${SUPABASE_URL}/functions/v1/auto-translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ texto: text, from, to }),
  });
  if (!res.ok) throw new Error('Translation failed');
  const data = await res.json();
  return data.translated || data.texto_traducido || text;
}

// UNE 178503 sec. 7.6 — tourist types by category
const TOURIST_TYPES_BY_CATEGORY: Record<string, readonly string[]> = {
  viajero: ['FAMILY TOURISM', 'LGTBI TOURISM', 'BACKPACKING TOURISM', 'BUSINESS TOURISM', 'ROMANTIC TOURISM', 'SENIOR TOURISM'],
  actividad: ['ADVENTURE TOURISM', 'WELLNESS TOURISM', 'CYCLING TOURISM', 'DIVING TOURISM', 'SAILING TOURISM', 'WATER SPORTS TOURISM', 'TREKKING TOURISM'],
  motivacion: ['BEACH AND SUN TOURISM', 'CULTURAL TOURISM', 'ECOTOURISM', 'HERITAGE TOURISM', 'NATURE TOURISM', 'RURAL TOURISM', 'BIRDWATCHING', 'EVENTS AND FESTIVALS TOURISM'],
  producto: ['FOOD TOURISM', 'WINE TOURISM', 'BEER TOURISM', 'OLIVE OIL TOURISM'],
};

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

  const [typologies, setTypologies] = useState<TypologyItem[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = useRef(false);

  // Warn on unsaved changes
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty.current) { e.preventDefault(); }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  function markDirty() { dirty.current = true; }

  // Form state
  const [rdfType, setRdfType] = useState('TouristAttraction');
  const [slug, setSlug] = useState('');
  const [nameEs, setNameEs] = useState('');
  const [nameGl, setNameGl] = useState('');
  const [descEs, setDescEs] = useState('');
  const [descGl, setDescGl] = useState('');
  const [municipioId, setMunicipioId] = useState('');
  const [zonaId, setZonaId] = useState('');
  const [zones, setZones] = useState<{ id: string; slug: string; name: Record<string, string> }[]>([]);
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
  // UNE 178503 fields
  const [touristTypes, setTouristTypes] = useState<string[]>([]);
  const [ratingValue, setRatingValue] = useState('');
  const [servesCuisine, setServesCuisine] = useState('');
  const [sameAs, setSameAs] = useState('');
  const [occupancy, setOccupancy] = useState('');
  // Extra languages (EN/FR/PT)
  const [nameEn, setNameEn] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [namePt, setNamePt] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descFr, setDescFr] = useState('');
  const [descPt, setDescPt] = useState('');
  // Auto-translate state
  const [translating, setTranslating] = useState<string | null>(null);

  async function handleTranslate(sourceText: string, targetLang: string, setter: (v: string) => void) {
    if (!sourceText.trim()) return;
    const key = `${targetLang}-${Date.now()}`;
    setTranslating(key);
    try {
      const result = await translateText(sourceText, 'es', targetLang);
      setter(result);
      markDirty();
    } catch {
      // Fallback: simple ES→GL approximation for demo
      if (targetLang === 'gl') {
        const gl = sourceText
          .replace(/\bde el\b/gi, 'do')
          .replace(/\bde la\b/gi, 'da')
          .replace(/\bde los\b/gi, 'dos')
          .replace(/\bde las\b/gi, 'das')
          .replace(/\blos\b/gi, 'os')
          .replace(/\blas\b/gi, 'as')
          .replace(/\bel\b/gi, 'o')
          .replace(/\bla\b/gi, 'a')
          .replace(/\by\b/gi, 'e')
          .replace(/ción\b/gi, 'ción')
          .replace(/\bplaya\b/gi, 'praia')
          .replace(/\bmirador\b/gi, 'miradoiro')
          .replace(/\biglesia\b/gi, 'igrexa')
          .replace(/\bmuseo\b/gi, 'museo')
          .replace(/\brestaurante\b/gi, 'restaurante')
          .replace(/\bpuente\b/gi, 'ponte');
        setter(gl);
        markDirty();
      }
    } finally {
      setTranslating(null);
    }
  }

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
      .then((r) => {
        setRdfType(r.rdfType || '');
        setSlug(r.slug || '');
        setNameEs(r.name?.es || '');
        setNameGl(r.name?.gl || '');
        setDescEs(r.description?.es || '');
        setDescGl(r.description?.gl || '');
        setMunicipioId(r.municipioId || '');
        setZonaId(r.zonaId || '');
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
        // UNE 178503 fields
        setTouristTypes(r.touristTypes || []);
        setRatingValue(r.ratingValue?.toString() || '');
        setServesCuisine((r.servesCuisine || []).join(', '));
        setSameAs((r.contact?.sameAs || []).join('\n'));
        setOccupancy(r.occupancy?.toString() || '');
        // Extra languages
        setNameEn(r.name?.en || '');
        setNameFr(r.name?.fr || '');
        setNamePt(r.name?.pt || '');
        setDescEn(r.description?.en || '');
        setDescFr(r.description?.fr || '');
        setDescPt(r.description?.pt || '');
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

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const URL_RE = /^https?:\/\/.+/;

  function validate(): string[] {
    const errs: string[] = [];
    if (!nameEs.trim()) errs.push('Nombre (ES) es obligatorio');
    if (!slug.trim()) errs.push('Slug es obligatorio');
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errs.push('Slug solo admite letras minusculas, numeros y guiones');

    const lat = latitude ? parseFloat(latitude) : null;
    const lng = longitude ? parseFloat(longitude) : null;
    if (lat !== null && (lat < -90 || lat > 90)) errs.push('Latitud debe estar entre -90 y 90');
    if (lng !== null && (lng < -180 || lng > 180)) errs.push('Longitud debe estar entre -180 y 180');

    const emails = email ? email.split(',').map((e) => e.trim()).filter(Boolean) : [];
    for (const e of emails) {
      if (!EMAIL_RE.test(e)) errs.push(`Email invalido: ${e}`);
    }

    if (url && !URL_RE.test(url)) errs.push('URL debe comenzar con http:// o https://');
    if (seoDescEs.length > 300) errs.push('Descripcion SEO (ES) demasiado larga (max 300)');
    if (seoDescGl.length > 300) errs.push('Descripcion SEO (GL) demasiado larga (max 300)');

    return errs;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setError(validationErrors.join('\n'));
      return;
    }

    setSaving(true);

    const body = {
      rdf_type: rdfType,
      slug,
      municipio_id: municipioId || null,
      zona_id: zonaId || null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      address_street: addressStreet || null,
      address_postal: addressPostal || null,
      telephone: telephone ? telephone.split(',').map((t) => t.trim()).filter(Boolean) : [],
      email: email ? email.split(',').map((e) => e.trim()).filter(Boolean) : [],
      url: url || null,
      same_as: sameAs ? sameAs.split('\n').map((s) => s.trim()).filter(Boolean) : [],
      opening_hours: openingHours || null,
      is_accessible_for_free: isAccessibleForFree,
      public_access: publicAccess,
      visible_en_mapa: visibleOnMap,
      tourist_types: touristTypes,
      rating_value: ratingValue ? parseInt(ratingValue, 10) : null,
      serves_cuisine: servesCuisine ? servesCuisine.split(',').map((c) => c.trim()).filter(Boolean) : [],
      occupancy: occupancy ? parseInt(occupancy, 10) : null,
      name: { es: nameEs, gl: nameGl, ...(nameEn && { en: nameEn }), ...(nameFr && { fr: nameFr }), ...(namePt && { pt: namePt }) },
      description: { es: descEs, gl: descGl, ...(descEn && { en: descEn }), ...(descFr && { fr: descFr }), ...(descPt && { pt: descPt }) },
      seo_title: { es: seoTitleEs, gl: seoTitleGl },
      seo_description: { es: seoDescEs, gl: seoDescGl },
      category_ids: selectedCategories,
    };

    try {
      dirty.current = false;
      if (isNew) {
        const created = await api.createResource(body);
        // CRIT-02 fix: redirect to edit mode so media/docs/relations are available
        navigate(`/resources/${created.id}`, { replace: true });
      } else {
        await api.updateResource(id!, body);
        navigate('/resources');
      }
    } catch (err: unknown) {
      setError((err as Error).message);
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
        <div className="page-header__actions">
          {!isNew && slug && (
            <a
              href={`${WEB_BASE}/es/recurso/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
            >
              Ver en web
            </a>
          )}
          <button className="btn" onClick={() => navigate('/resources')}>Volver</button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ whiteSpace: 'pre-line' }}>{error}</div>
      )}

      <form onSubmit={handleSubmit} onChange={markDirty} className="resource-form">
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
              <label>Slug *{!isNew && ' (no editable)'}</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="mirador-a-lanzada" disabled={!isNew} />
              {!isNew && <span className="field-hint">El slug no se puede cambiar para proteger las URLs existentes</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Municipio</label>
              <select value={municipioId} onChange={(e) => { setMunicipioId(e.target.value); setZonaId(''); if (e.target.value) { api.getZones(e.target.value).then(setZones).catch(() => setZones([])); } else { setZones([]); } }}>
                <option value="">-- Sin municipio --</option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.id}>{m.name?.es || m.slug}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Zona</label>
              <select value={zonaId} onChange={(e) => setZonaId(e.target.value)} disabled={!municipioId}>
                <option value="">-- Sin zona --</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name?.es || z.slug}</option>
                ))}
              </select>
            </div>
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
              <label>Nombre (GL) <button type="button" className="translate-btn" disabled={!nameEs || !!translating} onClick={() => handleTranslate(nameEs, 'gl', setNameGl)}>{translating ? '...' : 'Traducir a GL'}</button></label>
              <input value={nameGl} onChange={(e) => setNameGl(e.target.value)} placeholder="Miradoiro de A Lanzada" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Descripcion (ES)</label>
              <textarea rows={4} value={descEs} onChange={(e) => setDescEs(e.target.value)} placeholder="Descripcion del recurso..." />
            </div>
            <div className="form-field">
              <label>Descripcion (GL) <button type="button" className="translate-btn" disabled={!descEs || !!translating} onClick={() => handleTranslate(descEs, 'gl', setDescGl)}>{translating ? '...' : 'Traducir a GL'}</button></label>
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
          <div className="form-field">
              <label>Redes sociales / enlaces externos</label>
              <textarea rows={3} value={sameAs} onChange={(e) => setSameAs(e.target.value)} placeholder={"https://instagram.com/ejemplo\nhttps://facebook.com/ejemplo"} />
              <span className="field-hint">Una URL por linea (Instagram, Facebook, TripAdvisor, etc.)</span>
            </div>
          </div>
        </fieldset>

        {/* --- UNE 178503 sec. 7.6-7.7 --- */}
        <fieldset>
          <legend>Clasificacion turistica (UNE 178503)</legend>

          <div className="form-row">
            <div className="form-field">
              <label>Clasificacion (estrellas/tenedores)</label>
              <select value={ratingValue} onChange={(e) => setRatingValue(e.target.value)}>
                <option value="">-- Sin clasificacion --</option>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{'*'.repeat(n)} ({n})</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Aforo</label>
              <input type="number" min="0" value={occupancy} onChange={(e) => setOccupancy(e.target.value)} placeholder="150" />
            </div>
          </div>

          <div className="form-field">
            <label>Tipo de cocina</label>
            <input value={servesCuisine} onChange={(e) => setServesCuisine(e.target.value)} placeholder="Gallega, Mariscos, Tapas" />
            <span className="field-hint">Separados por comas (solo restauracion)</span>
          </div>

          <div className="form-field">
            <label>Tipos de turismo (UNE 178503 sec. 7.6)</label>
            <div className="categories-grid">
              {Object.entries(TOURIST_TYPES_BY_CATEGORY).map(([cat, types]) => (
                <div key={cat} className="category-group">
                  <strong style={{ textTransform: 'capitalize' }}>{cat}</strong>
                  {types.map((tt) => (
                    <label key={tt} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={touristTypes.includes(tt)}
                        onChange={() => setTouristTypes((prev) =>
                          prev.includes(tt) ? prev.filter((t) => t !== tt) : [...prev, tt]
                        )}
                      />
                      {tt.replace(' TOURISM', '').toLowerCase()}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </fieldset>

        {/* --- Traducciones extra (EN/FR/PT) --- */}
        <fieldset>
          <legend>Traducciones adicionales (EN / FR / PT)</legend>

          <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="form-field">
              <label>Nombre (EN) <button type="button" className="translate-btn" disabled={!nameEs || !!translating} onClick={() => handleTranslate(nameEs, 'en', setNameEn)}>Traducir</button></label>
              <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="English name" />
            </div>
            <div className="form-field">
              <label>Nombre (FR) <button type="button" className="translate-btn" disabled={!nameEs || !!translating} onClick={() => handleTranslate(nameEs, 'fr', setNameFr)}>Traducir</button></label>
              <input value={nameFr} onChange={(e) => setNameFr(e.target.value)} placeholder="Nom en francais" />
            </div>
            <div className="form-field">
              <label>Nombre (PT) <button type="button" className="translate-btn" disabled={!nameEs || !!translating} onClick={() => handleTranslate(nameEs, 'pt', setNamePt)}>Traducir</button></label>
              <input value={namePt} onChange={(e) => setNamePt(e.target.value)} placeholder="Nome em portugues" />
            </div>
          </div>

          <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="form-field">
              <label>Descripcion (EN) <button type="button" className="translate-btn" disabled={!descEs || !!translating} onClick={() => handleTranslate(descEs, 'en', setDescEn)}>Traducir</button></label>
              <textarea rows={3} value={descEn} onChange={(e) => setDescEn(e.target.value)} placeholder="English description" />
            </div>
            <div className="form-field">
              <label>Descripcion (FR) <button type="button" className="translate-btn" disabled={!descEs || !!translating} onClick={() => handleTranslate(descEs, 'fr', setDescFr)}>Traducir</button></label>
              <textarea rows={3} value={descFr} onChange={(e) => setDescFr(e.target.value)} placeholder="Description en francais" />
            </div>
            <div className="form-field">
              <label>Descripcion (PT) <button type="button" className="translate-btn" disabled={!descEs || !!translating} onClick={() => handleTranslate(descEs, 'pt', setDescPt)}>Traducir</button></label>
              <textarea rows={3} value={descPt} onChange={(e) => setDescPt(e.target.value)} placeholder="Descricao em portugues" />
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
              <textarea rows={2} value={seoDescEs} onChange={(e) => setSeoDescEs(e.target.value)} placeholder="Descripcion para buscadores (max 160 chars)" maxLength={300} />
              <span className={`field-hint ${seoDescEs.length > 160 ? 'field-hint--warn' : ''}`}>{seoDescEs.length}/160</span>
            </div>
            <div className="form-field">
              <label>Descripcion SEO (GL)</label>
              <textarea rows={2} value={seoDescGl} onChange={(e) => setSeoDescGl(e.target.value)} placeholder="Descricion para buscadores (max 160 chars)" maxLength={300} />
              <span className={`field-hint ${seoDescGl.length > 160 ? 'field-hint--warn' : ''}`}>{seoDescGl.length}/160</span>
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
