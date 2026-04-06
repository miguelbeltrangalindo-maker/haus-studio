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

  const active      = sessions.filter(s => !['Cancelada', 'No show'].includes(s.estatus))
  const todaySes    = active.filter(s => s.fecha === today).sort((a, b) => a.hora > b.hora ? 1 : -1)
  const tomorrowSes = active.filter(s => s.fecha === tomorrow).sort((a, b) => a.hora > b.hora ? 1 : -1)
  const pendEntrega = active.filter(s => s.estatus === 'Pendiente de entrega')
  const pendPago    = active.filter(s => s.estatus === 'Pendiente de pago')
  const entregadas  = sessions.filter(s => s.estatus === 'Entregada')

  const now = new Date()
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
  const weekSes   = active.filter(s => {
    const d = new Date(s.fecha + 'T00:00')
    return d >= weekStart && d <= weekEnd
  })

  const cobradoHoy  = todaySes.reduce((a, s) => a + (+s.anticipo || 0), 0)
  const restanteHoy = todaySes.reduce((a, s) => a + (+s.restante || 0), 0)
  const totalRestante = active.reduce((a, s) => a + (+s.restante || 0), 0)

  const handleCreate = async (form) => {
    const { error } = await createSession(form)
    if (error) { toast(error, 'error'); return }
    toast('Sesión creada', 'success')
    setModal(false)
  }

  const dateLabel = format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })

  const SessionRow = ({ s }) => (
    <div className="session-row" style={{ cursor: 'pointer' }} onClick={() => navigate('/sesiones')}>
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

  const MiniList = ({ list, empty }) => {
    if (loading) return <div className="loading">Cargando…</div>
    if (!list.length) return (
      <div style={{ padding: '20px 0', fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
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
          <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>+ Nueva sesión</button>
        </div>
      </div>

      {/* Hero */}
      <div className="dash-hero">
        <div className="dash-hero-label" style={{ textTransform: 'capitalize' }}>{dateLabel}</div>
        <div className="dash-hero-headline">
          <span className="dash-hero-count">{todaySes.length}</span>
          <span className="dash-hero-unit">{todaySes.length === 1 ? 'sesión hoy' : 'sesiones hoy'}</span>
        </div>
        {(cobradoHoy > 0 || restanteHoy > 0) && (
          <div className="dash-hero-money">
            {cobradoHoy > 0 && (
              <span className="money-cobrado">${cobradoHoy.toLocaleString()} cobrados</span>
            )}
            {cobradoHoy > 0 && restanteHoy > 0 && <span style={{ color: 'var(--text3)', margin: '0 8px' }}>·</span>}
            {restanteHoy > 0 && (
              <span className="money-pendiente">${restanteHoy.toLocaleString()} por cobrar hoy</span>
            )}
          </div>
        )}
      </div>

      {/* KPI strip */}
      <div className="dash-kpis">
        <div className="dash-kpi" onClick={() => navigate('/agenda')} style={{ cursor: 'pointer' }}>
          <div className="dash-kpi-icon violet">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1.5" y="2.5" width="13" height="12" rx="1.5"/>
              <path d="M5 1.5v2M11 1.5v2M1.5 6.5h13"/>
            </svg>
          </div>
          <div>
            <div className="dash-kpi-value">{weekSes.length}</div>
            <div className="dash-kpi-label">Esta semana</div>
          </div>
        </div>

        <div className="dash-kpi" onClick={() => navigate('/sesiones')} style={{ cursor: 'pointer' }}>
          <div className="dash-kpi-icon amber">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6.5"/><path d="M8 5v3l2 2"/>
            </svg>
          </div>
          <div>
            <div className="dash-kpi-value" style={{ color: pendEntrega.length > 0 ? 'var(--amber-l)' : undefined }}>
              {pendEntrega.length}
            </div>
            <div className="dash-kpi-label">Pend. entrega</div>
          </div>
        </div>

        <div className="dash-kpi">
          <div className="dash-kpi-icon amber">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 4h12M2 8h8M2 12h5"/><circle cx="12" cy="11" r="3"/>
            </svg>
          </div>
          <div>
            <div className="dash-kpi-value" style={{ color: totalRestante > 0 ? 'var(--amber-l)' : undefined }}>
              ${totalRestante.toLocaleString()}
            </div>
            <div className="dash-kpi-label">Por cobrar</div>
          </div>
        </div>

        <div className="dash-kpi">
          <div className="dash-kpi-icon green">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 8l3.5 3.5L13 4"/>
            </svg>
          </div>
          <div>
            <div className="dash-kpi-value">{entregadas.length}</div>
            <div className="dash-kpi-label">Entregadas</div>
          </div>
        </div>

        {pendPago.length > 0 && (
          <div className="dash-kpi" onClick={() => navigate('/sesiones')} style={{ cursor: 'pointer' }}>
            <div className="dash-kpi-icon red">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1.5" y="5" width="13" height="9" rx="1.5"/>
                <path d="M5 5V3.5a3 3 0 016 0V5"/>
              </svg>
            </div>
            <div>
              <div className="dash-kpi-value" style={{ color: 'var(--red-l)' }}>{pendPago.length}</div>
              <div className="dash-kpi-label">Pend. pago</div>
            </div>
          </div>
        )}

        <div className="dash-kpi" style={{ cursor: 'pointer' }} onClick={() => setModal(true)}>
          <div className="dash-kpi-icon violet">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 3v10M3 8h10"/>
            </svg>
          </div>
          <div>
            <div className="dash-kpi-value" style={{ color: 'var(--violet-l)' }}>Nueva</div>
            <div className="dash-kpi-label">Agendar sesión</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="page-content">
        <div className="dash-grid">
          <div className="card">
            <div className="section-title">Sesiones de hoy</div>
            <MiniList list={todaySes} empty="Sin sesiones hoy" />
            {todaySes.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <button className="btn btn-sm btn-ghost" onClick={() => navigate('/hoy')}>
                  Ver agenda operativa →
                </button>
              </div>
            )}
          </div>
          <div className="card">
            <div className="section-title">Mañana</div>
            <MiniList list={tomorrowSes} empty="Sin sesiones mañana" />
          </div>
        </div>

        {pendEntrega.length > 0 && (
          <div className="card" style={{ marginTop: 0 }}>
            <div className="section-title">Pendientes de entrega</div>
            <MiniList list={pendEntrega} empty="" />
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
