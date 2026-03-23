import { supabase } from '../db/supabase.js';
import { AppError } from '../middleware/error-handler.js';

const BUCKET = 'media';

// ---------------------------------------------------------------------------
// Upload document
// ---------------------------------------------------------------------------

export async function uploadDocument(
  entidadTipo: string,
  entidadId: string,
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  nombre?: Record<string, string>,
) {
  const ext = file.originalname.split('.').pop() || 'bin';
  const path = `documentos/${entidadTipo}/${entidadId}/${Date.now()}.${ext}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadError) throw new AppError(400, `Upload failed: ${uploadError.message}`);

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  // Get current max order
  const { data: existing } = await supabase
    .from('documento_descargable')
    .select('orden')
    .eq('entidad_tipo', entidadTipo)
    .eq('entidad_id', entidadId)
    .order('orden', { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.orden ?? -1) + 1;

  const { data, error } = await supabase
    .from('documento_descargable')
    .insert({
      entidad_tipo: entidadTipo,
      entidad_id: entidadId,
      url: urlData.publicUrl,
      storage_path: path,
      nombre: nombre || {},
      mime_type: file.mimetype,
      size_bytes: file.size,
      orden: nextOrder,
    })
    .select()
    .single();

  if (error) throw new AppError(400, error.message);
  return data;
}

// ---------------------------------------------------------------------------
// List documents for an entity
// ---------------------------------------------------------------------------

export async function listDocuments(entidadTipo: string, entidadId: string) {
  const { data, error } = await supabase
    .from('documento_descargable')
    .select('*')
    .eq('entidad_tipo', entidadTipo)
    .eq('entidad_id', entidadId)
    .order('orden');

  if (error) throw error;
  return data || [];
}

// ---------------------------------------------------------------------------
// Update document metadata
// ---------------------------------------------------------------------------

export async function updateDocument(id: string, input: { nombre?: Record<string, string>; orden?: number }) {
  const update: Record<string, unknown> = {};
  if (input.nombre !== undefined) update.nombre = input.nombre;
  if (input.orden !== undefined) update.orden = input.orden;

  const { data, error } = await supabase
    .from('documento_descargable')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(400, error.message);
  if (!data) throw new AppError(404, 'Document not found');

  return data;
}

// ---------------------------------------------------------------------------
// Delete document
// ---------------------------------------------------------------------------

export async function deleteDocument(id: string) {
  const { data: doc, error: fetchError } = await supabase
    .from('documento_descargable')
    .select('storage_path')
    .eq('id', id)
    .single();

  if (fetchError || !doc) throw new AppError(404, 'Document not found');

  if (doc.storage_path) {
    await supabase.storage.from(BUCKET).remove([doc.storage_path]);
  }

  const { error } = await supabase
    .from('documento_descargable')
    .delete()
    .eq('id', id);

  if (error) throw new AppError(400, error.message);
  return { deleted: true };
}
