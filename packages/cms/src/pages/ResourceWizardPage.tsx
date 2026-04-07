import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type TypologyItem, type MunicipalityItem, type CategoryItem } from '@/lib/api';
import { Wizard, WizardFieldGroup, WizardCompletionCard, type WizardStepDef } from '@/components/Wizard';
import { MediaUploader } from '@/components/MediaUploader';
import { DocumentUploader } from '@/components/DocumentUploader';
import { RelationsManager } from '@/components/RelationsManager';
import { AiWritingAssistant } from '@/components/AiWritingAssistant';
import { AiSeoGenerator } from '@/components/AiSeoGenerator';
import { AiQualityScore } from '@/components/AiQualityScore';
import { RichTextEditor } from '@/components/RichTextEditor';
import { TemplateSelector } from '@/components/TemplateSelector';
import { LivePreviewPanel } from '@/components/LivePreviewPanel';
import { EditorialStatusBar, type EditorialState } from '@/components/EditorialStatusBar';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import type { SeoResult, ImportedResource } from '@/lib/ai';
import type { ResourceTemplate } from '@/data/resource-templates';

const WEB_BASE = import.meta.env.VITE_WEB_URL || 'http://localhost:3000';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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

const TOURIST_TYPES_BY_CATEGORY: Record<string, readonly string[]> = {
  viajero: ['FAMILY TOURISM', 'LGTBI TOURISM', 'BACKPACKING TOURISM', 'BUSINESS TOURISM', 'ROMANTIC TOURISM', 'SENIOR TOURISM'],
  actividad: ['ADVENTURE TOURISM', 'WELLNESS TOURISM', 'CYCLING TOURISM', 'DIVING TOURISM', 'SAILING TOURISM', 'WATER SPORTS TOURISM', 'TREKKING TOURISM'],
  motivacion: ['BEACH AND SUN TOURISM', 'CULTURAL TOURISM', 'ECOTOURISM', 'HERITAGE TOURISM', 'NATURE TOURISM', 'RURAL TOURISM', 'BIRDWATCHING', 'EVENTS AND FESTIVALS TOURISM'],
  producto: ['FOOD TOURISM', 'WINE TOURISM', 'BEER TOURISM', 'OLIVE OIL TOURISM'],
};

