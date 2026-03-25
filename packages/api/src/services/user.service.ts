import { supabase } from '../db/supabase.js';
import { AppError } from '../middleware/error-handler.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const VALID_ROLES = ['admin', 'editor', 'validador', 'tecnico', 'analitica'] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface UserInput {
  email: string;
  nombre: string;
  rol: typeof VALID_ROLES[number];
  activo?: boolean;
}

function validateUserInput(input: Partial<UserInput>, isCreate = false) {
  const errors: string[] = [];
  if (isCreate && !input.email) errors.push('email es obligatorio');
  if (isCreate && !input.nombre) errors.push('nombre es obligatorio');
  if (input.email !== undefined && !EMAIL_RE.test(input.email)) errors.push('formato de email invalido');
  if (input.rol !== undefined && !VALID_ROLES.includes(input.rol)) errors.push(`rol invalido: ${input.rol}`);
  if (input.nombre !== undefined && input.nombre.length > 200) errors.push('nombre demasiado largo (max 200)');
  if (errors.length > 0) throw new AppError(400, errors.join('; '));
}

function sanitizeDbError(msg: string): string {
  if (msg.includes('duplicate key') && msg.includes('email')) return 'Ya existe un usuario con ese email';
  if (msg.includes('duplicate key')) return 'Ya existe un registro duplicado';
  if (msg.includes('violates foreign key')) return 'Referencia a un registro que no existe';
  if (msg.includes('violates check constraint')) return 'Valor fuera de rango permitido';
  return 'Error al guardar en la base de datos';
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
  validateUserInput(input, true);

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

  if (error) throw new AppError(error.code === '23505' ? 409 : 400, sanitizeDbError(error.message));

  return data;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateUser(id: string, input: Partial<UserInput>) {
  validateUserInput(input);

  const update: Record<string, unknown> = {};
  if (input.email !== undefined) update.email = input.email;
  if (input.nombre !== undefined) update.nombre = input.nombre;
  if (input.rol !== undefined) update.rol = input.rol;
  if (input.activo !== undefined) update.activo = input.activo;

  const { data, error } = await supabase
    .from('usuario')
    .update(update)
    .eq('id', id)
    .select('id, email, nombre, rol, activo, created_at, updated_at')
    .single();

  if (error) throw new AppError(400, sanitizeDbError(error.message));
  if (!data) throw new AppError(404, 'Usuario no encontrado');

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

  if (error) throw new AppError(400, sanitizeDbError(error.message));
  return { deleted: true };
}
