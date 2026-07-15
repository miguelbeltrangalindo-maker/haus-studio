import { useState, useMemo } from 'react'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns'
import { todayStr, tomorrowStr, initials, fmtDate, ALL_STATUSES } from '../lib/utils'
import { useToast } from '../hooks/useToast'
import { useConfirm } from '../components/ConfirmDialog'
import Badge from '../components/Badge'
import SessionModal from '../components/SessionModal'
import { SkeletonRows, EmptyState } from '../components/Skeleton'
import { useConfig } from '../hooks/useConfig'

const QUICK = [
  { label: 'Todas',            key: '' },
  { label: 'Hoy',              key: 'hoy' },
  { label: 'Mañana',           key: 'manana' },
  { label: 'Esta semana',      key: 'semana' },
  { label: 'Este mes',         key: 'mes' },
  { label: 'En sesión',        key: 'en-sesion' },
  { label: 'Pend. de entrega', key: 'pendiente' },
  { label: 'Pend. de pago',    key: 'pago' },
  { label: 'Entregadas',       key: 'entregada' },
  { label: 'Canceladas',       key: 'cancelada' },
  { label: 'Rango',            key: 'rango' },
]

export default function Sesiones({ sessions, loading, createSession, updateSession, createPago, onSelectSession }) {
  const toast = useToast()
  const confirm = useConfirm()
  const { config } = useConfig()
  const [search, setSearch] = useState('')
  const [quick,  setQuick]  = useState('')
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo,   setRangeTo]   = useState('')
  const [modal,  setModal]  = useState(null)

  const today = todayStr()
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd   = format(endOfWeek(new Date(),   { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const monthEnd   = format(endOfMonth(new Date()),   'yyyy-MM-dd')

  const filtered = useMemo(() => {
    let list = [...sessions]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.nombre?.toLowerCase().includes(q) ||
        s.telefono?.includes(search)
      )
    }
    if (quick === 'hoy')       list = list.filter(s => s.fecha === today)
    if (quick === 'manana')    list = list.filter(s => s.fecha === tomorrowStr())
    if (quick === 'semana')    list = list.filter(s => s.fecha >= weekStart && s.fecha <= weekEnd)
    if (quick === 'mes')       list = list.filter(s => s.fecha >= monthStart && s.fecha <= monthEnd)
    if (quick === 'en-sesion') list = list.filter(s => s.estatus === 'En sesión')
    if (quick === 'pendiente') list = list.filter(s => s.estatus === 'Pendiente de entrega')
    if (quick === 'pago')      list = list.filter(s => +s.restante > 0)
    if (quick === 'entregada') list = list.filter(s => s.estatus === 'Entregada')
    if (quick === 'cancelada') list = list.filter(s => s.estatus === 'Cancelada')
    if (quick === 'rango') {
      if (rangeFrom) list = list.filter(s => s.fecha >= rangeFrom)
      if (rangeTo)   list = list.filter(s => s.fecha <= rangeTo)
    }
    return list.sort((a, b) => (a.fecha + (a.hora || '')) < (b.fecha + (b.hora || '')) ? 1 : -1)
  }, [sessions, search, quick, rangeFrom, rangeTo, today, weekStart, weekEnd, monthStart, monthEnd])

  const exportCSV = () => {
    const headers = ['Nombre','Teléfono','Fecha','Hora','Personas','Estatus','Anticipo','Método anticipo','Pagos cobrados','Saldo pendiente','Descuento','Notas']
    const rows = filtered.map(s => [
      s.nombre || '',
      s.telefono || '',
      s.fecha || '',
      s.hora?.slice(0, 5) || '',
      s.personas || '',
      s.estatus || '',
      s.anticipo || 0,
      s.metodo_anticipo || '',
      s.pagos || 0,
      s.restante || 0,
      s.descuento || 0,
      (s.notas || '').replace(/,/g, ';').replace(/\n/g, ' '),
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sesiones-${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSave = async (form) => {
    let result
    if (modal?.session?.id) result = await updateSession(modal.session.id, form)
    else result = await createSession(form)
    if (result.error) { toast(result.error, 'error'); return result }
    toast(modal?.session?.id ? 'Sesión actualizada' : 'Sesión creada', 'success')
    setModal(null)
    return result
  }

  const handleDelete = async () => {
    if (!modal?.session?.id) return
    const ok = await confirm({
      title: 'Cancelar esta sesión',
      message: `${modal.session.nombre || 'Sesión'} · ${fmtDate(modal.session.fecha)}`,
      confirmLabel: 'Cancelar sesión',
      cancelLabel: 'No, mantener',
      destructive: true,
    })
    if (!ok) return
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
    } else if (type === 'cobranza') {
      msg = (config.wa_settings?.cobranza_message || '')
        .replace(/{nombre}/g, s.nombre)
        .replace(/{saldo}/g, `$${(+s.restante || 0).toLocaleString()}`)
        .replace(/{fecha}/g, fmtDate(s.fecha))
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
          <button className="btn btn-ghost btn-sm" onClick={exportCSV} title="Exportar CSV">
            ↓ CSV
          </button>
          <button className="btn btn-ghost btn-sm" onClick={async () => (await import('../lib/exportExcel')).exportSesiones(filtered)} title="Exportar Excel"
            disabled={filtered.length === 0}>
            ↓ Excel
          </button>
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
            <button className="btn btn-sm" onClick={() => { setSearch(''); setQuick(''); setRangeFrom(''); setRangeTo('') }}>
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

        {/* Rango personalizado */}
        {quick === 'rango' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
            <input className="form-input" type="date" value={rangeFrom}
              onChange={e => setRangeFrom(e.target.value)}
              style={{ width: 160 }} placeholder="Desde" />
            <span style={{ color: 'var(--text3)', fontSize: 13 }}>—</span>
            <input className="form-input" type="date" value={rangeTo}
              onChange={e => setRangeTo(e.target.value)}
              min={rangeFrom}
              style={{ width: 160 }} placeholder="Hasta" />
          </div>
        )}

        {/* Resultado */}
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
          {!loading && `${filtered.length} sesión${filtered.length !== 1 ? 'es' : ''}`}
        </div>

        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <SkeletonRows count={5} />
          ) : filtered.length === 0 ? (
            sessions.length === 0 ? (
              <EmptyState
                glyph="◯"
                title="Aún no hay sesiones"
                sub="Crea la primera para empezar a llenar tu agenda."
                action={
                  <button className="btn btn-primary btn-sm" onClick={() => setModal({})}>
                    + Agendar primera sesión
                  </button>
                }
              />
            ) : (
              <EmptyState
                glyph="—"
                title="Sin coincidencias"
                sub="Ninguna sesión cumple con los filtros actuales."
                action={
                  <button className="btn btn-sm" onClick={() => { setSearch(''); setQuick(''); setRangeFrom(''); setRangeTo('') }}>
                    Limpiar filtros
                  </button>
                }
              />
            )
          ) : (
            <div className="session-list">
              {filtered.map(s => (
                <div key={s.id} className="session-card" onClick={() => onSelectSession?.(s)}>
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
                    {+s.restante > 0 && !['Cancelada', 'No show'].includes(s.estatus) && (
                      <button
                        className="btn btn-wa btn-xs btn-icon"
                        title={`Recordar saldo pendiente de $${(+s.restante).toLocaleString()} por WhatsApp`}
                        onClick={e => openWA(s, 'cobranza', e)}
                      >
                        💰
                      </button>
                    )}
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
          createPago={createPago}
          sessions={sessions}
        />
      )}
    </>
  )
}
