import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const friendly = (msg = '') => {
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos'
  if (/email not confirmed/i.test(msg))       return 'Este usuario aún no está confirmado'
  if (/fetch|network/i.test(msg))             return 'Sin conexión — intenta de nuevo'
  return msg || 'No se pudo iniciar sesión'
}

function Shell({ children }) {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="logo-name" style={{ margin: '0 auto' }}>HAUS</div>
        <div className="logo-sub" style={{ textAlign: 'center', marginBottom: 28 }}>Studio System</div>
        {children}
      </div>
    </div>
  )
}

export function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [busy, setBusy]         = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) { setError('Escribe tu correo y contraseña'); return }
    setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(friendly(error.message))
  }

  return (
    <Shell>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-group">
          <label className="form-label" htmlFor="login-email">Correo</label>
          <input id="login-email" className="form-input" type="email" autoComplete="username"
            inputMode="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="login-pass">Contraseña</label>
          <input id="login-pass" className="form-input" type="password" autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && <div className="login-error" role="alert">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ marginTop: 6 }}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </Shell>
  )
}

// Decide qué mostrar según el estado de la sesión; children = la app
export function AuthGate({ children }) {
  const { session, profileStatus, signOut, user } = useAuth()

  if (session === undefined || (session && ['idle', 'loading'].includes(profileStatus))) {
    return <div className="login-wrap"><div className="loading">Cargando…</div></div>
  }
  if (!session) return <Login />

  if (profileStatus !== 'ok') {
    const msg = {
      'missing':  `El usuario ${user?.email || ''} no tiene acceso al estudio. Pide al administrador que te dé de alta.`,
      'no-table': 'Falta correr la migración supabase/auth_1_perfiles.sql en Supabase.',
      'error':    'No se pudo cargar tu perfil — revisa tu conexión.',
    }[profileStatus]
    return (
      <Shell>
        <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, textAlign: 'center', marginBottom: 20 }}>{msg}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {profileStatus === 'error' && <button className="btn" onClick={() => window.location.reload()}>Reintentar</button>}
          <button className="btn btn-ghost" onClick={signOut}>Cerrar sesión</button>
        </div>
      </Shell>
    )
  }
  return children
}
