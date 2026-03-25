import { supabase } from '../db/supabase.js';
import { AppError } from '../middleware/error-handler.js';
import { getTranslations } from './translation.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageInput {
  slug: string;
  template?: string;
  title?: Record<string, string>;
  body?: Record<string, string>;
  seo_title?: Record<string, string>;
  seo_description?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validatePageInput(input: Partial<PageInput>, isCreate = false) {
  const errors: string[] = [];
  if (isCreate && !input.slug) errors.push('slug es obligatorio');
  if (isCreate && !input.title?.es) errors.push('title.es es obligatorio');
  if (input.slug !== undefined) {
    if (!SLUG_RE.test(input.slug)) errors.push('slug solo admite letras minusculas, numeros y guiones');
    if (input.slug.length > 300) errors.push('slug demasiado largo (max 300)');
  }
  if (input.seo_description) {
    for (const [lang, val] of Object.entries(input.seo_description)) {
      if (val.length > 300) errors.push(`seo_description.${lang} demasiado larga (max 300)`);
    }
  }
  if (errors.length > 0) throw new AppError(400, errors.join('; '));
}

function sanitizeDbError(msg: string): string {
  if (msg.includes('duplicate key') && msg.includes('slug')) return 'Ya existe una pagina con ese slug';
  if (msg.includes('duplicate key')) return 'Ya existe un registro duplicado';
  if (msg.includes('violates foreign key')) return 'Referencia a un registro que no existe';
  return 'Error al guardar en la base de datos';
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listPages() {
  const { data, error } = await supabase
    .from('pagina')
    .select('id, slug, template, estado_editorial, published_at, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = data || [];
  if (rows.length === 0) return [];

  // Batch-fetch titles in 1 query (fix N+1)
  const ids = rows.map((r) => r.id);
  const { data: translations } = await supabase
    .from('traduccion')
    .select('entidad_id, idioma, valor')
    .eq('entidad_tipo', 'pagina')
    .eq('campo', 'title')
    .in('entidad_id', ids);

  const titleMap: Record<string, Record<string, string>> = {};
  for (const t of translations || []) {
    if (!titleMap[t.entidad_id]) titleMap[t.entidad_id] = {};
    titleMap[t.entidad_id][t.idioma] = t.valor;
  }

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    template: r.template,
    status: r.estado_editorial,
    publishedAt: r.published_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    title: titleMap[r.id] || {},
  }));
}

// ---------------------------------------------------------------------------
// Get by ID
// ---------------------------------------------------------------------------

export async function getPageById(id: string) {
  const { data, error } = await supabase
    .from('pagina')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) throw new AppError(404, 'Page not found');

  const translations = await getTranslations('pagina', data.id);

  return {
    id: data.id,
    slug: data.slug,
    template: data.template,
    status: data.estado_editorial,
    publishedAt: data.published_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    title: translations.title || {},
    body: translations.body || {},
    seoTitle: translations.seo_title || {},
    seoDescription: translations.seo_description || {},
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createPage(input: PageInput) {
  validatePageInput(input, true);

  const { data, error } = await supabase
    .from('pagina')
    .insert({
      slug: input.slug,
      template: input.template || 'default',
      estado_editorial: 'borrador',
    })
    .select()
    .single();

  if (error) throw new AppError(400, sanitizeDbError(error.message));

  await savePageTranslations(data.id, input);
  return getPageById(data.id);
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updatePage(id: string, input: Partial<PageInput>) {
  validatePageInput(input);

  const update: Record<string, unknown> = {};
  if (input.slug !== undefined) update.slug = input.slug;
  if (input.template !== undefined) update.template = input.template;

  if (Object.keys(update).length > 0) {
    const { error } = await supabase
      .from('pagina')
      .update(update)
      .eq('id', id);

    if (error) throw new AppError(400, sanitizeDbError(error.message));
  }

  await savePageTranslations(id, input);
  return getPageById(id);
}

// ---------------------------------------------------------------------------
// Update status
// ---------------------------------------------------------------------------

const PAGE_TRANSITIONS: Record<string, string[]> = {
  borrador: ['revision', 'archivado'],
  revision: ['publicado', 'borrador'],
  publicado: ['archivado', 'borrador'],
  archivado: ['borrador'],
};

export async function updatePageStatus(id: string, newStatus: string) {
  const { data: current, error: fetchError } = await supabase
    .from('pagina')
    .select('estado_editorial')
    .eq('id', id)
    .single();

  if (fetchError || !current) throw new AppError(404, 'Page not found');

  const allowed = PAGE_TRANSITIONS[current.estado_editorial] || [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(400, `Transicion no permitida: ${current.estado_editorial} → ${newStatus}`);
  }

  const update: Record<string, unknown> = { estado_editorial: newStatus };
  if (newStatus === 'publicado') update.published_at = new Date().toISOString();

  const { error } = await supabase.from('pagina').update(update).eq('id', id);
  if (error) throw new AppError(400, sanitizeDbError(error.message));

  return getPageById(id);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deletePage(id: string) {
  // Delete translations first
  await supabase
    .from('traduccion')
    .delete()
    .eq('entidad_tipo', 'pagina')
    .eq('entidad_id', id);

  const { error } = await supabase.from('pagina').delete().eq('id', id);
  if (error) throw new AppError(400, sanitizeDbError(error.message));

  return { deleted: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function savePageTranslations(id: string, input: Partial<PageInput>) {
  const fields: Array<[string, Record<string, string> | undefined]> = [
    ['title', input.title],
    ['body', input.body],
    ['seo_title', input.seo_title],
    ['seo_description', input.seo_description],
  ];

  for (const [campo, values] of fields) {
    if (!values) continue;
    for (const [idioma, valor] of Object.entries(values)) {
      if (!valor) continue;
      await supabase
        .from('traduccion')
        .upsert(
          { entidad_tipo: 'pagina', entidad_id: id, campo, idioma, valor },
          { onConflict: 'entidad_tipo,entidad_id,campo,idioma' },
        );
    }
  }
}
