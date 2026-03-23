import { supabase } from '../db/supabase.js';
import { AppError } from '../middleware/error-handler.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const VALID_ROLES = ['admin', 'editor', 'validador', 'tecnico', 'analitica'] as const;

interface UserInput {
  email: string;
  nombre: string;
  rol: typeof VALID_ROLES[number];
  activo?: boolean;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listUsers() {
  const { data, error } = await supabase
    .from('usuario')
    .select('id, email, nombre, rol, activo, created_at, updated_at')
    .order('nombre');

  if (error) throw error;
  return data || [];
}

// ---------------------------------------------------------------------------
// Get by ID
// ---------------------------------------------------------------------------

export async function getUserById(id: string) {
  const { data, error } = await supabase
    .from('usuario')
    .select('id, email, nombre, rol, activo, created_at, updated_at')
    .eq('id', id)
    .single();

  if (error || !data) throw new AppError(404, 'User not found');
  return data;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createUser(input: UserInput) {
  if (!VALID_ROLES.includes(input.rol)) {
    throw new AppError(400, `Rol invalido: ${input.rol}. Validos: ${VALID_ROLES.join(', ')}`);
  }

  const { data, error } = await supabase
    .from('usuario')
    .insert({
      email: input.email,
      nombre: input.nombre,
      rol: input.rol,
      activo: input.activo ?? true,
    })
    .select('id, email, nombre, rol, activo, created_at, updated_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'Ya existe un usuario con ese email');
    }
    throw new AppError(400, error.message);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateUser(id: string, input: Partial<UserInput>) {
  const update: Record<string, unknown> = {};
  if (input.email !== undefined) update.email = input.email;
  if (input.nombre !== undefined) update.nombre = input.nombre;
  if (input.rol !== undefined) {
    if (!VALID_ROLES.includes(input.rol)) {
      throw new AppError(400, `Rol invalido: ${input.rol}`);
    }
    update.rol = input.rol;
  }
  if (input.activo !== undefined) update.activo = input.activo;

  const { data, error } = await supabase
    .from('usuario')
    .update(update)
    .eq('id', id)
    .select('id, email, nombre, rol, activo, created_at, updated_at')
    .single();

  if (error) throw new AppError(400, error.message);
  if (!data) throw new AppError(404, 'User not found');

  return data;
}

// ---------------------------------------------------------------------------
// Delete (soft — set activo=false)
// ---------------------------------------------------------------------------

export async function deleteUser(id: string) {
  const { error } = await supabase
    .from('usuario')
    .update({ activo: false })
    .eq('id', id);

  if (error) throw new AppError(400, error.message);
  return { deleted: true };
}
