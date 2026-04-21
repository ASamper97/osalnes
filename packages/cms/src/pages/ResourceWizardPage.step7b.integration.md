# Integración · Paso 7b en `ResourceWizardPage.tsx`

Asume que el paso 7a ya está aplicado y funcionando. El paso 7b es una
**ampliación incremental**: se reemplazan `PublishModal`,
`ResourceWizardStep7Review`, `step7-review.copy.ts` y `step7-review.css`
con sus versiones 7b; se añaden 3 componentes nuevos; se aplican 2 patches
AI; se ejecuta la migración 025.

---

## 1) Aplicar migración 025

```bash
npx supabase db push
```

Verificar:
```sql
\d public.resources
-- Deben aparecer: scheduled_publish_at, published_at, published_by

select constraint_name from information_schema.table_constraints
where table_name='resources' and constraint_name like 'resources_publication%';
-- Debe existir resources_publication_status_check (con 'scheduled')
-- y resources_scheduled_publish_at_coherent

select public.publish_scheduled_resources();
-- Debe devolver un integer (0 si no hay nada pendiente)
```

## 2) Desplegar Edge Function `publish-scheduled`

Esta función es NUEVA, distinta de `ai-writer`:

```bash
# Asumiendo carpeta supabase/functions/publish-scheduled/index.ts
npx supabase functions deploy publish-scheduled

# Configurar variable de entorno CRON_SECRET para proteger el endpoint
npx supabase secrets set CRON_SECRET="tu-secret-aleatorio-aqui"

# Programar ejecución cada 15 minutos
# (si el proyecto usa pg_cron, supabase schedule, o cron externo)
```

### Opción A · pg_cron directo en Postgres

Si tienes pg_cron instalado:
```sql
select cron.schedule(
  'publish-scheduled-every-15min',
  '*/15 * * * *',
  $$ select public.publish_scheduled_resources(); $$
);
```

Esta opción es la más sencilla: no requiere desplegar el Edge Function,
solo ejecuta la RPC directamente. Recomendada.

### Opción B · Supabase Scheduled Functions (si disponible en tu plan)

### Opción C · GitHub Actions cron

En `.github/workflows/publish-scheduled.yml`:
```yaml
on:
  schedule:
    - cron: '*/15 * * * *'
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/publish-scheduled" \
               -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

**Elegir UNA de las tres.** Recomendado A si el proyecto ya usa pg_cron.

## 3) Aplicar patch AI

- `packages/cms/src/lib/ai.ts` — añadir `aiSuggestImprovements` según
  `ai.step7b.patch.ts`.
- `supabase/functions/ai-writer/index.ts` — añadir action
  `suggestImprovements` según `index.suggestImprovements-action.patch.ts`.

Desplegar:
```bash
npx supabase functions deploy ai-writer
```

## 4) Reemplazar ficheros del paso 7a

El installer sobrescribe automáticamente:
- `PublishModal.tsx` → versión 7b (con selector ahora/programar)
- `ResourceWizardStep7Review.tsx` → versión 7b (con nuevos panels)
- `step7-review.copy.ts` → versión 7b (copy ampliado)
- `step7-review.css` → versión 7b (estilos nuevos)

Los otros componentes del 7a (ScoreDashboard, StepCard,
PidCompletenessCard) **no cambian**.

## 5) Nuevos handlers en `ResourceWizardPage.tsx`

```tsx
import { aiSuggestImprovements } from '../lib/ai';
import type { AuditEntry } from '../components/AuditLogPanel';
import type { ImprovementSuggestion } from '../components/ImprovementSuggestions';
import { type PublicationStatus } from '@osalnes/shared/data/publication-status';

// Estado nuevo
const [publicationStatus, setPublicationStatus] = useState<PublicationStatus>('draft');
const [scheduledPublishAt, setScheduledPublishAt] = useState<string | null>(null);
const [publishedAt, setPublishedAt] = useState<string | null>(null);

// Hidratación desde BD al cargar recurso
useEffect(() => {
  if (!initialResource) return;
  setPublicationStatus(initialResource.publication_status ?? 'draft');
  setScheduledPublishAt(initialResource.scheduled_publish_at ?? null);
  setPublishedAt(initialResource.published_at ?? null);
}, [initialResource]);

// Handler: publicar ahora
async function handlePublishNow() {
  if (!resourceId) throw new Error('Resource sin ID');
  const { error } = await supabase.from('resources').update({
    publication_status: 'published',
    published_at: new Date().toISOString(),
    published_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    scheduled_publish_at: null,
  }).eq('id', resourceId);
  if (error) throw error;
  setPublicationStatus('published');
  setPublishedAt(new Date().toISOString());
}

