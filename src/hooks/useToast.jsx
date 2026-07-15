import { createContext, useContext, useState, useCallback, useRef } from 'react'

const ToastCtx = createContext(null)

// Translate raw Supabase / Postgres / network errors to operator-friendly Spanish
function humanize(raw) {
  if (raw == null) return 'Algo salió mal'
  const msg = typeof raw === 'string' ? raw : (raw?.message || String(raw))
  const m = msg.toLowerCase()

  // Network / fetch
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) {
    return 'Sin conexión — revisa internet e intenta de nuevo'
  }
  // Auth
  if (m.includes('jwt') || m.includes('expired') || m.includes('not authenticated')) {
    return 'Sesión caducada — recarga la app'
  }
  if (m.includes('row-level security') || m.includes('rls')) {
    return 'No tienes permiso para esa acción'
  }
  // Schema
  if (m.includes('schema cache') || m.includes('does not exist') || (m.includes('column') && m.includes('exist'))) {
    return 'La base aún se está actualizando — recarga en un momento'
  }
  // Constraints
  if (m.includes('duplicate key') || m.includes('unique constraint') || m.includes('23505')) {
    return 'Ya existe un registro con esos datos'
  }
  if (m.includes('foreign key') || m.includes('23503')) {
    return 'No se puede borrar: hay registros vinculados'
  }
  if (m.includes('not null') || m.includes('null value')) {
    return 'Falta un campo obligatorio'
  }
  if (m.includes('check constraint') || m.includes('invalid input')) {
    return 'Algún dato no tiene el formato correcto'
  }
  // Rate limit / size
  if (m.includes('rate limit') || m.includes('429')) {
    return 'Demasiadas peticiones — espera un momento'
  }
  if (m.includes('payload') && m.includes('large')) {
    return 'El contenido es demasiado grande'
  }
  // If it already looks like a human message (Spanish, no SQL noise), keep it
  const looksHuman = !/(\bfk\b|\bcolumn\b|\btable\b|\bpostgres\b|\bsql\b|"\w+_\w+"|::|relation)/i.test(msg)
  if (looksHuman && msg.length < 140) return msg
  return 'No se pudo completar la acción — intenta de nuevo'
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ msg: '', type: '', show: false, action: null })
  const timerRef = useRef(null)

  // opts.action = { label, onClick } — muestra un botón (p. ej. "Deshacer") y extiende la duración
  const show = useCallback((rawMsg, type = '', opts = {}) => {
    const msg = type === 'error' ? humanize(rawMsg) : (typeof rawMsg === 'string' ? rawMsg : String(rawMsg ?? ''))
    const action = opts.action || null
    setToast({ msg, type, show: true, action })
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(
      () => setToast(t => ({ ...t, show: false })),
      opts.duration ?? (action ? 6000 : 3000),
    )
  }, [])

  const runAction = async () => {
    const a = toast.action
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(t => ({ ...t, show: false }))
    try {
      const result = await a.onClick()
      if (result?.error) show(result.error, 'error')
    } catch { show('No se pudo deshacer', 'error') }
  }

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className={`toast ${toast.type} ${toast.show ? 'show' : ''}`} role="status" aria-live="polite">
        <span>{toast.msg}</span>
        {toast.action && (
          <button className="toast-action" onClick={runAction}>
            {toast.action.label}
          </button>
        )}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
