import { useState, useEffect, useMemo, useRef } from 'react'
import { fmtDate, initials } from '../lib/utils'
import Badge from './Badge'

export default function GlobalSearch({ sessions = [], onSelect, onClose }) {
  const [q, setQ] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 60)
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(id); window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return []
    const digits = q.replace(/\D/g, '')
    return sessions
      .filter(s =>
        s.nombre?.toLowerCase().includes(query) ||
        (digits.length >= 3 && s.telefono?.includes(digits))
      )
      .sort((a, b) => (a.fecha + (a.hora || '')) < (b.fecha + (b.hora || '')) ? 1 : -1)
      .slice(0, 10)
  }, [sessions, q])

  return (
    <div className="modal-overlay gs-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="gs-panel" role="dialog" aria-modal="true" aria-label="Búsqueda global">
        <input
          ref={inputRef}
          className="gs-input"
          placeholder="Buscar cliente o teléfono…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <div className="gs-results">
          {!q.trim() ? (
            <div className="gs-empty">Escribe un nombre o teléfono</div>
          ) : results.length === 0 ? (
            <div className="gs-empty">Sin resultados para “{q.trim()}”</div>
          ) : (
            results.map(s => (
              <div key={s.id} className="gs-result" onClick={() => { onSelect(s); onClose() }}>
                <div className="avatar">{initials(s.nombre)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="gs-result-name">{s.nombre}</div>
                  <div className="gs-result-meta">
                    {fmtDate(s.fecha)} · {s.hora?.slice(0, 5)}
                    {+s.restante > 0 && (
                      <span style={{ color: 'var(--amber)' }}>
                        {` · $${(+s.restante).toLocaleString()} saldo`}
                      </span>
                    )}
                  </div>
                </div>
                <Badge status={s.estatus} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
