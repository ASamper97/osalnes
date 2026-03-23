import { supabase } from '../db/supabase.js';
import { AppError } from '../middleware/error-handler.js';

const BUCKET = 'media';

/**
 * Upload a file to Supabase Storage and create the DB record.
 */
export async function uploadAsset(
  entidadTipo: string,
  entidadId: string,
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  tipo: 'imagen' | 'video' | 'audio' = 'imagen',
) {
  const ext = file.originalname.split('.').pop() || 'bin';
  const path = `${entidadTipo}/${entidadId}/${Date.now()}.${ext}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadError) throw new AppError(400, `Upload failed: ${uploadError.message}`);

  // Get public URL
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  // Get current max order
  const { data: existing } = await supabase
    .from('asset_multimedia')
    .select('orden')
    .eq('entidad_tipo', entidadTipo)
    .eq('entidad_id', entidadId)
    .order('orden', { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.orden ?? -1) + 1;

  // Insert DB record
  const { data, error } = await supabase
    .from('asset_multimedia')
    .insert({
      entidad_tipo: entidadTipo,
      entidad_id: entidadId,
      tipo,
      url: urlData.publicUrl,
      storage_path: path,
      mime_type: file.mimetype,
      size_bytes: file.size,
      orden: nextOrder,
    })
    .select()
    .single();

  if (error) throw new AppError(400, error.message);

  return data;
}

/**
 * List all media assets for an entity.
 */
export async function listAssets(entidadTipo: string, entidadId: string) {
  const { data, error } = await supabase
    .from('asset_multimedia')
    .select('*')
    .eq('entidad_tipo', entidadTipo)
    .eq('entidad_id', entidadId)
    .order('orden');

  if (error) throw error;
  return data || [];
}

/**
 * Delete a media asset from Storage and DB.
 */
export async function deleteAsset(assetId: string) {
  const { data: asset, error: fetchError } = await supabase
    .from('asset_multimedia')
    .select('storage_path')
    .eq('id', assetId)
    .single();

  if (fetchError || !asset) throw new AppError(404, 'Asset not found');

  // Delete from storage
  if (asset.storage_path) {
    await supabase.storage.from(BUCKET).remove([asset.storage_path]);
  }

  // Delete DB record
  const { error } = await supabase
    .from('asset_multimedia')
    .delete()
    .eq('id', assetId);

  if (error) throw new AppError(400, error.message);
  return { deleted: true };
}
