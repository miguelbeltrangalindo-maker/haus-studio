import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { initials, statusClass } from '../lib/utils'
import Badge from '../components/Badge'
import SessionModal from '../components/SessionModal'
import { useToast } from '../hooks/useToast'

const KpiIcon = ({ children, color }) => (
  <div className={`dash-kpi-icon ${color}`}>{children}</div>
)

export default function DashboardDesktop({
  sessions, loading, createSession, onSelectSession,
  rangeLabel, totalSessions,
  confirmadas, pendEntrega, pendPago, entregadas, canceladas, liquidadas,
  totalLiquidado, totalAnticipo, totalRestante,
  todaySes, tomorrowSes, featuredSession,
}) {
  const toast    = useToast()
  const navigate = useNavigate()
  const [modal, setModal] = useState(false)

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
  const featuredEta = (() => {
    if (!featuredSession) return null
    if (featuredSession.estatus === 'En sesión') return 'EN SESIÓN · AHORA'
    const [h, m] = (featuredSession.hora || '00:00').split(':').map(Number)
    const diff = (h * 60 + m) - nowMinutes
    if (diff <= 0) return 'LLEGANDO'
    if (diff < 60) return `EN ${diff} MIN`
    const hrs = Math.floor(diff / 60); const mins = diff % 60
    return `EN ${hrs}H${mins > 0 ? ` ${mins}MIN` : ''}`
  })()

  const handleCreate = async (form) => {
    const { error } = await createSession(form)
    if (error) { toast(error, 'error'); return }
    toast('Sesión creada', 'success')
    setModal(false)
  }

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
        <div className="dash-hero-label">{rangeLabel}</div>
        <div className="dash-hero-headline">
          <span className="dash-hero-count">{totalSessions}</span>
          <span className="dash-hero-unit">{totalSessions === 1 ? 'sesión agendada' : 'sesiones agendadas'}</span>
        </div>
        {(totalAnticipo > 0 || totalRestante > 0) && (
          <div className="dash-hero-money">
            {totalAnticipo > 0 && <span className="money-cobrado">${totalAnticipo.toLocaleString()} en anticipos</span>}
            {totalAnticipo > 0 && totalRestante > 0 && <span style={{ color: 'var(--text3)', margin: '0 8px' }}>·</span>}
            {totalRestante > 0 && <span className="money-pendiente">${totalRestante.toLocaleString()} por cobrar</span>}
          </div>
        )}
      </div>

      {/* KPI strip — auto-fill grid */}
      <div className="dash-kpis">
        <div className="dash-kpi" onClick={() => navigate('/sesiones')} style={{ cursor: 'pointer' }}>
          <KpiIcon color="violet">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1.5" y="2.5" width="13" height="12" rx="1.5"/><path d="M5 1.5v2M11 1.5v2M1.5 6.5h13"/>
            </svg>
          </KpiIcon>
          <div>
            <div className="dash-kpi-value">{confirmadas.length}</div>
            <div className="dash-kpi-label">Confirmadas</div>
          </div>
        </div>

        <div className="dash-kpi" onClick={() => navigate('/sesiones')} style={{ cursor: 'pointer' }}>
          <KpiIcon color="amber">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6.5"/><path d="M8 5v3l2 2"/>
            </svg>
          </KpiIcon>
          <div>
            <div className="dash-kpi-value" style={{ color: pendEntrega.length > 0 ? 'var(--amber-l)' : undefined }}>
              {pendEntrega.length}
            </div>
            <div className="dash-kpi-label">Pend. entrega</div>
          </div>
        </div>

        <div className="dash-kpi" onClick={() => navigate('/sesiones')} style={{ cursor: 'pointer' }}>
          <KpiIcon color="amber">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1.5" y="5.5" width="13" height="8" rx="1.5"/><path d="M5 5.5V4a3 3 0 016 0v1.5"/>
            </svg>
          </KpiIcon>
          <div>
            <div className="dash-kpi-value" style={{ color: pendPago.length > 0 ? 'var(--amber-l)' : undefined }}>
              {pendPago.length}
            </div>
            <div className="dash-kpi-label">Pend. pago</div>
          </div>
        </div>

        <div className="dash-kpi">
          <KpiIcon color="amber">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="9" r="5.5"/><path d="M8 6.5v2.5l1.5 1.5"/><path d="M5.5 1.5h5M8 1.5v2"/>
            </svg>
          </KpiIcon>
          <div>
            <div className="dash-kpi-value" style={{ color: totalRestante > 0 ? 'var(--amber-l)' : undefined }}>
              ${totalRestante.toLocaleString()}
            </div>
            <div className="dash-kpi-label">Por cobrar</div>
          </div>
        </div>

        <div className="dash-kpi">
          <KpiIcon color="green">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 8l3.5 3.5L13 4"/>
            </svg>
          </KpiIcon>
          <div>
            <div className="dash-kpi-value" style={{ color: liquidadas.length > 0 ? 'var(--green-l)' : undefined }}>
              {totalLiquidado > 0 ? `$${totalLiquidado.toLocaleString()}` : liquidadas.length}
            </div>
            <div className="dash-kpi-label">
              Liquidadas{liquidadas.length > 0 && totalLiquidado > 0 ? ` · ${liquidadas.length}` : ''}
            </div>
          </div>
        </div>

        <div className="dash-kpi">
          <KpiIcon color="green">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="4" width="12" height="9" rx="1.5"/>
              <path d="M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M2 8h12"/>
            </svg>
          </KpiIcon>
          <div>
            <div className="dash-kpi-value">{entregadas.length}</div>
            <div className="dash-kpi-label">Entregadas</div>
          </div>
        </div>

        <div className="dash-kpi">
          <KpiIcon color="green">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 5h12M2 8h8M2 11h5"/><circle cx="12" cy="10.5" r="3.5"/><path d="M10.5 10.5h3M12 9v3"/>
            </svg>
          </KpiIcon>
          <div>
            <div className="dash-kpi-value" style={{ color: totalAnticipo > 0 ? 'var(--green-l)' : undefined }}>
              ${totalAnticipo.toLocaleString()}
            </div>
            <div className="dash-kpi-label">Anticipos</div>
          </div>
        </div>

        {canceladas.length > 0 && (
          <div className="dash-kpi">
            <KpiIcon color="red">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4l8 8M12 4l-8 8"/>
              </svg>
            </KpiIcon>
            <div>
              <div className="dash-kpi-value" style={{ color: 'var(--red-l)' }}>{canceladas.length}</div>
              <div className="dash-kpi-label">Canceladas</div>
            </div>
          </div>
        )}
      </div>

      {/* Featured / Next session */}
      {featuredSession && (
        <div className="page-content" style={{ paddingBottom: 0 }}>
          <div
            className={`nsc ${statusClass(featuredSession.estatus)}`}
            onClick={() => onSelectSession ? onSelectSession(featuredSession) : navigate('/hoy')}
          >
            {featuredEta && <div className="nsc-eta">{featuredEta}</div>}
            <div className="nsc-row">
              <div className="nsc-name">{featuredSession.nombre}</div>
              <Badge status={featuredSession.estatus} />
            </div>
            <div className="nsc-meta">
              {featuredSession.hora?.slice(0, 5)}
              {' · '}{featuredSession.personas} {featuredSession.personas === 1 ? 'persona' : 'personas'}
              {featuredSession.telefono && ` · ${featuredSession.telefono}`}
            </div>
            {(+featuredSession.anticipo > 0 || +featuredSession.restante > 0) && (
              <div className="nsc-money">
                {+featuredSession.anticipo > 0 && (
                  <span className="nsc-anticipo">${(+featuredSession.anticipo).toLocaleString()} anticipo</span>
                )}
                {+featuredSession.restante > 0 && (
                  <span className="nsc-restante">${(+featuredSession.restante).toLocaleString()} saldo</span>
                )}
              </div>
            )}
            {featuredSession.notas && <div className="nsc-notes">{featuredSession.notas}</div>}
          </div>
        </div>
      )}

      {/* Today / Tomorrow + Pending delivery */}
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

      {modal && <SessionModal onSave={handleCreate} onClose={() => setModal(false)} sessions={sessions} />}
    </>
  )
}
