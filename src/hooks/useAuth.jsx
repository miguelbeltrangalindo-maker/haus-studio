import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthCtx = createContext(null)

// session: undefined = cargando · null = sin sesión · objeto = sesión activa
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [profileStatus, setProfileStatus] = useState('idle') // idle | loading | ok | missing | no-table | error

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) { setProfile(null); setProfileStatus('idle'); return }
    let cancelled = false
    setProfileStatus('loading')
    supabase.from('profiles').select('id, nombre, rol').eq('id', userId).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { setProfileStatus(error.code === '42P01' ? 'no-table' : 'error'); return }
        if (!data) { setProfileStatus('missing'); return }
        setProfile(data)
        setProfileStatus('ok')
      })
    return () => { cancelled = true }
  }, [userId])

  const signOut = useCallback(() => supabase.auth.signOut(), [])

  // fetch a /api con el token del usuario
  const authFetch = useCallback(async (url, opts = {}) => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return window.fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  }, [])

  const value = {
    session, user: session?.user || null, profile, profileStatus,
    isAdmin: profile?.rol === 'admin',
    signOut, authFetch,
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
