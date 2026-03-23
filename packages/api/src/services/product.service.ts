import { supabase } from '../db/supabase.js';
import { AppError } from '../middleware/error-handler.js';
import { getTranslatedField } from './translation.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductInput {
  slug: string;
  activo?: boolean;
  name?: Record<string, string>;
  description?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listProducts() {
  const { data, error } = await supabase
    .from('producto_turistico')
    .select('id, slug, activo, created_at')
    .order('slug');

  if (error) throw error;

  return Promise.all(
    (data || []).map(async (r) => ({
      id: r.id,
      slug: r.slug,
      activo: r.activo,
      createdAt: r.created_at,
      name: await getTranslatedField('producto_turistico', r.id, 'name'),
      description: await getTranslatedField('producto_turistico', r.id, 'description'),
    })),
  );
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createProduct(input: ProductInput) {
  const { data, error } = await supabase
    .from('producto_turistico')
    .insert({
      slug: input.slug,
      activo: input.activo ?? true,
    })
    .select()
    .single();

  if (error) throw new AppError(400, error.message);

  await saveTranslations(data.id, input);
  return { ...data, name: input.name || {}, description: input.description || {} };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateProduct(id: string, input: Partial<ProductInput>) {
  const update: Record<string, unknown> = {};
  if (input.slug !== undefined) update.slug = input.slug;
  if (input.activo !== undefined) update.activo = input.activo;

  if (Object.keys(update).length > 0) {
    const { error } = await supabase
      .from('producto_turistico')
      .update(update)
      .eq('id', id);

    if (error) throw new AppError(400, error.message);
  }

  await saveTranslations(id, input);

  return {
    id,
    ...(input.slug !== undefined && { slug: input.slug }),
    name: input.name || await getTranslatedField('producto_turistico', id, 'name'),
    description: input.description || await getTranslatedField('producto_turistico', id, 'description'),
  };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteProduct(id: string) {
  // Delete M:N associations
  await supabase.from('recurso_producto').delete().eq('producto_id', id);

  // Delete translations
  await supabase
    .from('traduccion')
    .delete()
    .eq('entidad_tipo', 'producto_turistico')
    .eq('entidad_id', id);

  const { error } = await supabase.from('producto_turistico').delete().eq('id', id);
  if (error) throw new AppError(400, error.message);

  return { deleted: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function saveTranslations(id: string, input: Partial<ProductInput>) {
  const fields: Array<[string, Record<string, string> | undefined]> = [
    ['name', input.name],
    ['description', input.description],
  ];

  for (const [campo, values] of fields) {
    if (!values) continue;
    for (const [idioma, valor] of Object.entries(values)) {
      if (!valor) continue;
      await supabase
        .from('traduccion')
        .upsert(
          { entidad_tipo: 'producto_turistico', entidad_id: id, campo, idioma, valor },
          { onConflict: 'entidad_tipo,entidad_id,campo,idioma' },
        );
    }
  }
}
