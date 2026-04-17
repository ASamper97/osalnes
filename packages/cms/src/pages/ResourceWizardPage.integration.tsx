// @ts-nocheck
// ──────────────────────────────────────────────────────────────────────────
// INTEGRACIÓN: ResourceWizardPage.tsx
//
// Este fichero NO se commitea tal cual. Son los fragmentos que hay que
// pegar/sustituir en `packages/cms/src/pages/ResourceWizardPage.tsx` para
// conectar TagSelector (paso 4) y PidCompletenessCard (paso 7).
// Se borrará al completar la Tarea 4 del prompt guía-burros v2.
// ──────────────────────────────────────────────────────────────────────────


// ═══════════ 1) IMPORTS nuevos al principio del fichero ═══════════

import TagSelector from '../components/TagSelector';
import PidCompletenessCard from '../components/PidCompletenessCard';
import { RESOURCE_TYPE_BY_XLSX_LABEL } from '@osalnes/shared/data/resource-type-catalog';
import { TAGS_BY_KEY } from '@osalnes/shared/data/tag-catalog';


// ═══════════ 2) ESTADO nuevo en el componente ResourceWizardPage ═══════════

// Dentro del estado del formulario (donde ya existen `name`, `slug`, etc.)
// añadir:
const [tagKeys, setTagKeys] = useState<string[]>(
  () => initialResource?.tags?.map((t: { tag_key: string }) => t.tag_key) ?? [],
);

// Y si el tipo cambia, limpiar tags que dejen de ser aplicables (opcional pero recomendado):
useEffect(() => {
  if (!resourceTypeLabel) return;
  const def = RESOURCE_TYPE_BY_XLSX_LABEL[resourceTypeLabel];
  if (!def) return;
  const allowed = new Set(def.wizardGroups);
  setTagKeys((prev) =>
    prev.filter((k) => {
      const tag = TAGS_BY_KEY[k];
      return tag && allowed.has(tag.groupKey);
    }),
  );
}, [resourceTypeLabel]);


// ═══════════ 3) PASO 4 — sustituir el desplegable plano ═══════════

// ANTES (a borrar): el `<select multiple>` de "tipos turismo UNE 178503"
// y el desplegable de "categorías portal".

// DESPUÉS (contenido del paso 4):
<WizardFieldGroup
  title="Clasificación semántica"
  tip="Marca todas las etiquetas que apliquen. El catálogo solo muestra los grupos relevantes para el tipo que seleccionaste en el paso 1. Las etiquetas marcadas como 'PID' se exportan a la Plataforma Inteligente de Destinos; las marcadas 'solo CMS' son editoriales."
>
  <TagSelector
    resourceTypeLabel={resourceTypeLabel}
    value={tagKeys}
    onChange={setTagKeys}
    includeMunicipio={false}      // ya se pide en paso 3
  />
</WizardFieldGroup>


// ═══════════ 4) PASO 7 — añadir tarjeta al grid de revisión ═══════════

// En el grid de CompletionCards del paso 7, al principio del grid
// (primera posición) añadir:

<PidCompletenessCard
  selectedKeys={tagKeys}
  onEdit={() => goToStep(4)}   // usar la función de navegación del wizard
/>


// ═══════════ 5) GUARDAR — persistir tags al submit ═══════════

// En la función `handleSubmit` / `saveResource`, después de hacer upsert
// sobre `resources`, sincronizar `resource_tags`:

async function saveResourceTags(resourceId: string, keys: string[]) {
  // Estrategia simple: borrar todas y reinsertar. Para volúmenes bajos
  // (máx ~30 tags por recurso) es correcto. Si escala, mover a diff.
  await supabase.from('resource_tags').delete().eq('resource_id', resourceId);

  if (keys.length === 0) return;

  const rows = keys
    .map((k) => TAGS_BY_KEY[k])
    .filter((t): t is NonNullable<typeof t> => !!t)
    .map((t) => ({
      resource_id: resourceId,
      tag_key: t.key,
      field: t.field,
      value: t.value,
      pid_exportable: t.pidExportable,
      source: 'manual',
    }));

  const { error } = await supabase.from('resource_tags').insert(rows);
  if (error) throw error;
}

// Y en handleSubmit, tras guardar el recurso:
const saved = await upsertResource({...});
await saveResourceTags(saved.id, tagKeys);


// ═══════════ 6) LEER — cargar tags existentes al editar ═══════════

// En el loader inicial de la página (donde ya se lee el recurso por id):
const { data: resource } = await supabase
  .from('resources')
  .select(`
    *,
    tags:resource_tags(tag_key, field, value, pid_exportable)
  `)
  .eq('id', id)
  .single();

// `initialResource.tags` ya viene como array → se convierte a string[] en el
// useState inicial del paso 2 de arriba.


// ═══════════ 7) CSS — añadir al final de styles.css ═══════════

// Pegar el contenido completo de:
//   - packages/cms/src/components/tag-selector.css
//   - packages/cms/src/components/pid-completeness-card.css
// al final de packages/cms/src/styles.css.
// (O alternativamente, hacer `import './TagSelector.css'` desde TagSelector.tsx
//  si el proyecto admite import de CSS por componente — verificar vite.config.)


// ═══════════ 8) ai-writer — actualizar acción `categorize` ═══════════

// En supabase/functions/ai-writer/index.ts, la acción `categorize` hoy
// devuelve tipos turismo UNE 178503 en formato libre. Cambiar el prompt
// para que devuelva claves del catálogo:

// Prompt nuevo (resumen):
//   "Dado el texto del recurso, sugiere etiquetas del siguiente catálogo
//    UNE 178503. Devuelve JSON con array de tag_keys (ej: ['experiencia.cultura',
//    'serv-alojamiento.wifi']). Solo claves que existan en el catálogo."
//
// Pasar al prompt el catálogo filtrado por grupos aplicables al tipo del recurso
// para reducir alucinaciones:
//
//   const applicableTags = TAGS.filter(t =>
//     RESOURCE_TYPE_BY_XLSX_LABEL[resourceType]?.wizardGroups.includes(t.groupKey)
//   );
//   const prompt = `Catálogo disponible:\n${applicableTags.map(t =>
//     `- ${t.key}: "${t.label}" (${t.field})`
//   ).join('\n')}\n\nTexto del recurso:\n${text}\n\nDevuelve {"suggested_keys": [...]}`;

// El botón "Aplicar tipos sugeridos" de AiQualityScore.tsx pasa a llamar a
// setTagKeys(current => [...new Set([...current, ...suggested_keys])]).
