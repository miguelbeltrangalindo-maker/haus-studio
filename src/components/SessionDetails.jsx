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

export default function SessionDetails({ session, onClose, updateSession, deleteSession, sessionPagos = [], createPago, sessionExtras = [], createExtra, updateExtra, deleteExtra }) {
  const { config } = useConfig()
  const toast = useToast()
  const [editOpen, setEditOpen]   = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('efectivo')
  const [paying, setPaying]       = useState(false)
  const [extraQtys, setExtraQtys]           = useState({})
  const [applyingExtras, setApplyingExtras] = useState(false)
  const [editingExtra, setEditingExtra]     = useState(null) // { id, concepto, monto, cantidad }
  const [savingExtra, setSavingExtra]       = useState(false)
  const [descuento, setDescuento]           = useState('')
  const [applyingDesc, setApplyingDesc]     = useState(false)

  if (!session) return null

  const nextSt  = nextStatus(session.estatus)
  const nextLbl = nextStatusLabel(session.estatus)
  const hasPending = +session.restante > 0

  // ── Logical consistency checks ──
  const pagosSum    = sessionPagos.reduce((a, p) => a + (+p.monto || 0), 0)
  const pagosDesync = sessionPagos.length > 0 && Math.abs((+session.pagos || 0) - pagosSum) > 0.01

  const statusInconsistente =
    (+session.restante === 0 || !session.restante) &&
    +session.anticipo > 0 &&
    ['Reservada', 'Confirmada'].includes(session.estatus)

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

  const handleSyncPagos = async () => {
    await updateSession(session.id, { pagos: String(pagosSum) })
    toast('Pagos sincronizados', 'success')
  }

  const handleApplyDescuento = async () => {
    const monto = +descuento
    if (!monto || monto <= 0) { toast('Ingresa un monto válido', 'error'); return }
    const restante = +session.restante || 0
    if (monto > restante) { toast(`El descuento no puede superar $${restante.toLocaleString()}`, 'error'); return }
    if (!confirm(`¿Aplicar descuento de $${monto.toLocaleString()}?\n\nEl saldo pendiente pasará de $${restante.toLocaleString()} a $${(restante - monto).toLocaleString()}.`)) return
    setApplyingDesc(true)
    const newDesc = (+session.descuento || 0) + monto
    await updateSession(session.id, {
      restante: String(restante - monto),
      descuento: String(newDesc),
    })
    toast(`Descuento de $${monto.toLocaleString()} aplicado`, 'success')
    setDescuento('')
    setApplyingDesc(false)
  }

  const conceptos = config.extra_conceptos || []

  const handleApplyExtras = async () => {
    const toAdd = conceptos.filter(c => (extraQtys[c.id] || 0) > 0)
    if (!toAdd.length) return
    setApplyingExtras(true)
    let totalMonto = 0
    for (const c of toAdd) {
      const qty = extraQtys[c.id]
      const monto = qty * c.precio_unitario
      const result = await createExtra(session.id, c.nombre, monto, qty, c.precio_unitario)
      if (result.error) { toast(result.error, 'error'); setApplyingExtras(false); return }
      totalMonto += monto
    }
    await updateSession(session.id, { restante: String((+session.restante || 0) + totalMonto) })
    toast(`$${totalMonto.toLocaleString()} en cargos agregados`, 'success')
    setExtraQtys({})
    setApplyingExtras(false)
  }

  const handleUpdateExtra = async () => {
    if (!editingExtra) return
    const original = sessionExtras.find(e => e.id === editingExtra.id)
    if (!original) return
    const newMonto = +(editingExtra.monto) || 0
    const newCantidad = +(editingExtra.cantidad) || 1
    if (newMonto <= 0) { toast('El monto debe ser mayor a 0', 'error'); return }
    setSavingExtra(true)
    const result = await updateExtra(editingExtra.id, {
      concepto: editingExtra.concepto,
      monto: newMonto,
      cantidad: newCantidad,
    })
    if (result.error) { toast(result.error, 'error'); setSavingExtra(false); return }
    // Adjust restante by the difference
    const diff = newMonto - (+original.monto || 0)
    if (diff !== 0) {
      await updateSession(session.id, { restante: String(Math.max(0, (+session.restante || 0) + diff)) })
    }
    toast('Cargo actualizado', 'success')
    setEditingExtra(null)
    setSavingExtra(false)
  }

  const handleDeleteExtra = async (extra) => {
    const qty = extra.cantidad > 1 ? ` ×${extra.cantidad}` : ''
    if (!confirm(`¿Estás seguro de eliminar el cargo "${extra.concepto}${qty}" por $${(+extra.monto).toLocaleString()}?\n\nEste monto se descontará del saldo pendiente.`)) return
    await deleteExtra(extra.id)
    const newRestante = Math.max(0, (+session.restante || 0) - (+extra.monto || 0))
    await updateSession(session.id, { restante: String(newRestante) })
    toast('Cargo eliminado')
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

  const handleDeletePermanent = async () => {
    if (!confirm(`¿Eliminar permanentemente la sesión de ${session.nombre}?\n\nSe borrarán todos los pagos y cargos asociados. Esta acción no se puede deshacer.`)) return
    await deleteSession(session.id)
    toast('Sesión eliminada', 'success')
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

        {/* ── Consistency warnings ── */}
        {statusInconsistente && (
          <div className="dp-alert amber">
            <span>Sesión liquidada pero en estatus <strong>{session.estatus}</strong>. ¿Avanzar a Completada?</span>
            <button className="btn btn-xs btn-primary" onClick={handleAdvance} disabled={advancing}>
              {advancing ? '…' : `→ ${nextLbl || 'Completada'}`}
            </button>
          </div>
        )}
        {pagosDesync && (
          <div className="dp-alert red">
            <span>Pagos desincronizados — historial: <strong>${pagosSum.toLocaleString()}</strong> / registro: <strong>${(+session.pagos || 0).toLocaleString()}</strong></span>
            <button className="btn btn-xs" onClick={handleSyncPagos}>Sincronizar</button>
          </div>
        )}

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
            {session.metodo_anticipo && (
              <div style={{ width: '100%', fontSize: 12, color: 'var(--text3)', marginTop: 2, textTransform: 'capitalize' }}>
                Anticipo vía {session.metodo_anticipo}
              </div>
            )}
            {session.metodo_pago && (
              <div style={{ width: '100%', fontSize: 12, color: 'var(--text3)', marginTop: 2, textTransform: 'capitalize' }}>
                Saldo cobrado con {session.metodo_pago}
              </div>
            )}
          </div>
        )}

        {/* Cargos adicionales */}
        {createExtra && (
          <div className="dp-section">
            <div className="dp-section-label">Cargos adicionales</div>

            {/* Applied extras */}
            {sessionExtras.map(e => {
              const isEditing = editingExtra?.id === e.id
              if (isEditing) {
                return (
                  <div key={e.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 6, background: 'var(--bg2)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        className="form-input"
                        style={{ fontSize: 13, padding: '5px 10px' }}
                        value={editingExtra.concepto}
                        onChange={ev => setEditingExtra(x => ({ ...x, concepto: ev.target.value }))}
                        placeholder="Concepto"
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>Cantidad</div>
                          <input className="form-input" type="number" min="1" max="99"
                            style={{ fontSize: 13, padding: '5px 10px' }}
                            value={editingExtra.cantidad}
                            onChange={ev => setEditingExtra(x => ({ ...x, cantidad: ev.target.value }))} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>Monto total ($)</div>
                          <input className="form-input" type="number" min="0"
                            style={{ fontSize: 13, padding: '5px 10px' }}
                            value={editingExtra.monto}
                            onChange={ev => setEditingExtra(x => ({ ...x, monto: ev.target.value }))} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary btn-sm" onClick={handleUpdateExtra} disabled={savingExtra} style={{ flex: 1 }}>
                          {savingExtra ? '…' : 'Guardar'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingExtra(null)} style={{ flex: 1 }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                )
              }
              return (
                <div key={e.id} className="dp-meta-row">
                  <span className="dp-meta-label">
                    {e.concepto}{(e.cantidad > 1) ? ` ×${e.cantidad}` : ''}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="dp-meta-value" style={{ color: 'var(--amber-l)' }}>+${(+e.monto).toLocaleString()}</span>
                    {updateExtra && (
                      <button onClick={() => setEditingExtra({ id: e.id, concepto: e.concepto, monto: e.monto, cantidad: e.cantidad || 1 })}
                        title="Editar"
                        style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>✎</button>
                    )}
                    {deleteExtra && (
                      <button onClick={() => handleDeleteExtra(e)}
                        title="Eliminar"
                        style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
                    )}
                  </span>
                </div>
              )
            })}

            {/* Quantity pickers from config */}
            {conceptos.length > 0 ? (
              <>
                {conceptos.map(c => {
                  const qty = extraQtys[c.id] || 0
                  const subtotal = qty * c.precio_unitario
                  return (
                    <div key={c.id} className="dp-meta-row" style={{ paddingBlock: 7 }}>
                      <span className="dp-meta-label">{c.nombre}
                        <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>${c.precio_unitario.toLocaleString()}/u</span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {subtotal > 0 && <span style={{ fontSize: 11, color: 'var(--amber-l)', marginRight: 4 }}>${subtotal.toLocaleString()}</span>}
                        <button className="qty-btn" onClick={() => setExtraQtys(q => ({ ...q, [c.id]: Math.max(0, (q[c.id] || 0) - 1) }))}>−</button>
                        <span style={{ width: 22, textAlign: 'center', fontWeight: 600, fontSize: 14 }}>{qty}</span>
                        <button className="qty-btn" onClick={() => setExtraQtys(q => ({ ...q, [c.id]: Math.min(9, (q[c.id] || 0) + 1) }))}>+</button>
                      </span>
                    </div>
                  )
                })}
                {Object.values(extraQtys).some(q => q > 0) && (() => {
                  const total = conceptos.reduce((s, c) => s + (extraQtys[c.id] || 0) * c.precio_unitario, 0)
                  return (
                    <button className="btn btn-primary btn-sm" onClick={handleApplyExtras} disabled={applyingExtras}
                      style={{ width: '100%', marginTop: 8 }}>
                      {applyingExtras ? 'Guardando…' : `Agregar $${total.toLocaleString()}`}
                    </button>
                  )
                })()}
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: sessionExtras.length > 0 ? 8 : 0 }}>
                Configura los conceptos en Configuración → Cargos adicionales
              </div>
            )}
          </div>
        )}

        {/* Descuento */}
        {hasPending && (
          <div className="dp-section">
            <div className="dp-section-label">Descuento</div>
            {+session.descuento > 0 && (
              <div className="dp-meta-row" style={{ marginBottom: 8 }}>
                <span className="dp-meta-label">Descuento aplicado</span>
                <span className="dp-meta-value" style={{ color: 'var(--green-l)' }}>
                  −${(+session.descuento).toLocaleString()}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                type="number"
                min="1"
                max={session.restante}
                value={descuento}
                onChange={e => setDescuento(e.target.value)}
                placeholder={`Máx. $${(+session.restante).toLocaleString()}`}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-sm"
                onClick={handleApplyDescuento}
                disabled={applyingDesc || !descuento || +descuento <= 0}
                style={{ whiteSpace: 'nowrap' }}
              >
                {applyingDesc ? '…' : 'Aplicar'}
              </button>
            </div>
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
          {deleteSession && (
            <button
              className="btn btn-sm"
              onClick={handleDeletePermanent}
              style={{ width: '100%', color: 'var(--red)', borderColor: 'var(--red)', marginTop: 2 }}
            >
              Eliminar permanentemente
            </button>
          )}
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
