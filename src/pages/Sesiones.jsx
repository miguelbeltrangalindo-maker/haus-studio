import { useState, useMemo } from 'react'
import { todayStr, tomorrowStr, initials, fmtDate, ALL_STATUSES } from '../lib/utils'
import { useToast } from '../hooks/useToast'
import Badge from '../components/Badge'
import SessionModal from '../components/SessionModal'
import { useConfig } from '../hooks/useConfig'

const QUICK = [
  { label: 'Todas', key: '' },
  { label: 'Hoy', key: 'hoy' },
  { label: 'Mañana', key: 'mañana' },
  { label: 'Pendientes de entrega', key: 'pendiente' },
  { label: 'Entregadas', key: 'entregada' },
  { label: 'Canceladas', key: 'cancelada' },
]

export default function Sesiones({ sessions, loading, createSession, updateSession, deleteSession }) {
  const toast = useToast()
  const { config } = useConfig()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [quick, setQuick] = useState('')
  const [modal, setModal] = useState(null)

  const filtered = useMemo(() => {
    let list = [...sessions]
    if (search) list = list.filter(s => s.nombre.toLowerCase().includes(search.toLowerCase()) || s.telefono.includes(search))
    if (filterStatus) list = list.filter(s => s.estatus === filterStatus)
    if (filterDate) list = list.filter(s => s.fecha === filterDate)
    if (quick === 'hoy') list = list.filter(s => s.fecha === todayStr())
    if (quick === 'mañana') list = list.filter(s => s.fecha === tomorrowStr())
    if (quick === 'pendiente') list = list.filter(s => s.estatus === 'Pendiente de entrega')
    if (quick === 'entregada') list = list.filter(s => s.estatus === 'Entregada')
    if (quick === 'cancelada') list = list.filter(s => s.estatus === 'Cancelada')
    return list.sort((a, b) => (a.fecha + a.hora) < (b.fecha + b.hora) ? 1 : -1)
  }, [sessions, search, filterStatus, filterDate, quick])

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
      msg = (config.reminder_message || '').replace(/{nombre}/g, s.nombre).replace(/{fecha}/g, fmtDate(s.fecha)).replace(/{hora}/g, s.hora)
      updateSession(s.id, { reminder_sent: true })
    } else {
      if (!s.link) { toast('Sin vínculo de fotos', 'error'); return }
      msg = (config.delivery_message || '').replace(/{nombre}/g, s.nombre).replace(/{link}/g, s.link)
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
        <div className="search-bar">
          <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="Buscar por nombre o teléfono…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input" style={{ minWidth: 180 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos los estatus</option>
            {ALL_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <input className="input" type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          <button className="btn btn-sm" onClick={() => { setSearch(''); setFilterStatus(''); setFilterDate(''); setQuick('') }}>
            Limpiar
          </button>
        </div>

        <div className="filter-pills">
          {QUICK.map(q => (
            <div key={q.key} className={`pill ${quick === q.key ? 'active' : ''}`} onClick={() => setQuick(q.key)}>
              {q.label}
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading">Cargando sesiones…</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">Sin sesiones que coincidan</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Personas</th>
                    <th>Anticipo</th>
                    <th>Restante</th>
                    <th>Estatus</th>
                    <th>Fotos</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id} onClick={() => setModal({ session: s })}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="avatar" style={{ width: 26, height: 26, fontSize: 10 }}>{initials(s.nombre)}</div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{s.nombre}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.telefono}</div>
                          </div>
                        </div>
                      </td>
                      <td>{fmtDate(s.fecha)}</td>
                      <td>{s.hora}</td>
                      <td style={{ textAlign: 'center' }}>{s.personas}</td>
                      <td style={{ color: 'var(--green2)' }}>${(+s.anticipo || 0).toLocaleString()}</td>
                      <td style={{ color: s.restante > 0 ? 'var(--amber2)' : 'var(--text3)' }}>
                        ${(+s.restante || 0).toLocaleString()}
                      </td>
                      <td><Badge status={s.estatus} /></td>
                      <td>
                        {s.link_sent
                          ? <span className="sent-check">✓ Enviadas</span>
                          : s.link ? <span style={{ fontSize: 11, color: 'var(--blue2)' }}>Listo</span>
                          : <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>
                        }
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-wa btn-sm btn-icon" title="Recordatorio"
                            onClick={e => openWA(s, 'reminder', e)}>📱</button>
                          {s.link && (
                            <button className="btn btn-wa btn-sm btn-icon" title="Enviar fotos"
                              onClick={e => openWA(s, 'delivery', e)}>📸</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
