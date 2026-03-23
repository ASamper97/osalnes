import { supabase } from '../db/supabase.js';
import { AppError } from '../middleware/error-handler.js';
import { getTranslatedField } from './translation.service.js';

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listCategories() {
  const { data, error } = await supabase
    .from('categoria')
    .select('id, slug, parent_id, orden, activo')
    .order('orden');

  if (error) throw error;

  return Promise.all(
    (data || []).map(async (r) => ({
      id: r.id,
      slug: r.slug,
      parentId: r.parent_id,
      orden: r.orden,
      activo: r.activo,
      name: await getTranslatedField('categoria', r.id, 'name'),
    })),
  );
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

interface CreateCategoryInput {
  slug: string;
  parent_id?: string | null;
  orden?: number;
  activo?: boolean;
  name: { es?: string; gl?: string };
}

export async function createCategory(input: CreateCategoryInput) {
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

  if (error) throw new AppError(400, error.message);

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
  const updates: Record<string, unknown> = {};
  if (input.slug !== undefined) updates.slug = input.slug;
  if (input.parent_id !== undefined) updates.parent_id = input.parent_id || null;
  if (input.orden !== undefined) updates.orden = input.orden;
  if (input.activo !== undefined) updates.activo = input.activo;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('categoria').update(updates).eq('id', id);
    if (error) throw new AppError(400, error.message);
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

async function saveTranslations(categoryId: string, name: { es?: string; gl?: string }) {
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
