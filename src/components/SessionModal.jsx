import { useState, useEffect } from 'react'
import { ALL_STATUSES, fmtDate, todayStr } from '../lib/utils'
import { useConfig } from '../hooks/useConfig'
import { useToast } from '../hooks/useToast'
import Badge from './Badge'

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
    anticipo: 0,
    restante: 0,
    notas: '',
    link: '',
    seguimiento: '',
    reminder_sent: false,
    link_sent: false,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (session) setForm({ ...form, ...session })
  }, [session])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast('El nombre es requerido', 'error'); return }
    if (!form.telefono.trim()) { toast('El teléfono es requerido', 'error'); return }
    if (!form.fecha) { toast('La fecha es requerida', 'error'); return }
    if (!form.hora) { toast('La hora es requerida', 'error'); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const openWhatsApp = (type) => {
    const phone = '52' + form.telefono.replace(/\D/g, '').replace(/^52/, '').replace(/^1/, '')
    let msg = ''
    if (type === 'reminder') {
      msg = (config.reminder_message || '')
        .replace(/{nombre}/g, form.nombre)
        .replace(/{fecha}/g, fmtDate(form.fecha))
        .replace(/{hora}/g, form.hora)
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

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{isNew ? 'Nueva sesión' : form.nombre}</div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Nombre completo *</label>
            <input className="form-input" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre del cliente" />
          </div>
          <div className="form-group">
            <label className="form-label">Teléfono *</label>
            <input className="form-input" value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="5512345678" />
          </div>
          <div className="form-group">
            <label className="form-label">Fecha *</label>
            <input className="form-input" type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Hora *</label>
            <input className="form-input" type="time" value={form.hora} onChange={e => set('hora', e.target.value)} step="1800" />
          </div>
          <div className="form-group">
            <label className="form-label">Personas asistentes</label>
            <input className="form-input" type="number" min="1" max="20" value={form.personas} onChange={e => set('personas', +e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Estatus</label>
            <select className="form-input" value={form.estatus} onChange={e => set('estatus', e.target.value)}>
              {ALL_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Anticipo recibido ($)</label>
            <input className="form-input" type="number" min="0" value={form.anticipo} onChange={e => set('anticipo', +e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Monto restante ($)</label>
            <input className="form-input" type="number" min="0" value={form.restante} onChange={e => set('restante', +e.target.value)} />
          </div>
          <div className="form-group full">
            <label className="form-label">Notas internas</label>
            <textarea className="form-input" value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="ej. trae bebé, quiere foto familiar, liquidar en efectivo..." />
          </div>
          <div className="form-group full">
            <label className="form-label">Vínculo de entrega de fotos</label>
            <input className="form-input" value={form.link} onChange={e => set('link', e.target.value)} placeholder="https://drive.google.com/..." />
          </div>
          <div className="form-group full">
            <label className="form-label">Observaciones de seguimiento</label>
            <textarea className="form-input" value={form.seguimiento} onChange={e => set('seguimiento', e.target.value)} placeholder="Seguimiento, estado de edición, pendientes..." />
          </div>

          {!isNew && (
            <div className="form-group full">
              <label className="form-label">Trazabilidad</label>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.reminder_sent} onChange={e => set('reminder_sent', e.target.checked)} />
                  <span>Recordatorio enviado</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.link_sent} onChange={e => set('link_sent', e.target.checked)} />
                  <span>Fotos enviadas</span>
                </label>
                {session?.created_at && (
                  <span style={{ color: 'var(--text3)', fontSize: 12 }}>
                    Creado: {new Date(session.created_at).toLocaleDateString('es-MX')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          {!isNew && (
            <>
              <button className="btn btn-wa btn-sm" onClick={() => openWhatsApp('reminder')}>
                📱 Recordatorio
              </button>
              {form.link && (
                <button className="btn btn-wa btn-sm" onClick={() => openWhatsApp('delivery')}>
                  📸 Enviar fotos
                </button>
              )}
              <button className="btn btn-danger btn-sm" onClick={() => onDelete && onDelete()}>
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
