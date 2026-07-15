import { useState, useEffect } from 'react'
import { format, addDays } from 'date-fns'
import { useConfig } from '../hooks/useConfig'
import { useToast } from '../hooks/useToast'
import { supabase } from '../lib/supabase'

const Toggle = ({ checked, onChange }) => (
  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}
    onClick={() => onChange(!checked)}>
    <div style={{
      width: 44, height: 24, borderRadius: 12,
      background: checked ? 'var(--green)' : 'var(--bg3)',
      border: '1px solid var(--border)',
      position: 'relative', transition: 'background .2s',
    }}>
      <div style={{
        position: 'absolute', top: 2,
        left: checked ? 22 : 2,
        width: 18, height: 18, borderRadius: '50%',
        background: checked ? '#fff' : 'var(--text3)',
        transition: 'left .2s',
      }} />
    </div>
  </label>
)

const WaToggleCard = ({ title, sub, checked, onChange, children }) => (
  <div className="card" style={{ padding: '14px 18px', marginBottom: 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <div style={{ fontWeight: 500, fontSize: 14 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
    {children}
  </div>
)

const DIAS_SEMANA = [
  { label: 'Dom', value: 0 },
  { label: 'Lun', value: 1 },
  { label: 'Mar', value: 2 },
  { label: 'Mié', value: 3 },
  { label: 'Jue', value: 4 },
  { label: 'Vie', value: 5 },
  { label: 'Sáb', value: 6 },
]

export default function Config({ comisionSchemaReady = false }) {
  const { config, updateConfig, statsSchemaReady } = useConfig()
  const toast = useToast()
  const [form, setForm] = useState(config)
  const [saving, setSaving] = useState(false)
  const [newConcepto, setNewConcepto] = useState('')
  const [newPrecio, setNewPrecio]     = useState('')
  const [addingC, setAddingC]         = useState(false)
  const [editingPrices, setEditingPrices] = useState({})
  const [newBlockedDate, setNewBlockedDate] = useState('')
  // ── Testing Reset ──
  const [resetStep,  setResetStep]  = useState(0) // 0=hidden 1=warning 2=final
  const [resetting,  setResetting]  = useState(false)

  useEffect(() => { setForm(config) }, [config])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const conceptos       = form.extra_conceptos  || []
  const closedWeekdays  = form.closed_weekdays  || []
  const blockedDates    = form.blocked_dates    || []

  const toggleWeekday = (val) => {
    const next = closedWeekdays.includes(val)
      ? closedWeekdays.filter(d => d !== val)
      : [...closedWeekdays, val].sort()
    set('closed_weekdays', next)
  }

  const addBlockedDate = () => {
    if (!newBlockedDate) return
    if (blockedDates.includes(newBlockedDate)) { toast('Esa fecha ya está bloqueada', 'error'); return }
    set('blocked_dates', [...blockedDates, newBlockedDate].sort())
    setNewBlockedDate('')
  }

  const removeBlockedDate = (d) => set('blocked_dates', blockedDates.filter(x => x !== d))

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

  const handleTestingReset = async () => {
    setResetting(true)
    const tables = ['session_pagos', 'session_extras', 'gastos', 'sessions']
    const errors = []
    for (const table of tables) {
      const { error } = await supabase.from(table).delete().not('id', 'is', null)
      if (error && error.code !== '42P01') errors.push(`${table}: ${error.message}`)
    }
    setResetting(false)
    setResetStep(0)
    if (errors.length) {
      toast(`Errores: ${errors.join(' · ')}`, 'error')
    } else {
      toast('Sistema reiniciado — todos los datos eliminados', 'success')
      // Force a full page reload so all hooks re-fetch empty state
      setTimeout(() => window.location.reload(), 800)
    }
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
                  value={form.stats_settings?.stats_start || defaultStart}
                  onChange={e => set('stats_settings', { ...(form.stats_settings || {}), stats_start: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha de fin</label>
                <input className="form-input" type="date"
                  value={form.stats_settings?.stats_end || defaultEnd}
                  min={form.stats_settings?.stats_start || defaultStart}
                  onChange={e => set('stats_settings', { ...(form.stats_settings || {}), stats_end: e.target.value })} />
              </div>
            </div>
            {(form.stats_settings?.stats_start || form.stats_settings?.stats_end) && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 10 }}
                onClick={() => set('stats_settings', { stats_start: '', stats_end: '' })}
              >
                Restablecer a 30 días desde hoy
              </button>
            )}

            {!statsSchemaReady && (
              <div style={{
                marginTop: 16,
                background: 'var(--red-bg)', border: '1px solid rgba(156,53,53,.25)',
                borderRadius: 'var(--r2)', padding: '14px 18px',
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: 'var(--red-l)' }}>
                  Requiere migración — el rango no se guardará hasta ejecutar esto en Supabase:
                </div>
                <pre className="sql-block">{`ALTER TABLE config ADD COLUMN IF NOT EXISTS stats_settings jsonb DEFAULT '{}'::jsonb;`}</pre>
              </div>
            )}
          </div>

          <div className="config-section">
            <div className="config-title">Recordatorios de WhatsApp</div>
            <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text3)' }}>
              Los mensajes se envían usando la plantilla aprobada en Meta. El cron corre todos los días a las 9:00 AM.
            </div>

            {/* Toggle 1: confirmación al agendar */}
            {(() => {
              const wa = form.wa_settings || {}
              const setWa = (k, v) => set('wa_settings', { ...wa, [k]: v })
              return (
                <>
                  <WaToggleCard
                    title="Confirmación al agendar"
                    sub="Envía la plantilla de WA en el momento en que creas una sesión"
                    checked={!!wa.on_booking}
                    onChange={v => setWa('on_booking', v)}
                  />

                  <WaToggleCard
                    title="Recordatorio programado"
                    sub="Envía un recordatorio automático a las 9:00 AM según el tiempo configurado"
                    checked={!!wa.reminder_enabled}
                    onChange={v => setWa('reminder_enabled', v)}
                  >
                    {wa.reminder_enabled && (
                      <select
                        className="form-input"
                        style={{ maxWidth: 200, marginTop: 10 }}
                        value={wa.reminder_days ?? 1}
                        onChange={e => setWa('reminder_days', +e.target.value)}
                      >
                        <option value={0}>El mismo día de la sesión</option>
                        <option value={1}>1 día antes</option>
                        <option value={2}>2 días antes</option>
                        <option value={3}>3 días antes</option>
                      </select>
                    )}
                  </WaToggleCard>
                </>
              )
            })()}
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

          <div className="config-section">
            <div className="config-title">Días cerrados</div>
            <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--text3)' }}>
              Bloquea días de la semana o fechas específicas. No se podrán agendar sesiones en esos días.
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Días de la semana siempre cerrados</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                {DIAS_SEMANA.map(d => (
                  <button
                    key={d.value}
                    type="button"
                    className={`method-tab${closedWeekdays.includes(d.value) ? ' active' : ''}`}
                    onClick={() => toggleWeekday(d.value)}
                    style={closedWeekdays.includes(d.value) ? { background: 'var(--red)', borderColor: 'var(--red)', color: '#fff' } : {}}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Fechas específicas bloqueadas</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input
                  className="form-input"
                  type="date"
                  value={newBlockedDate}
                  onChange={e => setNewBlockedDate(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-sm btn-primary" onClick={addBlockedDate}>Bloquear</button>
              </div>
              {blockedDates.length > 0 && (
                <div className="card" style={{ padding: '10px 16px', marginTop: 10 }}>
                  {blockedDates.map(d => (
                    <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBlock: 6, borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 14 }}>
                        {new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                      <button
                        onClick={() => removeBlockedDate(d)}
                        style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16 }}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Finanzas ── */}
          <div className="config-section">
            <div className="config-title">Finanzas — Comisión bancaria</div>
            <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
              Define el porcentaje que cobra el banco por pagos con tarjeta.
              Cuando se registre un pago con método <strong>Tarjeta</strong> (anticipo o cobro de saldo),
              el sistema creará automáticamente un gasto de comisión en la categoría
              <em> Comisión bancaria</em>. Si ese pago se edita o elimina, el gasto se actualizará o eliminará también.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div className="form-group" style={{ maxWidth: 180 }}>
                <label className="form-label">% de comisión por tarjeta</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.payment_settings?.comision_tarjeta ?? 0}
                    onChange={e => set('payment_settings', {
                      ...(form.payment_settings || {}),
                      comision_tarjeta: +e.target.value,
                    })}
                    style={{ textAlign: 'right' }}
                  />
                  <span style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 600 }}>%</span>
                </div>
              </div>

              {/* Preview */}
              {(form.payment_settings?.comision_tarjeta ?? 0) > 0 && (
                <div style={{
                  background: 'var(--amber-bg)', border: '1px solid rgba(158,107,26,.25)',
                  borderRadius: 'var(--r2)', padding: '10px 16px', fontSize: 13,
                  color: 'var(--text2)', lineHeight: 1.5,
                }}>
                  Ejemplo: un pago con tarjeta de{' '}
                  <strong>$1,000</strong> generará automáticamente un gasto de{' '}
                  <strong style={{ color: 'var(--amber)' }}>
                    ${(1000 * ((form.payment_settings?.comision_tarjeta ?? 0) / 100)).toFixed(2)}
                  </strong>
                </div>
              )}
            </div>

            {/* Aviso de migración SQL si las columnas no existen */}
            {!comisionSchemaReady && (
              <div style={{
                background: 'var(--red-bg)', border: '1px solid rgba(156,53,53,.25)',
                borderRadius: 'var(--r2)', padding: '14px 18px',
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--red-l)' }}>
                  Requiere migración en Supabase
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10, lineHeight: 1.6 }}>
                  Para habilitar la comisión automática ejecuta este SQL en el editor de Supabase:
                </div>
                <pre className="sql-block">{`-- 1. Columnas en la tabla gastos
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS auto_comision boolean DEFAULT false;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS source_ref text;

-- 2. Columna en la tabla config
ALTER TABLE config ADD COLUMN IF NOT EXISTS payment_settings jsonb DEFAULT '{"comision_tarjeta":0}'::jsonb;`}</pre>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
                  Ejecuta ambos bloques y recarga la página — el módulo quedará activo.
                </div>
              </div>
            )}

            {comisionSchemaReady && (
              <div style={{
                background: 'var(--green-bg)', border: '1px solid rgba(45,138,58,.25)',
                borderRadius: 'var(--r2)', padding: '10px 16px', fontSize: 13, color: 'var(--text2)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--green)" strokeWidth="2">
                  <polyline points="3 8 6.5 11.5 13 4.5"/>
                </svg>
                Módulo activo — las comisiones se registrarán automáticamente
              </div>
            )}
          </div>

          <div style={{ paddingTop: 8 }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar todos los cambios'}
            </button>
          </div>

          {/* ── Testing Reset ── */}
          <div className="config-section" style={{ marginTop: 40, borderColor: 'var(--red)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div className="config-title" style={{ color: 'var(--red)', marginBottom: 0 }}>Testing Reset</div>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
                background: 'var(--red)', color: '#fff',
                padding: '2px 8px', borderRadius: 99,
              }}>SOLO PRUEBAS</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>
              Este botón <strong>borra permanentemente</strong> toda la información del sistema:{' '}
              sesiones, clientes, cobros de saldo, cargos adicionales y gastos.
              Úsalo únicamente durante la fase de pruebas para dejar la base de datos limpia.
              <strong style={{ color: 'var(--red)' }}> Esta acción no se puede deshacer.</strong>
            </div>

            {resetStep === 0 && (
              <button
                className="btn btn-sm"
                onClick={() => setResetStep(1)}
                style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
              >
                Testing Reset
              </button>
            )}

            {resetStep === 1 && (
              <div style={{
                border: '1px solid var(--red)', borderRadius: 'var(--r2)',
                overflow: 'hidden',
              }}>
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--red)', marginBottom: 10 }}>
                    ⚠ Se eliminarán todos estos registros
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                    {[
                      ['Sesiones', 'Todos los agendamientos y datos de clientes'],
                      ['Cobros de saldo', 'Historial completo de pagos (session_pagos)'],
                      ['Cargos adicionales', 'Todos los extras aplicados a sesiones'],
                      ['Gastos', 'Todos los gastos, incluyendo comisiones automáticas'],
                    ].map(([title, desc]) => (
                      <div key={title} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--red)', fontWeight: 700, flexShrink: 0 }}>×</span>
                        <span style={{ fontSize: 13, color: 'var(--text2)' }}>
                          <strong>{title}</strong> — {desc}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
                    La configuración del estudio (mensajes, cargos, horarios, comisiones) <strong>no</strong> se borrará.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-sm"
                      onClick={() => setResetStep(2)}
                      style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                    >
                      Entiendo, continuar →
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setResetStep(0)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {resetStep === 2 && (
              <div style={{
                border: '1px solid var(--red)', borderRadius: 'var(--r2)',
                overflow: 'hidden',
                background: 'color-mix(in srgb, var(--red) 8%, transparent)',
              }}>
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--red)', marginBottom: 8 }}>
                    Confirmación final — Esta acción NO puede deshacerse
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>
                    Se eliminarán de forma permanente <strong>todos los datos operativos</strong> del sistema.
                    La base de datos quedará vacía y lista para una nueva fase de pruebas.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={handleTestingReset}
                      disabled={resetting}
                      style={{ flex: 1 }}
                    >
                      {resetting ? 'Eliminando todo…' : 'Ejecutar Testing Reset'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setResetStep(0)} disabled={resetting}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
