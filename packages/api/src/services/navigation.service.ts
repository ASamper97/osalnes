import { supabase } from '../db/supabase.js';
import { AppError } from '../middleware/error-handler.js';
import { getTranslatedField } from './translation.service.js';

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

  return Promise.all(
    (data || []).map(async (r) => ({
      id: r.id,
      menuSlug: r.menu_slug,
      parentId: r.parent_id,
      tipo: r.tipo,
      referencia: r.referencia,
      orden: r.orden,
      visible: r.visible,
      label: await getTranslatedField('navegacion', r.id, 'label'),
    })),
  );
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

interface CreateNavInput {
  menu_slug: string;
  parent_id?: string | null;
  tipo: string;
  referencia?: string | null;
  orden?: number;
  visible?: boolean;
  label: { es?: string; gl?: string };
}

export async function createNavItem(input: CreateNavInput) {
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

  if (error) throw new AppError(400, error.message);

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
  const updates: Record<string, unknown> = {};
  if (input.menu_slug !== undefined) updates.menu_slug = input.menu_slug;
  if (input.parent_id !== undefined) updates.parent_id = input.parent_id || null;
  if (input.tipo !== undefined) updates.tipo = input.tipo;
  if (input.referencia !== undefined) updates.referencia = input.referencia || null;
  if (input.orden !== undefined) updates.orden = input.orden;
  if (input.visible !== undefined) updates.visible = input.visible;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('navegacion').update(updates).eq('id', id);
    if (error) throw new AppError(400, error.message);
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
  // Remove children first
  const { data: children } = await supabase
    .from('navegacion')
    .select('id')
    .eq('parent_id', id);

  if (children && children.length > 0) {
    throw new AppError(400, 'Cannot delete navigation item with children. Delete children first.');
  }

  await supabase.from('traduccion').delete().eq('entidad_tipo', 'navegacion').eq('entidad_id', id);

  const { error } = await supabase.from('navegacion').delete().eq('id', id);
  if (error) throw new AppError(400, error.message);

  return { deleted: true };
}

// ---------------------------------------------------------------------------
// Bulk reorder a menu
// ---------------------------------------------------------------------------

export async function reorderMenu(menuSlug: string, items: { id: string; orden: number }[]) {
  for (const item of items) {
    await supabase.from('navegacion').update({ orden: item.orden }).eq('id', item.id).eq('menu_slug', menuSlug);
  }
  return { reordered: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function saveTranslations(navId: string, label: { es?: string; gl?: string }) {
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
