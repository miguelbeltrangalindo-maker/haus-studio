import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { todayStr, tomorrowStr, initials, fmtDate } from '../lib/utils'
import Badge from '../components/Badge'
import SessionModal from '../components/SessionModal'
import { useToast } from '../hooks/useToast'

export default function Dashboard({ sessions, loading, createSession, updateSession }) {
  const toast    = useToast()
  const navigate = useNavigate()
  const [modal, setModal] = useState(false)

  const today    = todayStr()
  const tomorrow = tomorrowStr()

  const active       = sessions.filter(s => s.estatus !== 'Cancelada')
  const todaySes     = active.filter(s => s.fecha === today).sort((a, b) => a.hora > b.hora ? 1 : -1)
  const tomorrowSes  = active.filter(s => s.fecha === tomorrow).sort((a, b) => a.hora > b.hora ? 1 : -1)
  const pendEntrega  = active.filter(s => s.estatus === 'Pendiente de entrega')
  const entregadas   = sessions.filter(s => s.estatus === 'Entregada')
  const completadas  = sessions.filter(s => s.estatus === 'Completada')
  const canceladas   = sessions.filter(s => s.estatus === 'Cancelada')

  const now = new Date()
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1)
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
  const weekSes = active.filter(s => {
    const d = new Date(s.fecha + 'T00:00')
    return d >= weekStart && d <= weekEnd
  })

  const totalAnticipo = active.reduce((a, s) => a + (+s.anticipo || 0), 0)
  const totalRestante = active.reduce((a, s) => a + (+s.restante || 0), 0)
  const cobradoHoy    = todaySes.reduce((a, s) => a + (+s.anticipo || 0), 0)
  const restanteHoy   = todaySes.reduce((a, s) => a + (+s.restante || 0), 0)

  const handleCreate = async (form) => {
    const { error } = await createSession(form)
    if (error) { toast(error, 'error'); return }
    toast('Sesión creada', 'success')
    setModal(false)
  }

  const dateLabel = format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })

  const SessionRow = ({ s }) => (
    <div className="session-row">
      <div className="avatar">{initials(s.nombre)}</div>
      <div className="session-row-info">
        <div className="session-row-name">{s.nombre}</div>
        <div className="session-row-sub">
          {s.hora?.slice(0, 5)} · {s.personas} {s.personas === 1 ? 'persona' : 'personas'}
        </div>
      </div>
      <Badge status={s.estatus} />
    </div>
  )

  const MiniList = ({ list, empty, maxItems = 5 }) => {
    if (loading) return <div className="loading">Cargando…</div>
    if (!list.length) return (
      <div style={{ padding: '16px 0', fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
        {empty}
      </div>
    )
    return list.slice(0, maxItems).map(s => <SessionRow key={s.id} s={s} />)
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Dashboard</div>
        <div className="topbar-right">
          <span className="topbar-date" style={{ textTransform: 'capitalize' }}>{dateLabel}</span>
          <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>+ Nueva sesión</button>
        </div>
      </div>

      <div className="page-content">

        {/* Métricas principales */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Sesiones hoy</div>
            <div className="stat-value blue">{todaySes.length}</div>
            <div className="stat-sub">{todaySes.filter(s => ['Confirmada', 'Llegó', 'En sesión'].includes(s.estatus)).length} activas</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Esta semana</div>
            <div className="stat-value purple">{weekSes.length}</div>
            <div className="stat-sub">sesiones agendadas</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Cobrado hoy</div>
            <div className="stat-value green">${cobradoHoy.toLocaleString()}</div>
            {restanteHoy > 0 && <div className="stat-sub" style={{ color: 'var(--c-pago)' }}>${restanteHoy.toLocaleString()} por cobrar</div>}
          </div>
          <div className="stat-card">
            <div className="stat-label">Total anticipos</div>
            <div className="stat-value green">${totalAnticipo.toLocaleString()}</div>
            <div className="stat-sub">activas</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Por cobrar</div>
            <div className="stat-value amber">${totalRestante.toLocaleString()}</div>
            <div className="stat-sub">saldo pendiente</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pend. de entrega</div>
            <div className="stat-value orange">{pendEntrega.length}</div>
            <div className="stat-sub" style={{ cursor: 'pointer', color: 'var(--accent)' }}
              onClick={() => navigate('/sesiones')}>ver sesiones →</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Entregadas</div>
            <div className="stat-value green">{entregadas.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Canceladas</div>
            <div className="stat-value">{canceladas.length}</div>
          </div>
        </div>

        {/* Accesos rápidos */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={() => navigate('/hoy')}>
            Ver agenda de hoy
          </button>
          <button className="btn btn-sm" onClick={() => navigate('/agenda')}>
            Abrir agenda
          </button>
          <button className="btn btn-sm" onClick={() => navigate('/sesiones')}>
            Pendientes de entrega
          </button>
        </div>

        {/* Hoy y Mañana */}
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

        {/* Pendientes de entrega */}
        {pendEntrega.length > 0 && (
          <div className="card" style={{ marginTop: 20 }}>
            <div className="section-title">Pendientes de entrega</div>
            <MiniList list={pendEntrega} empty="" maxItems={6} />
          </div>
        )}

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
