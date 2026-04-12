import { format, parseISO, differenceInDays, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { todayStr } from '../lib/utils'
import { useConfig } from '../hooks/useConfig'

export default function Estadisticas({ sessions, gastos = [], pagos = [], extras = [] }) {
  const { config } = useConfig()

  const today = todayStr()
  const effectiveStart = config.stats_start || today
  const effectiveEnd   = config.stats_end || format(addDays(new Date(), 29), 'yyyy-MM-dd')

  const rangeLabel = (() => {
    try {
      const s = parseISO(effectiveStart); const e = parseISO(effectiveEnd)
      return `${format(s, "d 'de' MMM", { locale: es })} — ${format(e, "d 'de' MMM yyyy", { locale: es })}`
    } catch { return '' }
  })()

  // ── Sessions ──
  const rangeSessions = sessions.filter(s => s.fecha >= effectiveStart && s.fecha <= effectiveEnd)
  const rangeActive   = rangeSessions.filter(s => !['Cancelada', 'No show'].includes(s.estatus))
  const canceladas    = rangeSessions.filter(s => ['Cancelada', 'No show'].includes(s.estatus))

  const totalAnticipo  = rangeActive.reduce((a, s) => a + (+s.anticipo || 0), 0)
  const totalRestante  = rangeActive.reduce((a, s) => a + (+s.restante  || 0), 0)
  const totalFacturado = totalAnticipo + totalRestante

  const liquidadas = rangeActive.filter(s =>
    ['Completada', 'Entregada', 'Pendiente de entrega'].includes(s.estatus) &&
    (+s.restante === 0 || s.restante === '' || s.restante == null)
  )
  const totalLiquidado = liquidadas.reduce((a, s) => a + (+s.pagos || 0), 0)

  // Cobrado real: sesiones liquidadas → pagos completos; con deuda → solo anticipo
  const totalCobrado = rangeActive.reduce((a, s) => {
    const liquidada = +s.restante === 0 || s.restante === '' || s.restante == null
    return a + (liquidada ? (+s.pagos || +s.anticipo || 0) : (+s.anticipo || 0))
  }, 0)

  const conDeuda = rangeActive.filter(s => +s.restante > 0)
  const pctCobrado = totalFacturado > 0 ? Math.round((totalCobrado / totalFacturado) * 100) : 0
  const tasaCancelacion = rangeSessions.length > 0 ? Math.round((canceladas.length / rangeSessions.length) * 100) : 0
  const promedioValor = rangeActive.length > 0 ? Math.round(totalFacturado / rangeActive.length) : 0

  // ── Gastos ──
  const rangeGastos = gastos.filter(g => g.fecha >= effectiveStart && g.fecha <= effectiveEnd)
  const totalGastos = rangeGastos.reduce((a, g) => a + (+g.monto || 0), 0)
  const gastosPorCat = rangeGastos.reduce((acc, g) => {
    acc[g.categoria] = (acc[g.categoria] || 0) + (+g.monto || 0)
    return acc
  }, {})
  const catEntries = Object.entries(gastosPorCat).sort((a, b) => b[1] - a[1])

  // ── Balance ──
  const balanceNeto = totalCobrado - totalGastos
  const maxBar = Math.max(totalCobrado, totalGastos, 1)

  // ── Opportunity ──
  let totalDias = 1, diasConSesion = 0, diasLibres = 0, ocupacion = 0
  try {
    const s = parseISO(effectiveStart); const e = parseISO(effectiveEnd)
    totalDias = differenceInDays(e, s) + 1
    diasConSesion = new Set(rangeActive.map(s => s.fecha)).size
    diasLibres = totalDias - diasConSesion
    ocupacion  = Math.round((diasConSesion / totalDias) * 100)
  } catch {}
  const promedioSesionesDia = diasConSesion > 0 ? (rangeActive.length / diasConSesion).toFixed(1) : '0'

  // ── Cobros por método ──
  const sessionIdsInRange = new Set(rangeActive.map(s => s.id))
  const rangePagos = pagos.filter(p => sessionIdsInRange.has(p.session_id))
  const metodosMap = rangePagos.reduce((acc, p) => {
    const key = p.metodo || 'efectivo'
    acc[key] = (acc[key] || 0) + (+p.monto || 0)
    return acc
  }, {})
  const METODOS = [
    { key: 'efectivo',      label: 'Efectivo' },
    { key: 'transferencia', label: 'Transferencia' },
    { key: 'tarjeta',       label: 'Tarjeta' },
  ]
  const maxMetodo = Math.max(...Object.values(metodosMap), 1)

  // ── Cargos extras ──
  const rangeExtras = extras.filter(e => sessionIdsInRange.has(e.session_id))
  const extrasPorConcepto = rangeExtras.reduce((acc, e) => {
    acc[e.concepto] = (acc[e.concepto] || 0) + (+e.monto || 0)
    return acc
  }, {})
  const extrasEntries = Object.entries(extrasPorConcepto).sort((a, b) => b[1] - a[1])
  const totalExtras = rangeExtras.reduce((a, e) => a + (+e.monto || 0), 0)
  const maxExtra = Math.max(...extrasEntries.map(([, m]) => m), 1)

  // ── Status breakdown ──
  const statusRows = [
    { label: 'Confirmadas / por llegar', count: rangeActive.filter(s => ['Reservada','Confirmada','Llegó','En sesión'].includes(s.estatus)).length, color: 'violet' },
    { label: 'Completadas',              count: rangeActive.filter(s => s.estatus === 'Completada').length, color: 'green' },
    { label: 'Pend. de entrega',         count: rangeActive.filter(s => s.estatus === 'Pendiente de entrega').length, color: 'amber' },
    { label: 'Entregadas',               count: rangeActive.filter(s => s.estatus === 'Entregada').length, color: 'green' },
    { label: 'Canceladas / No show',     count: canceladas.length, color: 'red' },
  ]

  const Kpi = ({ label, value, color }) => (
    <div className="stat-kpi">
      <div className={`stat-kpi-value${color ? ' ' + color : ''}`}>{value}</div>
      <div className="stat-kpi-label">{label}</div>
    </div>
  )

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Estadísticas</div>
        <div className="topbar-right">
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{rangeLabel}</span>
        </div>
      </div>

      <div className="page-content">

        {/* ── Balance ── */}
        <div className="stats-block">
          <div className="section-title">Balance financiero</div>
          <div className="stat-kpis">
            <Kpi label="Cobrado"              value={`$${totalCobrado.toLocaleString()}`}   color="green" />
            <Kpi label="Saldo por cobrar"     value={`$${totalRestante.toLocaleString()}`}   color="amber" />
            <Kpi label="Total facturado"      value={`$${totalFacturado.toLocaleString()}`}  />
            <Kpi label="Gastos registrados"   value={`$${totalGastos.toLocaleString()}`}     color="red" />
          </div>

          <div className="balance-vs">
            <div className="bvs-row">
              <span className="bvs-label">Cobrado</span>
              <div className="bvs-track">
                <div className="bvs-bar green" style={{ width: `${Math.round((totalCobrado / maxBar) * 100)}%` }} />
              </div>
              <span className="bvs-amount green">${totalCobrado.toLocaleString()}</span>
            </div>
            <div className="bvs-row">
              <span className="bvs-label">Gastos</span>
              <div className="bvs-track">
                <div className="bvs-bar red" style={{ width: `${Math.round((totalGastos / maxBar) * 100)}%` }} />
              </div>
              <span className="bvs-amount red">${totalGastos.toLocaleString()}</span>
            </div>
            <div className="bvs-neto" style={{ color: balanceNeto >= 0 ? 'var(--green)' : 'var(--red)' }}>
              Neto: {balanceNeto >= 0 ? '+' : '−'}${Math.abs(balanceNeto).toLocaleString()}
            </div>
          </div>
        </div>

        {/* ── Cobros ── */}
        <div className="stats-block">
          <div className="section-title">Cobros</div>
          <div className="stat-kpis">
            <Kpi label="Liquidadas"          value={liquidadas.length}                        color="green" />
            <Kpi label="Total liquidado"     value={`$${totalLiquidado.toLocaleString()}`}    color="green" />
            <Kpi label="Con saldo pendiente" value={conDeuda.length}                          color={conDeuda.length > 0 ? 'amber' : ''} />
            <Kpi label="% cobrado"           value={`${pctCobrado}%`}                         color={pctCobrado >= 80 ? 'green' : 'amber'} />
          </div>
          {conDeuda.length > 0 && (
            <div className="card" style={{ marginTop: 12, padding: '14px 20px' }}>
              <div className="section-title" style={{ marginBottom: 10 }}>Sesiones con deuda</div>
              {conDeuda.map(s => (
                <div key={s.id} className="breakdown-row">
                  <div className="breakdown-label">{s.nombre}</div>
                  <div className="breakdown-right">
                    <span className="breakdown-date">{s.fecha}</span>
                    <span className="breakdown-amount amber">${(+s.restante).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Cobros por método ── */}
        <div className="stats-block">
          <div className="section-title">Entradas por método de pago</div>
          <div className="stat-kpis">
            {METODOS.map(({ key, label }) => (
              <Kpi key={key} label={label} value={`$${(metodosMap[key] || 0).toLocaleString()}`} color={(metodosMap[key] || 0) > 0 ? 'green' : ''} />
            ))}
            <Kpi label="Total registrado" value={`$${rangePagos.reduce((a, p) => a + (+p.monto || 0), 0).toLocaleString()}`} />
          </div>
          <div className="card" style={{ padding: '14px 20px', marginTop: 12 }}>
            {METODOS.map(({ key, label }) => {
              const monto = metodosMap[key] || 0
              return (
                <div key={key} className="breakdown-row">
                  <div className="breakdown-label">{label}</div>
                  <div className="bvs-track" style={{ flex: 1, margin: '0 12px' }}>
                    <div className="bvs-bar green" style={{ width: monto > 0 ? `${Math.round((monto / maxMetodo) * 100)}%` : '0%' }} />
                  </div>
                  <div className={`breakdown-amount${monto > 0 ? ' green' : ''}`} style={{ minWidth: 72, textAlign: 'right', color: monto === 0 ? 'var(--text3)' : undefined }}>
                    {monto > 0 ? `$${monto.toLocaleString()}` : '—'}
                  </div>
                </div>
              )
            })}
            {rangePagos.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
                {rangePagos.length} pago{rangePagos.length !== 1 ? 's' : ''} registrado{rangePagos.length !== 1 ? 's' : ''} en el rango
              </div>
            )}
            {rangePagos.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', paddingTop: 4 }}>
                Los pagos cobrados desde ahora quedarán registrados aquí
              </div>
            )}
          </div>
        </div>

        {/* ── Sesiones ── */}
        <div className="stats-block">
          <div className="section-title">Sesiones</div>
          <div className="stat-kpis">
            <Kpi label="Total agendadas"     value={rangeActive.length} />
            <Kpi label="Tasa cancelación"    value={`${tasaCancelacion}%`} color={tasaCancelacion > 20 ? 'red' : tasaCancelacion > 10 ? 'amber' : 'green'} />
            <Kpi label="Valor promedio"      value={`$${promedioValor.toLocaleString()}`} />
            <Kpi label="Sesiones canceladas" value={canceladas.length} color={canceladas.length > 0 ? 'red' : ''} />
          </div>
          <div className="card" style={{ marginTop: 12, padding: '14px 20px' }}>
            <div className="section-title" style={{ marginBottom: 10 }}>Por estatus</div>
            {statusRows.map(({ label, count, color }) => (
              <div key={label} className="breakdown-row">
                <div className={`breakdown-dot ${color}`} />
                <div className="breakdown-label">{label}</div>
                <div className="breakdown-count">{count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Oportunidades ── */}
        <div className="stats-block">
          <div className="section-title">Ocupación y oportunidades</div>
          <div className="stat-kpis">
            <Kpi label="Días en el rango"      value={totalDias} />
            <Kpi label="Días con sesiones"     value={diasConSesion} color="violet" />
            <Kpi label="Días disponibles"      value={diasLibres} />
            <Kpi label="Ocupación"             value={`${ocupacion}%`} color={ocupacion >= 70 ? 'green' : ocupacion >= 40 ? 'amber' : 'red'} />
          </div>
          {rangeActive.length > 0 && (
            <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 10 }}>
              Promedio de <strong>{promedioSesionesDia}</strong> sesiones/día activo
              {diasLibres > 0 && ` · ${diasLibres} día${diasLibres !== 1 ? 's' : ''} sin agendar disponible${diasLibres !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>

        {/* ── Gastos por categoría ── */}
        {catEntries.length > 0 && (
          <div className="stats-block">
            <div className="section-title">Gastos por categoría</div>
            <div className="card" style={{ padding: '14px 20px' }}>
              {catEntries.map(([cat, monto]) => (
                <div key={cat} className="breakdown-row">
                  <div className="breakdown-label">{cat}</div>
                  <div className="bvs-track" style={{ flex: 1, margin: '0 12px' }}>
                    <div className="bvs-bar amber" style={{ width: `${Math.round((monto / totalGastos) * 100)}%` }} />
                  </div>
                  <div className="breakdown-amount amber">${monto.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Cargos extras por concepto ── */}
        <div className="stats-block">
          <div className="section-title">Cargos adicionales por concepto</div>
          {extrasEntries.length > 0 ? (
            <>
              <div className="stat-kpis">
                <Kpi label="Total cargos extras" value={`$${totalExtras.toLocaleString()}`} color="amber" />
                <Kpi label="Número de cargos"    value={rangeExtras.length} />
              </div>
              <div className="card" style={{ padding: '14px 20px', marginTop: 12 }}>
                {extrasEntries.map(([concepto, monto]) => (
                  <div key={concepto} className="breakdown-row">
                    <div className="breakdown-label">{concepto}</div>
                    <div className="bvs-track" style={{ flex: 1, margin: '0 12px' }}>
                      <div className="bvs-bar amber" style={{ width: `${Math.round((monto / maxExtra) * 100)}%` }} />
                    </div>
                    <div className="breakdown-amount amber">${monto.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="card" style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text3)' }}>
              Sin cargos adicionales en este rango
            </div>
          )}
        </div>

      </div>
    </>
  )
}
