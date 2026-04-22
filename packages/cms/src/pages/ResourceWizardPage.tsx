import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getAuthHeaders, type TypologyItem, type MunicipalityItem, type CategoryItem } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { saveResourceTags, loadResourceTags } from '@/lib/resource-tags';
import { Wizard, WizardFieldGroup, type WizardStepDef } from '@/components/Wizard';
// Paso 5 · t5 — los uploaders legacy (MediaUploader / DocumentUploader /
// RelationsManager) ya no se usan en el wizard: el paso 5 rediseñado
// (ResourceWizardStep5Multimedia) monta los nuevos ImagesBlock /
// VideosBlock / DocumentsBlock contra las tablas de la migración 023.
// Relaciones entre recursos quedan pospuestas a iteración futura.
import { AiWritingAssistant } from '@/components/AiWritingAssistant';
// Paso 6 · t4 — AiSeoGenerator (legacy, generaba ES+GL en una sola
// llamada con action `seo`) ya no se usa: lo reemplaza
// ResourceWizardStep6Seo con llamadas `generateSeo` por idioma.
// Paso 7a · t3 — AiQualityScore (componente legacy del paso 7 que llamaba
// al motor de calidad via IA) ya no se usa: lo reemplaza el motor local
// ResourceQualityEngine que audita offline sin coste Gemini.
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
// Paso 7a · t3 — PidCompletenessCard (componente legacy con signature
// {selectedKeys, onEdit}) ya no se usa: el paso 7 rediseñado monta el
// nuevo PidCompletenessCard con `{groups, totalExportable}` dentro de
// `ResourceWizardStep7Review`.
import ResourceWizardStep4Classification from '@/pages/ResourceWizardStep4Classification';
import type { EstablishmentData } from '@/components/EstablishmentDetails';
import '@/pages/step4-classification.css';
import ResourceWizardStep5Multimedia from '@/pages/ResourceWizardStep5Multimedia';
import { getVideoThumbnailUrl, type ImageItem, type VideoItem, type DocumentItem } from '@osalnes/shared/data/media';
import { aiGenAltText, aiGenerateSeo, aiSuggestKeywords, aiTranslateResource } from '@/lib/ai';
import '@/pages/step5-multimedia.css';
import ResourceWizardStep6Seo from '@/pages/ResourceWizardStep6Seo';
import {
  type ResourceSeo,
  type AnyLang,
  type AdditionalLang,
  type TranslationByLang,
  type SeoByLang,
  emptyResourceSeo,
} from '@osalnes/shared/data/seo';
import '@/pages/step6-seo.css';
import ResourceWizardStep7Review from '@/pages/ResourceWizardStep7Review';
import type { QualityStep, ResourceSnapshot } from '@osalnes/shared/data/quality-engine';
import { auditResource } from '@osalnes/shared/data/quality-engine';
import type { PublicationStatus } from '@osalnes/shared/data/publication-status';
import type { AuditEntry } from '@/components/AuditLogPanel';
import { aiSuggestImprovements, type AiImprovementSuggestion } from '@/lib/ai';
import '@/pages/step7-review.css';
// ── Wizard global (transversal) ──────────────────────────────────────
import WizardStepper from '@/components/WizardStepper';
import AutoSaveIndicator from '@/components/AutoSaveIndicator';
import RecoverDraftModal from '@/components/RecoverDraftModal';
import { useAutoSave, loadLocalAutosave, clearLocalAutosave } from '@/hooks/useAutoSave';
import { useBeforeUnload } from '@/hooks/useBeforeUnload';
import {
  buildStepperState,
  canNavigateToStep,
  type NavigationContext,
  type WizardStepKey,
} from '@osalnes/shared/data/wizard-navigation';
import '@/pages/wizard-global.css';
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

// Paso 5 · t4 — mappers snake_case → camelCase para las 3 tablas media.
// Mantienen el contrato de los tipos compartidos (ImageItem/VideoItem/
// DocumentItem) sin exponer los nombres de columnas BD al frontend.
const IMAGES_BUCKET = 'resource-images';
const DOCUMENTS_BUCKET = 'resource-documents';

