import { useState } from 'react'
import { fmtDate, nextStatus, nextStatusLabel } from '../lib/utils'
import { useConfig } from '../hooks/useConfig'
import { useToast } from '../hooks/useToast'
import Badge from './Badge'
import SessionModal from './SessionModal'

const METHODS = [
  { key: 'efectivo',      label: 'Efectivo' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'tarjeta',       label: 'Tarjeta' },
]

const METHOD_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta' }

export default function SessionDetails({ session, onClose, updateSession, sessionPagos = [], createPago }) {
  const { config } = useConfig()
  const toast = useToast()
  const [editOpen, setEditOpen]     = useState(false)
  const [advancing, setAdvancing]   = useState(false)
  const [payAmount, setPayAmount]   = useState('')
  const [payMethod, setPayMethod]   = useState('efectivo')
  const [paying, setPaying]         = useState(false)

  if (!session) return null

  const nextSt  = nextStatus(session.estatus)
  const nextLbl = nextStatusLabel(session.estatus)
  const hasPending = +session.restante > 0

  const handleAdvance = async () => {
    if (!nextSt) return
    setAdvancing(true)
    const result = await updateSession(session.id, { estatus: nextSt })
    if (result.error) toast(result.error, 'error')
    else toast(`${session.nombre.split(' ')[0]} → ${nextSt}`, 'success')
    setAdvancing(false)
  }

  const handleCobrar = async () => {
    const amount = +payAmount
    if (!amount || amount <= 0) { toast('Ingresa un monto válido', 'error'); return }
    const currentRestante = +session.restante || 0
    const newRestante = Math.max(0, currentRestante - amount)
    const updates = {
      restante:    String(newRestante),
      metodo_pago: payMethod,
      pagos:       (+session.pagos || 0) + amount,
      estatus:     (newRestante === 0 && session.estatus === 'Pendiente de pago') ? 'Completada' : session.estatus,
    }
    setPaying(true)
    const result = await updateSession(session.id, updates)
    if (result.error) { toast(result.error, 'error'); setPaying(false); return }
    if (createPago) await createPago(session.id, amount, payMethod)
    toast(`$${amount.toLocaleString()} cobrado ✓`, 'success')
    setPayAmount('')
    setPaying(false)
  }

  const openWA = (type) => {
    const phone = '52' + session.telefono.replace(/\D/g, '').replace(/^52/, '')
    let msg = ''
    if (type === 'reminder') {
      msg = (config.reminder_message || '')
        .replace(/{nombre}/g, session.nombre)
        .replace(/{fecha}/g, fmtDate(session.fecha))
        .replace(/{hora}/g, session.hora?.slice(0, 5))
      updateSession(session.id, { reminder_sent: true })
    } else {
      if (!session.link) { toast('Sin vínculo de fotos', 'error'); return }
      msg = (config.delivery_message || '')
        .replace(/{nombre}/g, session.nombre)
        .replace(/{link}/g, session.link)
      updateSession(session.id, { link_sent: true })
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const handleSave = async (form) => {
    const result = await updateSession(session.id, form)
    if (result.error) { toast(result.error, 'error'); return }
    toast('Sesión actualizada', 'success')
    setEditOpen(false)
  }

  const handleDelete = async () => {
    if (!confirm('¿Cancelar esta sesión?')) return
    await updateSession(session.id, { estatus: 'Cancelada' })
    toast('Sesión cancelada')
    onClose()
  }

  return (
    <>
      <aside className="details-panel open">

        {/* Header */}
        <div className="dp-header">
          <button className="dp-close btn btn-ghost" onClick={onClose} title="Cerrar">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13"/>
            </svg>
          </button>
          <div className="dp-name">{session.nombre}</div>
          <div style={{ marginTop: 8 }}><Badge status={session.estatus} /></div>
        </div>

        {/* Date / Time */}
        <div className="dp-datetime">
          <div>
            <div className="dp-date-label">Fecha</div>
            <div className="dp-date">{fmtDate(session.fecha)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="dp-date-label">Hora</div>
            <div className="dp-time">{session.hora?.slice(0, 5)}</div>
          </div>
        </div>

        {/* Status advance */}
        {nextSt && (
          <div className="dp-section">
            <button
              className="btn btn-primary btn-sm"
              onClick={handleAdvance}
              disabled={advancing}
              style={{ width: '100%' }}
            >
              {advancing ? 'Guardando…' : `→ ${nextLbl}`}
            </button>
          </div>
        )}

        {/* Money */}
        {(+session.anticipo > 0 || +session.restante > 0) && (
          <div className="dp-money">
            {+session.anticipo > 0 && (
              <div className="dp-money-item">
                <div className="dp-money-label">Anticipo</div>
                <div className="dp-money-value green">${(+session.anticipo).toLocaleString()}</div>
              </div>
            )}
            {+session.restante > 0 && (
              <div className="dp-money-item">
                <div className="dp-money-label">Por cobrar</div>
                <div className="dp-money-value amber">${(+session.restante).toLocaleString()}</div>
              </div>
            )}
            {+session.restante === 0 && +session.anticipo > 0 && (
              <div style={{ width: '100%', marginTop: 4 }}>
                <span className="dp-paid-badge">Liquidada ✓</span>
              </div>
            )}
            {session.metodo_pago && (
              <div style={{ width: '100%', fontSize: 12, color: 'var(--text3)', marginTop: 2, textTransform: 'capitalize' }}>
                Pagado con {session.metodo_pago}
              </div>
            )}
          </div>
        )}

        {/* Cobrar saldo */}
        {hasPending && (
          <div className="dp-section">
            <div className="dp-section-label" style={{ color: 'var(--amber-l)' }}>Cobrar saldo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                className="form-input"
                type="number"
                min="1"
                max={session.restante}
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder={`Máx. $${(+session.restante).toLocaleString()}`}
              />
              <div className="method-tabs">
                {METHODS.map(m => (
                  <button
                    key={m.key}
                    type="button"
                    className={`method-tab ${payMethod === m.key ? 'active' : ''}`}
                    onClick={() => setPayMethod(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleCobrar}
                disabled={paying || !payAmount || +payAmount <= 0}
              >
                {paying ? 'Guardando…' : 'Cobrar y guardar'}
              </button>
              {payAmount && +payAmount >= +session.restante && (
                <span style={{ fontSize: 12, color: 'var(--green-l)', textAlign: 'center' }}>Saldo liquidado ✓</span>
              )}
            </div>
          </div>
        )}

        {/* Payment history */}
        {sessionPagos.length > 0 && (
          <div className="dp-section">
            <div className="dp-section-label">Historial de pagos</div>
            {sessionPagos.map(p => (
              <div key={p.id} className="dp-meta-row">
                <span className="dp-meta-label" style={{ textTransform: 'capitalize' }}>
                  {METHOD_LABEL[p.metodo] || p.metodo}
                </span>
                <span className="dp-meta-value" style={{ color: 'var(--green-l)', fontWeight: 600 }}>
                  ${(+p.monto).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Meta */}
        <div className="dp-section">
          <div className="dp-section-label">Detalle</div>
          <div className="dp-meta-row">
            <span className="dp-meta-label">Personas</span>
            <span className="dp-meta-value">{session.personas}</span>
          </div>
          {session.telefono && (
            <div className="dp-meta-row">
              <span className="dp-meta-label">Teléfono</span>
              <span className="dp-meta-value">{session.telefono}</span>
            </div>
          )}
          <div className="dp-meta-row">
            <span className="dp-meta-label">Recordatorio</span>
            <span className="dp-meta-value" style={{ color: session.reminder_sent ? 'var(--green-l)' : 'var(--text3)' }}>
              {session.reminder_sent ? 'Enviado ✓' : 'Pendiente'}
            </span>
          </div>
          {session.link && (
            <div className="dp-meta-row">
              <span className="dp-meta-label">Fotos</span>
              <span className="dp-meta-value" style={{ color: session.link_sent ? 'var(--green-l)' : 'var(--text3)' }}>
                {session.link_sent ? 'Enviadas ✓' : 'Pendiente'}
              </span>
            </div>
          )}
        </div>

        {/* Notes */}
        {session.notas && (
          <div className="dp-section">
            <div className="dp-section-label">Notas</div>
            <div className="dp-notes">{session.notas}</div>
          </div>
        )}

        {/* Link */}
        {session.link && (
          <div className="dp-section">
            <div className="dp-section-label">Entrega</div>
            <a href={session.link} target="_blank" rel="noreferrer" className="dp-link">
              Ver galería →
            </a>
          </div>
        )}

        {/* WhatsApp */}
        <div className="dp-section">
          <div className="dp-section-label">WhatsApp</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-wa btn-sm"
              onClick={() => openWA('reminder')}
              style={{ flex: 1, opacity: session.reminder_sent ? .6 : 1 }}
            >
              {session.reminder_sent ? '✓ Recordatorio' : '📱 Recordatorio'}
            </button>
            {session.link && (
              <button
                className="btn btn-wa btn-sm"
                onClick={() => openWA('delivery')}
                style={{ flex: 1, opacity: session.link_sent ? .6 : 1 }}
              >
                {session.link_sent ? '✓ Fotos' : '📸 Fotos'}
              </button>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="dp-actions">
          <button className="btn btn-sm" onClick={() => setEditOpen(true)} style={{ width: '100%' }}>
            Editar sesión completa
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleDelete} style={{ width: '100%' }}>
            Cancelar sesión
          </button>
        </div>

      </aside>

      {editOpen && (
        <SessionModal
          session={session}
          onSave={handleSave}
          onClose={() => setEditOpen(false)}
          onDelete={handleDelete}
        />
      )}
    </>
  )
}
