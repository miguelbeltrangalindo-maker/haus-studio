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
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Nombre del estudio</label>
                <input className="form-input" value={form.studio_name || ''}
                  onChange={e => set('studio_name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Horario apertura</label>
                <input className="form-input" type="time" value={form.open_time || '09:00'}
                  onChange={e => set('open_time', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Horario cierre</label>
                <input className="form-input" type="time" value={form.close_time || '20:00'}
                  onChange={e => set('close_time', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Duración de bloque (min)</label>
                <input className="form-input" type="number" min="15" max="120" step="15"
                  value={form.block_minutes || 30}
                  onChange={e => set('block_minutes', +e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Rango de estadísticas (días)</label>
                <select className="form-input" value={form.stats_range || 30}
                  onChange={e => set('stats_range', +e.target.value)}>
                  <option value={7}>Próximos 7 días</option>
                  <option value={14}>Próximas 2 semanas</option>
                  <option value={30}>Próximos 30 días</option>
                  <option value={60}>Próximos 2 meses</option>
                  <option value={90}>Próximos 3 meses</option>
                </select>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                  Período que se muestra en el Dashboard
                </span>
              </div>
            </div>
          </div>

          <div className="config-section">
            <div className="config-title">Mensaje de recordatorio — WhatsApp</div>
            <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text3)' }}>
              Variables: <code style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4 }}>{'{nombre}'}</code>{' '}
              <code style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4 }}>{'{fecha}'}</code>{' '}
              <code style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4 }}>{'{hora}'}</code>
            </div>
            <div className="form-group">
              <textarea className="form-input" rows="7"
                value={form.reminder_message || ''}
                onChange={e => set('reminder_message', e.target.value)} />
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Vista previa</div>
              <div style={{
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 'var(--r2)', padding: '12px 16px',
                fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap',
              }}>
                {(form.reminder_message || '')
                  .replace(/{nombre}/g, 'Ana García')
                  .replace(/{fecha}/g, '15/06/2025')
                  .replace(/{hora}/g, '10:00')}
              </div>
            </div>
          </div>

          <div className="config-section">
            <div className="config-title">Mensaje de entrega de fotos — WhatsApp</div>
            <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text3)' }}>
              Variables: <code style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4 }}>{'{nombre}'}</code>{' '}
              <code style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4 }}>{'{link}'}</code>
            </div>
            <div className="form-group">
              <textarea className="form-input" rows="6"
                value={form.delivery_message || ''}
                onChange={e => set('delivery_message', e.target.value)} />
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Vista previa</div>
              <div style={{
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 'var(--r2)', padding: '12px 16px',
                fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap',
              }}>
                {(form.delivery_message || '')
                  .replace(/{nombre}/g, 'Ana García')
                  .replace(/{link}/g, 'https://drive.google.com/tu-galeria')}
              </div>
            </div>
          </div>

          <div style={{ paddingTop: 8 }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar todos los cambios'}
            </button>
          </div>

        </div>
      </div>
    </>
  )
}
