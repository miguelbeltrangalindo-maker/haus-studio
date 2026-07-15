import { useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { todayStr } from '../lib/utils'

const METHOD_LABEL = {
  efectivo:      'Efectivo',
  transferencia: 'Transferencia',
  tarjeta:       'Tarjeta',
  'sin-metodo':  'Sin método registrado',
}
const METHOD_ORDER = ['efectivo', 'transferencia', 'tarjeta', 'sin-metodo']

// Fecha local (no UTC) de un timestamp ISO — los cobros de la noche cuentan en el día correcto
const localDate = (iso) => iso ? format(new Date(iso), 'yyyy-MM-dd') : ''

export default function CorteSheet({ sessions = [], pagos = [], gastos = [], onClose }) {
  const hoy = todayStr()

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const corte = useMemo(() => {
    // Entradas por método: anticipos de sesiones creadas hoy (cupón no es dinero)
    // + cobros de saldo registrados hoy
    const porMetodo = {}
    const add = (metodo, monto) => {
      const key = METHOD_LABEL[metodo] ? metodo : 'sin-metodo'
      if (!porMetodo[key]) porMetodo[key] = { monto: 0, count: 0 }
      porMetodo[key].monto += monto
      porMetodo[key].count += 1
    }

    sessions.forEach(s => {
      if (localDate(s.created_at) !== hoy) return
      if (s.metodo_anticipo === 'cupon') return
      const monto = +s.anticipo || 0
      if (monto > 0) add(s.metodo_anticipo, monto)
    })

    pagos.forEach(p => {
      if (localDate(p.created_at) !== hoy) return
      const monto = +p.monto || 0
      if (monto > 0) add(p.metodo, monto)
    })

    const totalCobrado = Object.values(porMetodo).reduce((a, m) => a + m.monto, 0)
    const movimientos  = Object.values(porMetodo).reduce((a, m) => a + m.count, 0)

    // Salidas del día
    const gastosHoy     = gastos.filter(g => g.fecha === hoy && !g.auto_comision)
    const comisionesHoy = gastos.filter(g => g.fecha === hoy && g.auto_comision)
    const totalGastos     = gastosHoy.reduce((a, g) => a + (+g.monto || 0), 0)
    const totalComisiones = comisionesHoy.reduce((a, g) => a + (+g.monto || 0), 0)

    return {
      porMetodo, totalCobrado, movimientos,
      gastosHoy, totalGastos,
      comisionesHoy, totalComisiones,
      neto: totalCobrado - totalGastos - totalComisiones,
      efectivoEnCaja: porMetodo.efectivo?.monto || 0,
    }
  }, [sessions, pagos, gastos, hoy])

  const dateLabel = format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })
  const fmt = (n) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

  const Row = ({ label, sub, value, color, strong }) => (
    <div className="dp-meta-row" style={{ paddingBlock: 7 }}>
      <span className="dp-meta-label" style={strong ? { fontWeight: 600, color: 'var(--text1)' } : {}}>
        {label}
        {sub != null && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>{sub}</span>}
      </span>
      <span className="dp-meta-value" style={{ fontWeight: strong ? 700 : 600, color: color || 'var(--text1)' }}>
        {value}
      </span>
    </div>
  )

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div
        className="modal qc-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="corte-title"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 460 }}
      >
        <div id="corte-title" className="modal-title" style={{ fontSize: 22, marginBottom: 2 }}>
          Corte del día
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 18, textTransform: 'capitalize' }}>
          {dateLabel}
        </div>

        {corte.movimientos === 0 && corte.gastosHoy.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0 20px', color: 'var(--text3)', fontSize: 13 }}>
            Sin movimientos registrados hoy
          </div>
        ) : (
          <>
            {/* Total cobrado — número principal */}
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--green)', letterSpacing: '-0.02em' }}>
                {fmt(corte.totalCobrado)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                cobrado hoy · {corte.movimientos} movimiento{corte.movimientos !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Entradas por método */}
            <div className="dp-section-label" style={{ marginBottom: 4 }}>Entradas por método</div>
            <div style={{ marginBottom: 16 }}>
              {METHOD_ORDER.filter(k => corte.porMetodo[k]).map(k => (
                <Row
                  key={k}
                  label={METHOD_LABEL[k]}
                  sub={`×${corte.porMetodo[k].count}`}
                  value={fmt(corte.porMetodo[k].monto)}
                  color="var(--green)"
                />
              ))}
            </div>

            {/* Efectivo esperado en caja */}
            <div style={{
              background: 'color-mix(in srgb, var(--green) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)',
              borderRadius: 'var(--r2)', padding: '10px 14px', marginBottom: 16,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>
                Efectivo esperado en caja
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>
                {fmt(corte.efectivoEnCaja)}
              </span>
            </div>

            {/* Salidas */}
            {(corte.totalGastos > 0 || corte.totalComisiones > 0) && (
              <>
                <div className="dp-section-label" style={{ marginBottom: 4 }}>Salidas de hoy</div>
                <div style={{ marginBottom: 16 }}>
                  {corte.totalGastos > 0 && (
                    <Row
                      label="Gastos registrados"
                      sub={`×${corte.gastosHoy.length}`}
                      value={`−${fmt(corte.totalGastos)}`}
                      color="var(--red)"
                    />
                  )}
                  {corte.totalComisiones > 0 && (
                    <Row
                      label="Comisiones de tarjeta"
                      sub={`×${corte.comisionesHoy.length}`}
                      value={`−${fmt(corte.totalComisiones)}`}
                      color="var(--red)"
                    />
                  )}
                </div>
              </>
            )}

            {/* Neto */}
            <div style={{
              borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 4,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Neto del día</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: corte.neto >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {corte.neto < 0 ? '−' : ''}{fmt(Math.abs(corte.neto))}
              </span>
            </div>
          </>
        )}

        <button className="btn btn-sm" onClick={onClose} style={{ width: '100%', marginTop: 16 }}>
          Cerrar
        </button>
      </div>
    </div>
  )
}
