import { supabase } from '../db/supabase.js';
import { AppError } from '../middleware/error-handler.js';

// ---------------------------------------------------------------------------
// Validation & helpers
// ---------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateCategoryInput(input: Partial<CreateCategoryInput>, isCreate = false) {
  const errors: string[] = [];
  if (isCreate && !input.slug) errors.push('slug es obligatorio');
  if (isCreate && !input.name?.es) errors.push('name.es es obligatorio');
  if (input.slug !== undefined) {
    if (!SLUG_RE.test(input.slug)) errors.push('slug solo admite letras minusculas, numeros y guiones');
    if (input.slug.length > 200) errors.push('slug demasiado largo (max 200)');
  }
  if (errors.length > 0) throw new AppError(400, errors.join('; '));
}

function sanitizeDbError(msg: string): string {
  if (msg.includes('duplicate key') && msg.includes('slug')) return 'Ya existe una categoria con ese slug';
  if (msg.includes('duplicate key')) return 'Ya existe un registro duplicado';
  if (msg.includes('violates foreign key')) return 'Referencia a un registro que no existe';
  return 'Error al guardar en la base de datos';
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listCategories() {
  const { data, error } = await supabase
    .from('categoria')
    .select('id, slug, parent_id, orden, activo')
    .order('orden');

  if (error) throw error;

  const rows = data || [];
  if (rows.length === 0) return [];

  // Batch-fetch all category names in a single query (fix N+1)
  const ids = rows.map((r) => r.id);
  const { data: translations } = await supabase
    .from('traduccion')
    .select('entidad_id, idioma, valor')
    .eq('entidad_tipo', 'categoria')
    .eq('campo', 'name')
    .in('entidad_id', ids);

  const nameMap: Record<string, Record<string, string>> = {};
  for (const t of translations || []) {
    if (!nameMap[t.entidad_id]) nameMap[t.entidad_id] = {};
    nameMap[t.entidad_id][t.idioma] = t.valor;
  }

  // Count resources per category (single query)
  const { data: rcRows } = await supabase
    .from('recurso_categoria')
    .select('categoria_id');
  const countMap: Record<string, number> = {};
  for (const rc of rcRows || []) {
    countMap[rc.categoria_id] = (countMap[rc.categoria_id] || 0) + 1;
  }

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    parentId: r.parent_id,
    orden: r.orden,
    activo: r.activo,
    name: nameMap[r.id] || {},
    resourceCount: countMap[r.id] || 0,
  }));
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

interface CreateCategoryInput {
  slug: string;
  parent_id?: string | null;
  orden?: number;
  activo?: boolean;
  name: Record<string, string>;
}

export async function createCategory(input: CreateCategoryInput) {
  validateCategoryInput(input, true);

  const { data, error } = await supabase
    .from('categoria')
    .insert({
      slug: input.slug,
      parent_id: input.parent_id || null,
      orden: input.orden ?? 0,
      activo: input.activo ?? true,
    })
    .select()
    .single();

  if (error) throw new AppError(400, sanitizeDbError(error.message));

  await saveTranslations(data.id, input.name);

  return {
    id: data.id,
    slug: data.slug,
    parentId: data.parent_id,
    orden: data.orden,
    activo: data.activo,
    name: input.name,
  };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateCategory(id: string, input: Partial<CreateCategoryInput>) {
  validateCategoryInput(input);

  const updates: Record<string, unknown> = {};
  if (input.slug !== undefined) updates.slug = input.slug;
  if (input.parent_id !== undefined) updates.parent_id = input.parent_id || null;
  if (input.orden !== undefined) updates.orden = input.orden;
  if (input.activo !== undefined) updates.activo = input.activo;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('categoria').update(updates).eq('id', id);
    if (error) throw new AppError(400, sanitizeDbError(error.message));
  }

  if (input.name) {
    await saveTranslations(id, input.name);
  }

  return { id, ...updates, name: input.name };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteCategory(id: string) {
  // Check no children
  const { data: children } = await supabase
    .from('categoria')
    .select('id')
    .eq('parent_id', id)
    .limit(1);

  if (children && children.length > 0) {
    throw new AppError(400, 'Cannot delete category with subcategories. Delete children first.');
  }

  // Remove translations
  await supabase.from('traduccion').delete().eq('entidad_tipo', 'categoria').eq('entidad_id', id);

  // Remove resource associations
  await supabase.from('recurso_categoria').delete().eq('categoria_id', id);

  const { error } = await supabase.from('categoria').delete().eq('id', id);
  if (error) throw new AppError(400, error.message);

  return { deleted: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function saveTranslations(categoryId: string, name: Record<string, string>) {
  for (const [lang, value] of Object.entries(name)) {
    if (!value) continue;
    await supabase
      .from('traduccion')
      .upsert(
        {
          entidad_tipo: 'categoria',
          entidad_id: categoryId,
          campo: 'name',
          idioma: lang,
          valor: value,
        },
        { onConflict: 'entidad_tipo,entidad_id,campo,idioma' },
      );
  }
}
