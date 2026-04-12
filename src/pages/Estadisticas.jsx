import { format, parseISO, differenceInDays, addDays, eachDayOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import { todayStr } from '../lib/utils'
import { useConfig } from '../hooks/useConfig'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

export default function Estadisticas({ sessions, gastos = [], pagos = [], extras = [], extrasTableError = false }) {
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

  const totalDescuentos = rangeActive.reduce((a, s) => a + (+s.descuento || 0), 0)

  // Valor real por sesión = anticipo + pagos cobrados + saldo pendiente (descuentos ya aplicados al restante)
  const totalFacturado = rangeActive.reduce((a, s) =>
    a + (+s.anticipo || 0) + (+s.pagos || 0) + (+s.restante || 0), 0)

  const liquidadas = rangeActive.filter(s =>
    ['Completada', 'Entregada', 'Pendiente de entrega'].includes(s.estatus) &&
    (+s.restante === 0 || s.restante === '' || s.restante == null)
  )
  const totalLiquidado = liquidadas.reduce((a, s) => a + (+s.anticipo || 0) + (+s.pagos || 0), 0)

  // Cobrado real: anticipos + pagos cobrados del saldo
  const totalCobrado = rangeActive.reduce((a, s) =>
    a + (+s.anticipo || 0) + (+s.pagos || 0), 0)

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

  // ── Cupones ──
  const sessionesCupon  = rangeActive.filter(s => s.metodo_anticipo === 'cupon')
  const totalCupon      = sessionesCupon.reduce((a, s) => a + (+s.anticipo || 0), 0)

  // ── Anticipos por método ──
  const anticipoEfectivo      = rangeActive.filter(s => s.metodo_anticipo === 'efectivo').reduce((a, s) => a + (+s.anticipo || 0), 0)
  const anticipoTransferencia = rangeActive.filter(s => s.metodo_anticipo === 'transferencia').reduce((a, s) => a + (+s.anticipo || 0), 0)
  const anticipoSinMetodo     = rangeActive.filter(s => !s.metodo_anticipo && +s.anticipo > 0).reduce((a, s) => a + (+s.anticipo || 0), 0)
  const maxAnticipo = Math.max(anticipoEfectivo, anticipoTransferencia, anticipoSinMetodo, 1)

  // ── Cobros por método (session_pagos + anticipos) ──
  const sessionIdsInRange = new Set(rangeActive.map(s => s.id))
  const rangePagos = pagos.filter(p => sessionIdsInRange.has(p.session_id))
  // Start with pagos del saldo (session_pagos)
  const metodosMap = rangePagos.reduce((acc, p) => {
    const key = p.metodo || 'efectivo'
    acc[key] = (acc[key] || 0) + (+p.monto || 0)
    return acc
  }, {})
  // Add anticipos by their method
  rangeActive.forEach(s => {
    if (!s.metodo_anticipo || !+s.anticipo) return
    metodosMap[s.metodo_anticipo] = (metodosMap[s.metodo_anticipo] || 0) + (+s.anticipo)
  })
  const METODOS = [
    { key: 'efectivo',      label: 'Efectivo' },
    { key: 'transferencia', label: 'Transferencia' },
    { key: 'tarjeta',       label: 'Tarjeta' },
    { key: 'cupon',         label: 'Cupón' },
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

  // ── Chart data ──
  // Line chart: daily income over range
  const lineData = (() => {
    try {
      const days = eachDayOfInterval({ start: parseISO(effectiveStart), end: parseISO(effectiveEnd) })
      // Build daily income map from sessions
      const byDate = {}
      rangeActive.forEach(s => {
        const d = s.fecha
        byDate[d] = (byDate[d] || 0) + (+s.anticipo || 0) + (+s.pagos || 0)
      })
      let acum = 0
      return days.map(d => {
        const key = format(d, 'yyyy-MM-dd')
        const day = byDate[key] || 0
        acum += day
        return {
          fecha: format(d, 'd MMM', { locale: es }),
          Día: day,
          Acumulado: acum,
        }
      }).filter((_, i, arr) => {
        // For large ranges show only days with data + thin out empties
        if (arr.length <= 14) return true
        return i === 0 || i === arr.length - 1 || arr[i].Día > 0
      })
    } catch { return [] }
  })()

  // Pie: payment methods
  const COLORS = {
    efectivo: '#2D8A3A', transferencia: '#6B4FA8', tarjeta: '#9E6B1A', cupon: '#1A7A9E',
    green: '#2D8A3A', violet: '#6B4FA8', amber: '#9E6B1A', red: '#9C3535',
  }
  const pieMetodos = METODOS
    .map(m => ({ name: m.label, value: metodosMap[m.key] || 0, color: COLORS[m.key] }))
    .filter(d => d.value > 0)

  // Pie: session status
  const PIE_STATUS = [
    { name: 'Confirmadas',      value: rangeActive.filter(s => ['Reservada','Confirmada','Llegó','En sesión'].includes(s.estatus)).length, color: '#6B4FA8' },
    { name: 'Completadas',      value: rangeActive.filter(s => s.estatus === 'Completada').length, color: '#2D8A3A' },
    { name: 'Pend. entrega',    value: rangeActive.filter(s => s.estatus === 'Pendiente de entrega').length, color: '#9E6B1A' },
    { name: 'Entregadas',       value: rangeActive.filter(s => s.estatus === 'Entregada').length, color: '#3BA44A' },
    { name: 'Canceladas',       value: canceladas.length, color: '#9C3535' },
  ].filter(d => d.value > 0)

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
            <Kpi label="Anticipos"             value={`$${totalAnticipo.toLocaleString()}`}   />
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

        {/* ── Gráfica de ingresos ── */}
        {lineData.length > 1 && (
          <div className="stats-block">
            <div className="section-title">Ingresos cobrados en el período</div>
            <div className="card" style={{ padding: '20px 12px 8px' }}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={lineData} margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false}
                    tickFormatter={v => v === 0 ? '' : `$${(v/1000).toFixed(0)}k`} width={40} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text2)', fontWeight: 600 }}
                    formatter={(v, name) => [`$${v.toLocaleString()}`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Line type="monotone" dataKey="Día" stroke="#6B4FA8" strokeWidth={2}
                    dot={{ r: 4, fill: '#6B4FA8', strokeWidth: 0 }}
                    activeDot={{ r: 6 }} connectNulls />
                  <Line type="monotone" dataKey="Acumulado" stroke="#2D8A3A" strokeWidth={2}
                    dot={{ r: 3, fill: '#2D8A3A', strokeWidth: 0 }}
                    activeDot={{ r: 6 }} connectNulls strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Anticipos ── */}
        <div className="stats-block">
          <div className="section-title">Anticipos recibidos</div>
          <div className="stat-kpis">
            <Kpi label="Total anticipos"   value={`$${totalAnticipo.toLocaleString()}`}          color="green" />
            <Kpi label="Sesiones con ant." value={rangeActive.filter(s => +s.anticipo > 0).length} />
            <Kpi label="Efectivo"          value={`$${anticipoEfectivo.toLocaleString()}`}        color={anticipoEfectivo > 0 ? 'green' : ''} />
            <Kpi label="Transferencia"     value={`$${anticipoTransferencia.toLocaleString()}`}   color={anticipoTransferencia > 0 ? 'green' : ''} />
          </div>
          <div className="card" style={{ padding: '14px 20px', marginTop: 12 }}>
            {[
              { label: 'Efectivo',      monto: anticipoEfectivo },
              { label: 'Transferencia', monto: anticipoTransferencia },
              ...(anticipoSinMetodo > 0 ? [{ label: 'Sin método registrado', monto: anticipoSinMetodo }] : []),
            ].map(({ label, monto }) => (
              <div key={label} className="breakdown-row">
                <div className="breakdown-label">{label}</div>
                <div className="bvs-track" style={{ flex: 1, margin: '0 12px' }}>
                  <div className="bvs-bar green" style={{ width: monto > 0 ? `${Math.round((monto / maxAnticipo) * 100)}%` : '0%' }} />
                </div>
                <div className={`breakdown-amount${monto > 0 ? ' green' : ''}`} style={{ minWidth: 72, textAlign: 'right', color: monto === 0 ? 'var(--text3)' : undefined }}>
                  {monto > 0 ? `$${monto.toLocaleString()}` : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Cupones ── */}
        {(sessionesCupon.length > 0 || rangeActive.some(s => s.metodo_anticipo === 'cupon')) && (
          <div className="stats-block">
            <div className="section-title">Cupones</div>
            <div className="stat-kpis">
              <Kpi label="Sesiones con cupón"  value={sessionesCupon.length}                    color={sessionesCupon.length > 0 ? 'violet' : ''} />
              <Kpi label="Costo total cubierto" value={`$${totalCupon.toLocaleString()}`}        color={totalCupon > 0 ? 'green' : ''} />
              <Kpi label="Promedio por cupón"   value={sessionesCupon.length > 0 ? `$${Math.round(totalCupon / sessionesCupon.length).toLocaleString()}` : '—'} />
            </div>
            {sessionesCupon.length > 0 && (
              <div className="card" style={{ padding: '14px 20px', marginTop: 12 }}>
                <div className="section-title" style={{ marginBottom: 10 }}>Sesiones con cupón</div>
                {sessionesCupon.map(s => (
                  <div key={s.id} className="breakdown-row">
                    <div className="breakdown-label">{s.nombre}</div>
                    <div className="breakdown-right">
                      <span className="breakdown-date">{s.fecha}</span>
                      <span className="breakdown-amount" style={{ color: 'var(--text-violet, #6B4FA8)' }}>${(+s.anticipo).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Cobros ── */}
        <div className="stats-block">
          <div className="section-title">Cobros</div>
          <div className="stat-kpis">
            <Kpi label="Liquidadas"          value={liquidadas.length}                        color="green" />
            <Kpi label="Total liquidado"     value={`$${totalLiquidado.toLocaleString()}`}    color="green" />
            <Kpi label="Con saldo pendiente" value={conDeuda.length}                          color={conDeuda.length > 0 ? 'amber' : ''} />
            <Kpi label="% cobrado"           value={`${pctCobrado}%`}                         color={pctCobrado >= 80 ? 'green' : 'amber'} />
            {totalDescuentos > 0 && <Kpi label="Descuentos aplicados" value={`−$${totalDescuentos.toLocaleString()}`} color="red" />}
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
            <Kpi label="Total registrado" value={`$${Object.values(metodosMap).reduce((a, v) => a + v, 0).toLocaleString()}`} />
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

        {/* ── Gráficas de pastel ── */}
        {(pieMetodos.length > 0 || PIE_STATUS.length > 0) && (
          <div className="stats-block">
            <div className="section-title">Distribución</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {pieMetodos.length > 0 && (
                <div className="card" style={{ padding: '16px 12px 8px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4, textAlign: 'center' }}>
                    Entradas por método
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieMetodos} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" outerRadius={72} innerRadius={36}
                        paddingAngle={3} strokeWidth={0}>
                        {pieMetodos.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        formatter={(v) => [`$${v.toLocaleString()}`]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              {PIE_STATUS.length > 0 && (
                <div className="card" style={{ padding: '16px 12px 8px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4, textAlign: 'center' }}>
                    Sesiones por estatus
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={PIE_STATUS} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" outerRadius={72} innerRadius={36}
                        paddingAngle={3} strokeWidth={0}>
                        {PIE_STATUS.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        formatter={(v, name) => [v, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}

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
          {extrasTableError ? (
            <div className="card" style={{ padding: '14px 20px' }}>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
                Crea la tabla en Supabase → SQL Editor:
              </p>
              <pre style={{ fontSize: 11, background: 'var(--bg3)', borderRadius: 8, padding: 12, overflowX: 'auto', color: 'var(--text2)', lineHeight: 1.6 }}>{`create table if not exists session_extras (
  id         uuid default gen_random_uuid() primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  concepto   text not null,
  monto      numeric(10,2) not null,
  created_at timestamptz default now()
);
alter table session_extras enable row level security;
create policy "allow_all" on session_extras
  for all using (true) with check (true);`}</pre>
            </div>
          ) : extrasEntries.length > 0 ? (
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
