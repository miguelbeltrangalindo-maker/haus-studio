import { useState, useEffect } from 'react'
import { format, addDays } from 'date-fns'
import { useConfig } from '../hooks/useConfig'
import { useToast } from '../hooks/useToast'

export default function Config() {
  const { config, updateConfig } = useConfig()
  const toast = useToast()
  const [form, setForm] = useState(config)
  const [saving, setSaving] = useState(false)
  const [newConcepto, setNewConcepto] = useState('')
  const [newPrecio, setNewPrecio]     = useState('')
  const [addingC, setAddingC]         = useState(false)
  const [editingPrices, setEditingPrices] = useState({}) // { [id]: precio_string }

  useEffect(() => { setForm(config) }, [config])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const conceptos = form.extra_conceptos || []

  const handleAddConcepto = () => {
    if (!newConcepto.trim()) { toast('Ingresa un nombre', 'error'); return }
    if (!+newPrecio || +newPrecio <= 0) { toast('Ingresa un precio válido', 'error'); return }
    const nuevo = { id: crypto.randomUUID(), nombre: newConcepto.trim(), precio_unitario: +newPrecio }
    set('extra_conceptos', [...conceptos, nuevo])
    setNewConcepto('')
    setNewPrecio('')
    setAddingC(false)
  }

  const handlePriceChange = (id, value) => {
    setEditingPrices(p => ({ ...p, [id]: value }))
    const parsed = +value
    if (parsed > 0) {
      set('extra_conceptos', conceptos.map(c => c.id === id ? { ...c, precio_unitario: parsed } : c))
    }
  }

  const handleRemoveConcepto = (id) => {
    const concepto = conceptos.find(c => c.id === id)
    const primera = confirm(
      `¿Eliminar el concepto "${concepto?.nombre}"?\n\nATENCIÓN: Si este cargo ya fue aplicado a sesiones, los saldos de esas sesiones no se ajustarán automáticamente y quedarán descuadrados.`
    )
    if (!primera) return
    const segunda = confirm(
      `Confirma nuevamente: al eliminar "${concepto?.nombre}" las reglas lógicas del sistema pueden verse afectadas y los saldos existentes no cuadrarán.\n\n¿Continuar de todas formas?`
    )
    if (!segunda) return
    set('extra_conceptos', conceptos.filter(c => c.id !== id))
  }

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

          <div className="config-section">
            <div className="config-title">Cargos adicionales</div>
            <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--text3)' }}>
              Define los cargos que pueden añadirse a cada sesión. Cada uno tiene un precio por unidad y se puede aplicar hasta ×9 veces.
            </div>

            {conceptos.length > 0 && (
              <div className="card" style={{ padding: '10px 16px', marginBottom: 12 }}>
                {conceptos.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBlock: 8, borderBottom: '1px solid var(--border)' }}
                    className="dp-meta-row">
                    <span style={{ flex: 1, fontWeight: 500, fontSize: 14 }}>{c.nombre}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>$</span>
                      <input
                        className="form-input"
                        type="number"
                        min="1"
                        value={editingPrices[c.id] ?? c.precio_unitario}
                        onChange={e => handlePriceChange(c.id, e.target.value)}
                        style={{ width: 90, padding: '4px 8px', fontSize: 13, textAlign: 'right' }}
                        title="Precio por unidad"
                      />
                      <span style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>/ u</span>
                    </div>
                    <button
                      onClick={() => handleRemoveConcepto(c.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}
                      title="Eliminar"
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            {addingC ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Nombre del concepto</label>
                    <input className="form-input" placeholder="Ej. Persona adicional"
                      value={newConcepto} onChange={e => setNewConcepto(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddConcepto()} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Precio por unidad ($)</label>
                    <input className="form-input" type="number" min="1" placeholder="200"
                      value={newPrecio} onChange={e => setNewPrecio(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddConcepto()} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={handleAddConcepto}>Guardar concepto</button>
                  <button className="btn btn-sm" onClick={() => { setAddingC(false); setNewConcepto(''); setNewPrecio('') }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={() => setAddingC(true)}>+ Nuevo concepto</button>
            )}
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
