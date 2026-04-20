import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getAuthHeaders, type TypologyItem, type MunicipalityItem, type CategoryItem } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { saveResourceTags, loadResourceTags } from '@/lib/resource-tags';
import { Wizard, WizardFieldGroup, WizardCompletionCard, type WizardStepDef } from '@/components/Wizard';
import { MediaUploader } from '@/components/MediaUploader';
import { DocumentUploader } from '@/components/DocumentUploader';
import { RelationsManager } from '@/components/RelationsManager';
import { AiWritingAssistant } from '@/components/AiWritingAssistant';
import { AiSeoGenerator } from '@/components/AiSeoGenerator';
import { AiQualityScore } from '@/components/AiQualityScore';
import { RichTextEditor } from '@/components/RichTextEditor';
import TemplatePicker from '@/pages/TemplatePicker';
import { ImportFromUrlModal } from '@/components/ImportFromUrlModal';
import MainTypeSelector from '@/components/MainTypeSelector';
import ResourceWizardStep2Content from '@/pages/ResourceWizardStep2Content';
import TranslationReadyToast from '@/components/TranslationReadyToast';
import { useBackgroundTranslation } from '@/lib/useBackgroundTranslation';
import type { GlStatus } from '@/pages/step2-content.copy';
import ResourceWizardStep3Location from '@/pages/ResourceWizardStep3Location';
import type { LocationData, ContactData } from '@/pages/ResourceWizardStep3Location';
import type { SocialLink } from '@/components/SocialLinksEditor';
import type { OpeningHoursPlan } from '@osalnes/shared/data/opening-hours';
import { emptyPlanByKind, validatePlan } from '@osalnes/shared/data/opening-hours';
import { LivePreviewPanel } from '@/components/LivePreviewPanel';
import { EditorialStatusBar, type EditorialState } from '@/components/EditorialStatusBar';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import TagSelector from '@/components/TagSelector';
import PidCompletenessCard from '@/components/PidCompletenessCard';
import type { SeoResult, ImportedResource } from '@/lib/ai';
import type { ResourceTemplate } from '@/data/resource-templates';
import { RESOURCE_TYPE_BY_XLSX_LABEL, getWizardGroupsForType } from '@osalnes/shared/data/resource-type-catalog';
import { TAGS_BY_KEY, TAGS_BY_GROUP } from '@osalnes/shared/data/tag-catalog';
import { RESOURCE_TEMPLATE_BY_KEY } from '@osalnes/shared/data/resource-templates';

const WEB_BASE = import.meta.env.VITE_WEB_URL || 'http://localhost:3000';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

