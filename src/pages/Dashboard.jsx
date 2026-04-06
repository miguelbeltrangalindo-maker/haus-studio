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

  const dateLabel = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const SessionRow = ({ s }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
      <div className="avatar">{initials(s.nombre)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {s.nombre}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
          {s.hora?.slice(0, 5)} · {s.personas} {s.personas === 1 ? 'persona' : 'personas'}
        </div>
      </div>
      <Badge status={s.estatus} />
    </div>
  )

  const MiniList = ({ list, empty }) => {
    if (loading) return <div className="loading">Cargando…</div>
    if (!list.length) return (
      <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 14, color: 'var(--text2)' }}>
        {empty}
      </div>
    )
    return list.slice(0, 5).map(s => <SessionRow key={s.id} s={s} />)
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Dashboard</div>
        <div className="topbar-right">
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>{dateLabel}</span>
          <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>+ Nueva sesión</button>
        </div>
      </div>

      <div className="page-content">
        {/* Estadísticas */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Sesiones hoy</div>
            <div className="stat-value blue">{todaySes.length}</div>
            <div className="stat-sub">{todaySes.filter(s => s.estatus === 'Confirmada').length} confirmadas</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Esta semana</div>
            <div className="stat-value purple">{weekSes.length}</div>
            <div className="stat-sub">sesiones activas</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Anticipos recibidos</div>
            <div className="stat-value green">${totalAnticipo.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Por cobrar</div>
            <div className="stat-value amber">${totalRestante.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Mañana</div>
            <div className="stat-value">{tomorrowSes.length}</div>
            <div className="stat-sub">sesiones</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pend. de entrega</div>
            <div className="stat-value amber">{pendingDelivery.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Entregadas</div>
            <div className="stat-value green">{delivered.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Canceladas</div>
            <div className="stat-value">{cancelled.length}</div>
          </div>
        </div>

        {/* Listas */}
        <div className="dash-grid">
          <div className="card">
            <div className="section-title">Sesiones de hoy</div>
            <MiniList list={todaySes} empty="Sin sesiones hoy" />
          </div>
          <div className="card">
            <div className="section-title">Mañana</div>
            <MiniList list={tomorrowSes} empty="Sin sesiones mañana" />
          </div>
        </div>

        <div className="card" style={{ marginTop: 20 }}>
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