const CATEGORY_LABELS: Record<string, string> = {
  viajero: 'Tipo de viajero',
  actividad: 'Actividad',
  motivacion: 'Motivacion',
  producto: 'Producto turistico',
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/.+/;

export function ResourceWizardPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  // Reference data
  const [typologies, setTypologies] = useState<TypologyItem[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [zones, setZones] = useState<{ id: string; slug: string; name: Record<string, string> }[]>([]);

  // UI state
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(id || null);
  const dirty = useRef(false);
  const [translating, setTranslating] = useState<string | null>(null);
  // Template selector — only shown for new resources before the wizard starts
  const [templateApplied, setTemplateApplied] = useState(!isNew);
  const [activeTemplate, setActiveTemplate] = useState<ResourceTemplate | null>(null);
  // Live preview panel
  const [previewOpen, setPreviewOpen] = useState(false);
  // Editorial state
  const [editorialStatus, setEditorialStatus] = useState<EditorialState>('borrador');
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  // Forces ActivityTimeline to refetch after a status transition
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);

  // ── Form state ──────────────────────────────────────────────
  // Step 1: Identificacion
  const [rdfType, setRdfType] = useState('TouristAttraction');
  const [rdfTypesSecondary, setRdfTypesSecondary] = useState<string[]>([]);
  const [slug, setSlug] = useState('');
  const [municipioId, setMunicipioId] = useState('');
  const [zonaId, setZonaId] = useState('');

  // Step 2: Contenido
  const [nameEs, setNameEs] = useState('');
  const [nameGl, setNameGl] = useState('');
  const [descEs, setDescEs] = useState('');
  const [descGl, setDescGl] = useState('');

  // Step 3: Ubicacion + Contacto
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressPostal, setAddressPostal] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [url, setUrl] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [sameAs, setSameAs] = useState('');

  // Step 4: Clasificacion turistica
  const [touristTypes, setTouristTypes] = useState<string[]>([]);
  const [ratingValue, setRatingValue] = useState('');
  const [servesCuisine, setServesCuisine] = useState('');
  const [occupancy, setOccupancy] = useState('');

  // Step 5: Multimedia + Documentos (managed by child components)

  // Step 6: SEO + Traducciones
  const [seoTitleEs, setSeoTitleEs] = useState('');
  const [seoTitleGl, setSeoTitleGl] = useState('');
  const [seoDescEs, setSeoDescEs] = useState('');
  const [seoDescGl, setSeoDescGl] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [namePt, setNamePt] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descFr, setDescFr] = useState('');
  const [descPt, setDescPt] = useState('');

  // Opciones + Categorias
  const [isAccessibleForFree, setIsAccessibleForFree] = useState(false);
  const [publicAccess, setPublicAccess] = useState(false);
  const [visibleOnMap, setVisibleOnMap] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // ── Helpers ──────────────────────────────────────────────────

  function markDirty() { dirty.current = true; }

  /** Editorial state transition handler */
  async function handleStatusTransition(newStatus: EditorialState) {
    if (!savedId) return;
    setError(null);
    try {
      const updated = await api.updateResourceStatus(savedId, newStatus);
      setEditorialStatus((updated.status as EditorialState) || newStatus);
      setPublishedAt(updated.publishedAt || null);
      setActivityRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }

  /** Apply a template's defaults to the wizard state. Optionally enrich with imported data. */
  function applyTemplate(template: ResourceTemplate, imported?: ImportedResource) {
    setActiveTemplate(template);

    // 1. rdfType from template (or from imported data if available)
    setRdfType(imported?.rdf_type || template.rdfType);

    // 2. Smart defaults from template
    if (template.defaults.isAccessibleForFree !== undefined) setIsAccessibleForFree(template.defaults.isAccessibleForFree);
    if (template.defaults.publicAccess !== undefined) setPublicAccess(template.defaults.publicAccess);
    if (template.defaults.visibleOnMap !== undefined) setVisibleOnMap(template.defaults.visibleOnMap);
    if (template.defaults.touristTypes) setTouristTypes([...template.defaults.touristTypes]);

    // 3. Override with imported data when present
    if (imported) {
      if (imported.name) {
        setNameEs(imported.name);
        setSlug(slugify(imported.name));
      }
      if (imported.description) setDescEs(`<p>${imported.description.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`);
      if (imported.address) setAddressStreet(imported.address);
      if (imported.postal_code) setAddressPostal(imported.postal_code);
      if (imported.telephone?.length) setTelephone(imported.telephone.join(', '));
      if (imported.email?.length) setEmail(imported.email.join(', '));
      if (imported.url) setUrl(imported.url);
      if (imported.opening_hours) setOpeningHours(imported.opening_hours);
      if (imported.latitude !== undefined && imported.latitude !== null) setLatitude(imported.latitude.toString());
      if (imported.longitude !== undefined && imported.longitude !== null) setLongitude(imported.longitude.toString());
      if (imported.rating_value) setRatingValue(imported.rating_value.toString());
      if (imported.cuisine?.length) setServesCuisine(imported.cuisine.join(', '));
      if (imported.tourist_types?.length) setTouristTypes(imported.tourist_types);
    }

    setTemplateApplied(true);
    markDirty();
  }

  async function handleTranslate(sourceText: string, targetLang: string, setter: (v: string) => void) {
    if (!sourceText.trim()) return;
    const key = `${targetLang}-${Date.now()}`;
    setTranslating(key);
    try {
      const result = await translateText(sourceText, 'es', targetLang);
      setter(result);
      markDirty();
    } catch {
      if (targetLang === 'gl') {
        const gl = sourceText
          .replace(/\bde el\b/gi, 'do').replace(/\bde la\b/gi, 'da')
          .replace(/\bde los\b/gi, 'dos').replace(/\bde las\b/gi, 'das')
          .replace(/\blos\b/gi, 'os').replace(/\blas\b/gi, 'as')
          .replace(/\bel\b/gi, 'o').replace(/\bla\b/gi, 'a').replace(/\by\b/gi, 'e')
          .replace(/\bplaya\b/gi, 'praia').replace(/\bmirador\b/gi, 'miradoiro')
          .replace(/\biglesia\b/gi, 'igrexa').replace(/\bpuente\b/gi, 'ponte');
        setter(gl);
        markDirty();
      }
    } finally {
      setTranslating(null);
    }
  }

  function handleNameEsChange(value: string) {
    setNameEs(value);
    if (isNew) setSlug(slugify(value));
    markDirty();
  }

  function toggleCategory(catId: string) {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId],
    );
    markDirty();
  }

  // ── Data loading ────────────────────────────────────────────

  useEffect(() => {
    api.getTypologies().then(setTypologies).catch(() => {});
    api.getMunicipalities().then(setMunicipalities).catch(() => {});
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) return;
    api.getResource(id!)
      .then((r) => {
        setRdfType(r.rdfType || '');
        setRdfTypesSecondary(r.rdfTypes || []);
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
        setTouristTypes(r.touristTypes || []);
        setRatingValue(r.ratingValue?.toString() || '');
        setServesCuisine((r.servesCuisine || []).join(', '));
        setSameAs((r.contact?.sameAs || []).join('\n'));
        setOccupancy(r.occupancy?.toString() || '');
        setNameEn(r.name?.en || '');
        setNameFr(r.name?.fr || '');
        setNamePt(r.name?.pt || '');
        setDescEn(r.description?.en || '');
        setDescFr(r.description?.fr || '');
        setDescPt(r.description?.pt || '');
        setSavedId(r.id);
        setEditorialStatus((r.status as EditorialState) || 'borrador');
        setPublishedAt(r.publishedAt || null);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [id, isNew]);

  // Warn on unsaved changes
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty.current) e.preventDefault();
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ── Validation per step ─────────────────────────────────────

  const validateStep1 = useCallback((): string[] => {
    const errs: string[] = [];
    if (!rdfType) errs.push('Selecciona una tipologia para el recurso');
    if (!nameEs.trim()) errs.push('El nombre en castellano es obligatorio');
    if (!slug.trim()) errs.push('El slug es obligatorio (se genera automaticamente a partir del nombre)');
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errs.push('El slug solo admite letras minusculas, numeros y guiones');
    return errs;
  }, [rdfType, nameEs, slug]);

  const validateStep2 = useCallback((): string[] => {
    // Content step — name already validated in step 1, descriptions are optional but recommended
    return [];
  }, []);

  const validateStep3 = useCallback((): string[] => {
    const errs: string[] = [];
    const lat = latitude ? parseFloat(latitude) : null;
    const lng = longitude ? parseFloat(longitude) : null;
    if (lat !== null && (lat < -90 || lat > 90)) errs.push('La latitud debe estar entre -90 y 90');
    if (lng !== null && (lng < -180 || lng > 180)) errs.push('La longitud debe estar entre -180 y 180');
    const emails = email ? email.split(',').map((e) => e.trim()).filter(Boolean) : [];
    for (const e of emails) {
      if (!EMAIL_RE.test(e)) errs.push(`Email invalido: ${e}`);
    }
    if (url && !URL_RE.test(url)) errs.push('La URL debe comenzar con http:// o https://');
    return errs;
  }, [latitude, longitude, email, url]);

  const validateStep6 = useCallback((): string[] => {
    const errs: string[] = [];
    if (seoDescEs.length > 300) errs.push('La descripcion SEO (ES) es demasiado larga (max 300 caracteres)');
    if (seoDescGl.length > 300) errs.push('La descripcion SEO (GL) es demasiado larga (max 300 caracteres)');
    return errs;
  }, [seoDescEs, seoDescGl]);

  // ── Step definitions ────────────────────────────────────────

  const steps: WizardStepDef[] = [
    {
      id: 'identificacion',
      title: 'Identificacion',
      subtitle: 'Tipo de recurso y nombre',
      icon: '🏷️',
      help: 'Lo primero: elige que tipo de recurso vas a dar de alta (hotel, playa, museo...) y dale un nombre. El slug (la URL amigable) se genera solo a partir del nombre.',
      validate: validateStep1,
    },
    {
      id: 'contenido',
      title: 'Contenido',
      subtitle: 'Descripcion en castellano y gallego',
      icon: '✏️',
      help: 'Escribe la descripcion del recurso. Como minimo en castellano; usa el boton "Traducir a GL" para generar la version en gallego automaticamente. Despues podras revisarla.',
      validate: validateStep2,
    },
    {
      id: 'ubicacion',
      title: 'Ubicacion',
      subtitle: 'Direccion, coordenadas y contacto',
      icon: '📍',
      help: 'Indica donde se encuentra el recurso. Las coordenadas GPS son importantes para que aparezca correctamente en el mapa. Tambien puedes anadir telefonos, email y web.',
      validate: validateStep3,
    },
    {
      id: 'clasificacion',
      title: 'Clasificacion',
      subtitle: 'Turismo y categorias (UNE 178503)',
      icon: '⭐',
      help: 'Clasifica el recurso segun los estandares de turismo inteligente. Estrellas, tipo de cocina, aforo... Tambien marca las categorias internas del portal.',
      optional: true,
    },
    {
      id: 'multimedia',
      title: 'Multimedia',
      subtitle: 'Fotos, videos y documentos',
      icon: '📸',
      help: savedId
        ? 'Sube fotografias y videos del recurso. Arrastra para reordenar. Tambien puedes adjuntar documentos descargables (PDF, folletos...).'
        : 'Las fotos y documentos se podran subir despues de guardar el recurso por primera vez. Completa este asistente y vuelve a editar para anadir multimedia.',
      optional: true,
    },
    {
      id: 'seo',
      title: 'SEO e idiomas',
      subtitle: 'Buscadores y traducciones adicionales',
      icon: '🌐',
      help: 'Optimiza como aparece el recurso en Google y traduce a ingles, frances y portugues. El titulo SEO ideal tiene menos de 60 caracteres y la descripcion menos de 160.',
      validate: validateStep6,
      optional: true,
    },
    {
      id: 'revision',
      title: 'Revision',
      subtitle: 'Comprueba y publica',
      icon: '✅',
      help: 'Revisa todos los datos antes de guardar. Los campos marcados con advertencia deberian completarse para mejorar la calidad del recurso.',
    },
  ];

  // ── Save / Submit ───────────────────────────────────────────

  async function handleFinish() {
    setError(null);
    setSaving(true);

    const body = {
      rdf_type: rdfType,
      rdf_types: rdfTypesSecondary.filter((t) => t !== rdfType),
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
      if (isNew || !savedId) {
        const created = await api.createResource(body);
        setSavedId(created.id);
        navigate(`/resources/${created.id}`, { replace: true });
      } else {
        await api.updateResource(savedId, body);
        navigate('/resources');
      }
    } catch (err: unknown) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  // ── Computed ─────────────────────────────────────────────────

  const rootCategories = categories.filter((c) => !c.parentId);
  const subCategories = (parentId: string) => categories.filter((c) => c.parentId === parentId);
  const currentTypology = typologies.find((t) => t.typeCode === rdfType);

  // ── Render ───────────────────────────────────────────────────

  if (loading) return <p>Cargando recurso...</p>;

  // Show TemplateSelector before the wizard for new resources
  if (isNew && !templateApplied) {
    return (
      <TemplateSelector
        onSelect={applyTemplate}
        onCancel={() => navigate('/resources')}
      />
    );
  }

  // Get typology group for the preview badge
  const typologyGroup = currentTypology?.grupo;

  // Build preview data from current form state
  const previewData = {
    name: nameEs,
    type: currentTypology?.name?.es || rdfType,
    typeGroup: typologyGroup,
    description: descEs,
    municipio: municipalities.find((m) => m.id === municipioId)?.name?.es,
    address: addressStreet,
    postalCode: addressPostal,
    telephone,
    email,
    url,
    openingHours,
    ratingValue,
    cuisine: servesCuisine,
    isAccessibleForFree,
    latitude,
    longitude,
  };

  return (
    <>
    <Wizard
      steps={steps}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      onFinish={handleFinish}
      saving={saving}
      title={isNew ? 'Nuevo recurso turistico' : 'Editar recurso'}
      subtitle={isNew
        ? activeTemplate
          ? `${activeTemplate.icon} Plantilla: ${activeTemplate.name} — ${activeTemplate.description}`
          : 'Te guiamos paso a paso para crear un recurso completo y bien documentado'
        : `Editando: ${nameEs || slug}`
      }
      finishLabel={isNew ? 'Crear recurso' : 'Guardar cambios'}
      onCancel={() => navigate('/resources')}
    >
      {error && (
        <div className="alert alert-error" style={{ whiteSpace: 'pre-line', marginBottom: '1rem' }}>{error}</div>
      )}

      {/* Editorial status bar — only when editing existing resource */}
      {!isNew && savedId && (
        <EditorialStatusBar
          currentStatus={editorialStatus}
          publishedAt={publishedAt}
          onTransition={handleStatusTransition}
          disabled={saving}
        />
      )}

      {/* ================================================================
          STEP 1 — Identificacion
          ================================================================ */}
      {currentStep === 0 && (
        <>
          <WizardFieldGroup
            title="Tipologia principal"
            description="Que tipo de recurso turistico es? Esto determina los campos disponibles y como se muestra en la web."
            required
          >
            <div className="form-field">
              <select value={rdfType} onChange={(e) => { setRdfType(e.target.value); markDirty(); }}>
                {typologies.map((t) => (
                  <option key={t.typeCode} value={t.typeCode}>
                    {t.name?.es || t.typeCode} ({t.grupo})
                  </option>
                ))}
              </select>
            </div>

            <details style={{ marginTop: '0.5rem' }}>
              <summary style={{ fontSize: '0.78rem', color: 'var(--cms-text-light)', cursor: 'pointer' }}>
                Tipologias secundarias ({rdfTypesSecondary.length})
              </summary>
              <div className="secondary-types-grid" style={{ marginTop: '0.5rem' }}>
                {typologies.filter((t) => t.typeCode !== rdfType).map((t) => (
                  <label key={t.typeCode} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={rdfTypesSecondary.includes(t.typeCode)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRdfTypesSecondary((prev) => [...prev, t.typeCode]);
                        } else {
                          setRdfTypesSecondary((prev) => prev.filter((x) => x !== t.typeCode));
                        }
                        markDirty();
                      }}
                    />
                    {t.name?.es || t.typeCode}
                  </label>
                ))}
              </div>
            </details>
          </WizardFieldGroup>

          <WizardFieldGroup
            title="Nombre del recurso"
            description="El nombre principal tal como se mostrara en la web y en buscadores."
            required
            tip="Usa el nombre oficial o el mas reconocible. Ejemplo: 'Mirador de A Lanzada', no 'mirador lanzada'."
          >
            <div className="form-row">
              <div className="form-field">
                <label>Nombre (ES) *</label>
                <input
                  value={nameEs}
                  onChange={(e) => handleNameEsChange(e.target.value)}
                  placeholder="Ej: Mirador de A Lanzada"
                  autoFocus
                />
              </div>
              <div className="form-field">
                <label>
                  Nombre (GL)
                  <button type="button" className="translate-btn" disabled={!nameEs || !!translating} onClick={() => handleTranslate(nameEs, 'gl', setNameGl)}>
                    {translating ? '...' : 'Traducir a GL'}
                  </button>
                </label>
                <input value={nameGl} onChange={(e) => { setNameGl(e.target.value); markDirty(); }} placeholder="Ej: Miradoiro de A Lanzada" />
              </div>
            </div>
          </WizardFieldGroup>

          <WizardFieldGroup
            title="Slug (URL amigable)"
            description="Se genera automaticamente a partir del nombre. Es la parte de la URL que identifica este recurso."
          >
            <div className="form-field">
              <input
                value={slug}
                onChange={(e) => { setSlug(e.target.value); markDirty(); }}
                placeholder="mirador-a-lanzada"
                disabled={!isNew}
              />
              {!isNew && <span className="field-hint">El slug no se puede cambiar para proteger las URLs existentes</span>}
              {isNew && slug && (
                <span className="field-hint">
                  Vista previa: {WEB_BASE}/es/recurso/<strong>{slug}</strong>
                </span>
              )}
            </div>
          </WizardFieldGroup>

          <WizardFieldGroup
            title="Municipio y zona"
            description="A que municipio de O Salnes pertenece este recurso?"
          >
            <div className="form-row">
              <div className="form-field">
                <label>Municipio</label>
                <select
                  value={municipioId}
                  onChange={(e) => {
                    setMunicipioId(e.target.value);
                    setZonaId('');
                    markDirty();
                    if (e.target.value) {
                      api.getZones(e.target.value).then(setZones).catch(() => setZones([]));
                    } else {
                      setZones([]);
                    }
                  }}
                >
                  <option value="">-- Sin municipio --</option>
                  {municipalities.map((m) => (
                    <option key={m.id} value={m.id}>{m.name?.es || m.slug}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Zona</label>
                <select value={zonaId} onChange={(e) => { setZonaId(e.target.value); markDirty(); }} disabled={!municipioId}>
                  <option value="">-- Sin zona --</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>{z.name?.es || z.slug}</option>
                  ))}
                </select>
              </div>
            </div>
          </WizardFieldGroup>
        </>
      )}

      {/* ================================================================
          STEP 2 — Contenido (descripciones)
          ================================================================ */}
      {currentStep === 1 && (
        <>
          <WizardFieldGroup
            title="Descripcion en castellano"
            description="Describe el recurso de forma atractiva e informativa. Esta es la descripcion principal que veran los visitantes."
            tip="Una buena descripcion tiene entre 100 y 300 palabras, menciona lo que hace unico al recurso y da informacion practica. Usa los botones de la barra superior para dar formato (negrita, listas, titulos...) y el boton 'Mejorar con IA' para que la IA reescriba el texto."
          >
            <RichTextEditor
              value={descEs}
              onChange={(html) => { setDescEs(html); markDirty(); }}
              placeholder="Describe el recurso: que es, que lo hace especial, que puede encontrar el visitante..."
              minHeight={220}
            />
            <AiWritingAssistant
              text={descEs}
              lang="es"
              onAccept={(t) => { setDescEs(t); markDirty(); }}
              translationTargets={[
                { lang: 'gl', label: 'Gallego', onAccept: (t) => { setDescGl(t); markDirty(); } },
                { lang: 'en', label: 'Ingles', onAccept: (t) => { setDescEn(t); markDirty(); } },
                { lang: 'fr', label: 'Frances', onAccept: (t) => { setDescFr(t); markDirty(); } },
                { lang: 'pt', label: 'Portugues', onAccept: (t) => { setDescPt(t); markDirty(); } },
              ]}
            />
          </WizardFieldGroup>

          <WizardFieldGroup
            title="Descripcion en gallego"
            description="Traduce o adapta la descripcion al gallego. Puedes usar el boton de traduccion automatica como punto de partida."
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.35rem' }}>
              <button
                type="button"
                className="translate-btn"
                disabled={!descEs || !!translating}
                onClick={() => handleTranslate(descEs, 'gl', setDescGl)}
              >
                {translating ? 'Traduciendo...' : 'Traducir automaticamente a GL'}
              </button>
            </div>
            <RichTextEditor
              value={descGl}
              onChange={(html) => { setDescGl(html); markDirty(); }}
              placeholder="Descricion do recurso en galego..."
              minHeight={220}
            />
          </WizardFieldGroup>

          <WizardFieldGroup title="Opciones de visibilidad">
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <label className="checkbox-label">
                <input type="checkbox" checked={isAccessibleForFree} onChange={(e) => { setIsAccessibleForFree(e.target.checked); markDirty(); }} />
                Acceso gratuito
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={publicAccess} onChange={(e) => { setPublicAccess(e.target.checked); markDirty(); }} />
                Acceso publico
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={visibleOnMap} onChange={(e) => { setVisibleOnMap(e.target.checked); markDirty(); }} />
                Visible en mapa
              </label>
            </div>
          </WizardFieldGroup>
        </>
      )}

      {/* ================================================================
          STEP 3 — Ubicacion + Contacto
          ================================================================ */}
      {currentStep === 2 && (
        <>
          <WizardFieldGroup
            title="Coordenadas GPS"
            description="Las coordenadas permiten que el recurso aparezca en el mapa interactivo del portal."
            tip="Puedes obtener las coordenadas desde Google Maps: haz clic derecho sobre el punto y copia las coordenadas."
          >
            <div className="form-row">
              <div className="form-field">
                <label>Latitud</label>
                <input type="number" step="any" value={latitude} onChange={(e) => { setLatitude(e.target.value); markDirty(); }} placeholder="42.4345" />
              </div>
              <div className="form-field">
                <label>Longitud</label>
                <input type="number" step="any" value={longitude} onChange={(e) => { setLongitude(e.target.value); markDirty(); }} placeholder="-8.8712" />
              </div>
            </div>
          </WizardFieldGroup>

          <WizardFieldGroup
            title="Direccion postal"
            description="La direccion fisica del recurso."
          >
            <div className="form-row">
              <div className="form-field">
                <label>Direccion</label>
                <input value={addressStreet} onChange={(e) => { setAddressStreet(e.target.value); markDirty(); }} placeholder="Rua do Porto, 1" />
              </div>
              <div className="form-field">
                <label>Codigo postal</label>
                <input value={addressPostal} onChange={(e) => { setAddressPostal(e.target.value); markDirty(); }} placeholder="36989" />
              </div>
            </div>
          </WizardFieldGroup>

          <WizardFieldGroup
            title="Datos de contacto"
            description="Informacion para que los visitantes puedan contactar o encontrar mas informacion."
            tip="Si hay varios telefonos o emails, separalos con comas."
          >
            <div className="form-row">
              <div className="form-field">
                <label>Telefono(s)</label>
                <input value={telephone} onChange={(e) => { setTelephone(e.target.value); markDirty(); }} placeholder="+34986720075, +34986720076" />
              </div>
              <div className="form-field">
                <label>Email(s)</label>
                <input value={email} onChange={(e) => { setEmail(e.target.value); markDirty(); }} placeholder="info@ejemplo.gal" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Web</label>
                <input value={url} onChange={(e) => { setUrl(e.target.value); markDirty(); }} placeholder="https://turismo.sanxenxo.gal" />
              </div>
              <div className="form-field">
                <label>Horario</label>
                <input value={openingHours} onChange={(e) => { setOpeningHours(e.target.value); markDirty(); }} placeholder="Mo-Su 09:00-20:00" />
              </div>
            </div>
            <div className="form-field">
              <label>Redes sociales / enlaces externos</label>
              <textarea rows={3} value={sameAs} onChange={(e) => { setSameAs(e.target.value); markDirty(); }} placeholder={"https://instagram.com/ejemplo\nhttps://facebook.com/ejemplo"} />
              <span className="field-hint">Una URL por linea (Instagram, Facebook, TripAdvisor, etc.)</span>
            </div>
          </WizardFieldGroup>
        </>
      )}

      {/* ================================================================
          STEP 4 — Clasificacion turistica + Categorias
          ================================================================ */}
      {currentStep === 3 && (
        <>
          <WizardFieldGroup
            title="Clasificacion del establecimiento"
            description="Estrellas, tenedores o clasificacion oficial del recurso."
          >
            <div className="form-row">
              <div className="form-field">
                <label>Clasificacion (estrellas/tenedores)</label>
                <select value={ratingValue} onChange={(e) => { setRatingValue(e.target.value); markDirty(); }}>
                  <option value="">-- Sin clasificacion --</option>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Aforo</label>
                <input type="number" min="0" value={occupancy} onChange={(e) => { setOccupancy(e.target.value); markDirty(); }} placeholder="150" />
              </div>
            </div>
            <div className="form-field">
              <label>Tipo de cocina</label>
              <input value={servesCuisine} onChange={(e) => { setServesCuisine(e.target.value); markDirty(); }} placeholder="Gallega, Mariscos, Tapas" />
              <span className="field-hint">Separados por comas (solo para restauracion)</span>
            </div>
          </WizardFieldGroup>

          <WizardFieldGroup
            title="Tipos de turismo (UNE 178503)"
            description="Marca los tipos de turismo asociados a este recurso. Esto mejora las busquedas y el posicionamiento."
          >
            <div className="categories-grid">
              {Object.entries(TOURIST_TYPES_BY_CATEGORY).map(([cat, types]) => (
                <div key={cat} className="category-group">
                  <strong>{CATEGORY_LABELS[cat] || cat}</strong>
                  {types.map((tt) => (
                    <label key={tt} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={touristTypes.includes(tt)}
                        onChange={() => {
                          setTouristTypes((prev) =>
                            prev.includes(tt) ? prev.filter((t) => t !== tt) : [...prev, tt]
                          );
                          markDirty();
                        }}
                      />
                      {tt.replace(' TOURISM', '').toLowerCase()}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </WizardFieldGroup>

          <WizardFieldGroup
            title="Categorias del portal"
            description="Marca las categorias internas del portal donde debe aparecer este recurso."
          >
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
          </WizardFieldGroup>
        </>
      )}

      {/* ================================================================
          STEP 5 — Multimedia + Documentos
          ================================================================ */}
      {currentStep === 4 && (
        <>
          {savedId ? (
            <>
              <WizardFieldGroup
                title="Fotografias y videos"
                description="Sube imagenes y videos del recurso. Puedes arrastrar para reordenar — la primera imagen sera la principal."
                tip="Las imagenes deberian tener al menos 1200px de ancho para verse bien en la web. Formatos: JPG, PNG, WebP. Videos: MP4."
              >
                <MediaUploader recursoId={savedId} />
              </WizardFieldGroup>

              <WizardFieldGroup
                title="Documentos descargables"
                description="Adjunta folletos, PDF informativos, mapas o cualquier documento que el visitante pueda descargar."
              >
                <DocumentUploader entidadTipo="recurso_turistico" entidadId={savedId} />
              </WizardFieldGroup>

              <WizardFieldGroup
                title="Relaciones con otros recursos"
                description="Conecta este recurso con otros del portal: cercania, rutas, alternativas..."
              >
                <RelationsManager recursoId={savedId} />
              </WizardFieldGroup>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📸</div>
              <h3 style={{ marginBottom: '0.5rem', color: 'var(--cms-text)' }}>Multimedia disponible tras guardar</h3>
              <p style={{ color: 'var(--cms-text-light)', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto' }}>
                Para subir fotos, videos y documentos, primero completa el asistente y guarda el recurso.
                Despues podras volver a editar y anadir todo el contenido multimedia.
              </p>
            </div>
          )}
        </>
      )}

      {/* ================================================================
          STEP 6 — SEO + Traducciones adicionales
          ================================================================ */}
      {currentStep === 5 && (
        <>
          <AiSeoGenerator
            name={nameEs}
            description={descEs}
            type={currentTypology?.name?.es || rdfType}
            municipality={municipalities.find((m) => m.id === municipioId)?.name?.es || ''}
            onApply={(seo: SeoResult) => {
              setSeoTitleEs(seo.title_es);
              setSeoTitleGl(seo.title_gl);
              setSeoDescEs(seo.desc_es);
              setSeoDescGl(seo.desc_gl);
              markDirty();
            }}
          />

          <WizardFieldGroup
            title="SEO — Titulo y descripcion para buscadores"
            description="Estos textos aparecen en los resultados de Google. Un buen SEO atrae mas visitantes."
            tip="Titulo ideal: menos de 60 caracteres. Descripcion ideal: entre 120 y 160 caracteres. Si los dejas vacios, se usaran el nombre y la descripcion del recurso."
          >
            <div className="form-row">
              <div className="form-field">
                <label>Titulo SEO (ES)</label>
                <input value={seoTitleEs} onChange={(e) => { setSeoTitleEs(e.target.value); markDirty(); }} placeholder="Titulo para buscadores" />
                <span className={`field-hint ${seoTitleEs.length > 60 ? 'field-hint--warn' : ''}`}>{seoTitleEs.length}/60</span>
              </div>
              <div className="form-field">
                <label>Titulo SEO (GL)</label>
                <input value={seoTitleGl} onChange={(e) => { setSeoTitleGl(e.target.value); markDirty(); }} placeholder="Titulo para buscadores" />
                <span className={`field-hint ${seoTitleGl.length > 60 ? 'field-hint--warn' : ''}`}>{seoTitleGl.length}/60</span>
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Descripcion SEO (ES)</label>
                <textarea rows={2} value={seoDescEs} onChange={(e) => { setSeoDescEs(e.target.value); markDirty(); }} placeholder="Descripcion para buscadores (max 160 chars)" maxLength={300} />
                <span className={`field-hint ${seoDescEs.length > 160 ? 'field-hint--warn' : ''}`}>{seoDescEs.length}/160</span>
              </div>
              <div className="form-field">
                <label>Descripcion SEO (GL)</label>
                <textarea rows={2} value={seoDescGl} onChange={(e) => { setSeoDescGl(e.target.value); markDirty(); }} placeholder="Descricion para buscadores (max 160 chars)" maxLength={300} />
                <span className={`field-hint ${seoDescGl.length > 160 ? 'field-hint--warn' : ''}`}>{seoDescGl.length}/160</span>
              </div>
            </div>
          </WizardFieldGroup>

          <WizardFieldGroup
            title="Traducciones adicionales"
            description="Traduce el nombre y la descripcion a ingles, frances y portugues. Usa los botones de traduccion automatica como punto de partida."
          >
            <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="form-field">
                <label>
                  Nombre (EN)
                  <button type="button" className="translate-btn" disabled={!nameEs || !!translating} onClick={() => handleTranslate(nameEs, 'en', setNameEn)}>Traducir</button>
                </label>
                <input value={nameEn} onChange={(e) => { setNameEn(e.target.value); markDirty(); }} placeholder="English name" />
              </div>
              <div className="form-field">
                <label>
                  Nombre (FR)
                  <button type="button" className="translate-btn" disabled={!nameEs || !!translating} onClick={() => handleTranslate(nameEs, 'fr', setNameFr)}>Traducir</button>
                </label>
                <input value={nameFr} onChange={(e) => { setNameFr(e.target.value); markDirty(); }} placeholder="Nom en francais" />
              </div>
              <div className="form-field">
                <label>
                  Nombre (PT)
                  <button type="button" className="translate-btn" disabled={!nameEs || !!translating} onClick={() => handleTranslate(nameEs, 'pt', setNamePt)}>Traducir</button>
                </label>
                <input value={namePt} onChange={(e) => { setNamePt(e.target.value); markDirty(); }} placeholder="Nome em portugues" />
              </div>
            </div>
            <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="form-field">
                <label>
                  Descripcion (EN)
                  <button type="button" className="translate-btn" disabled={!descEs || !!translating} onClick={() => handleTranslate(descEs, 'en', setDescEn)}>Traducir</button>
                </label>
                <textarea rows={3} value={descEn} onChange={(e) => { setDescEn(e.target.value); markDirty(); }} placeholder="English description" />
              </div>
              <div className="form-field">
                <label>
                  Descripcion (FR)
                  <button type="button" className="translate-btn" disabled={!descEs || !!translating} onClick={() => handleTranslate(descEs, 'fr', setDescFr)}>Traducir</button>
                </label>
                <textarea rows={3} value={descFr} onChange={(e) => { setDescFr(e.target.value); markDirty(); }} placeholder="Description en francais" />
              </div>
              <div className="form-field">
                <label>
                  Descripcion (PT)
                  <button type="button" className="translate-btn" disabled={!descEs || !!translating} onClick={() => handleTranslate(descEs, 'pt', setDescPt)}>Traducir</button>
                </label>
                <textarea rows={3} value={descPt} onChange={(e) => { setDescPt(e.target.value); markDirty(); }} placeholder="Descricao em portugues" />
              </div>
            </div>
          </WizardFieldGroup>
        </>
      )}

      {/* ================================================================
          STEP 7 — Revision final
          ================================================================ */}
      {currentStep === 6 && (
        <>
        <AiQualityScore
          resourceData={{
            nameEs, nameGl, descEs, descGl, rdfType,
            latitude, longitude, telephone, email, url,
            seoTitleEs, seoDescEs, nameEn, nameFr, namePt,
            touristTypes, selectedCategories,
            municipio: municipalities.find((m) => m.id === municipioId)?.name?.es || '',
            hasMedia: !!savedId,
          }}
          onApplyTouristTypes={(types) => { setTouristTypes(types); markDirty(); }}
        />
        <div className="wizard__completion-grid">
          <WizardCompletionCard
            title="Identificacion"
            icon="🏷️"
            onEdit={() => setCurrentStep(0)}
            items={[
              { label: 'Tipologia', value: currentTypology?.name?.es || rdfType, status: 'complete' },
              { label: 'Nombre (ES)', value: nameEs, status: nameEs ? 'complete' : 'incomplete' },
              { label: 'Nombre (GL)', value: nameGl, status: nameGl ? 'complete' : 'warning' },
              { label: 'Slug', value: slug, status: slug ? 'complete' : 'incomplete' },
              { label: 'Municipio', value: municipalities.find((m) => m.id === municipioId)?.name?.es || '', status: municipioId ? 'complete' : 'warning' },
            ]}
          />

          <WizardCompletionCard
            title="Contenido"
            icon="✏️"
            onEdit={() => setCurrentStep(1)}
            items={[
              { label: 'Descripcion ES', value: descEs ? `${descEs.split(/\s+/).filter(Boolean).length} palabras` : '', status: descEs ? 'complete' : 'warning' },
              { label: 'Descripcion GL', value: descGl ? `${descGl.split(/\s+/).filter(Boolean).length} palabras` : '', status: descGl ? 'complete' : 'warning' },
              { label: 'Acceso gratuito', value: isAccessibleForFree ? 'Si' : 'No', status: 'complete' },
              { label: 'Visible en mapa', value: visibleOnMap ? 'Si' : 'No', status: 'complete' },
            ]}
          />

          <WizardCompletionCard
            title="Ubicacion y contacto"
            icon="📍"
            onEdit={() => setCurrentStep(2)}
            items={[
              { label: 'Coordenadas', value: latitude && longitude ? `${latitude}, ${longitude}` : '', status: latitude && longitude ? 'complete' : 'warning' },
              { label: 'Direccion', value: addressStreet, status: addressStreet ? 'complete' : 'warning' },
              { label: 'Telefono', value: telephone, status: telephone ? 'complete' : 'warning' },
              { label: 'Email', value: email, status: email ? 'complete' : 'warning' },
              { label: 'Web', value: url, status: url ? 'complete' : 'warning' },
            ]}
          />

          <WizardCompletionCard
            title="Clasificacion"
            icon="⭐"
            onEdit={() => setCurrentStep(3)}
            items={[
              { label: 'Estrellas', value: ratingValue ? '★'.repeat(parseInt(ratingValue)) : '', status: ratingValue ? 'complete' : 'warning' },
              { label: 'Tipos turismo', value: `${touristTypes.length} seleccionados`, status: touristTypes.length > 0 ? 'complete' : 'warning' },
              { label: 'Categorias', value: `${selectedCategories.length} seleccionadas`, status: selectedCategories.length > 0 ? 'complete' : 'warning' },
            ]}
          />

          <WizardCompletionCard
            title="SEO e idiomas"
            icon="🌐"
            onEdit={() => setCurrentStep(5)}
            items={[
              { label: 'SEO titulo ES', value: seoTitleEs, status: seoTitleEs ? 'complete' : 'warning' },
              { label: 'SEO desc ES', value: seoDescEs ? `${seoDescEs.length} chars` : '', status: seoDescEs ? 'complete' : 'warning' },
              { label: 'Ingles', value: nameEn ? 'Traducido' : '', status: nameEn ? 'complete' : 'warning' },
              { label: 'Frances', value: nameFr ? 'Traducido' : '', status: nameFr ? 'complete' : 'warning' },
              { label: 'Portugues', value: namePt ? 'Traducido' : '', status: namePt ? 'complete' : 'warning' },
            ]}
          />

          <WizardCompletionCard
            title="Multimedia"
            icon="📸"
            onEdit={() => setCurrentStep(4)}
            items={[
              { label: 'Estado', value: savedId ? 'Disponible' : 'Disponible tras guardar', status: savedId ? 'complete' : 'warning' },
            ]}
          />
        </div>

        {/* Activity timeline — only for existing resources */}
        {!isNew && savedId && (
          <div style={{ marginTop: '1.25rem' }}>
            <ActivityTimeline
              key={activityRefreshKey}
              entidadTipo="recurso_turistico"
              entidadId={savedId}
            />
          </div>
        )}
        </>
      )}
    </Wizard>

    {/* Floating preview button */}
    <button
      type="button"
      className="preview-fab"
      onClick={() => setPreviewOpen(true)}
      title="Ver vista previa de como queda en la web"
    >
      <span className="preview-fab__icon">👁</span>
      Vista previa
    </button>

    {/* Live preview panel */}
    <LivePreviewPanel
      open={previewOpen}
      onClose={() => setPreviewOpen(false)}
      data={previewData}
    />
    </>
  );
}
