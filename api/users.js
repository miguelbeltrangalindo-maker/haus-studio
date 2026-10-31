import { adminClient, requireStaff } from './_auth.js'

// Administración de usuarios del estudio (solo admin).
//   GET                                   → lista
//   POST   { email, password, nombre, rol } → crea
//   PATCH  { id, nombre?, rol?, password? } → edita
//   DELETE { id }                          → elimina
export default async function handler(req, res) {
  const supabase = adminClient()
  const auth = await requireStaff(req, supabase, { requireAdmin: true })
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  const me = auth.user.id
  const body = req.body || {}
  const ROLES = ['admin', 'operador']

  const adminCount = async () => {
    const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('rol', 'admin')
    return count || 0
  }

  try {
    if (req.method === 'GET') {
      const { data: profiles, error } = await supabase.from('profiles').select('id, nombre, rol, created_at').order('created_at')
      if (error) return res.status(500).json({ error: error.message })
      const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      const byId = Object.fromEntries((list?.users || []).map(u => [u.id, u]))
      return res.status(200).json({
        users: profiles.map(p => ({
          ...p,
          email: byId[p.id]?.email || '',
          last_sign_in_at: byId[p.id]?.last_sign_in_at || null,
        })),
      })
    }

    if (req.method === 'POST') {
      const email    = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      const nombre   = String(body.nombre || '').trim()
      const rol      = ROLES.includes(body.rol) ? body.rol : 'operador'
      if (!email.includes('@'))  return res.status(400).json({ error: 'Correo inválido' })
      if (password.length < 8)   return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' })
      if (!nombre)               return res.status(400).json({ error: 'El nombre es requerido' })

      const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true })
      if (error) {
        const msg = /already|registered|exists/i.test(error.message) ? 'Ya existe un usuario con ese correo' : error.message
        return res.status(400).json({ error: msg })
      }
      const { error: pErr } = await supabase.from('profiles').insert({ id: data.user.id, nombre, rol })
      if (pErr) {
        await supabase.auth.admin.deleteUser(data.user.id)
        return res.status(500).json({ error: pErr.message })
      }
      return res.status(200).json({ user: { id: data.user.id, email, nombre, rol } })
    }

    if (req.method === 'PATCH') {
      const { id } = body
      if (!id) return res.status(400).json({ error: 'id requerido' })
      const updates = {}
      if (body.nombre !== undefined) updates.nombre = String(body.nombre).trim()
      if (body.rol !== undefined) {
        if (!ROLES.includes(body.rol)) return res.status(400).json({ error: 'Rol inválido' })
        if (body.rol !== 'admin') {
          const { data: target } = await supabase.from('profiles').select('rol').eq('id', id).maybeSingle()
          if (target?.rol === 'admin' && (await adminCount()) <= 1) {
            return res.status(400).json({ error: 'Debe quedar al menos un administrador' })
          }
        }
        updates.rol = body.rol
      }
      if (Object.keys(updates).length) {
        const { error } = await supabase.from('profiles').update(updates).eq('id', id)
        if (error) return res.status(500).json({ error: error.message })
      }
      if (body.password) {
        if (String(body.password).length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' })
        const { error } = await supabase.auth.admin.updateUserById(id, { password: String(body.password) })
        if (error) return res.status(500).json({ error: error.message })
      }
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'DELETE') {
      const { id } = body
      if (!id) return res.status(400).json({ error: 'id requerido' })
      if (id === me) return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' })
      const { error } = await supabase.auth.admin.deleteUser(id) // profiles se borra en cascada
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('users api error:', err.message)
    return res.status(500).json({ error: 'Error del servidor' })
  }
}
