import { useState, useEffect } from 'react'
import { format, addDays } from 'date-fns'
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

  // Defaults if never saved before
  const defaultStart = format(new Date(), 'yyyy-MM-dd')
  const defaultEnd   = format(addDays(new Date(), 29), 'yyyy-MM-dd')

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
            </div>
          </div>

          <div className="config-section">
            <div className="config-title">Rango de estadísticas — Dashboard</div>
            <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--text3)' }}>
              Define el período de fechas para calcular todas las métricas del Dashboard: sesiones agendadas, montos por cobrar, sesiones liquidadas, etc.
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Fecha de inicio</label>
                <input className="form-input" type="date"
                  value={form.stats_start || defaultStart}
                  onChange={e => set('stats_start', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha de fin</label>
                <input className="form-input" type="date"
                  value={form.stats_end || defaultEnd}
                  min={form.stats_start || defaultStart}
                  onChange={e => set('stats_end', e.target.value)} />
              </div>
            </div>
            {(form.stats_start || form.stats_end) && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 10 }}
                onClick={() => { set('stats_start', ''); set('stats_end', '') }}
              >
                Restablecer a 30 días desde hoy
              </button>
            )}
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
