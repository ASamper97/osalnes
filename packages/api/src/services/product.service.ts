import { supabase } from '../db/supabase.js';
import { AppError } from '../middleware/error-handler.js';

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
// Validation
// ---------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateProductInput(input: Partial<ProductInput>, isCreate = false) {
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
  if (msg.includes('duplicate key') && msg.includes('slug')) return 'Ya existe un producto con ese slug';
  if (msg.includes('duplicate key')) return 'Ya existe un registro duplicado';
  if (msg.includes('violates foreign key')) return 'Referencia a un registro que no existe';
  return 'Error al guardar en la base de datos';
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

  const rows = data || [];
  if (rows.length === 0) return [];

  // Batch-fetch all translations in 1 query (fix N+1)
  const ids = rows.map((r) => r.id);
  const { data: translations } = await supabase
    .from('traduccion')
    .select('entidad_id, campo, idioma, valor')
    .eq('entidad_tipo', 'producto_turistico')
    .in('entidad_id', ids);

  const tMap: Record<string, Record<string, Record<string, string>>> = {};
  for (const t of translations || []) {
    if (!tMap[t.entidad_id]) tMap[t.entidad_id] = {};
    if (!tMap[t.entidad_id][t.campo]) tMap[t.entidad_id][t.campo] = {};
    tMap[t.entidad_id][t.campo][t.idioma] = t.valor;
  }

  // Count resources per product
  const { data: rpRows } = await supabase
    .from('recurso_producto')
    .select('producto_id');
  const countMap: Record<string, number> = {};
  for (const rp of rpRows || []) {
    countMap[rp.producto_id] = (countMap[rp.producto_id] || 0) + 1;
  }

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    activo: r.activo,
    createdAt: r.created_at,
    name: tMap[r.id]?.name || {},
    description: tMap[r.id]?.description || {},
    resourceCount: countMap[r.id] || 0,
  }));
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createProduct(input: ProductInput) {
  validateProductInput(input, true);

  const { data, error } = await supabase
    .from('producto_turistico')
    .insert({
      slug: input.slug,
      activo: input.activo ?? true,
    })
    .select()
    .single();

  if (error) throw new AppError(400, sanitizeDbError(error.message));

  await saveTranslations(data.id, input);
  return { ...data, name: input.name || {}, description: input.description || {} };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateProduct(id: string, input: Partial<ProductInput>) {
  validateProductInput(input);

  const update: Record<string, unknown> = {};
  if (input.slug !== undefined) update.slug = input.slug;
  if (input.activo !== undefined) update.activo = input.activo;

  if (Object.keys(update).length > 0) {
    const { error } = await supabase
      .from('producto_turistico')
      .update(update)
      .eq('id', id);

    if (error) throw new AppError(400, sanitizeDbError(error.message));
  }

  await saveTranslations(id, input);

  return { id, ...update, name: input.name || {}, description: input.description || {} };
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
  if (error) throw new AppError(400, sanitizeDbError(error.message));

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
