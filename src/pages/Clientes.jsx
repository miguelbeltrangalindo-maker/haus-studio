import { useMemo, useState } from 'react'
import { fmtDate, initials, esCortesia, ingresoAnticipo, fmtFechaHora, clienteKey } from '../lib/utils'
import Badge from '../components/Badge'
import { SkeletonRows, EmptyState } from '../components/Skeleton'
import { useToast } from '../hooks/useToast'

const tieneTel = (c) => /^\d{10}$/.test(c.phone)

// Captura rápida del teléfono de una clienta: se guarda en todas sus sesiones
function TelefonoForm({ cliente, updateSession }) {
  const toast = useToast()
  const [tel, setTel]   = useState('')
  const [busy, setBusy] = useState(false)
  const guardar = async () => {
    if (tel.length !== 10) { toast('El teléfono debe tener 10 dígitos', 'error'); return }
    setBusy(true)
    let fallos = 0
    for (const s of cliente.sesiones) {
      const r = await updateSession(s.id, { telefono: tel })
      if (r?.error) fallos++
    }
    setBusy(false)
    if (fallos) toast(`No se pudo guardar en ${fallos} sesión${fallos !== 1 ? 'es' : ''}`, 'error')
    else toast(`Teléfono guardado para ${cliente.nombre}`, 'success')
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--border)' }}
      onClick={e => e.stopPropagation()}>
      <input className="form-input" inputMode="numeric" autoFocus placeholder="Teléfono (10 dígitos)"
        value={tel} onChange={e => setTel(e.target.value.replace(/\D/g, '').slice(0, 10))}
        onKeyDown={e => e.key === 'Enter' && guardar()}
        style={{ flex: 1, ...(tel.length > 0 && tel.length !== 10 ? { borderColor: 'var(--red)' } : {}) }} />
      <button className="btn btn-primary btn-sm" onClick={guardar} disabled={busy || tel.length !== 10}>
        {busy ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  )
}

export default function Clientes({ sessions = [], loading, onSelectSession, updateSession }) {
  const [search, setSearch]     = useState('')
  const [expanded, setExpanded] = useState(null)
  const [sort, setSort]         = useState('reciente') // reciente | sesiones | gasto

  const clientes = useMemo(() => {
    const map = {}
    sessions.forEach(s => {
      const phone = clienteKey(s)
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
      const sorted  = [...c.sesiones].sort((a, b) => (b.fecha || '9999') > (a.fecha || '9999') ? 1 : -1)
      const latest  = sorted.find(s => s.fecha) || sorted[0]
      const totalGastado = c.sesiones.filter(s => s.estatus !== 'Cancelada').reduce((a, s) => a + ingresoAnticipo(s) + (+s.pagos || 0), 0)
      const saldoPendiente = activas.reduce((a, s) => a + (+s.restante || 0), 0)
      return {
        ...c,
        nombre: latest?.nombre || c.nombre,
        telefono: latest?.telefono || c.telefono,
        ultimaVisita: latest?.fecha || '',
        totalSesiones: activas.length,
        totalCanceladas: c.sesiones.filter(s => s.estatus === 'Cancelada').length,
        totalNoShow: c.sesiones.filter(s => s.estatus === 'No show').length,
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
          <button
            className="btn btn-ghost btn-sm"
            onClick={async () => (await import('../lib/exportExcel')).exportClientes(sessions)}
            title="Exportar clientes a Excel"
            disabled={sessions.length === 0}
          >
            ↓ Excel
          </button>
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
          <div className="card" style={{ padding: 0 }}>
            <SkeletonRows count={4} />
          </div>
        ) : filtered.length === 0 ? (
          clientes.length === 0 ? (
            <EmptyState
              glyph="◯"
              title="Aún no hay clientes"
              sub="Los clientes aparecen aquí cuando creas sesiones con su nombre y teléfono."
            />
          ) : (
            <EmptyState
              glyph="—"
              title="Sin coincidencias"
              sub="Ningún cliente cumple con la búsqueda actual."
              action={
                <button className="btn btn-sm" onClick={() => setSearch('')}>
                  Limpiar búsqueda
                </button>
              }
            />
          )
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
                        {tieneTel(c) ? c.telefono : <span style={{ color: 'var(--amber-l)' }}>Sin teléfono</span>}
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
                        {c.totalNoShow > 0 && (
                          <span style={{ color: 'var(--red)' }}>
                            {c.totalNoShow} no-show{c.totalNoShow !== 1 ? 's' : ''}
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
                    {!tieneTel(c) && updateSession && <TelefonoForm cliente={c} updateSession={updateSession} />}
                    {c.sesiones.map(s => (
                      <div
                        key={s.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 20px', borderBottom: '1px solid var(--border)',
                          cursor: 'pointer',
                        }}
                        onClick={() => onSelectSession?.(s)}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text1)' }}>
                            {fmtFechaHora(s)}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                            {s.personas} {s.personas === 1 ? 'persona' : 'personas'}
                            {esCortesia(s) ? ' · cortesía' : +s.anticipo > 0 && ` · $${(+s.anticipo).toLocaleString()} ant.`}
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
