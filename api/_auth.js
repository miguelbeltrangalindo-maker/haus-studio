import { createClient } from '@supabase/supabase-js'

// Archivos con "_" en /api no se publican como ruta en Vercel: esto es solo un helper.

export const adminClient = () => createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

/**
 * Valida el token del usuario (Authorization: Bearer <access_token>) y devuelve
 * { user, profile } o { status, error }. Con requireAdmin exige rol admin.
 */
export async function requireStaff(req, supabase, { requireAdmin = false } = {}) {
  const header = req.headers['authorization'] || ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return { status: 401, error: 'Inicia sesión' }

  const { data: { user } = {}, error } = await supabase.auth.getUser(token)
  if (error || !user) return { status: 401, error: 'Sesión inválida o vencida' }

  const { data: profile } = await supabase.from('profiles').select('id, nombre, rol').eq('id', user.id).maybeSingle()
  if (!profile) return { status: 403, error: 'Tu usuario no tiene acceso al estudio' }
  if (requireAdmin && profile.rol !== 'admin') return { status: 403, error: 'Solo el administrador puede hacer esto' }

  return { user, profile }
}
