import { useState } from 'react'
import { todayStr, tomorrowStr, initials, fmtDate } from '../lib/utils'
import Badge from '../components/Badge'
import SessionModal from '../components/SessionModal'
import { useToast } from '../hooks/useToast'

export default function Dashboard({ sessions, loading, createSession, updateSession }) {
  const toast = useToast()
  const [modal, setModal] = useState(false)

  const today = todayStr()
  const tomorrow = tomorrowStr()

  const active = sessions.filter(s => s.estatus !== 'Cancelada')
  const todaySes = active.filter(s => s.fecha === today).sort((a, b) => a.hora > b.hora ? 1 : -1)
  const tomorrowSes = active.filter(s => s.fecha === tomorrow).sort((a, b) => a.hora > b.hora ? 1 : -1)
  const pendingDelivery = active.filter(s => s.estatus === 'Pendiente de entrega')
  const delivered = sessions.filter(s => s.estatus === 'Entregada')
  const cancelled = sessions.filter(s => s.estatus === 'Cancelada')

  const now = new Date()
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1)
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
  const weekSes = active.filter(s => {
    const d = new Date(s.fecha + 'T00:00')
    return d >= weekStart && d <= weekEnd
  })

  const totalAnticipo = active.reduce((a, s) => a + (+s.anticipo || 0), 0)
  const totalRestante = active.reduce((a, s) => a + (+s.restante || 0), 0)

  const handleCreate = async (form) => {
    const { error } = await createSession(form)
    if (error) { toast(error, 'error'); return }
    toast('Sesión creada', 'success')
    setModal(false)
  }

  const dateLabel = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const MiniList = ({ list, empty }) => {
    if (loading) return <div className="loading">Cargando…</div>
    if (!list.length) return <div className="empty-state" style={{ padding: '24px' }}><div style={{ fontSize: 12 }}>{empty}</div></div>
    return list.slice(0, 6).map(s => (
      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
        <div className="avatar">{initials(s.nombre)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nombre}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.hora} · {s.personas} persona{s.personas > 1 ? 's' : ''}</div>
        </div>
        <Badge status={s.estatus} />
      </div>
    ))
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Dashboard</div>
        <div className="topbar-right">
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{dateLabel}</span>
          <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>+ Nueva sesión</button>
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-label">Sesiones hoy</div><div className="stat-value blue">{todaySes.length}</div><div className="stat-sub">{todaySes.filter(s => s.estatus === 'Confirmada').length} confirmadas</div></div>
          <div className="stat-card"><div className="stat-label">Sesiones mañana</div><div className="stat-value">{tomorrowSes.length}</div></div>
          <div className="stat-card"><div className="stat-label">Esta semana</div><div className="stat-value purple">{weekSes.length}</div></div>
          <div className="stat-card"><div className="stat-label">Anticipos recibidos</div><div className="stat-value green">${totalAnticipo.toLocaleString()}</div></div>
          <div className="stat-card"><div className="stat-label">Por cobrar</div><div className="stat-value amber">${totalRestante.toLocaleString()}</div></div>
          <div className="stat-card"><div className="stat-label">Pendientes entrega</div><div className="stat-value amber">{pendingDelivery.length}</div></div>
          <div className="stat-card"><div className="stat-label">Entregadas</div><div className="stat-value green">{delivered.length}</div></div>
          <div className="stat-card"><div className="stat-label">Canceladas</div><div className="stat-value">{cancelled.length}</div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div className="card">
            <div className="section-title">Sesiones de hoy</div>
            <MiniList list={todaySes} empty="Sin sesiones hoy" />
          </div>
          <div className="card">
            <div className="section-title">Próximas — mañana</div>
            <MiniList list={tomorrowSes} empty="Sin sesiones mañana" />
          </div>
        </div>

        <div className="card">
          <div className="section-title">Pendientes de entrega</div>
          <MiniList list={pendingDelivery} empty="Sin pendientes de entrega" />
        </div>
      </div>

      {modal && (
        <SessionModal
          onSave={handleCreate}
          onClose={() => setModal(false)}
        />
      )}
    </>
  )
}
