import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { useConfirm } from '../components/ConfirmDialog'

const ROL_LABEL = { admin: 'Administrador', operador: 'Operador' }

// Mi cuenta: nombre, rol, cambiar contraseña y cerrar sesión. Lo ven todos los roles.
export function CuentaCard() {
  const { user, profile, signOut } = useAuth()
  const toast = useToast()
  const [pass, setPass]   = useState('')
  const [busy, setBusy]   = useState(false)

  const changePass = async () => {
    if (pass.length < 8) { toast('La contraseña debe tener al menos 8 caracteres', 'error'); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pass })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    setPass('')
    toast('Contraseña actualizada', 'success')
  }

  return (
    <div className="config-section">
      <div className="config-title">Mi cuenta</div>
      <div className="user-row" style={{ borderBottom: 'none', paddingTop: 0 }}>
        <div className="user-row-info">
          <div className="user-row-name">{profile?.nombre || 'Sin nombre'}</div>
          <div className="user-row-meta">{user?.email}</div>
        </div>
        <span className={`role-pill ${profile?.rol === 'admin' ? 'admin' : ''}`}>{ROL_LABEL[profile?.rol] || profile?.rol}</span>
      </div>
      <div className="form-group" style={{ marginTop: 8 }}>
        <label className="form-label">Nueva contraseña</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-input" type="password" autoComplete="new-password" value={pass}
            onChange={e => setPass(e.target.value)} placeholder="Mínimo 8 caracteres" />
          <button className="btn btn-sm" onClick={changePass} disabled={busy || !pass}>
            {busy ? '…' : 'Cambiar'}
          </button>
        </div>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={signOut} style={{ marginTop: 16, width: '100%' }}>
        Cerrar sesión
      </button>
    </div>
  )
}

// Alta y administración de usuarios — solo admin (la API también lo exige)
export function UsuariosSection() {
  const { authFetch, user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [users, setUsers]   = useState(null)
  const [form, setForm]     = useState({ nombre: '', email: '', password: '', rol: 'operador' })
  const [saving, setSaving] = useState(false)
  const [passFor, setPassFor] = useState(null) // id del usuario al que se le cambia la clave
  const [newPass, setNewPass] = useState('')

  const call = useCallback(async (method, body) => {
    try {
      const res  = await authFetch('/api/users', { method, ...(body ? { body: JSON.stringify(body) } : {}) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return { error: data.error || `Error ${res.status}` }
      return data
    } catch { return { error: 'Sin conexión' } }
  }, [authFetch])

  const load = useCallback(async () => {
    const r = await call('GET')
    if (r.error) { toast(r.error, 'error'); setUsers([]); return }
    setUsers(r.users)
  }, [call, toast])

  useEffect(() => { load() }, [load])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const create = async () => {
    if (!form.nombre.trim()) { toast('Escribe el nombre', 'error'); return }
    if (!form.email.includes('@')) { toast('Correo inválido', 'error'); return }
    if (form.password.length < 8) { toast('La contraseña debe tener al menos 8 caracteres', 'error'); return }
    setSaving(true)
    const r = await call('POST', form)
    setSaving(false)
    if (r.error) { toast(r.error, 'error'); return }
    toast(`Usuario ${form.nombre.trim()} creado`, 'success')
    setForm({ nombre: '', email: '', password: '', rol: 'operador' })
    load()
  }

  const changeRol = async (u, rol) => {
    const r = await call('PATCH', { id: u.id, rol })
    if (r.error) { toast(r.error, 'error'); return }
    toast(`${u.nombre} ahora es ${ROL_LABEL[rol].toLowerCase()}`, 'success')
    load()
  }

  const resetPass = async (u) => {
    if (newPass.length < 8) { toast('La contraseña debe tener al menos 8 caracteres', 'error'); return }
    const r = await call('PATCH', { id: u.id, password: newPass })
    if (r.error) { toast(r.error, 'error'); return }
    toast(`Contraseña de ${u.nombre} actualizada`, 'success')
    setPassFor(null); setNewPass('')
  }

  const remove = async (u) => {
    const ok = await confirm({
      title: `Eliminar a ${u.nombre}`,
      message: `${u.email}\n\nYa no podrá entrar al sistema. Las sesiones y cobros que registró se conservan.`,
      confirmLabel: 'Eliminar usuario',
      destructive: true,
    })
    if (!ok) return
    const r = await call('DELETE', { id: u.id })
    if (r.error) { toast(r.error, 'error'); return }
    toast('Usuario eliminado')
    load()
  }

  return (
    <div className="config-section">
      <div className="config-title">Usuarios</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12, lineHeight: 1.5 }}>
        El <strong>operador</strong> agenda, cobra y gestiona sesiones, pero no entra a Configuración,
        no aplica descuentos y no edita ni borra cobros (solo puede deshacer su cobro en los primeros 10 min).
      </div>

      {users === null ? <div className="loading">Cargando…</div> : users.map(u => (
        <div key={u.id}>
        <div className="user-row">
          <div className="user-row-info">
            <div className="user-row-name">{u.nombre}{u.id === user?.id ? ' (tú)' : ''}</div>
            <div className="user-row-meta">{u.email}</div>
          </div>
          <select className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
            value={u.rol} onChange={e => changeRol(u, e.target.value)}>
            <option value="operador">Operador</option>
            <option value="admin">Administrador</option>
          </select>
          {u.id !== user?.id && (
            <>
              <button className="btn btn-ghost btn-xs" onClick={() => { setPassFor(passFor === u.id ? null : u.id); setNewPass('') }} title="Cambiar contraseña">Clave</button>
              <button className="btn btn-ghost btn-xs" onClick={() => remove(u)} title="Eliminar" style={{ color: 'var(--red-l)' }}>×</button>
            </>
          )}
        </div>
        {passFor === u.id && (
          <div style={{ display: 'flex', gap: 8, padding: '0 0 12px' }}>
            <input className="form-input" type="text" autoComplete="off" autoFocus value={newPass}
              onChange={e => setNewPass(e.target.value)} placeholder={`Nueva contraseña para ${u.nombre}`} />
            <button className="btn btn-sm btn-primary" onClick={() => resetPass(u)}>Guardar</button>
          </div>
        )}
        </div>
      ))}

      <div className="modal-section-title" style={{ marginTop: 18 }}>Nuevo usuario</div>
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Nombre</label>
          <input className="form-input" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ana" />
        </div>
        <div className="form-group">
          <label className="form-label">Correo</label>
          <input className="form-input" type="email" autoComplete="off" value={form.email} onChange={e => set('email', e.target.value)} placeholder="ana@correo.com" />
        </div>
        <div className="form-group">
          <label className="form-label">Contraseña inicial</label>
          <input className="form-input" type="text" autoComplete="off" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Mínimo 8 caracteres" />
        </div>
        <div className="form-group">
          <label className="form-label">Rol</label>
          <select className="form-input" value={form.rol} onChange={e => set('rol', e.target.value)}>
            <option value="operador">Operador</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
      </div>
      <button className="btn btn-primary btn-sm" onClick={create} disabled={saving} style={{ marginTop: 12 }}>
        {saving ? 'Creando…' : 'Crear usuario'}
      </button>
    </div>
  )
}

// Página de Configuración para el operador: solo su cuenta
export default function Cuenta() {
  return (
    <>
      <div className="topbar"><div className="topbar-title">Mi cuenta</div></div>
      <div className="page-content"><div style={{ maxWidth: 640 }}><CuentaCard /></div></div>
    </>
  )
}