function getPublicUrl(bucket: string, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function mapImageRows(rows: Record<string, unknown>[]): ImageItem[] {
  return rows.map((r) => ({
    id: r.id as string,
    storagePath: r.storage_path as string,
    publicUrl: getPublicUrl(IMAGES_BUCKET, r.storage_path as string),
    mimeType: r.mime_type as string,
    sizeBytes: r.size_bytes as number,
    width: (r.width as number | null) ?? undefined,
    height: (r.height as number | null) ?? undefined,
    altText: (r.alt_text as string | null) ?? null,
    altSource: (r.alt_source as ImageItem['altSource']) ?? null,
    isPrimary: !!r.is_primary,
    sortOrder: (r.sort_order as number | null) ?? 0,
    createdAt: r.created_at as string,
  }));
}

function mapVideoRows(rows: Record<string, unknown>[]): VideoItem[] {
  return rows.map((r) => ({
    id: r.id as string,
    url: r.url as string,
    provider: r.provider as VideoItem['provider'],
    externalId: (r.external_id as string | null) ?? null,
    title: (r.title as string | null) ?? null,
    thumbnailUrl: (r.thumbnail_url as string | null) ?? null,
    sortOrder: (r.sort_order as number | null) ?? 0,
    createdAt: r.created_at as string,
  }));
}

function mapDocumentRows(rows: Record<string, unknown>[]): DocumentItem[] {
  return rows.map((r) => ({
    id: r.id as string,
    storagePath: r.storage_path as string,
    publicUrl: getPublicUrl(DOCUMENTS_BUCKET, r.storage_path as string),
    mimeType: r.mime_type as string,
    sizeBytes: r.size_bytes as number,
    originalFilename: r.original_filename as string,
    title: r.title as string,
    kind: r.kind as DocumentItem['kind'],
    lang: r.lang as DocumentItem['lang'],
    sortOrder: (r.sort_order as number | null) ?? 0,
    createdAt: r.created_at as string,
  }));
}
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
  // Editorial state. Paso 7b · t4 — `editorialStatus` y `publicationStatus`
  // representan el mismo dato (recurso_turistico.estado_editorial). Mantenemos
  // `editorialStatus` para no romper el EditorialStatusBar/handleStatusTransition
  // legacy, y añadimos `scheduledPublishAt` al bloque.
  const [editorialStatus, setEditorialStatus] = useState<EditorialState>('borrador');
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [scheduledPublishAt, setScheduledPublishAt] = useState<string | null>(null);
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
  // Legacy — ratingValue, servesCuisine, occupancy mantenidos para compat con
  // import-from-url, applyTemplate y LivePreviewPanel. La fuente de verdad del
  // paso 4 rediseñado es `establishment` (paso 4 · t5). Al cambiar
  // establishment se mirror-sync a estos para que el preview siga viendo el
  // valor al día.
  const [ratingValue, setRatingValue] = useState('');
  const [servesCuisine, setServesCuisine] = useState('');
  const [occupancy, setOccupancy] = useState('');
  // Paso 4 · t5 — estado nuevo estructurado (migración 022). Fuente de verdad
  // del paso 4: clasificación del establecimiento condicional al tipo del
  // paso 1 (estrellas / tenedores / categoría museo + aforo + cocinas UNE).
  const [establishment, setEstablishment] = useState<EstablishmentData>({
    rating: null,
    occupancy: null,
    cuisineCodes: [],
  });

  // Paso 5 · t4 — estado multimedia (migración 023). Las 3 tablas
  // resource_images / resource_videos / resource_documents se escriben
  // directo desde el cliente vía supabase-js (policy authenticated), sin
  // pasar por la edge function admin. Para el wizard es snake_case→camelCase
  // en el mapper, igual que paso 4 con establishment.
  const [mediaImages, setMediaImages] = useState<ImageItem[]>([]);
  const [mediaVideos, setMediaVideos] = useState<VideoItem[]>([]);
  const [mediaDocuments, setMediaDocuments] = useState<DocumentItem[]>([]);

  // Paso 6 · t4 — estado SEO estructurado (migración 024). Fuente de verdad
  // del paso 6 rediseñado: título+descripción por idioma, traducciones EN/
  // FR/PT, slug, indexable, og image override, keywords, canonical. Se
  // sincroniza con los 10 campos legacy (seoTitleEs/…/nameEn/…/descEn/…)
  // al cambiar, para no romper el preview del paso 7 ni la LocalizedValue
  // name/description que el admin escribe en la tabla `traduccion`.
  const [seo, setSeo] = useState<ResourceSeo>(emptyResourceSeo());

  // ── Wizard global · t2 — dirty tracking + recuperación sesión previa ──
  // dirtySteps: set 1-indexed (1..7) de pasos con cambios no guardados.
  // El efecto de useAutoSave marca el paso actual como dirty cuando
  // isDirty=true; handleNavigate lo quita al saltar a otro paso (tras
  // forceSave).
  const [dirtySteps, setDirtySteps] = useState<Set<number>>(new Set());
  // recoverState: si al abrir un recurso hay local más reciente que el
  // servidor, pedimos al usuario recuperar o descartar antes de montar
  // el wizard.
  const [recoverState, setRecoverState] = useState<
    | { kind: 'checking' }
    | { kind: 'found'; localSavedAt: string; localData: Record<string, unknown> }
    | { kind: 'none' }
  >({ kind: 'checking' });
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
      if (imported.rating_value) {
        setRatingValue(imported.rating_value.toString());
        // Paso 4 · t5 — mirror a establishment. Solo aceptamos rangos 1-5
        // para evitar meter basura en accommodation_rating (CHECK constraint).
        const r = parseInt(String(imported.rating_value), 10);
        if (r >= 1 && r <= 5) {
          setEstablishment((prev) => ({ ...prev, rating: r }));
        }
      }
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
    if (imported.rating_value) {
      setRatingValue(imported.rating_value.toString());
      // Paso 4 · t5 — mirror a establishment. Solo aceptamos rangos 1-5
      // para evitar meter basura en accommodation_rating (CHECK constraint).
      const r = parseInt(String(imported.rating_value), 10);
      if (r >= 1 && r <= 5) {
        setEstablishment((prev) => ({ ...prev, rating: r }));
      }
    }
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
        // Paso 4 · t5 — hidratación de establishment. Prioridad al campo
        // nuevo `accommodationRating` (migración 022); fallback a `ratingValue`
        // legacy por si el recurso se creó antes del backfill y la migración
        // no pudo copiarlo (p.ej. por tipo de dato).
        setEstablishment({
          rating: r.accommodationRating ?? r.ratingValue ?? null,
          occupancy: r.occupancy ?? null,
          cuisineCodes: r.servesCuisine || [],
        });
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
        // Paso 7b · t4 — scheduled_publish_at viene en snake_case del mapper
        // admin (el wizard lo hidrata así directamente, igual que paso 3).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setScheduledPublishAt(((r as any).scheduled_publish_at as string | null | undefined) ?? null);
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
        // Paso 6 · t4 — hidratación de seo desde la migración 024 con
        // fallback al LocalizedValue legacy (seo_title / name.en/fr/pt /
        // description.en/fr/pt) para recursos creados antes del backfill.
        const rByLang = (r.seo_by_lang ?? {}) as Partial<Record<AnyLang, SeoByLang>>;
        const byLang: Partial<Record<AnyLang, SeoByLang>> = { ...rByLang };
        if (!byLang.es && (r.seoTitle?.es || r.seoDescription?.es)) {
          byLang.es = { title: r.seoTitle?.es || '', description: r.seoDescription?.es || '' };
        }
        if (!byLang.gl && (r.seoTitle?.gl || r.seoDescription?.gl)) {
          byLang.gl = { title: r.seoTitle?.gl || '', description: r.seoDescription?.gl || '' };
        }
        const rTranslations = (r.translations ?? {}) as Partial<Record<AdditionalLang, TranslationByLang>>;
        const translations: Partial<Record<AdditionalLang, TranslationByLang>> = { ...rTranslations };
        (['en', 'fr', 'pt'] as AdditionalLang[]).forEach((lang) => {
          if (translations[lang]) return;
          const legacyName = r.name?.[lang];
          const legacyDesc = r.description?.[lang];
          if (legacyName || legacyDesc) {
            translations[lang] = {
              name: legacyName || '',
              description: legacyDesc || '',
            };
          }
        });
        setSeo({
          byLang,
          translations,
          slug: r.slug || '',
          indexable: r.indexable ?? true,
          ogImageOverridePath: r.og_image_override_path ?? null,
          keywords: (r.keywords as string[]) ?? [],
          canonicalUrl: r.canonical_url ?? null,
        });
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

  // Paso 5 · t4 — hidratación del estado multimedia (migración 023).
  // Dispara al cargar el recurso (edición) y también cuando el auto-save
  // de step 0 crea `savedId` en creación: en ambos casos tenemos id real y
  // podemos leer las 3 tablas vía supabase-js con policy authenticated.
  useEffect(() => {
    if (!savedId) return;
    void Promise.all([
      supabase.from('resource_images').select('*').eq('resource_id', savedId).order('sort_order'),
      supabase.from('resource_videos').select('*').eq('resource_id', savedId).order('sort_order'),
      supabase.from('resource_documents').select('*').eq('resource_id', savedId).order('sort_order'),
    ]).then(([imgRes, vidRes, docRes]) => {
      setMediaImages(mapImageRows(imgRes.data ?? []));
      setMediaVideos(mapVideoRows(vidRes.data ?? []));
      setMediaDocuments(mapDocumentRows(docRes.data ?? []));
    }).catch((err) => {
      console.error('[wizard] media hydration failed:', err);
    });
  }, [savedId]);

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
  // El paso 5 (Multimedia) necesita un savedId real para asociar imágenes,
  // vídeos y documentos a un recurso (FK a recurso_turistico · migración
  // 023). Antes del auto-save, el usuario tenía que terminar TODO el
  // wizard, guardar y volver a entrar para añadir fotos — doble pase.
  //
  // Ahora: en cuanto el usuario completa válidamente el paso 1 y avanza,
  // creamos un borrador silencioso con los campos mínimos. A partir de ese
  // momento `savedId` está poblado y el paso 5 rediseñado puede subir
  // directo. El "Crear recurso" final del paso 7 se convierte en un
  // updateResource. Si el auto-save no se disparó (p.ej. el usuario saltó
  // al paso 5 sin nombre), `handleSaveDraft` del paso 5 (decisión 1-B)
  // fuerza la creación con slug/nombre fallback.
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

  // ── Paso 5 · t4 — Handlers multimedia ───────────────────────
  //
  // Todos los handlers escriben directo a las 3 tablas media
  // (resource_images/resource_videos/resource_documents) y a los buckets
  // Storage correspondientes. RLS: `write_{images,videos,documents}_authenticated`
  // permite insert/update/delete si el caller está autenticado. El auto-save
  // de step 0 garantiza que `savedId` existe cuando el usuario llega al paso 5;
  // si llegara sin él, el componente enseña el panel "Guarda primero".

  async function handleSaveDraft(): Promise<string> {
    if (savedId) return savedId;
    // Mínimos para pasar el NOT NULL de rdf_type y slug. Si el usuario aún no
    // ha rellenado nombre, generamos un slug temporal y un nombre placeholder.
    // El editor corregirá esos campos cuando vuelva a los pasos 1-2.
    const mainTagDerivedType = mainTypeKey ? TAGS_BY_KEY[mainTypeKey]?.value : null;
    const effectiveRdfType = mainTagDerivedType || rdfType || 'TouristAttraction';
    const fallbackSlug = slug || `borrador-${Date.now()}`;
    const fallbackName = nameEs || 'Borrador sin nombre';
    const created = await api.createResource({
      rdf_type: effectiveRdfType,
      rdf_types: [],
      slug: fallbackSlug,
      municipio_id: municipioId || null,
      zona_id: zonaId || null,
      name: { es: fallbackName, gl: nameGl || fallbackName },
    } as unknown as Parameters<typeof api.createResource>[0]);
    setSavedId(created.id);
    navigate(`/resources/${created.id}`, { replace: true });
    return created.id;
  }

  // ─── Imágenes ──────────────────────────────────────────────────

  async function handleUploadImage(file: File): Promise<ImageItem> {
    if (!savedId) throw new Error('No resourceId');
    const uuid = crypto.randomUUID();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${savedId}/${uuid}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from(IMAGES_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadErr) throw uploadErr;

    const isPrimary = mediaImages.length === 0;
    const { data: inserted, error: dbErr } = await supabase
      .from('resource_images')
      .insert({
        resource_id: savedId,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        is_primary: isPrimary,
        sort_order: mediaImages.length,
      })
      .select()
      .single();
    if (dbErr) throw dbErr;

    const [item] = mapImageRows([inserted as Record<string, unknown>]);
    setMediaImages((curr) => [...curr, item]);
    markDirty();
    return item;
  }

  async function handleUpdateImageAlt(
    imageId: string,
    altText: string,
    altSource: ImageItem['altSource'],
  ): Promise<void> {
    const { error: dbErr } = await supabase
      .from('resource_images')
      .update({ alt_text: altText, alt_source: altSource })
      .eq('id', imageId);
    if (dbErr) throw dbErr;
    setMediaImages((curr) =>
      curr.map((i) => (i.id === imageId ? { ...i, altText, altSource } : i)),
    );
    markDirty();
  }

  async function handleSetImagePrimary(imageId: string): Promise<void> {
    const { error: rpcErr } = await supabase.rpc('mark_image_as_primary', {
      p_image_id: imageId,
    });
    if (rpcErr) throw rpcErr;
    setMediaImages((curr) => curr.map((i) => ({ ...i, isPrimary: i.id === imageId })));
    markDirty();
  }

  async function handleRemoveImage(imageId: string): Promise<void> {
    const target = mediaImages.find((i) => i.id === imageId);
    const { error: dbErr } = await supabase
      .from('resource_images')
      .delete()
      .eq('id', imageId);
    if (dbErr) throw dbErr;
    // Limpieza best-effort en Storage. Si falla no rompemos la UX: el CASCADE
    // de la tabla ya purgó la fila y el objeto huérfano queda como deuda
    // (documentada en el checklist T7). El trigger/cron de limpieza física
    // vive en una iteración futura.
    if (target?.storagePath) {
      await supabase.storage.from(IMAGES_BUCKET).remove([target.storagePath]).catch(() => null);
    }
    setMediaImages((curr) => curr.filter((i) => i.id !== imageId));
    markDirty();
  }

  async function handleGenerateImageAlt(imageId: string): Promise<string | null> {
    const img = mediaImages.find((i) => i.id === imageId);
    if (!img?.publicUrl) return null;
    const typeLabel =
      mainTypeKey && TAGS_BY_KEY[mainTypeKey]
        ? TAGS_BY_KEY[mainTypeKey].label
        : null;
    let alt: string;
    try {
      alt = await aiGenAltText({
        imageUrl: img.publicUrl,
        resourceContext: {
          name: nameEs || 'recurso',
          typeLabel,
          municipio: selectedMunicipioName,
        },
      });
    } catch {
      return null;
    }
    if (!alt) return null;
    await handleUpdateImageAlt(imageId, alt, 'ai');
    return alt;
  }

  // ─── Vídeos ────────────────────────────────────────────────────

  async function handleAddVideo(input: {
    url: string;
    provider: VideoItem['provider'];
    externalId: string | null;
    thumbnailUrl: string | null;
  }): Promise<VideoItem> {
    if (!savedId) throw new Error('No resourceId');
    const thumbnail = input.thumbnailUrl ?? getVideoThumbnailUrl(input.provider, input.externalId);
    const { data: inserted, error: dbErr } = await supabase
      .from('resource_videos')
      .insert({
        resource_id: savedId,
        url: input.url,
        provider: input.provider,
        external_id: input.externalId,
        thumbnail_url: thumbnail,
        sort_order: mediaVideos.length,
      })
      .select()
      .single();
    if (dbErr) throw dbErr;
    const [item] = mapVideoRows([inserted as Record<string, unknown>]);
    setMediaVideos((curr) => [...curr, item]);
    markDirty();
    return item;
  }

  async function handleRemoveVideo(videoId: string): Promise<void> {
    const { error: dbErr } = await supabase
      .from('resource_videos')
      .delete()
      .eq('id', videoId);
    if (dbErr) throw dbErr;
    setMediaVideos((curr) => curr.filter((v) => v.id !== videoId));
    markDirty();
  }

  async function handleUpdateVideoTitle(videoId: string, title: string): Promise<void> {
    const { error: dbErr } = await supabase
      .from('resource_videos')
      .update({ title })
      .eq('id', videoId);
    if (dbErr) throw dbErr;
    setMediaVideos((curr) => curr.map((v) => (v.id === videoId ? { ...v, title } : v)));
    markDirty();
  }

  // ─── Documentos ────────────────────────────────────────────────

  async function handleUploadDocument(
    file: File,
    initial: { title: string; kind: DocumentItem['kind']; lang: DocumentItem['lang'] },
  ): Promise<DocumentItem> {
    if (!savedId) throw new Error('No resourceId');
    const uuid = crypto.randomUUID();
    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
    const path = `${savedId}/${uuid}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadErr) throw uploadErr;

    const { data: inserted, error: dbErr } = await supabase
      .from('resource_documents')
      .insert({
        resource_id: savedId,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        original_filename: file.name,
        title: initial.title,
        kind: initial.kind,
        lang: initial.lang,
        sort_order: mediaDocuments.length,
      })
      .select()
      .single();
    if (dbErr) throw dbErr;
    const [item] = mapDocumentRows([inserted as Record<string, unknown>]);
    setMediaDocuments((curr) => [...curr, item]);
    markDirty();
    return item;
  }

  async function handleUpdateDocumentMeta(
    docId: string,
    patch: Partial<Pick<DocumentItem, 'title' | 'kind' | 'lang'>>,
  ): Promise<void> {
    const { error: dbErr } = await supabase
      .from('resource_documents')
      .update(patch)
      .eq('id', docId);
    if (dbErr) throw dbErr;
    setMediaDocuments((curr) =>
      curr.map((d) => (d.id === docId ? { ...d, ...patch } : d)),
    );
    markDirty();
  }

  async function handleRemoveDocument(docId: string): Promise<void> {
    const target = mediaDocuments.find((d) => d.id === docId);
    const { error: dbErr } = await supabase
      .from('resource_documents')
      .delete()
      .eq('id', docId);
    if (dbErr) throw dbErr;
    if (target?.storagePath) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([target.storagePath]).catch(() => null);
    }
    setMediaDocuments((curr) => curr.filter((d) => d.id !== docId));
    markDirty();
  }

  // ── Paso 6 · t4 — Handlers SEO / traducciones / slug / OG image ──

  async function handleGenerateSeoAi(lang: AnyLang): Promise<SeoByLang | null> {
    // Solo idiomas base tienen generateSeo (decisión del paso 6 · t3). El
    // resto (EN/FR/PT) pasan por `translateResource` que genera nombre +
    // descripción corta, no SEO optimizado.
    if (lang !== 'es' && lang !== 'gl') return null;
    try {
      const typeLabel =
        mainTypeKey && TAGS_BY_KEY[mainTypeKey]
          ? TAGS_BY_KEY[mainTypeKey].label
          : null;
      const res = await aiGenerateSeo({
        descriptionEs: descEs,
        resourceName: nameEs,
        lang,
        typeLabel,
        municipio: selectedMunicipioName,
      });
      if (!res.title && !res.description) return null;
      return res;
    } catch {
      return null;
    }
  }

  async function handleSuggestKeywordsAi(descriptionEs: string): Promise<string[]> {
    try {
      return await aiSuggestKeywords(descriptionEs);
    } catch {
      return [];
    }
  }

  async function handleTranslateOne(lang: AdditionalLang): Promise<TranslationByLang | null> {
    try {
      const r = await aiTranslateResource({
        resourceName: nameEs,
        descriptionEs: descEs,
        targetLang: lang,
      });
      if (!r.name && !r.description) return null;
      return r;
    } catch {
      return null;
    }
  }

  async function handleTranslateAll(): Promise<Partial<Record<AdditionalLang, TranslationByLang>>> {
    const langs: AdditionalLang[] = ['en', 'fr', 'pt'];
    const entries = await Promise.all(
      langs.map(async (lang) => {
        const r = await handleTranslateOne(lang);
        return [lang, r] as const;
      }),
    );
    const out: Partial<Record<AdditionalLang, TranslationByLang>> = {};
    for (const [lang, r] of entries) if (r) out[lang] = r;
    return out;
  }

  async function handleCheckSlugDuplicate(slug: string): Promise<boolean> {
    const { data, error: rpcErr } = await supabase.rpc('slug_is_available', {
      p_slug: slug,
      p_exclude_resource_id: savedId ?? null,
    });
    if (rpcErr) throw rpcErr;
    // RPC devuelve true si el slug está libre → el componente espera `true`
    // si es duplicado. Invertimos.
    return data === false;
  }

  async function handleUploadOgOverride(file: File): Promise<string> {
    if (!savedId) throw new Error('No resourceId');
    const uuid = crypto.randomUUID();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${savedId}/og-${uuid}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from(IMAGES_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadErr) throw uploadErr;
    setSeo((prev) => ({ ...prev, ogImageOverridePath: path }));
    markDirty();
    return path;
  }

  async function handleRemoveOgOverride(): Promise<void> {
    const currentPath = seo.ogImageOverridePath;
    setSeo((prev) => ({ ...prev, ogImageOverridePath: null }));
    if (currentPath) {
      await supabase.storage.from(IMAGES_BUCKET).remove([currentPath]).catch(() => null);
    }
    markDirty();
  }

  // ── Paso 7a · t2 — Snapshot + handlers del paso 7 (revisión) ──────
  //
  // El motor `auditResource` del paso 7a necesita un snapshot plano de
  // todos los pasos. Aquí unificamos los estados dispersos del wizard
  // padre con useMemo; las dependencias cubren los 10 estados que se
  // leen en el motor.

  const resourceSnapshot: ResourceSnapshot = useMemo(() => ({
    // Paso 1
    mainTypeKey,
    nameEs: nameEs ?? '',
    nameGl: nameGl ?? '',
    // slug viene del state `seo.slug` (paso 6) con fallback al legacy
    // `slug` del paso 1 — mismo bridge que en el save payload.
    slug: seo.slug || slug || '',
    municipioId: municipioId || null,
    // selectedMunicipioName está declarado más abajo (deriva de
    // municipalities.find), así que recomputamos aquí inline para no
    // caer en un "used before declaration".
    municipioName:
      municipalities.find((m) => m.id === municipioId)?.name?.es ?? null,

    // Paso 2
    descriptionEs: descEs ?? '',
    descriptionGl: descGl ?? '',
    accessPublic: publicAccess ?? false,
    accessFree: isAccessibleForFree ?? false,
    visibleOnMap: visibleOnMap ?? true,

    // Paso 3 — coordenadas pueden venir del state estructurado nuevo o
    // del legacy string. Preferimos el estructurado; parseFloat del
    // legacy si no hay. Dirección y contacto vienen del state nuevo
    // directamente (paso 3 · t4).
    latitude: location.lat ?? (latitude ? parseFloat(latitude) : null),
    longitude: location.lng ?? (longitude ? parseFloat(longitude) : null),
    streetAddress: location.streetAddress || '',
    postalCode: location.postalCode || '',
    contactPhone: contact.phone || '',
    contactEmail: contact.email || '',
    contactWeb: contact.web || '',
    hoursPlan,

    // Paso 4
    accommodationRating: establishment.rating,
    occupancy: establishment.occupancy,
    servesCuisine: establishment.cuisineCodes,
    tagKeys,

    // Paso 5
    imageCount: mediaImages.length,
    primaryImageId: mediaImages.find((i) => i.isPrimary)?.id ?? null,
    imagesWithoutAltCount: mediaImages.filter(
      (i) => !i.altText || i.altText.trim().length === 0,
    ).length,
    videoCount: mediaVideos.length,
    documentCount: mediaDocuments.length,

    // Paso 6
    seo,
  }), [
    mainTypeKey, nameEs, nameGl, slug, seo, municipioId, municipalities,
    descEs, descGl, publicAccess, isAccessibleForFree, visibleOnMap,
    latitude, longitude, location, contact, hoursPlan,
    establishment, tagKeys,
    mediaImages, mediaVideos, mediaDocuments,
  ]);

  /** Navega al paso correspondiente al hacer clic en "Editar" de una tarjeta.
   *  currentStep es 0-indexed: identificación=0, contenido=1, ubicación=2,
   *  clasificación=3, multimedia=4, SEO=5, revisión=6. */
  function handleGoToStep(step: QualityStep) {
    const stepIndex: Record<QualityStep, number> = {
      identification: 0,
      content: 1,
      location: 2,
      classification: 3,
      multimedia: 4,
      seo: 5,
    };
    setCurrentStep(stepIndex[step]);
  }

  /** Guarda como borrador desde el paso 7. Reutiliza handleFinish vía wizard legacy. */
  async function handleSaveDraftStep7(): Promise<void> {
    await handleFinish();
  }

  // ── Paso 7b · t4 — Handlers de publicación programada + IA + historial ──
  //
  // Los 3 primeros escriben directo a `recurso_turistico` vía supabase-js.
  // Las tres columnas (estado_editorial, scheduled_publish_at,
  // published_at, published_by) están en el whitelist de admin pero aquí
  // no pasamos por admin porque necesitamos un round-trip rápido sin
  // traducir el body entero. policy RLS `authenticated` permite el UPDATE.

  async function handlePublishNow(): Promise<void> {
    if (!savedId) {
      // Sin recurso guardado aún, primero persistimos para obtener id
      // (handleFinish crea el borrador).
      await handleFinish();
    }
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null;
    const publishedAtIso = new Date().toISOString();
    const { error: updErr } = await supabase
      .from('recurso_turistico')
      .update({
        estado_editorial: 'publicado',
        published_at: publishedAtIso,
        published_by: userId,
        scheduled_publish_at: null,
      })
      .eq('id', savedId);
    if (updErr) throw updErr;
    setEditorialStatus('publicado');
    setPublishedAt(publishedAtIso);
    setScheduledPublishAt(null);
    setActivityRefreshKey((k) => k + 1);
  }

  async function handleSchedulePublish(utcIso: string): Promise<void> {
    if (!savedId) {
      await handleFinish();
    }
    const { error: updErr } = await supabase
      .from('recurso_turistico')
      .update({
        estado_editorial: 'programado',
        scheduled_publish_at: utcIso,
      })
      .eq('id', savedId);
    if (updErr) throw updErr;
    setEditorialStatus('programado');
    setScheduledPublishAt(utcIso);
    setActivityRefreshKey((k) => k + 1);
  }

  async function handleRequestAiSuggestions(): Promise<AiImprovementSuggestion[]> {
    const typeLabel =
      mainTypeKey && TAGS_BY_KEY[mainTypeKey]
        ? TAGS_BY_KEY[mainTypeKey].label
        : null;
    return aiSuggestImprovements({
      snapshot: {
        name: nameEs || '',
        typeLabel,
        municipio:
          municipalities.find((m) => m.id === municipioId)?.name?.es ?? null,
        descriptionEs: descEs || '',
        descriptionGl: descGl || '',
        hasCoordinates:
          (location.lat != null && location.lng != null) ||
          (!!latitude && !!longitude),
        hasContactInfo: !!(contact.phone || contact.email || contact.web),
        hasHours: !!hoursPlan,
        tagCount: tagKeys.length,
        imageCount: mediaImages.length,
        imagesWithoutAltCount: mediaImages.filter(
          (i) => !i.altText || i.altText.trim().length === 0,
        ).length,
        seoTitleEs: seo.byLang.es?.title ?? '',
        seoDescriptionEs: seo.byLang.es?.description ?? '',
        keywords: seo.keywords,
        translationCount: Object.keys(seo.translations).length,
      },
    });
  }

  /**
   * Carga últimas entradas del historial para el panel del paso 7b. La
   * tabla `log_cambios` (migración 001) usa valores Spanish en `accion`
   * y `usuario_id → usuario(id).email`. El AuditLogPanel ya entiende
   * las claves en Spanish tras t3.
   *
   * Si la tabla no existe o la RLS bloquea, caemos a array vacío: el
   * panel muestra "Sin cambios registrados" sin romper la pantalla.
   */
  async function handleLoadAuditLog(): Promise<AuditEntry[]> {
    if (!savedId) return [];
    const { data, error: logErr } = await supabase
      .from('log_cambios')
      .select('id, created_at, accion, cambios, usuario:usuario_id(email)')
      .eq('entidad_tipo', 'recurso_turistico')
      .eq('entidad_id', savedId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (logErr || !Array.isArray(data)) return [];
    return data.map((row) => {
      const r = row as Record<string, unknown>;
      const cambios = r.cambios as { fields?: string[] } | null;
      const usuario = r.usuario as { email?: string } | null;
      return {
        id: r.id as string,
        createdAt: r.created_at as string,
        action: r.accion as string,
        actor: usuario?.email ?? null,
        changedFields: Array.isArray(cambios?.fields) ? cambios.fields : null,
      };
    });
  }

  // ── Wizard global · t2 — NavigationContext + stepperState ─────────
  //
  // `wizard-navigation.ts` usa pasos 1-7 (human). El state local
  // `currentStep` es 0-indexed (0-6). Convertimos en la frontera.

  const navigationContext: NavigationContext = useMemo(() => {
    // Derivar pasos completos desde el quality-engine (igual que el
    // componente Step7). Un paso es 'complete' si su aggregate está en
    // 'ok' o 'warn' (no 'fail' ni 'empty').
    const completeSteps = new Set<number>();
    if (savedId) {
      const stepKeyToNumber: Record<QualityStep, number> = {
        identification: 1, content: 2, location: 3,
        classification: 4, multimedia: 5, seo: 6,
      };
      const report = auditResource(resourceSnapshot);
      for (const [key, agg] of Object.entries(report.byStep)) {
        if (agg.status === 'ok' || agg.status === 'warn') {
          completeSteps.add(stepKeyToNumber[key as QualityStep]);
        }
      }
    }
    // Paso 1 obligatorio: tipología + nombre + municipio.
    const step1Complete = !!(mainTypeKey && nameEs.trim() && municipioId);
    // Paso 2 obligatorio: descripción ES con al menos 20 chars útiles.
    const step2Complete = (descEs ?? '').trim().length >= 20;
    return {
      currentStep: currentStep + 1, // 0-indexed → 1-indexed
      resourceId: savedId,
      step1Complete,
      step2Complete,
      dirtySteps,
      completeSteps,
    };
  }, [
    currentStep, savedId, mainTypeKey, nameEs, municipioId, descEs,
    dirtySteps, resourceSnapshot,
  ]);

  const stepperState = useMemo(
    () => buildStepperState(navigationContext),
    [navigationContext],
  );

  // ── Wizard global · t2 — payload autosave ─────────────────────────
  //
  // Snapshot mínimo persistible del wizard. NO toca estado_editorial,
  // published_at, scheduled_publish_at (esos campos son prerrogativa
  // de los handlers de publicación del paso 7b). NO toca campos que ya
  // escribe `handleFinish` via admin edge function (slug, translations
  // en traduccion table) — el autosave solo guarda los jsonb + campos
  // escalares directamente accesibles por supabase-js con la policy
  // authenticated.
  const autoSavePayload = useMemo(() => ({
    name_es: nameEs,
    name_gl: nameGl,
    desc_es: descEs,
    desc_gl: descGl,
    municipio_id: municipioId || null,
    zona_id: zonaId || null,
    // establishment (paso 4)
    accommodation_rating: establishment.rating,
    occupancy: establishment.occupancy,
    serves_cuisine: establishment.cuisineCodes,
    // seo (paso 6)
    slug: seo.slug || slug || '',
    seo_by_lang: seo.byLang,
    translations: seo.translations,
    keywords: seo.keywords,
    indexable: seo.indexable,
    og_image_override_path: seo.ogImageOverridePath,
    canonical_url: seo.canonicalUrl,
    // visibility / access
    visible_en_mapa: visibleOnMap,
    // location (paso 3 estructurado)
    latitude: location.lat,
    longitude: location.lng,
    street_address: location.streetAddress || null,
    postal_code: location.postalCode || null,
    locality: location.locality || null,
    parroquia_text: location.parroquia || null,
    contact_phone: contact.phone || null,
    contact_email: contact.email || null,
    contact_web: contact.web || null,
    social_links: contact.socialLinks,
    opening_hours_plan: hoursPlan,
  }), [
    nameEs, nameGl, descEs, descGl, municipioId, zonaId,
    establishment, seo, slug, visibleOnMap,
    location, contact, hoursPlan,
  ]);

  const autoSave = useAutoSave({
    data: autoSavePayload,
    // Solo autosave cuando el recurso ya existe en BD (tiene id).
    enabled: savedId != null && recoverState.kind === 'none',
    intervalMs: 30_000,
    localStorageKey: savedId ? `resource-autosave-${savedId}` : undefined,
    onSave: async (data) => {
      if (!savedId) return;
      // Importante: NO incluir estado_editorial / published_at /
      // scheduled_publish_at / published_by. Esos son responsabilidad
      // exclusiva de los handlers de publicación del paso 7b.
      const { error: updErr } = await supabase
        .from('recurso_turistico')
        .update(data)
        .eq('id', savedId);
      if (updErr) throw updErr;
    },
  });

  // Marca el paso actual (1-indexed) como dirty mientras haya cambios
  // sin guardar. El handleNavigate lo quita al cambiar de paso.
  useEffect(() => {
    if (!autoSave.isDirty) return;
    setDirtySteps((curr) => {
      const humanStep = currentStep + 1;
      if (curr.has(humanStep)) return curr;
      const next = new Set(curr);
      next.add(humanStep);
      return next;
    });
  }, [autoSave.isDirty, currentStep]);

  // Aviso nativo del navegador al cerrar con cambios sin sincronizar.
  useBeforeUnload(
    autoSave.isDirty,
    'Tienes cambios sin guardar. Espera unos segundos a que se sincronicen antes de cerrar la pestaña.',
  );

  // Navegación validada desde el stepper. Recibe paso 1-indexed (human).
  async function handleNavigate(targetHumanStep: number) {
    const targetIdx = targetHumanStep - 1;
    if (targetIdx === currentStep) return;
    const { allowed } = canNavigateToStep(targetHumanStep, navigationContext);
    if (!allowed) return;
    // Forzar guardado antes de navegar, para que no se pierda nada.
    if (autoSave.isDirty) {
      try {
        await autoSave.forceSave();
      } catch {
        // Si falla, permitimos navegar igualmente: el dato queda en
        // localStorage y el AutoSaveIndicator mostrará el error.
      }
    }
    // Quitar dirty del paso que dejamos (ya sincronizado).
    setDirtySteps((curr) => {
      const next = new Set(curr);
      next.delete(currentStep + 1);
      return next;
    });
    setCurrentStep(targetIdx);
  }

  // ── Wizard global · t2 — Recuperación sesión previa ───────────────
  //
  // Al montar (solo edición: hay savedId), comprobar localStorage. Si
  // hay un autosave local MÁS RECIENTE que el updated_at del recurso,
  // ofrecer recuperar. Si no, descartar silenciosamente.
  useEffect(() => {
    if (!savedId) {
      setRecoverState({ kind: 'none' });
      return;
    }
    const key = `resource-autosave-${savedId}`;
    const local = loadLocalAutosave<Record<string, unknown>>(key);
    if (!local) {
      setRecoverState({ kind: 'none' });
      return;
    }
    // Si lo local tiene <1s de edad (recién salvado por el autosave de
    // esta misma sesión), no es un "draft recuperado".
    if (Date.now() - new Date(local.savedAt).getTime() < 2000) {
      setRecoverState({ kind: 'none' });
      return;
    }
    setRecoverState({
      kind: 'found',
      localSavedAt: local.savedAt,
      localData: local.data,
    });
  }, [savedId]);

  /**
   * Aplica el payload del localStorage al state del wizard. Solo
   * restaura los campos que el autosavePayload incluye; el resto
   * (media, tags) se deja tal cual porque el autosave no los toca.
   */
  function applyWizardSnapshot(snap: Record<string, unknown>) {
    const s = snap as Partial<typeof autoSavePayload>;
    if (typeof s.name_es === 'string') setNameEs(s.name_es);
    if (typeof s.name_gl === 'string') setNameGl(s.name_gl);
    if (typeof s.desc_es === 'string') setDescEs(s.desc_es);
    if (typeof s.desc_gl === 'string') setDescGl(s.desc_gl);
    if (typeof s.municipio_id === 'string' || s.municipio_id === null) {
      setMunicipioId(s.municipio_id ?? '');
    }
    if (typeof s.zona_id === 'string' || s.zona_id === null) {
      setZonaId(s.zona_id ?? '');
    }
    if (s.accommodation_rating !== undefined || s.occupancy !== undefined || s.serves_cuisine !== undefined) {
      setEstablishment({
        rating: (s.accommodation_rating as number | null | undefined) ?? null,
        occupancy: (s.occupancy as number | null | undefined) ?? null,
        cuisineCodes: Array.isArray(s.serves_cuisine) ? s.serves_cuisine : [],
      });
    }
    if (s.seo_by_lang || s.translations || s.keywords !== undefined) {
      setSeo((prev) => ({
        ...prev,
        slug: typeof s.slug === 'string' ? s.slug : prev.slug,
        byLang: (s.seo_by_lang as ResourceSeo['byLang']) ?? prev.byLang,
        translations: (s.translations as ResourceSeo['translations']) ?? prev.translations,
        keywords: Array.isArray(s.keywords) ? s.keywords : prev.keywords,
        indexable: typeof s.indexable === 'boolean' ? s.indexable : prev.indexable,
        ogImageOverridePath: (s.og_image_override_path as string | null | undefined) ?? prev.ogImageOverridePath,
        canonicalUrl: (s.canonical_url as string | null | undefined) ?? prev.canonicalUrl,
      }));
    }
    if (typeof s.visible_en_mapa === 'boolean') setVisibleOnMap(s.visible_en_mapa);
    if (s.latitude !== undefined || s.longitude !== undefined) {
      setLocation((prev) => ({
        ...prev,
        lat: (s.latitude as number | null | undefined) ?? prev.lat,
        lng: (s.longitude as number | null | undefined) ?? prev.lng,
        streetAddress: (s.street_address as string | null | undefined) ?? prev.streetAddress,
        postalCode: (s.postal_code as string | null | undefined) ?? prev.postalCode,
        locality: (s.locality as string | null | undefined) ?? prev.locality,
        parroquia: (s.parroquia_text as string | null | undefined) ?? prev.parroquia,
      }));
    }
    if (s.contact_phone !== undefined || s.contact_email !== undefined) {
      setContact((prev) => ({
        ...prev,
        phone: (s.contact_phone as string | null | undefined) ?? prev.phone,
        email: (s.contact_email as string | null | undefined) ?? prev.email,
        web: (s.contact_web as string | null | undefined) ?? prev.web,
        socialLinks: Array.isArray(s.social_links) ? (s.social_links as SocialLink[]) : prev.socialLinks,
      }));
    }
    if (s.opening_hours_plan) {
      setHoursPlan(s.opening_hours_plan as OpeningHoursPlan);
    }
  }

  function handleRecoverDraft() {
    if (recoverState.kind !== 'found') return;
    applyWizardSnapshot(recoverState.localData);
    if (savedId) clearLocalAutosave(`resource-autosave-${savedId}`);
    setRecoverState({ kind: 'none' });
    markDirty();
  }

  function handleDiscardDraft() {
    if (savedId) clearLocalAutosave(`resource-autosave-${savedId}`);
    setRecoverState({ kind: 'none' });
  }

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
      // Paso 6 · t4 — slug editable desde el paso 6 (decisión 3-B). El
      // state `seo.slug` manda; si está vacío, cae al legacy `slug` (que
      // se generó en paso 0 desde el nombre).
      slug: seo.slug || slug,
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
      // Paso 4 · t5 — fuente de verdad del paso 4 (migración 022). El
      // `rating_value` legacy se sigue escribiendo arriba hasta la limpieza
      // post-backfill (NO es semánticamente equivalente: rating_value es
      // "review average" schema.org; accommodation_rating es estrellas/
      // tenedores/categoría del establecimiento).
      accommodation_rating: establishment.rating,
      serves_cuisine: establishment.cuisineCodes,
      occupancy: establishment.occupancy,
      // Paso 6 · t4 — bridge seo ↔ legacy LocalizedValue. Los campos
      // `name`/`description` con EN/FR/PT se alimentan de `seo.translations`;
      // si el editor no tocó el paso 6 o cargó un recurso viejo, caemos al
      // legacy state. Igual con `seo_title`/`seo_description` ES/GL desde
      // `seo.byLang`. La edge function admin escribe ambos en paralelo:
      // `traduccion` table (legacy) + jsonb column (nuevo).
      name: {
        es: nameEs,
        gl: nameGl,
        ...(seo.translations.en?.name || nameEn ? { en: seo.translations.en?.name || nameEn } : {}),
        ...(seo.translations.fr?.name || nameFr ? { fr: seo.translations.fr?.name || nameFr } : {}),
        ...(seo.translations.pt?.name || namePt ? { pt: seo.translations.pt?.name || namePt } : {}),
      },
      description: {
        es: descEs,
        gl: descGl,
        ...(seo.translations.en?.description || descEn ? { en: seo.translations.en?.description || descEn } : {}),
        ...(seo.translations.fr?.description || descFr ? { fr: seo.translations.fr?.description || descFr } : {}),
        ...(seo.translations.pt?.description || descPt ? { pt: seo.translations.pt?.description || descPt } : {}),
      },
      seo_title: {
        es: seo.byLang.es?.title || seoTitleEs,
        gl: seo.byLang.gl?.title || seoTitleGl,
      },
      seo_description: {
        es: seo.byLang.es?.description || seoDescEs,
        gl: seo.byLang.gl?.description || seoDescGl,
      },
      // Paso 6 · t4 — campos SEO estructurados (migración 024). Fuente de
      // verdad nueva; la tabla `traduccion` + `seo_title`/`seo_description`
      // LocalizedValue se siguen escribiendo arriba hasta el backfill.
      seo_by_lang: seo.byLang,
      translations: seo.translations,
      keywords: seo.keywords,
      indexable: seo.indexable,
      og_image_override_path: seo.ogImageOverridePath,
      canonical_url: seo.canonicalUrl,
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
  // Paso 7a · t3 — `applicableTags` del antiguo AiQualityScore ya no se
  // computa aquí; el motor local ResourceQualityEngine opera offline sin
  // catálogo previo. Si en el futuro se necesita para el sugeridor de
  // tags (aiCategorize), recomputar a demanda en el consumidor.

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
    {/* ══════════ Wizard global · t2 — Stepper clickable + autosave ══════════
        El WizardStepper sustituye al stepper legacy del componente Wizard
        (que se oculta con hideDefaultStepper=true en t3). AutoSaveIndicator
        muestra el estado de sincronización (idle/saving/saved/error/offline).
        Ambos se renderizan FUERA del Wizard para que la cabecera sea visible
        incluso cuando el contenido hace scroll. */}
    <div className="wizard-global-header">
      <div className="wizard-global-header-top">
        <div>
          <h1 className="wizard-global-title">
            {isNew ? 'Nuevo recurso turístico' : 'Editar recurso'}
          </h1>
          <p className="wizard-global-subtitle">
            {isNew
              ? activeTemplate
                ? `${activeTemplate.icon} Plantilla: ${activeTemplate.name}`
                : 'Te guiamos paso a paso para crear un recurso completo'
              : `Editando: ${nameEs || slug}`}
          </p>
        </div>
        <AutoSaveIndicator
          status={autoSave.status}
          lastSavedAt={autoSave.lastSavedAt}
          errorMessage={autoSave.errorMessage}
          onRetry={autoSave.forceSave}
        />
      </div>
      <WizardStepper
        stepsState={stepperState}
        currentStep={currentStep + 1}
        onNavigate={handleNavigate}
      />
    </div>
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
      hideDefaultStepper
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
          STEP 4 — Clasificación turística (paso 4 · t5)
          ================================================================
          El bloque "Datos del establecimiento" es condicional a la tipología
          (hasAnyEstablishmentField). El sugeridor IA usa la descripción ES
          del paso 2 y el tipo del paso 1. Los tags se siguen guardando en
          `resource_tags` por el saveResourceTags existente; el componente no
          cambia esa lógica. */}
      {currentStep === 3 && (
        <ResourceWizardStep4Classification
          mainTypeKey={mainTypeKey}
          establishment={establishment}
          onChangeEstablishment={(next) => {
            setEstablishment(next);
            // Mirror a legacy state para compat con LivePreviewPanel,
            // applyTemplate y applyImportedFields (fuente de verdad sigue
            // siendo `establishment` al guardar).
            setRatingValue(next.rating != null ? String(next.rating) : '');
            setOccupancy(next.occupancy != null ? String(next.occupancy) : '');
            setServesCuisine(next.cuisineCodes.join(', '));
            markDirty();
          }}
          selectedTagKeys={tagKeys}
          onChangeSelectedTagKeys={(next) => {
            setTagKeys(next);
            markDirty();
          }}
          descriptionEs={descEs}
          municipio={selectedMunicipioName}
        />
      )}

      {/* ================================================================
          STEP 5 — Multimedia (paso 5 · t4)
          ================================================================
          Rediseño completo: imágenes con alt IA, vídeos por URL externa
          (YouTube/Vimeo), documentos PDF con metadata. Las relaciones
          entre recursos quedan pospuestas a iteración futura (decisión 5
          del usuario). El botón "Guardar borrador y continuar" (decisión
          1-B) desbloquea el paso en creación si el auto-save de step 0
          aún no se disparó. */}
      {currentStep === 4 && (
        <ResourceWizardStep5Multimedia
          resourceId={savedId}
          onSaveDraft={handleSaveDraft}
          onSkip={() => setCurrentStep(5)}
          images={mediaImages}
          videos={mediaVideos}
          documents={mediaDocuments}
          onUploadImage={handleUploadImage}
          onUpdateImageAlt={handleUpdateImageAlt}
          onSetImagePrimary={handleSetImagePrimary}
          onRemoveImage={handleRemoveImage}
          onGenerateImageAlt={handleGenerateImageAlt}
          onAddVideo={handleAddVideo}
          onRemoveVideo={handleRemoveVideo}
          onUpdateVideoTitle={handleUpdateVideoTitle}
          onUploadDocument={handleUploadDocument}
          onUpdateDocumentMeta={handleUpdateDocumentMeta}
          onRemoveDocument={handleRemoveDocument}
        />
      )}

      {/* ================================================================
          STEP 6 — SEO e idiomas (paso 6 · t4)
          ================================================================
          Rediseño completo: preview Google + preview Open Graph + slug
          editable + indexación + imagen OG + keywords con IA + traducción
          masiva + auditoría SEO en vivo. Sustituye los 10 campos legacy
          (4 SEO + 6 traducciones con botones individuales) y el
          AiSeoGenerator antiguo. */}
      {currentStep === 5 && (
        <ResourceWizardStep6Seo
          seo={seo}
          onChange={(next) => {
            setSeo(next);
            // Paso 6 · t4 — mirror a legacy state para que LivePreview,
            // applyTemplate y el guardado actual del name/description
            // LocalizedValue sigan funcionando. La fuente de verdad es
            // `seo` pero no borramos los 10 legacy todavía.
            setSeoTitleEs(next.byLang.es?.title ?? '');
            setSeoTitleGl(next.byLang.gl?.title ?? '');
            setSeoDescEs(next.byLang.es?.description ?? '');
            setSeoDescGl(next.byLang.gl?.description ?? '');
            setNameEn(next.translations.en?.name ?? '');
            setNameFr(next.translations.fr?.name ?? '');
            setNamePt(next.translations.pt?.name ?? '');
            setDescEn(next.translations.en?.description ?? '');
            setDescFr(next.translations.fr?.description ?? '');
            setDescPt(next.translations.pt?.description ?? '');
            markDirty();
          }}
          resourceName={nameEs}
          descriptionEs={descEs}
          hasPrimaryImage={mediaImages.some((i) => i.isPrimary)}
          primaryImageUrl={mediaImages.find((i) => i.isPrimary)?.publicUrl ?? null}
          ogOverrideUrl={seo.ogImageOverridePath ? getPublicUrl(IMAGES_BUCKET, seo.ogImageOverridePath) : null}
          isPublished={editorialStatus === 'publicado'}
          onGenerateSeoAi={handleGenerateSeoAi}
          onSuggestKeywordsAi={handleSuggestKeywordsAi}
          onTranslateOne={handleTranslateOne}
          onTranslateAll={handleTranslateAll}
          onCheckSlugDuplicate={handleCheckSlugDuplicate}
          currentResourceId={savedId}
          onUploadOgOverride={handleUploadOgOverride}
          onRemoveOgOverride={handleRemoveOgOverride}
        />
      )}

      {/* ================================================================
          STEP 7 — Revisión (paso 7a · t2)
          ================================================================
          Rediseño: ScoreDashboard global + 6 StepCards con estado honesto
          + PidCompletenessCard plegada + modal de confirmación al publicar
          + orden nuevo (resumen arriba, publicación abajo). Sustituye el
          bloque legacy (AiQualityScore + 6 WizardCompletionCard + PID
          card inline + bug "Disponible tras guardar" del paso 5). */}
      {currentStep === 6 && (
        <>
          <ResourceWizardStep7Review
            snapshot={resourceSnapshot}
            publicationStatus={editorialStatus as PublicationStatus}
            scheduledPublishAt={scheduledPublishAt}
            publishedAt={publishedAt}
            onGoToStep={handleGoToStep}
            onChangeVisibleOnMap={(next) => { setVisibleOnMap(next); markDirty(); }}
            onSaveDraft={handleSaveDraftStep7}
            onPublishNow={handlePublishNow}
            onSchedulePublish={handleSchedulePublish}
            onRequestAiSuggestions={handleRequestAiSuggestions}
            onLoadAuditLog={handleLoadAuditLog}
            onPrevious={() => setCurrentStep(5)}
          />

          {/* Paso 7b · t4 — ActivityTimeline queda duplicado con el nuevo
              `AuditLogPanel` que monta el Step7Review internamente. Se deja
              fuera de forma condicional: solo se renderiza si NO es new (el
              panel nuevo es para cambios del recurso guardado, y ActivityTimeline
              hoy tampoco se muestra en creación). Queda como deuda mover todo
              el histórico al panel nuevo y quitar ActivityTimeline. */}
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

    {/* Wizard global · t2 — Modal de recuperación de sesión previa.
        Aparece solo si al abrir un recurso existe un autosave local MÁS
        RECIENTE que el updated_at del servidor. Bloquea hasta que el
        usuario pulse "Recuperar" o "Descartar". */}
    {recoverState.kind === 'found' && (
      <RecoverDraftModal
        localSavedAt={recoverState.localSavedAt}
        remoteSavedAt={null}
        onRecover={handleRecoverDraft}
        onDiscard={handleDiscardDraft}
      />
    )}

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
