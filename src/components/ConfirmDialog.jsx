import { createContext, useCallback, useContext, useState, useRef, useEffect } from 'react'

const ConfirmCtx = createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const resolverRef = useRef(null)

  const confirm = useCallback((opts = {}) => {
    return new Promise(resolve => {
      resolverRef.current = resolve
      setState({
        title: opts.title || '¿Continuar?',
        message: opts.message || '',
        confirmLabel: opts.confirmLabel || 'Continuar',
        cancelLabel: opts.cancelLabel || 'Cancelar',
        destructive: !!opts.destructive,
      })
    })
  }, [])

  const close = (value) => {
    if (resolverRef.current) {
      resolverRef.current(value)
      resolverRef.current = null
    }
    setState(null)
  }

  useEffect(() => {
    if (!state) return
    const onKey = (e) => {
      if (e.key === 'Escape') close(false)
      if (e.key === 'Enter') close(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="modal-overlay"
          onClick={e => e.target === e.currentTarget && close(false)}
        >
          <div
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            style={{ maxWidth: 420, padding: '28px 28px 22px' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              id="confirm-title"
              className="modal-title"
              style={{ fontSize: 22, marginBottom: 12 }}
            >
              {state.title}
            </div>
            {state.message && (
              <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 24, whiteSpace: 'pre-line' }}>
                {state.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => close(false)}
              >
                {state.cancelLabel}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${state.destructive ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => close(true)}
                autoFocus
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmCtx)
