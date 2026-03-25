import { supabase } from '../db/supabase.js';
import { AppError } from '../middleware/error-handler.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateNavInput {
  menu_slug: string;
  parent_id?: string | null;
  tipo: string;
  referencia?: string | null;
  orden?: number;
  visible?: boolean;
  label: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_MENUS = ['header', 'footer', 'sidebar'];
const VALID_TIPOS = ['pagina', 'recurso', 'url_externa', 'categoria', 'tipologia'];

function validateNavInput(input: Partial<CreateNavInput>, isCreate = false) {
  const errors: string[] = [];
  if (isCreate && !input.menu_slug) errors.push('menu_slug es obligatorio');
  if (isCreate && !input.tipo) errors.push('tipo es obligatorio');
  if (isCreate && !input.label?.es) errors.push('label.es es obligatorio');
  if (input.menu_slug && !VALID_MENUS.includes(input.menu_slug)) errors.push(`menu_slug invalido: ${input.menu_slug}`);
  if (input.tipo && !VALID_TIPOS.includes(input.tipo)) errors.push(`tipo invalido: ${input.tipo}`);
  if (errors.length > 0) throw new AppError(400, errors.join('; '));
}

function sanitizeDbError(msg: string): string {
  if (msg.includes('duplicate key')) return 'Ya existe un elemento duplicado';
  if (msg.includes('violates foreign key')) return 'Referencia a un registro que no existe';
  if (msg.includes('violates check constraint')) return 'Valor fuera de rango permitido';
  return 'Error al guardar en la base de datos';
}

// ---------------------------------------------------------------------------
// List all navigation items (optionally by menu)
// ---------------------------------------------------------------------------

export async function listNavigation(menuSlug?: string) {
  let query = supabase
    .from('navegacion')
    .select('id, menu_slug, parent_id, tipo, referencia, orden, visible')
    .order('menu_slug')
    .order('orden');

  if (menuSlug) query = query.eq('menu_slug', menuSlug);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data || [];
  if (rows.length === 0) return [];

  // Batch-fetch all labels in 1 query (fix N+1)
  const ids = rows.map((r) => r.id);
  const { data: translations } = await supabase
    .from('traduccion')
    .select('entidad_id, idioma, valor')
    .eq('entidad_tipo', 'navegacion')
    .eq('campo', 'label')
    .in('entidad_id', ids);

  const labelMap: Record<string, Record<string, string>> = {};
  for (const t of translations || []) {
    if (!labelMap[t.entidad_id]) labelMap[t.entidad_id] = {};
    labelMap[t.entidad_id][t.idioma] = t.valor;
  }

  return rows.map((r) => ({
    id: r.id,
    menuSlug: r.menu_slug,
    parentId: r.parent_id,
    tipo: r.tipo,
    referencia: r.referencia,
    orden: r.orden,
    visible: r.visible,
    label: labelMap[r.id] || {},
  }));
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createNavItem(input: CreateNavInput) {
  validateNavInput(input, true);

  const { data, error } = await supabase
    .from('navegacion')
    .insert({
      menu_slug: input.menu_slug,
      parent_id: input.parent_id || null,
      tipo: input.tipo,
      referencia: input.referencia || null,
      orden: input.orden ?? 0,
      visible: input.visible ?? true,
    })
    .select()
    .single();

  if (error) throw new AppError(400, sanitizeDbError(error.message));

  await saveTranslations(data.id, input.label);

  return {
    id: data.id,
    menuSlug: data.menu_slug,
    parentId: data.parent_id,
    tipo: data.tipo,
    referencia: data.referencia,
    orden: data.orden,
    visible: data.visible,
    label: input.label,
  };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateNavItem(id: string, input: Partial<CreateNavInput>) {
  validateNavInput(input);

  const updates: Record<string, unknown> = {};
  if (input.menu_slug !== undefined) updates.menu_slug = input.menu_slug;
  if (input.parent_id !== undefined) updates.parent_id = input.parent_id || null;
  if (input.tipo !== undefined) updates.tipo = input.tipo;
  if (input.referencia !== undefined) updates.referencia = input.referencia || null;
  if (input.orden !== undefined) updates.orden = input.orden;
  if (input.visible !== undefined) updates.visible = input.visible;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('navegacion').update(updates).eq('id', id);
    if (error) throw new AppError(400, sanitizeDbError(error.message));
  }

  if (input.label) {
    await saveTranslations(id, input.label);
  }

  return { id, ...updates, label: input.label };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteNavItem(id: string) {
  const { data: children } = await supabase
    .from('navegacion')
    .select('id')
    .eq('parent_id', id);

  if (children && children.length > 0) {
    throw new AppError(400, 'No se puede eliminar un elemento con hijos. Elimina los hijos primero.');
  }

  await supabase.from('traduccion').delete().eq('entidad_tipo', 'navegacion').eq('entidad_id', id);

  const { error } = await supabase.from('navegacion').delete().eq('id', id);
  if (error) throw new AppError(400, sanitizeDbError(error.message));

  return { deleted: true };
}

// ---------------------------------------------------------------------------
// Bulk reorder a menu (optimized: parallel updates)
// ---------------------------------------------------------------------------

export async function reorderMenu(menuSlug: string, items: { id: string; orden: number }[]) {
  await Promise.all(
    items.map((item) =>
      supabase.from('navegacion').update({ orden: item.orden }).eq('id', item.id).eq('menu_slug', menuSlug),
    ),
  );
  return { reordered: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function saveTranslations(navId: string, label: Record<string, string>) {
  for (const [lang, value] of Object.entries(label)) {
    if (!value) continue;
    await supabase
      .from('traduccion')
      .upsert(
        {
          entidad_tipo: 'navegacion',
          entidad_id: navId,
          campo: 'label',
          idioma: lang,
          valor: value,
        },
        { onConflict: 'entidad_tipo,entidad_id,campo,idioma' },
      );
  }
}
