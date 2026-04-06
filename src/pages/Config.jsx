import { useState, useEffect } from 'react'
import { useConfig } from '../hooks/useConfig'
import { useToast } from '../hooks/useToast'

export default function Config() {
  const { config, updateConfig } = useConfig()
  const toast = useToast()
  const [form, setForm] = useState(config)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setForm(config) }, [config])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    await updateConfig(form)
    toast('Configuración guardada', 'success')
    setSaving(false)
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Configuración</div>
        <div className="topbar-right">
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <div className="page-content">
        <div style={{ maxWidth: 640 }}>

          <div className="config-section">
            <div className="config-title">Estudio</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Nombre del estudio</label>
                <input className="form-input" value={form.studio_name || ''} onChange={e => set('studio_name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Horario de apertura</label>
                <input className="form-input" type="time" value={form.open_time || '09:00'} onChange={e => set('open_time', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Horario de cierre</label>
                <input className="form-input" type="time" value={form.close_time || '20:00'} onChange={e => set('close_time', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Duración del bloque (min)</label>
                <input className="form-input" type="number" min="15" max="120" step="15"
                  value={form.block_minutes || 30} onChange={e => set('block_minutes', +e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Duración real de sesión (min)</label>
                <input className="form-input" type="number" min="5" max="120"
                  value={form.session_minutes || 20} onChange={e => set('session_minutes', +e.target.value)} />
              </div>
            </div>
          </div>

          <div className="config-section">
            <div className="config-title">Mensaje de recordatorio — WhatsApp</div>
            <div className="form-group">
              <label className="form-label">Variables disponibles: {'{nombre}'} {'{fecha}'} {'{hora}'}</label>
              <textarea className="form-input" rows="6"
                value={form.reminder_message || ''}
                onChange={e => set('reminder_message', e.target.value)} />
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Vista previa:</div>
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '10px 14px', fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {(form.reminder_message || '').replace(/{nombre}/g, 'Ana García').replace(/{fecha}/g, '15/06/2025').replace(/{hora}/g, '10:00')}
              </div>
            </div>
          </div>

          <div className="config-section">
            <div className="config-title">Mensaje de entrega de fotos — WhatsApp</div>
            <div className="form-group">
              <label className="form-label">Variables disponibles: {'{nombre}'} {'{link}'}</label>
              <textarea className="form-input" rows="5"
                value={form.delivery_message || ''}
                onChange={e => set('delivery_message', e.target.value)} />
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Vista previa:</div>
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '10px 14px', fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {(form.delivery_message || '').replace(/{nombre}/g, 'Ana García').replace(/{link}/g, 'https://drive.google.com/tu-galeria')}
              </div>
            </div>
          </div>

          <div style={{ paddingTop: 16 }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar todos los cambios'}
            </button>
          </div>

        </div>
      </div>
    </>
  )
}