// Handler: programar publicación
async function handleSchedulePublish(utcIso: string) {
  if (!resourceId) throw new Error('Resource sin ID');
  const { error } = await supabase.from('resources').update({
    publication_status: 'scheduled',
    scheduled_publish_at: utcIso,
  }).eq('id', resourceId);
  if (error) throw error;
  setPublicationStatus('scheduled');
  setScheduledPublishAt(utcIso);
}

// Handler: sugerencias IA
async function handleRequestAiSuggestions(): Promise<ImprovementSuggestion[]> {
  return aiSuggestImprovements({
    snapshot: {
      name: resourceName,
      typeLabel: getTypeLabel(mainTypeKey),
      municipio: selectedMunicipioName,
      descriptionEs,
      descriptionGl,
      hasCoordinates: latitude != null && longitude != null,
      hasContactInfo: !!(contactPhone || contactEmail || contactWeb),
      hasHours: hoursPlan != null,
      tagCount: selectedTagKeys.length,
      imageCount: mediaImages.length,
      imagesWithoutAltCount: mediaImages.filter(i => !i.altText?.trim()).length,
      seoTitleEs: seo.byLang.es?.title ?? '',
      seoDescriptionEs: seo.byLang.es?.description ?? '',
      keywords: seo.keywords,
      translationCount: Object.keys(seo.translations).length,
    },
  });
}

// Handler: cargar audit log
async function handleLoadAuditLog(): Promise<AuditEntry[]> {
  if (!resourceId) return [];
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, created_at, action, actor_email, changed_fields')
    .eq('resource_id', resourceId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return [];
  return (data ?? []).map(row => ({
    id: row.id,
    createdAt: row.created_at,
    action: row.action,
    actor: row.actor_email ?? null,
    changedFields: row.changed_fields ?? null,
  }));
}
```

## 6) Render

```tsx
<ResourceWizardStep7Review
  snapshot={resourceSnapshot}
  publicationStatus={publicationStatus}
  scheduledPublishAt={scheduledPublishAt}
  publishedAt={publishedAt}
  onGoToStep={handleGoToStep}
  onChangeVisibleOnMap={setVisibleOnMap}
  onSaveDraft={handleSaveDraft}
  onPublishNow={handlePublishNow}
  onSchedulePublish={handleSchedulePublish}
  onRequestAiSuggestions={handleRequestAiSuggestions}
  onLoadAuditLog={handleLoadAuditLog}
  onPrevious={() => setCurrentStep(6)}
/>
```

## 7) Verificación de audit_log

El panel "Historial de cambios" asume que existe una tabla `audit_log`
con los siguientes campos mínimos:
- `id` (uuid)
- `resource_id` (uuid, FK a resources)
- `created_at` (timestamptz)
- `action` (text) — p.ej. 'create', 'update', 'publish', 'schedule'
- `actor_email` (text nullable) — email de quien hizo el cambio
- `changed_fields` (text[] nullable) — lista de campos modificados

Si tu tabla tiene otros nombres, ajustar el `select` del handler
`handleLoadAuditLog` para mapear correctamente.

Si la tabla no existe aún, dejar el panel vacío es aceptable; no rompe
el paso 7. Puede añadirse en iteración posterior con triggers Postgres.

## 8) Checklist de aceptación

- [ ] Migración 025 aplicada. Existen columnas y RPC publish_scheduled_resources.
- [ ] Edge Function publish-scheduled desplegado y cron programado (o pg_cron configurado).
- [ ] Badge de estado actual visible en el header del paso 7 (Borrador / Programado / Publicado).
- [ ] Si el recurso está programado, el badge muestra la fecha/hora prevista.
- [ ] Panel "Sugerencias de la IA" aparece debajo del dashboard de score.
- [ ] Botón "Pedir sugerencias" desactivado si la descripción del paso 2 tiene <50 caracteres.
- [ ] Al pulsar, la IA tarda ~3-6 segundos y devuelve sugerencias agrupadas por paso.
- [ ] Cada grupo tiene botón "Ir al paso" que salta al paso correspondiente.
- [ ] Modal de publicación tiene 2 tabs: "Publicar ahora" / "Programar publicación".
- [ ] Tab "Programar" revela selector datetime-local.
- [ ] No deja programar fecha en pasado (validación mínimo ahora + 1 min).
- [ ] Al confirmar "Programar", el recurso pasa a status 'scheduled' y se guarda scheduled_publish_at.
- [ ] Al llegar la hora, el cron publica el recurso y lo marca publication_status='published'.
- [ ] Panel "Historial de cambios" plegable al final; al expandir carga las últimas entradas.
- [ ] Cada entrada muestra acción, fecha relativa ("hace 3 h"), actor y campos modificados.
- [ ] Copy con tildes correctas en todo el paso.
- [ ] Responsive (<760px) funciona correctamente en todos los bloques nuevos.
