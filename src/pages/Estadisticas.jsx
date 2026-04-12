import { format, parseISO, differenceInDays, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { todayStr } from '../lib/utils'
import { useConfig } from '../hooks/useConfig'

export default function Estadisticas({ sessions, gastos = [] }) {
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

      </div>
    </>
  )
}
