import { useMemo, useState } from 'react'
import { fmtDate, initials } from '../lib/utils'
import Badge from '../components/Badge'

export default function Clientes({ sessions = [], loading, onSelectSession }) {
  const [search, setSearch]     = useState('')
  const [expanded, setExpanded] = useState(null)
  const [sort, setSort]         = useState('reciente') // reciente | sesiones | gasto

  const clientes = useMemo(() => {
    const map = {}
    sessions.forEach(s => {
      const phone = s.telefono?.replace(/\D/g, '').slice(-10) || 'sin-telefono'
      if (!map[phone]) {
        map[phone] = {
          phone,
          nombre: s.nombre,
          telefono: s.telefono,
          sesiones: [],
        }
      }
      // Keep the most recent nombre
      map[phone].sesiones.push(s)
    })

    return Object.values(map).map(c => {
      const activas = c.sesiones.filter(s => !['Cancelada', 'No show'].includes(s.estatus))
      const sorted  = [...c.sesiones].sort((a, b) => b.fecha > a.fecha ? 1 : -1)
      const latest  = sorted[0]
      const totalGastado = activas.reduce((a, s) => a + (+s.anticipo || 0) + (+s.pagos || 0), 0)
      const saldoPendiente = activas.reduce((a, s) => a + (+s.restante || 0), 0)
      return {
        ...c,
        nombre: latest?.nombre || c.nombre,
        telefono: latest?.telefono || c.telefono,
        ultimaVisita: latest?.fecha || '',
        totalSesiones: activas.length,
        totalCanceladas: c.sesiones.length - activas.length,
        totalGastado,
        saldoPendiente,
        sesiones: sorted,
      }
    })
  }, [sessions])

  const filtered = useMemo(() => {
    let list = [...clientes]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.nombre?.toLowerCase().includes(q) ||
        c.phone?.includes(search)
      )
    }
    if (sort === 'reciente')  list.sort((a, b) => b.ultimaVisita > a.ultimaVisita ? 1 : -1)
    if (sort === 'sesiones')  list.sort((a, b) => b.totalSesiones - a.totalSesiones)
    if (sort === 'gasto')     list.sort((a, b) => b.totalGastado - a.totalGastado)
    return list
  }, [clientes, search, sort])

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Clientes</div>
        <div className="topbar-right">
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {!loading && `${filtered.length} cliente${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      <div className="page-content">
        {/* Search + sort */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 180 }}
            placeholder="Buscar por nombre o teléfono…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="form-input"
            style={{ width: 'auto', minWidth: 160 }}
            value={sort}
            onChange={e => setSort(e.target.value)}
          >
            <option value="reciente">Más reciente</option>
            <option value="sesiones">Más sesiones</option>
            <option value="gasto">Mayor gasto</option>
          </select>
        </div>

        {loading ? (
          <div className="loading">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">Sin clientes que coincidan</div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            {filtered.map(c => (
              <div key={c.phone}>
                {/* Cliente row */}
                <div
                  className="session-card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setExpanded(expanded === c.phone ? null : c.phone)}
                >
                  <div className="session-card-left">
                    <div className="avatar">{initials(c.nombre)}</div>
                    <div className="session-card-info">
                      <div className="session-card-header">
                        <span className="session-card-name">{c.nombre}</span>
                        {c.totalSesiones > 1 && (
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px',
                            borderRadius: 20, background: 'color-mix(in srgb, var(--violet) 15%, transparent)',
                            color: 'var(--violet-l)',
                          }}>
                            {c.totalSesiones}× cliente
                          </span>
                        )}
                      </div>
                      <div className="session-card-meta">
                        {c.telefono}
                        {c.ultimaVisita && ` · Última visita: ${fmtDate(c.ultimaVisita)}`}
                      </div>
                      <div className="session-card-money">
                        {c.totalSesiones > 0 && (
                          <span style={{ color: 'var(--text3)' }}>
                            {c.totalSesiones} sesión{c.totalSesiones !== 1 ? 'es' : ''}
                          </span>
                        )}
                        {c.totalGastado > 0 && (
                          <span style={{ color: 'var(--green)' }}>
                            ${c.totalGastado.toLocaleString()} gastado
                          </span>
                        )}
                        {c.saldoPendiente > 0 && (
                          <span style={{ color: 'var(--amber)' }}>
                            ${c.saldoPendiente.toLocaleString()} pendiente
                          </span>
                        )}
                        {c.totalCanceladas > 0 && (
                          <span style={{ color: 'var(--text3)' }}>
                            {c.totalCanceladas} cancelada{c.totalCanceladas !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ color: 'var(--text3)', fontSize: 18, paddingRight: 4, flexShrink: 0 }}>
                    {expanded === c.phone ? '▲' : '▼'}
                  </div>
                </div>

                {/* Expanded sessions */}
                {expanded === c.phone && (
                  <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg2)' }}>
                    {c.sesiones.map(s => (
                      <div
                        key={s.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 20px', borderBottom: '1px solid var(--border)',
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          if (window.matchMedia('(min-width: 769px)').matches) {
                            onSelectSession?.(s)
                          }
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text1)' }}>
                            {fmtDate(s.fecha)} · {s.hora?.slice(0, 5)}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                            {s.personas} {s.personas === 1 ? 'persona' : 'personas'}
                            {+s.anticipo > 0 && ` · $${(+s.anticipo).toLocaleString()} ant.`}
                            {+s.pagos > 0 && ` · $${(+s.pagos).toLocaleString()} cobrado`}
                            {+s.restante > 0 && (
                              <span style={{ color: 'var(--amber)' }}>{` · $${(+s.restante).toLocaleString()} saldo`}</span>
                            )}
                          </div>
                        </div>
                        <Badge status={s.estatus} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