async function translateText(text: string, from: string, to: string): Promise<string> {
  if (!text.trim()) return '';
  // Audit C4 — auto-translate now requires a valid Supabase JWT (the
  // edge function had verify_jwt=false). We add the bearer via the
  // shared getAuthHeaders helper so the cached token is reused.
  const auth = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/auto-translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      ...auth,
    },
    body: JSON.stringify({ texto: text, from, to }),
  });
  if (!res.ok) throw new Error('Translation failed');
  const data = await res.json();
  return data.translated || data.texto_traducido || text;
}

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
  // C6 — auto-save state. Once true, we avoid spawning multiple parallel
  // create requests if the user clicks "Siguiente" twice quickly.
  const autoSavingRef = useRef(false);
  const [autoSavedToast, setAutoSavedToast] = useState(false);
  // Template selector — only shown for new resources before the wizard starts
  const [templateApplied, setTemplateApplied] = useState(!isNew);
  const [activeTemplate, setActiveTemplate] = useState<ResourceTemplate | null>(null);
  // Paso 0 rediseño · tarea 3: modal de "Importar desde URL con IA".
  // El TemplatePicker delega el flujo al padre; este flag lo abre.
  const [importModalOpen, setImportModalOpen] = useState(false);
  // Live preview panel
  const [previewOpen, setPreviewOpen] = useState(false);
  // Editorial state
  const [editorialStatus, setEditorialStatus] = useState<EditorialState>('borrador');
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  // Forces ActivityTimeline to refetch after a status transition
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);

  // ── Form state ──────────────────────────────────────────────
  // Step 1: Identificacion
  // rdfType se mantiene como state local porque recurso_turistico.rdf_type
  // es NOT NULL — se deriva del mainTypeKey al guardar. La migración 020 lo
  // marca DEPRECATED, pero no lo borra hasta la limpieza posterior.
  const [rdfType, setRdfType] = useState('TouristAttraction');
  const [rdfTypesSecondary, setRdfTypesSecondary] = useState<string[]>([]);
  // Paso 0 · tarea 4: tipología UNE como fuente única. `mainTypeKey` es
  // la clave del catálogo (tipo-de-recurso.*); los subtipos viven ahora en
  // el paso 4 como tags, NO en un segundo vocabulario.
  const [mainTypeKey, setMainTypeKey] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [municipioId, setMunicipioId] = useState('');
  const [zonaId, setZonaId] = useState('');

  // Step 2: Contenido
  const [nameEs, setNameEs] = useState('');
  const [nameGl, setNameGl] = useState('');
  const [descEs, setDescEs] = useState('');
  const [descGl, setDescGl] = useState('');
  // Paso 2 · t4 — estado del editor GL (empty | translated | edited).
  // Al cargar un recurso existente con GL poblado, se asume 'edited' (no
  // podemos saber si vino de IA o fue editado manualmente); es la opción
  // segura porque no mentimos sobre la procedencia.
  const [glStatus, setGlStatus] = useState<GlStatus>('empty');

  // Step 3: Ubicacion + Contacto
  // Legacy: mantenidos para compat con completion cards del paso 7, preview,
  // template apply e import-from-url. Al guardar se envían junto con los
  // campos nuevos estructurados (fuente de verdad del paso 3) hasta la
  // limpieza física posterior a backfill.
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressPostal, setAddressPostal] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [url, setUrl] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [sameAs, setSameAs] = useState('');

  // Paso 3 · t4 — state nuevo estructurado (migración 021).
  // Fuente de verdad del paso 3 rediseñado: mapa + dirección + contacto +
  // redes sociales + plan de horarios. Se sincroniza hacia los legacy al
  // cambiar (para que el paso 7 preview/completion lea los valores al
  // día sin refactorizarlo).
  const [location, setLocation] = useState<LocationData>({
    lat: null,
    lng: null,
    streetAddress: '',
    postalCode: '',
    locality: '',
    parroquia: '',
  });
  const [contact, setContact] = useState<ContactData>({
    phone: '',
    email: '',
    web: '',
    socialLinks: [],
  });
  const [hoursPlan, setHoursPlan] = useState<OpeningHoursPlan>(emptyPlanByKind('weekly'));

  // Step 4: Clasificacion turistica
  // Legacy: tourist_types y category_ids se siguen escribiendo en paralelo
  // hasta migrar el dato (// TODO legacy).
  const [touristTypes, setTouristTypes] = useState<string[]>([]);
  const [ratingValue, setRatingValue] = useState('');
  const [servesCuisine, setServesCuisine] = useState('');
  const [occupancy, setOccupancy] = useState('');
  // Guia-burros v2 — tags UNE 178503 (catalogo 154×18). Hidratacion desde
  // resource_tags la hace la Tarea 6 en el loader.
  const [tagKeys, setTagKeys] = useState<string[]>([]);

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

  /**
   * Paso 0 · Tarea 3 — handler del TemplatePicker nuevo.
   * Recibe una `templateKey` del catálogo UNE (shared) y pre-rellena el
   * state. Sustituye al flujo del TemplateSelector legacy que pasaba un
   * ResourceTemplate completo con `defaults` y `highlights` inventados.
   */
  function handleTemplatePick(templateKey: string) {
    const tpl = RESOURCE_TEMPLATE_BY_KEY[templateKey];
    if (!tpl) return;

    if (tpl.isBlank) {
      // "Empezar en blanco" — el paso 1 forzará a elegir una tipología.
      setTemplateApplied(true);
      setActiveTemplate(null);
      setMainTypeKey(null);
      markDirty();
      return;
    }

    // rdf_type se deriva del value schema.org del mainTag para no violar
    // el NOT NULL de recurso_turistico.rdf_type al guardar (compat legacy
    // hasta la migración de limpieza post-backfill).
    const mainTag = TAGS_BY_KEY[tpl.mainTagKey];
    if (mainTag) setRdfType(mainTag.value);
    setMainTypeKey(tpl.mainTagKey);

    // Tags pre-aplicadas: main + initialTagKeys → visibles ya en el paso 4.
    setTagKeys([tpl.mainTagKey, ...tpl.initialTagKeys]);

    // Adapter mínimo al tipo ResourceTemplate legacy para alimentar el
    // subtitle del wizard ("Plantilla: {icon} {name}"). Los campos
    // `defaults` y `highlights` quedan vacíos — el flujo nuevo no los usa.
    setActiveTemplate({
      id: tpl.key,
      name: tpl.label,
      description: tpl.description,
      icon: tpl.icon,
      rdfType: mainTag?.value || 'TouristAttraction',
      defaults: {},
      highlights: [],
    } as unknown as ResourceTemplate);

    setTemplateApplied(true);
    markDirty();
  }

  /**
   * Aplica los campos extraídos por la IA desde una URL al state del
   * wizard. Reutiliza el mismo mapping que la rama imported del
   * applyTemplate legacy, pero desacoplado de cualquier template.
   */
  function applyImportedFields(imported: ImportedResource) {
    if (imported.rdf_type) setRdfType(imported.rdf_type);
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

    setImportModalOpen(false);
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

  // ── Data loading ────────────────────────────────────────────

  useEffect(() => {
    api.getTypologies().then(setTypologies).catch(() => {});
    api.getMunicipalities().then(setMunicipalities).catch(() => {});
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  // Load zones whenever the selected municipio changes. Using useEffect with
  // a cancelled flag protects against stale responses if the user clicks a
  // different municipio while the previous fetch is still in flight, AND
  // makes the dropdown populate correctly when editing an existing resource
  // (the previous imperative onChange-only fetch left zones empty on load).
  useEffect(() => {
    if (!municipioId) {
      setZones([]);
      return;
    }
    let cancelled = false;
    api.getZones(municipioId)
      .then((z) => { if (!cancelled) setZones(z); })
      .catch(() => { if (!cancelled) setZones([]); });
    return () => { cancelled = true; };
  }, [municipioId]);

  // Al cambiar la tipologia (paso 1), limpia las tags seleccionadas que
  // dejen de ser aplicables al nuevo tipo. Evita que un Hotel→Playa arrastre
  // amenities de alojamiento que no tienen sentido en una playa.
  useEffect(() => {
    const typology = typologies.find((t) => t.typeCode === rdfType);
    const label = typology?.name?.es;
    if (!label) return;
    const def = RESOURCE_TYPE_BY_XLSX_LABEL[label];
    if (!def) return;
    const allowed = new Set(def.wizardGroups);
    setTagKeys((prev) =>
      prev.filter((k) => {
        const tag = TAGS_BY_KEY[k];
        return tag ? allowed.has(tag.groupKey) : false;
      }),
    );
  }, [rdfType, typologies]);

  // Paso 0 · tarea 4 — Sincronía mainTypeKey ↔ tagKeys ↔ rdfType.
  // Cuando el usuario cambia la tipología principal en el paso 1:
  //   1. El tag `tipo-de-recurso.*` correspondiente aparece ya marcado en
  //      el TagSelector del paso 4 (setTagKeys con mainTypeKey al frente).
  //   2. Cualquier otro tag `tipo-de-recurso.*` previo se quita (solo uno
  //      principal; los subtipos viven en otros grupos del catálogo).
  //   3. rdf_type legacy se deriva del value schema.org del catálogo para
  //      no violar el NOT NULL de recurso_turistico.rdf_type al guardar
  //      (hasta la migración de limpieza post-backfill).
  useEffect(() => {
    if (!mainTypeKey) return;
    setTagKeys((prev) => {
      const filtered = prev.filter(
        (k) => !k.startsWith('tipo-de-recurso.') || k === mainTypeKey,
      );
      return filtered.includes(mainTypeKey) ? filtered : [...filtered, mainTypeKey];
    });
    const tag = TAGS_BY_KEY[mainTypeKey];
    if (tag?.value) setRdfType(tag.value);
  }, [mainTypeKey]);

  useEffect(() => {
    if (isNew) return;
    // Carga en paralelo del recurso (edge function) y sus tags UNE 178503
    // (tabla resource_tags vía supabase-js directo, permitido por la policy
    // authenticated de la migración 018). Si el fetch de tags falla —p.ej.
    // tabla aún sin datos— seguimos adelante con array vacío; no bloquea.
    Promise.all([
      api.getResource(id!),
      loadResourceTags(supabase, id!).catch(() => [] as string[]),
    ])
      .then(([r, keys]) => {
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
        // Hidrata el status GL del paso 2 — 'edited' si venía con texto,
        // 'empty' si no. Nunca 'translated' al cargar: no sabemos si la
        // traducción vino de la IA o fue editada por el usuario después.
        setGlStatus((r.description?.gl || '').trim() ? 'edited' : 'empty');
        setSavedId(r.id);
        setEditorialStatus((r.status as EditorialState) || 'borrador');
        setPublishedAt(r.publishedAt || null);
        // Paso 3 · t4 — hidratación de los 3 estados estructurados nuevos.
        // Prioridad al campo estructurado (migración 021) con fallback a
        // los campos legacy (compat mientras hay recursos sin backfill).
        setLocation({
          lat: r.location?.latitude ?? null,
          lng: r.location?.longitude ?? null,
          streetAddress: r.street_address ?? r.location?.streetAddress ?? '',
          postalCode: r.postal_code ?? r.location?.postalCode ?? '',
          locality: r.locality ?? '',
          parroquia: r.parroquia_text ?? '',
        });
        setContact({
          phone: r.contact_phone ?? (r.contact?.telephone?.[0] ?? ''),
          email: r.contact_email ?? (r.contact?.email?.[0] ?? ''),
          web: r.contact_web ?? (r.contact?.url ?? ''),
          socialLinks: (Array.isArray(r.social_links) ? (r.social_links as SocialLink[]) : []),
        });
        setHoursPlan(
          (r.opening_hours_plan as OpeningHoursPlan | null) ?? emptyPlanByKind('weekly'),
        );
        // Paso 2 · t5 — hidratación legacy→tag: si el recurso tenía
        // is_accessible_for_free=true en columna legacy, nos aseguramos de
        // que `caracteristicas.gratuito` esté entre las tags. Al guardar,
        // el flag se deriva del tag (no vuelve a escribirse desde aquí).
        const finalKeys = [...keys];
        if (r.isAccessibleForFree && !finalKeys.includes('caracteristicas.gratuito')) {
          finalKeys.push('caracteristicas.gratuito');
        }
        setTagKeys(finalKeys);
        // Hidratar mainTypeKey desde el primer tag del grupo tipo-de-recurso.*
        // presente en las tags del recurso. Si no hay, queda null — el paso 1
        // forzará a elegir uno antes de avanzar.
        const mainFromTags = finalKeys.find((k) => k.startsWith('tipo-de-recurso.'));
        if (mainFromTags) setMainTypeKey(mainFromTags);
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

  // ── C6 — Auto-save tras step 0 ─────────────────────────────────
  //
  // El paso 4 (Multimedia) necesita un savedId real para asociar las subidas.
  // Antes de este fix, el usuario tenía que terminar TODO el wizard, guardar
  // y volver a entrar para añadir fotos — doble pase forzoso.
  //
  // Ahora: en cuanto el usuario completa válidamente el paso 0 y avanza al 1,
  // creamos un borrador silencioso con los campos mínimos. A partir de ese
  // momento `savedId` está poblado y MediaUploader funciona en cuanto el
  // usuario llegue al paso 4. El "Crear recurso" final del paso 6 simplemente
  // se convierte en un updateResource.
  //
  // Idempotencia: `autoSavingRef` evita disparar dos creates si el usuario
  // hace doble click. `savedId` evita reentrar si ya existe el borrador.
  useEffect(() => {
    if (!isNew) return;
    if (savedId) return;
    if (autoSavingRef.current) return;
    if (currentStep === 0) return;             // todavía en step 0
    if (!nameEs.trim() || !rdfType || !slug) return;  // datos mínimos faltan

    autoSavingRef.current = true;
    api.createResource({
      rdf_type: rdfType,
      rdf_types: [],
      slug,
      municipio_id: municipioId || null,
      zona_id: zonaId || null,
      name: { es: nameEs, gl: nameGl || nameEs },  // GL fallback al ES por defecto
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .then((created) => {
        setSavedId(created.id);
        setAutoSavedToast(true);
        // Sustituir la URL silenciosamente para que un refresh recupere el borrador
        navigate(`/resources/${created.id}`, { replace: true });
        // Ocultar toast tras unos segundos
        setTimeout(() => setAutoSavedToast(false), 4000);
      })
      .catch((err) => {
        // No molestamos al usuario — seguirá sin savedId hasta que guarde manualmente.
        // Pero loguear ayuda al debug en producción.
        console.error('[wizard] auto-save de borrador falló:', err);
        autoSavingRef.current = false;  // permitir reintentar en el siguiente cambio de step
      });
    // No incluimos `nameEs/rdfType/slug` en deps para evitar reintentos en cada keystroke.
    // El effect se re-evalúa al cambiar currentStep, que es exactamente cuando queremos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, isNew, savedId]);

  // ── Validation per step ─────────────────────────────────────

  const validateStep1 = useCallback((): string[] => {
    const errs: string[] = [];
    // Paso 0 · tarea 4: mainTypeKey (tipología UNE) es obligatorio.
    // rdfType legacy se deriva automáticamente, no se valida aparte.
    if (!mainTypeKey) errs.push('Selecciona una tipología para el recurso');
    if (!nameEs.trim()) errs.push('El nombre en castellano es obligatorio');
    if (!municipioId) errs.push('El municipio es obligatorio');
    if (!slug.trim()) errs.push('El slug es obligatorio (se genera automáticamente a partir del nombre)');
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errs.push('El slug solo admite letras minúsculas, números y guiones');
    return errs;
  }, [mainTypeKey, nameEs, municipioId, slug]);

  const validateStep2 = useCallback((): string[] => {
    // Content step — name already validated in step 1, descriptions are optional but recommended
    return [];
  }, []);

  const validateStep3 = useCallback((): string[] => {
    const errs: string[] = [];
    // Paso 3 · t4 — validación sobre los states estructurados nuevos
    // (fuente de verdad del paso 3). El componente guarantiza que las
    // coordenadas son números; sólo validamos consistencia.
    if ((location.lat != null) !== (location.lng != null)) {
      errs.push('Las coordenadas deben tener latitud y longitud.');
    }
    if (contact.email && !EMAIL_RE.test(contact.email)) {
      errs.push('El correo electrónico no tiene un formato válido.');
    }
    if (contact.web && !URL_RE.test(contact.web)) {
      errs.push('El sitio web debe empezar por http:// o https://');
    }
    errs.push(...validatePlan(hoursPlan));
    return errs;
  }, [location.lat, location.lng, contact.email, contact.web, hoursPlan]);

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

    // Paso 0 · tarea 4: rdf_type deriva del value del mainTag UNE si está
    // presente (fuente única); cae a rdfType legacy y por último al default
    // 'TouristAttraction' para no violar el NOT NULL de recurso_turistico.
    const mainTagDerivedType = mainTypeKey ? TAGS_BY_KEY[mainTypeKey]?.value : null;
    const effectiveRdfType = mainTagDerivedType || rdfType || 'TouristAttraction';
    const body = {
      rdf_type: effectiveRdfType,
      rdf_types: rdfTypesSecondary.filter((t) => t !== effectiveRdfType),
      slug,
      municipio_id: municipioId || null,
      zona_id: zonaId || null,
      // Paso 3 · t4 — lat/lng derivan del state nuevo `location`. Los
      // legacy address_street/postal/telephone/email/url/same_as/opening_hours
      // se siguen escribiendo en paralelo (derivados del state estructurado)
      // hasta la migración de limpieza física post-backfill.
      latitude: location.lat ?? (latitude ? parseFloat(latitude) : null),
      longitude: location.lng ?? (longitude ? parseFloat(longitude) : null),
      address_street: location.streetAddress || addressStreet || null,
      address_postal: location.postalCode || addressPostal || null,
      telephone: contact.phone
        ? [contact.phone]
        : (telephone ? telephone.split(',').map((t) => t.trim()).filter(Boolean) : []),
      email: contact.email
        ? [contact.email]
        : (email ? email.split(',').map((e) => e.trim()).filter(Boolean) : []),
      url: contact.web || url || null,
      same_as: contact.socialLinks.length > 0
        ? contact.socialLinks.map((l) => l.url)
        : (sameAs ? sameAs.split('\n').map((s) => s.trim()).filter(Boolean) : []),
      opening_hours: openingHours || null,
      // Paso 3 · t4 — campos estructurados (migración 021), fuente de verdad.
      street_address: location.streetAddress || null,
      postal_code: location.postalCode || null,
      locality: location.locality || null,
      parroquia_text: location.parroquia || null,
      contact_phone: contact.phone || null,
      contact_email: contact.email || null,
      contact_web: contact.web || null,
      social_links: contact.socialLinks,
      opening_hours_plan: hoursPlan,
      // Paso 2 · t5 — acceso_gratuito deriva del tag caracteristicas.gratuito
      // (fuente única). Se sigue escribiendo la columna legacy en paralelo
      // hasta que todos los recursos estén migrados y los consumidores
      // downstream lean solo resource_tags.
      is_accessible_for_free: tagKeys.includes('caracteristicas.gratuito'),
      // TODO producto — confirmar con Mancomunidad si `publicAccess` se
      // mantiene como flag propio o se fusiona con gratuito. No existe tag
      // `caracteristicas.publico` en el catálogo UNE; mantener state legacy.
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
      const wasNew = isNew || !savedId;
      let resourceId: string;
      if (wasNew) {
        const created = await api.createResource(body);
        setSavedId(created.id);
        resourceId = created.id;
      } else {
        await api.updateResource(savedId!, body);
        resourceId = savedId!;
      }
      // Sincroniza las tags UNE 178503 después del upsert del recurso.
      // Incluye el mainTypeKey del paso 1 junto con los tagKeys del paso 4
      // (Set para evitar duplicado si ya estaba). policy authenticated de
      // la migración 018.
      const allKeys = Array.from(new Set([
        ...(mainTypeKey ? [mainTypeKey] : []),
        ...tagKeys,
      ]));
      await saveResourceTags(supabase, resourceId, allKeys);
      if (wasNew) {
        navigate(`/resources/${resourceId}`, { replace: true });
      } else {
        navigate('/resources');
      }
    } catch (err: unknown) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  // ── Computed ─────────────────────────────────────────────────

  const currentTypology = typologies.find((t) => t.typeCode === rdfType);
  const resourceTypeLabel = currentTypology?.name?.es ?? null;
  // Subset del catálogo UNE 178503 que aplica a la tipología actual. Se
  // pasa a AiQualityScore → aiCategorize → edge function como catálogo
  // permitido, para reducir alucinaciones (el modelo solo puede elegir
  // entre estas claves).
  const applicableTags = getWizardGroupsForType(resourceTypeLabel)
    .flatMap((g) => TAGS_BY_GROUP[g] ?? [])
    .map((t) => ({ key: t.key, label: t.label, field: t.field as string }));

  // Paso 2 · t4 — municipio en nombre legible (no ID) para el prompt draft.
  const selectedMunicipioName =
    municipalities.find((m) => m.id === municipioId)?.name?.es ?? null;

  // Paso 2 · t4 — hook de traducción automática en background. Se dispara
  // al abandonar el paso 2 si hay ES y el GL está vacío. El resultado
  // aparece en el editor GL y un toast notifica desde los pasos 3+.
  const bgTranslation = useBackgroundTranslation({
    descriptionEs: descEs,
    descriptionGl: descGl,
    setDescriptionGl: (next) => { setDescGl(next); markDirty(); },
    setGlStatus,
  });

  // Wrapper del onStepChange del Wizard: intercepta la salida del paso 2
  // (índice 1) para disparar la traducción background antes de avanzar.
  // No bloquea la navegación — el hook corre en paralelo.
  const handleStepChange = useCallback((nextStep: number) => {
    if (currentStep === 1 && nextStep > 1) {
      bgTranslation.dispatchIfNeeded();
    }
    setCurrentStep(nextStep);
  }, [currentStep, bgTranslation]);

  // ── Render ───────────────────────────────────────────────────

  if (loading) return <p>Cargando recurso...</p>;

  // Show TemplatePicker before the wizard for new resources (paso 0 tarea 3).
  // El modal de import se monta condicionalmente encima del picker.
  if (isNew && !templateApplied) {
    return (
      <>
        <TemplatePicker
          onPick={handleTemplatePick}
          onImportFromUrl={() => setImportModalOpen(true)}
          onCancel={() => navigate('/resources')}
        />
        {importModalOpen && (
          <ImportFromUrlModal
            onImported={applyImportedFields}
            onCancel={() => setImportModalOpen(false)}
          />
        )}
      </>
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
      onStepChange={handleStepChange}
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
            title="Tipología"
            required
            tip="La tipología determina qué campos y etiquetas te pide el wizard más adelante. Si tu recurso encaja en varios tipos, elige el principal ahora; los matices se añaden en el paso 4 como etiquetas."
          >
            <MainTypeSelector
              value={mainTypeKey}
              onChange={(next) => { setMainTypeKey(next); markDirty(); }}
              helperText="Elige la tipología que mejor describa el recurso. Son los 18 tipos oficiales UNE 178503."
            />
          </WizardFieldGroup>

          <WizardFieldGroup
            title="Nombre del recurso"
            description="El nombre principal tal como se mostrará en la web y en buscadores."
            required
            tip="Usa el nombre oficial o el más reconocible. Ejemplo: 'Mirador de A Lanzada', no 'mirador lanzada'."
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
            title="Municipio y zona"
            required
            tip="La zona es la parroquia o zona turística dentro del municipio — ayuda a que el buscador y el mapa filtren con precisión. Se cargan al elegir municipio."
          >
            <div className="form-row">
              <div className="form-field">
                <label>Municipio *</label>
                <select
                  value={municipioId}
                  onChange={(e) => {
                    setMunicipioId(e.target.value);
                    setZonaId('');
                    markDirty();
                  }}
                >
                  <option value="">-- Sin municipio --</option>
                  {municipalities.map((m) => (
                    <option key={m.id} value={m.id}>{m.name?.es || m.slug}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>
                  Zona / Parroquia
                  {municipioId && zones.length === 0 && (
                    <span className="field-hint"> (sin zonas registradas)</span>
                  )}
                </label>
                <select
                  value={zonaId}
                  onChange={(e) => { setZonaId(e.target.value); markDirty(); }}
                  disabled={!municipioId || zones.length === 0}
                >
                  <option value="">
                    {!municipioId
                      ? '-- Elige municipio primero --'
                      : zones.length === 0
                        ? '-- Sin zonas --'
                        : '-- Sin zona --'}
                  </option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>{z.name?.es || z.slug}</option>
                  ))}
                </select>
              </div>
            </div>
          </WizardFieldGroup>

          {/* Slug escondido tras un <details> — el 95% de editores no lo
              necesita tocar (se genera solo del nombre). Al abrirlo se ve
              la URL resultante y un aviso de que editarlo rompe enlaces. */}
          <details className="wizard-advanced">
            <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--cms-text-light)' }}>
              ⚙️ Editar slug (URL amigable)
            </summary>
            <div className="form-field" style={{ marginTop: '0.5rem' }}>
              <input
                value={slug}
                onChange={(e) => { setSlug(e.target.value); markDirty(); }}
                placeholder="se-genera-automaticamente"
                disabled={!isNew}
              />
              {!isNew && <span className="field-hint">El slug no se puede cambiar para proteger las URLs existentes.</span>}
              {isNew && (
                <span className="field-hint">
                  Se genera automáticamente desde el nombre. Vista previa:{' '}
                  <code>{WEB_BASE}/es/recurso/<strong>{slug || 'mirador-a-lanzada'}</strong></code>.
                  Solo edítalo si sabes lo que haces — cambios rompen enlaces antiguos.
                </span>
              )}
            </div>
          </details>
        </>
      )}

      {/* ================================================================
          STEP 2 — Contenido (descripciones)
          ================================================================ */}
      {currentStep === 1 && (
        <ResourceWizardStep2Content
          descriptionEs={descEs}
          onChangeDescriptionEs={(next) => { setDescEs(next); markDirty(); }}
          descriptionGl={descGl}
          onChangeDescriptionGl={(next) => { setDescGl(next); markDirty(); }}
          glStatus={glStatus}
          onChangeGlStatus={setGlStatus}
          isBackgroundTranslating={bgTranslation.isInFlight}
          context={{
            name: nameEs,
            mainTypeKey,
            municipio: selectedMunicipioName,
          }}
        />
      )}

      {/* ================================================================
          STEP 3 — Ubicacion + Contacto
          ================================================================ */}
      {currentStep === 2 && (
        <ResourceWizardStep3Location
          location={location}
          onChangeLocation={(next) => {
            setLocation(next);
            // Sincronía hacia states legacy para que el paso 7 preview /
            // completion cards y cualquier otro lector downstream vean los
            // datos al día sin refactorizarse. La fuente de verdad sigue
            // siendo `location`; los legacy son espejo.
            setLatitude(next.lat != null ? String(next.lat) : '');
            setLongitude(next.lng != null ? String(next.lng) : '');
            setAddressStreet(next.streetAddress);
            setAddressPostal(next.postalCode);
            markDirty();
          }}
          contact={contact}
          onChangeContact={(next) => {
            setContact(next);
            // Espejo a legacy (igual rationale). phone/email single-string
            // se unifican con el formato CSV antiguo del paso 7.
            setTelephone(next.phone);
            setEmail(next.email);
            setUrl(next.web);
            setSameAs(next.socialLinks.map((l) => l.url).join('\n'));
            markDirty();
          }}
          hoursPlan={hoursPlan}
          onChangeHoursPlan={(next) => { setHoursPlan(next); markDirty(); }}
          municipioName={selectedMunicipioName}
        />
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
            title="Clasificacion semantica (UNE 178503)"
            description="Marca todas las etiquetas que apliquen. El catalogo solo muestra los grupos relevantes para el tipo que seleccionaste en el paso 1."
            tip="Las etiquetas con badge 'PID' se exportan a la Plataforma Inteligente de Destinos. Las marcadas 'cms' son solo editoriales. Cambia la tipologia en el paso 1 para ver otros grupos disponibles."
          >
            <TagSelector
              resourceTypeLabel={resourceTypeLabel}
              value={tagKeys}
              onChange={(next) => {
                setTagKeys(next);
                markDirty();
              }}
              includeMunicipio={false}
            />
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
        {/* Paso 2 · t5 — opción de publicación (antes estaba en el paso 2
            como "Visible en mapa", ahora vive junto a la revisión final
            porque es una decisión editorial, no una característica del
            recurso). Persiste en recurso_turistico.visible_en_mapa. */}
        <WizardFieldGroup
          title="Opciones de publicación"
          tip="Decide si este recurso debe aparecer en el mapa público del portal. Puedes cambiarlo después en cualquier momento."
        >
          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
            <input
              type="checkbox"
              checked={visibleOnMap}
              onChange={(e) => { setVisibleOnMap(e.target.checked); markDirty(); }}
              style={{ marginTop: '0.2rem' }}
            />
            <span>
              <strong>Visible en el mapa público</strong>
              <br />
              <span style={{ color: 'var(--cms-text-light)', fontSize: '0.85rem' }}>
                Si lo dejas marcado, este recurso aparecerá como pin en el mapa de recursos turísticos de la web.
              </span>
            </span>
          </label>
        </WizardFieldGroup>

        <AiQualityScore
          resourceData={{
            nameEs, nameGl, descEs, descGl, rdfType,
            latitude, longitude, telephone, email, url,
            seoTitleEs, seoDescEs, nameEn, nameFr, namePt,
            touristTypes, selectedCategories,
            municipio: municipalities.find((m) => m.id === municipioId)?.name?.es || '',
            hasMedia: !!savedId,
          }}
          applicableTags={applicableTags}
          onApplyTagKeys={(keys) => {
            setTagKeys((prev) => Array.from(new Set([...prev, ...keys])));
            markDirty();
          }}
        />
        <div className="wizard__completion-grid">
          <PidCompletenessCard
            selectedKeys={tagKeys}
            onEdit={() => setCurrentStep(3)}
          />

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

    {/* Paso 2 · t4 — Toast "Traducción al gallego lista". Aparece cuando
        la traducción background termina y el usuario NO está en el paso 2
        (en el paso 2 sería ruido porque ya ve el GL). */}
    <TranslationReadyToast
      visible={bgTranslation.hasPendingReview && currentStep !== 1}
      onReview={() => {
        bgTranslation.dismissReview();
        setCurrentStep(1);
      }}
      onDismiss={bgTranslation.dismissReview}
    />

    {/* C6 — Toast del autosave: aparece la primera vez que el wizard
        crea el borrador silencioso al pasar de step 0 a step 1, para
        que el usuario sepa que su trabajo está a salvo y que ya puede
        cerrar la pestaña sin perder lo escrito. */}
    {autoSavedToast && (
      <div className="wizard-autosave-toast" role="status" aria-live="polite">
        💾 Borrador guardado automáticamente — puedes cerrar y continuar después
      </div>
    )}

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
