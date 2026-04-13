import { useState, useEffect, useMemo } from 'react'
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
  { key: 'cupon',         label: 'Cupón' },
]

export default function SessionModal({ session, prefillDate, prefillHora, onSave, onClose, onDelete, sessions = [] }) {
  const { config } = useConfig()
  const toast = useToast()
  const isNew = !session?.id
  const [nameFocused, setNameFocused] = useState(false)

  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    fecha: prefillDate || todayStr(),
    hora: prefillHora || '10:00',
    personas: 1,
    ninos: 0,
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

  // Unique clients derived from session history
  const clients = useMemo(() => {
    if (!sessions.length) return []
    const map = {}
    sessions.forEach(s => {
      const phone = s.telefono?.replace(/\D/g, '').slice(-10)
      if (!phone || phone.length < 10) return
      if (!map[phone] || s.fecha > map[phone].fecha) {
        map[phone] = { nombre: s.nombre, telefono: s.telefono, fecha: s.fecha, count: (map[phone]?.count || 0) + 1 }
      } else {
        map[phone].count = (map[phone].count || 1) + 1
      }
    })
    return Object.values(map).sort((a, b) => b.fecha > a.fecha ? 1 : -1)
  }, [sessions])

  const suggestions = useMemo(() => {
    if (!isNew || !nameFocused || !form.nombre.trim()) return []
    const q = form.nombre.toLowerCase()
    return clients
      .filter(c => c.nombre?.toLowerCase().includes(q) || c.telefono?.includes(form.nombre.replace(/\D/g, '')))
      .slice(0, 7)
  }, [clients, form.nombre, isNew, nameFocused])

  const selectClient = (c) => {
    setForm(f => ({ ...f, nombre: c.nombre, telefono: c.telefono }))
    setNameFocused(false)
  }

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast('El nombre es requerido', 'error'); return }
    const digits = form.telefono.replace(/\D/g, '')
    if (digits.length !== 10) { toast('El teléfono debe tener exactamente 10 dígitos', 'error'); return }
    if (!form.fecha) { toast('La fecha es requerida', 'error'); return }
    if (!form.hora)  { toast('La hora es requerida', 'error'); return }
    const hora = form.hora.slice(0, 5)
    const openTime  = (config.open_time  || '00:00').slice(0, 5)
    const closeTime = (config.close_time || '23:59').slice(0, 5)
    if (hora < openTime)  { toast(`La hora no puede ser antes de la apertura (${openTime})`, 'error'); return }
    if (hora > closeTime) { toast(`La hora no puede ser después del cierre (${closeTime})`, 'error'); return }
    if (isNew) {
      const now = new Date()
      const nowStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
      const nowTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
      if (form.fecha < nowStr || (form.fecha === nowStr && hora <= nowTime)) {
        toast('No puedes agendar sesiones en el pasado', 'error'); return
      }
    }
    const dayOfWeek = new Date(form.fecha + 'T12:00:00').getDay()
    const closedWeekdays = config.closed_weekdays || []
    const blockedDates   = config.blocked_dates   || []
    const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
    if (closedWeekdays.includes(dayOfWeek)) {
      toast(`El estudio está cerrado los ${DIAS[dayOfWeek]}`, 'error'); return
    }
    if (blockedDates.includes(form.fecha)) {
      toast('Esa fecha está bloqueada', 'error'); return
    }
    if (+form.anticipo > 0 && !form.metodo_anticipo) {
      toast('Selecciona el método del anticipo', 'error'); return
    }
    if (form.metodo_anticipo === 'cupon' && !(+form.anticipo > 0)) {
      toast('Ingresa el costo de sesión cubierto por el cupón', 'error'); return
    }
    if (form.metodo_anticipo === 'cupon' && !form.notas.trim()) {
      toast('Las notas internas son obligatorias al usar cupón (indica el tipo)', 'error'); return
    }
    const toNum = v => (v === '' || v == null) ? null : +v
    const payload = {
      ...form,
      anticipo:  toNum(form.anticipo),
      restante:  toNum(form.restante),
      descuento: toNum(form.descuento),
      pagos:     toNum(form.pagos),
    }
    setSaving(true)
    await onSave(payload)
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
          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">Nombre completo *</label>
            <input
              className="form-input"
              value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              placeholder="Nombre del cliente"
              onFocus={() => setNameFocused(true)}
              onBlur={() => setTimeout(() => setNameFocused(false), 150)}
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <div className="client-suggestions">
                {suggestions.map((c, i) => (
                  <div key={i} className="client-suggestion" onMouseDown={() => selectClient(c)}>
                    <div className="client-suggestion-name">{c.nombre}</div>
                    <div className="client-suggestion-meta">
                      {c.telefono}
                      {' · '}{c.count} sesión{c.count !== 1 ? 'es' : ''}
                      {c.fecha && ` · últ. ${fmtDate(c.fecha)}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">
              Teléfono * <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 11 }}>(10 dígitos)</span>
            </label>
            <input className="form-input" value={form.telefono} inputMode="numeric"
              onChange={e => set('telefono', e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="5512345678"
              style={form.telefono.length > 0 && form.telefono.length !== 10 ? { borderColor: 'var(--red)' } : {}} />
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
            <label className="form-label">
              Personas {form.personas > 4 && <span style={{ color: 'var(--amber-l)', fontSize: 11 }}>+{form.personas - 4} cargo extra</span>}
            </label>
            <input className="form-input" type="number" min="1" max="20" value={form.personas}
              onChange={e => set('personas', +e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Niños menores de 2 años</label>
            <input className="form-input" type="number" min="0" max="5" value={form.ninos}
              onChange={e => set('ninos', Math.min(5, Math.max(0, +e.target.value)))} />
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
            <label className="form-label">
              {form.metodo_anticipo === 'cupon' ? 'Costo de sesión (cupón) *' : 'Anticipo recibido ($)'}
            </label>
            <input className="form-input" type="number" min="0" value={form.anticipo}
              onChange={e => set('anticipo', e.target.value)}
              placeholder={form.metodo_anticipo === 'cupon' ? 'Costo total de la sesión' : '0'} />
          </div>
          <div className="form-group">
            <label className="form-label">
              Método del anticipo{+form.anticipo > 0 ? ' *' : ''}
            </label>
            <div className="method-tabs" style={+form.anticipo > 0 && !form.metodo_anticipo
              ? { outline: '2px solid var(--red)', borderRadius: 'var(--r1)' } : {}}>
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
            <label className="form-label">
              Notas internas{form.metodo_anticipo === 'cupon' ? ' *' : ''}
            </label>
            <textarea className="form-input" value={form.notas}
              onChange={e => set('notas', e.target.value)}
              placeholder={form.metodo_anticipo === 'cupon'
                ? 'Tipo de Cupón: '
                : 'Trae bebé, quiere foto familiar, liquidar en efectivo…'}
              style={form.metodo_anticipo === 'cupon' && !form.notas.trim()
                ? { borderColor: 'var(--amber)', boxShadow: '0 0 0 2px color-mix(in srgb, var(--amber) 20%, transparent)' }
                : {}} />
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
