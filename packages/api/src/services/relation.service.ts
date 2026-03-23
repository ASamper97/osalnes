import { supabase } from '../db/supabase.js';
import { AppError } from '../middleware/error-handler.js';
import { getTranslatedField } from './translation.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RelationInput {
  recurso_origen: string;
  recurso_destino: string;
  tipo_relacion: string;
  orden?: number;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// List relations for a resource
// ---------------------------------------------------------------------------

export async function listRelations(recursoId: string) {
  const { data, error } = await supabase
    .from('relacion_recurso')
    .select('id, recurso_origen, recurso_destino, tipo_relacion, orden, metadata, created_at')
    .or(`recurso_origen.eq.${recursoId},recurso_destino.eq.${recursoId}`)
    .order('orden');

  if (error) throw error;

  // Enrich with resource names
  return Promise.all(
    (data || []).map(async (r) => {
      const relatedId = r.recurso_origen === recursoId ? r.recurso_destino : r.recurso_origen;
      return {
        id: r.id,
        recursoOrigen: r.recurso_origen,
        recursoDestino: r.recurso_destino,
        tipoRelacion: r.tipo_relacion,
        orden: r.orden,
        metadata: r.metadata,
        createdAt: r.created_at,
        relatedResourceName: await getTranslatedField('recurso_turistico', relatedId, 'name'),
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createRelation(input: RelationInput) {
  if (input.recurso_origen === input.recurso_destino) {
    throw new AppError(400, 'Un recurso no puede relacionarse consigo mismo');
  }

  const { data, error } = await supabase
    .from('relacion_recurso')
    .insert({
      recurso_origen: input.recurso_origen,
      recurso_destino: input.recurso_destino,
      tipo_relacion: input.tipo_relacion,
      orden: input.orden ?? 0,
      metadata: input.metadata || {},
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'Esta relacion ya existe');
    }
    throw new AppError(400, error.message);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateRelation(id: string, input: Partial<RelationInput>) {
  const update: Record<string, unknown> = {};
  if (input.tipo_relacion !== undefined) update.tipo_relacion = input.tipo_relacion;
  if (input.orden !== undefined) update.orden = input.orden;
  if (input.metadata !== undefined) update.metadata = input.metadata;

  const { data, error } = await supabase
    .from('relacion_recurso')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(400, error.message);
  if (!data) throw new AppError(404, 'Relation not found');

  return data;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteRelation(id: string) {
  const { error } = await supabase
    .from('relacion_recurso')
    .delete()
    .eq('id', id);

  if (error) throw new AppError(400, error.message);
  return { deleted: true };
}
