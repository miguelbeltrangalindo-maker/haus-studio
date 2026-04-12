import { useState, useMemo } from 'react'
import { todayStr, tomorrowStr, initials, fmtDate, ALL_STATUSES } from '../lib/utils'
import { useToast } from '../hooks/useToast'
import Badge from '../components/Badge'
import SessionModal from '../components/SessionModal'
import { useConfig } from '../hooks/useConfig'

const QUICK = [
  { label: 'Todas',              key: '' },
  { label: 'Hoy',                key: 'hoy' },
  { label: 'Mañana',             key: 'manana' },
  { label: 'En sesión',          key: 'en-sesion' },
  { label: 'Pend. de entrega',   key: 'pendiente' },
  { label: 'Pend. de pago',      key: 'pago' },
  { label: 'Entregadas',         key: 'entregada' },
  { label: 'Canceladas',         key: 'cancelada' },
]

export default function Sesiones({ sessions, loading, createSession, updateSession, onSelectSession }) {
  const toast = useToast()
  const { config } = useConfig()
  const [search, setSearch] = useState('')
  const [quick,  setQuick]  = useState('')
  const [modal,  setModal]  = useState(null)

  const filtered = useMemo(() => {
    let list = [...sessions]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.nombre?.toLowerCase().includes(q) ||
        s.telefono?.includes(search)
      )
    }
    if (quick === 'hoy')       list = list.filter(s => s.fecha === todayStr())
    if (quick === 'manana')    list = list.filter(s => s.fecha === tomorrowStr())
    if (quick === 'en-sesion') list = list.filter(s => s.estatus === 'En sesión')
    if (quick === 'pendiente') list = list.filter(s => s.estatus === 'Pendiente de entrega')
    if (quick === 'pago')      list = list.filter(s => +s.restante > 0)
    if (quick === 'entregada') list = list.filter(s => s.estatus === 'Entregada')
    if (quick === 'cancelada') list = list.filter(s => s.estatus === 'Cancelada')
    return list.sort((a, b) => (a.fecha + (a.hora || '')) < (b.fecha + (b.hora || '')) ? 1 : -1)
  }, [sessions, search, quick])

  const handleSave = async (form) => {
    let result
    if (modal?.session?.id) result = await updateSession(modal.session.id, form)
    else result = await createSession(form)
    if (result.error) { toast(result.error, 'error'); return }
    toast(modal?.session?.id ? 'Sesión actualizada' : 'Sesión creada', 'success')
    setModal(null)
  }

  const handleDelete = async () => {
    if (!modal?.session?.id) return
    if (!confirm('¿Cancelar esta sesión?')) return
    await updateSession(modal.session.id, { estatus: 'Cancelada' })
    toast('Sesión cancelada')
    setModal(null)
  }

  const openWA = (s, type, e) => {
    e.stopPropagation()
    const phone = '52' + s.telefono.replace(/\D/g, '').replace(/^52/, '')
    let msg = ''
    if (type === 'reminder') {
      msg = (config.reminder_message || '')
        .replace(/{nombre}/g, s.nombre)
        .replace(/{fecha}/g, fmtDate(s.fecha))
        .replace(/{hora}/g, s.hora?.slice(0, 5) || s.hora)
      updateSession(s.id, { reminder_sent: true })
    } else {
      if (!s.link) { toast('Sin vínculo de fotos', 'error'); return }
      msg = (config.delivery_message || '')
        .replace(/{nombre}/g, s.nombre)
        .replace(/{link}/g, s.link)
      updateSession(s.id, { link_sent: true })
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Sesiones</div>
        <div className="topbar-right">
          <button className="btn btn-primary btn-sm" onClick={() => setModal({})}>+ Nueva sesión</button>
        </div>
      </div>

      <div className="page-content">
        {/* Búsqueda */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Buscar por nombre o teléfono…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {(search || quick) && (
            <button className="btn btn-sm" onClick={() => { setSearch(''); setQuick('') }}>
              Limpiar
            </button>
          )}
        </div>

        {/* Filtros rápidos */}
        <div className="filter-pills">
          {QUICK.map(q => (
            <button
              key={q.key}
              className={`pill ${quick === q.key ? 'active' : ''}`}
              onClick={() => setQuick(q.key)}
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Resultado */}
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
          {!loading && `${filtered.length} sesión${filtered.length !== 1 ? 'es' : ''}`}
        </div>

        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading">Cargando sesiones…</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">Sin sesiones que coincidan</div>
          ) : (
            <div className="session-list">
              {filtered.map(s => (
                <div key={s.id} className="session-card" onClick={() => {
                    if (window.matchMedia('(min-width: 769px)').matches) {
                      onSelectSession?.(s)
                    } else {
                      setModal({ session: s })
                    }
                  }}>
                  <div className="session-card-left">
                    <div className="avatar">{initials(s.nombre)}</div>
                    <div className="session-card-info">
                      <div className="session-card-header">
                        <span className="session-card-name">{s.nombre}</span>
                        <Badge status={s.estatus} />
                      </div>
                      <div className="session-card-meta">
                        {fmtDate(s.fecha)} · {s.hora?.slice(0, 5)} · {s.personas} {s.personas === 1 ? 'persona' : 'personas'}
                      </div>
                      {((+s.anticipo > 0) || (+s.restante > 0) || (+s.pagos > 0)) && (
                        <div className="session-card-money">
                          {+s.anticipo > 0 && (
                            <span style={{ color: 'var(--green)' }}>
                              ${(+s.anticipo).toLocaleString()} ant.
                            </span>
                          )}
                          {+s.pagos > 0 && (
                            <span style={{ color: 'var(--green)' }}>
                              ${(+s.pagos).toLocaleString()} cobrado
                            </span>
                          )}
                          {+s.restante > 0 && (
                            <span style={{ color: 'var(--amber)' }}>
                              ${(+s.restante).toLocaleString()} saldo
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="session-card-actions" onClick={e => e.stopPropagation()}>
                    <button
                      className="btn btn-wa btn-xs btn-icon"
                      title="Recordatorio WhatsApp"
                      onClick={e => openWA(s, 'reminder', e)}
                    >
                      📱
                    </button>
                    {s.link && (
                      <button
                        className="btn btn-wa btn-xs btn-icon"
                        title="Enviar fotos"
                        onClick={e => openWA(s, 'delivery', e)}
                      >
                        📸
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modal !== null && (
        <SessionModal
          session={modal.session}
          onSave={handleSave}
          onClose={() => setModal(null)}
          onDelete={handleDelete}
        />
      )}
    </>
  )
}
