import { useState, useEffect } from 'react'
import { ALL_STATUSES, fmtDate, todayStr, nextStatus, nextStatusLabel } from '../lib/utils'
import { useConfig } from '../hooks/useConfig'
import { useToast } from '../hooks/useToast'
import Badge from './Badge'

const METHODS = [
  { key: 'efectivo',      label: 'Efectivo' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'tarjeta',       label: 'Tarjeta' },
]
const ANTICIPO_METHODS = [
  { key: 'efectivo',      label: 'Efectivo' },
  { key: 'transferencia', label: 'Transferencia' },
]

export default function SessionModal({ session, prefillDate, prefillHora, onSave, onClose, onDelete }) {
  const { config } = useConfig()
  const toast = useToast()
  const isNew = !session?.id

  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    fecha: prefillDate || todayStr(),
    hora: prefillHora || '10:00',
    personas: 1,
    estatus: 'Reservada',
    anticipo: '',
    metodo_anticipo: '',
    restante: '',
    descuento: '',
    metodo_pago: '',
    pagos: 0,
    notas: '',
    link: '',
    seguimiento: '',
    reminder_sent: false,
    link_sent: false,
  })
  const [saving, setSaving] = useState(false)

  // Payment panel state
  const [payAmount, setPayAmount]   = useState('')
  const [payMethod, setPayMethod]   = useState('efectivo')

  useEffect(() => {
    if (session) setForm(f => ({ ...f, ...session }))
  }, [session])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast('El nombre es requerido', 'error'); return }
    if (!form.telefono.trim()) { toast('El teléfono es requerido', 'error'); return }
    if (!form.fecha) { toast('La fecha es requerida', 'error'); return }
    if (!form.hora)  { toast('La hora es requerida', 'error'); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  // ── Cobrar saldo ──
  const handleCobrar = async () => {
    const amount = +payAmount
    if (!amount || amount <= 0) { toast('Ingresa un monto válido', 'error'); return }
    const currentRestante = +form.restante || 0
    if (amount > currentRestante) { toast(`El monto no puede superar $${currentRestante.toLocaleString()}`, 'error'); return }
    const newRestante = Math.max(0, currentRestante - amount)
    const updated = {
      ...form,
      restante:    String(newRestante),
      metodo_pago: payMethod,
      pagos:       (+form.pagos || 0) + amount, // accumulate balance collected
      // If now fully paid and was in "Pendiente de pago", advance to Completada
      estatus: (newRestante === 0 && form.estatus === 'Pendiente de pago') ? 'Completada' : form.estatus,
    }
    setSaving(true)
    await onSave(updated)
    setSaving(false)
  }

  const openWhatsApp = (type) => {
    const phone = '52' + form.telefono.replace(/\D/g, '').replace(/^52/, '')
    let msg = ''
    if (type === 'reminder') {
      msg = (config.reminder_message || '')
        .replace(/{nombre}/g, form.nombre)
        .replace(/{fecha}/g, fmtDate(form.fecha))
        .replace(/{hora}/g, form.hora?.slice(0, 5) || form.hora)
      set('reminder_sent', true)
    } else {
      if (!form.link) { toast('Agrega primero el vínculo de fotos', 'error'); return }
      msg = (config.delivery_message || '')
        .replace(/{nombre}/g, form.nombre)
        .replace(/{link}/g, form.link)
      set('link_sent', true)
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const nextSt  = nextStatus(form.estatus)
  const nextLbl = nextStatusLabel(form.estatus)
  const hasPending = !isNew && (+form.restante > 0)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-title">{isNew ? 'Nueva sesión' : form.nombre || 'Sesión'}</div>
        {!isNew && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Badge status={form.estatus} />
            {nextSt && (
              <button className="btn btn-xs btn-primary" onClick={() => set('estatus', nextSt)}>
                → {nextLbl}
              </button>
            )}
          </div>
        )}
        {isNew && <div style={{ marginBottom: 20 }} />}

        {/* Contacto */}
        <div className="modal-section-title">Contacto</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Nombre completo *</label>
            <input className="form-input" value={form.nombre}
              onChange={e => set('nombre', e.target.value)} placeholder="Nombre del cliente" />
          </div>
          <div className="form-group">
            <label className="form-label">Teléfono *</label>
            <input className="form-input" value={form.telefono}
              onChange={e => set('telefono', e.target.value)} placeholder="5512345678" />
          </div>
        </div>

        {/* Sesión */}
        <div className="modal-section-title">Sesión</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Fecha *</label>
            <input className="form-input" type="date" value={form.fecha}
              onChange={e => set('fecha', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Hora *</label>
            <input className="form-input" type="time" value={form.hora}
              onChange={e => set('hora', e.target.value)} step="1800" />
          </div>
          <div className="form-group">
            <label className="form-label">Personas</label>
            <input className="form-input" type="number" min="1" max="20" value={form.personas}
              onChange={e => set('personas', +e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Estatus</label>
            <select className="form-input" value={form.estatus}
              onChange={e => set('estatus', e.target.value)}>
              {ALL_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Pago */}
        <div className="modal-section-title">Pago</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Anticipo recibido ($)</label>
            <input className="form-input" type="number" min="0" value={form.anticipo}
              onChange={e => set('anticipo', e.target.value)} placeholder="0" />
          </div>
          <div className="form-group">
            <label className="form-label">Método del anticipo</label>
            <div className="method-tabs">
              {ANTICIPO_METHODS.map(m => (
                <button key={m.key} type="button"
                  className={`method-tab ${form.metodo_anticipo === m.key ? 'active' : ''}`}
                  onClick={() => set('metodo_anticipo', form.metodo_anticipo === m.key ? '' : m.key)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Saldo pendiente ($)</label>
            <input className="form-input" type="number" min="0" value={form.restante}
              onChange={e => set('restante', e.target.value)} placeholder="0" />
          </div>
          <div className="form-group">
            <label className="form-label">Descuento ($)</label>
            <input className="form-input" type="number" min="0"
              value={form.descuento || ''}
              onChange={e => {
                const desc = +e.target.value || 0
                const restante = +form.restante || 0
                if (desc > restante) { set('descuento', restante); return }
                set('descuento', e.target.value)
              }}
              placeholder="0" />
            {(+form.descuento > 0) && (
              <div style={{ fontSize: 12, color: 'var(--green-l)', marginTop: 4 }}>
                Saldo después del descuento: ${Math.max(0, (+form.restante || 0) - (+form.descuento || 0)).toLocaleString()}
              </div>
            )}
          </div>
          {form.metodo_pago && (
            <div className="form-group">
              <label className="form-label">Último método de pago (saldo)</label>
              <input className="form-input" value={
                form.metodo_pago === 'efectivo' ? 'Efectivo'
                : form.metodo_pago === 'transferencia' ? 'Transferencia'
                : 'Tarjeta'
              } readOnly style={{ color: 'var(--text3)', cursor: 'default' }} />
            </div>
          )}
        </div>

        {/* ── Cobrar saldo pendiente ── */}
        {hasPending && (
          <>
            <div className="modal-section-title" style={{ color: 'var(--amber-l)' }}>
              Cobrar saldo pendiente
            </div>
            <div className="payment-panel">
              <div className="payment-summary">
                <span className="payment-summary-label">Saldo pendiente</span>
                <span className="payment-summary-amount">${(+form.restante).toLocaleString()}</span>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Monto a cobrar ($)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    max={form.restante}
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    placeholder={form.restante}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Método de pago</label>
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
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleCobrar}
                  disabled={saving || !payAmount || +payAmount <= 0}
                >
                  {saving ? 'Guardando…' : 'Cobrar y guardar'}
                </button>
                {payAmount && +payAmount > 0 && +payAmount < +form.restante && (
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                    Quedará pendiente: ${(+form.restante - +payAmount).toLocaleString()}
                  </span>
                )}
                {payAmount && +payAmount >= +form.restante && (
                  <span style={{ fontSize: 12, color: 'var(--green-l)' }}>
                    Saldo liquidado ✓
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        {/* Notas y entrega */}
        <div className="modal-section-title">Notas y entrega</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Notas internas</label>
            <textarea className="form-input" value={form.notas}
              onChange={e => set('notas', e.target.value)}
              placeholder="Trae bebé, quiere foto familiar, liquidar en efectivo…" />
          </div>
          <div className="form-group">
            <label className="form-label">Vínculo de entrega</label>
            <input className="form-input" value={form.link}
              onChange={e => set('link', e.target.value)}
              placeholder="https://drive.google.com/…" />
          </div>
          <div className="form-group">
            <label className="form-label">Seguimiento</label>
            <textarea className="form-input" value={form.seguimiento}
              onChange={e => set('seguimiento', e.target.value)}
              placeholder="Estado de edición, pendientes…" />
          </div>
        </div>

        {/* Trazabilidad */}
        {!isNew && (
          <>
            <div className="modal-section-title">Trazabilidad</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={!!form.reminder_sent}
                  onChange={e => set('reminder_sent', e.target.checked)} />
                Recordatorio enviado
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={!!form.link_sent}
                  onChange={e => set('link_sent', e.target.checked)} />
                Fotos enviadas
              </label>
              {session?.created_at && (
                <span style={{ color: 'var(--text3)', fontSize: 12 }}>
                  Creado {new Date(session.created_at).toLocaleDateString('es-MX')}
                </span>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>

          {!isNew && (
            <>
              <button className="btn btn-wa btn-sm" onClick={() => openWhatsApp('reminder')}
                style={form.reminder_sent ? { opacity: .65 } : {}}>
                {form.reminder_sent ? '✓ Recordatorio' : '📱 Recordatorio'}
              </button>
              {form.link && (
                <button className="btn btn-wa btn-sm" onClick={() => openWhatsApp('delivery')}
                  style={form.link_sent ? { opacity: .65 } : {}}>
                  {form.link_sent ? '✓ Fotos enviadas' : '📸 Enviar fotos'}
                </button>
              )}
              <button className="btn btn-danger btn-sm" onClick={() => onDelete?.()}>
                Cancelar sesión
              </button>
            </>
          )}

          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>

      </div>
    </div>
  )
}
