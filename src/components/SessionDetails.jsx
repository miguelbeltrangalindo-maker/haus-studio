import { useState, useEffect } from 'react'
import { fmtDate, nextStatus, nextStatusLabel } from '../lib/utils'
import { useConfig } from '../hooks/useConfig'
import { useToast } from '../hooks/useToast'
import { useConfirm } from './ConfirmDialog'
import Badge from './Badge'
import SessionModal from './SessionModal'

const METHODS = [
  { key: 'efectivo',      label: 'Efectivo' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'tarjeta',       label: 'Tarjeta' },
]

const METHOD_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta' }

export default function SessionDetails({ session, onClose, updateSession, deleteSession, sessionPagos = [], createPago, updatePago, deletePago, sessionExtras = [], createExtra, updateExtra, deleteExtra, sessions = [] }) {
  const { config } = useConfig()
  const toast = useToast()
  const confirm = useConfirm()
  const [editOpen, setEditOpen]   = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [syncing, setSyncing]     = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('efectivo')
  const [paying, setPaying]       = useState(false)
  const [extraQtys, setExtraQtys]           = useState({})
  const [applyingExtras, setApplyingExtras] = useState(false)
  const [descuento, setDescuento]           = useState('')
  const [applyingDesc, setApplyingDesc]     = useState(false)
  // ── Edición de pagos ──
  const [editingPagoId,  setEditingPagoId]  = useState(null)
  const [editPagoMonto,  setEditPagoMonto]  = useState('')
  const [editPagoMetodo, setEditPagoMetodo] = useState('efectivo')
  const [savingPago,     setSavingPago]     = useState(false)
  // ── Eliminación con doble confirmación ──
  const [deleteStep,   setDeleteStep]   = useState(0) // 0=hidden, 1=impact, 2=final
  const [deleting,     setDeleting]     = useState(false)

  useEffect(() => { setDeleteStep(0) }, [session.id])

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
    if (amount > currentRestante) { toast(`El monto no puede superar $${currentRestante.toLocaleString()}`, 'error'); return }
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
    if (createPago) {
      const pr = await createPago(session.id, amount, payMethod)
      if (pr?.error) { toast('El cobro se aplicó pero no quedó en el historial de pagos', 'error'); setPaying(false); return }
    }
    toast(`$${amount.toLocaleString()} cobrado ✓`, 'success')
    setPayAmount('')
    setPaying(false)
  }

  const handleSyncPagos = async () => {
    setSyncing(true)
    const result = await updateSession(session.id, { pagos: String(pagosSum) })
    if (result.error) toast(result.error, 'error')
    else toast('Pagos sincronizados', 'success')
    setSyncing(false)
  }

  const handleApplyDescuento = async () => {
    const monto = +descuento
    if (!monto || monto <= 0) { toast('Ingresa un monto válido', 'error'); return }
    const restante = +session.restante || 0
    if (monto > restante) { toast(`El descuento no puede superar $${restante.toLocaleString()}`, 'error'); return }
    const ok = await confirm({
      title: `Aplicar descuento de $${monto.toLocaleString()}`,
      message: `El saldo por cobrar pasará de $${restante.toLocaleString()} a $${(restante - monto).toLocaleString()}.`,
      confirmLabel: `Aplicar $${monto.toLocaleString()}`,
    })
    if (!ok) return
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

  const handleRevertDescuento = async () => {
    const desc = +session.descuento || 0
    if (!desc) return
    const restante = +session.restante || 0
    const ok = await confirm({
      title: `Quitar descuento de $${desc.toLocaleString()}`,
      message: `El saldo por cobrar volverá a $${(restante + desc).toLocaleString()}.`,
      confirmLabel: 'Quitar descuento',
      destructive: true,
    })
    if (!ok) return
    const result = await updateSession(session.id, {
      restante:  String(restante + desc),
      descuento: '0',
    })
    if (result?.error) { toast(result.error, 'error'); return }
    toast('Descuento eliminado — saldo restaurado')
  }

  const conceptos = config.extra_conceptos || []

  const handleApplyExtras = async () => {
    const toAdd = conceptos.filter(c => (extraQtys[c.id] || 0) > 0)
    if (!toAdd.length) return
    setApplyingExtras(true)
    let totalMonto = 0
    for (const c of toAdd) {
      const qty = extraQtys[c.id]
      const precio = c.precio_unitario || 0
      const monto = qty * precio
      const result = await createExtra(session.id, c.nombre, monto, qty, precio)
      if (result.error) { toast(result.error, 'error'); setApplyingExtras(false); return }
      totalMonto += monto
    }
    await updateSession(session.id, { restante: String((+session.restante || 0) + totalMonto) })
    toast(`$${totalMonto.toLocaleString()} en cargos agregados`, 'success')
    setExtraQtys({})
    setApplyingExtras(false)
  }

  const handleDeleteExtra = async (extra) => {
    const qty = extra.cantidad > 1 ? ` ×${extra.cantidad}` : ''
    const ok = await confirm({
      title: `Eliminar cargo`,
      message: `${extra.concepto}${qty} · $${(+extra.monto).toLocaleString()}\n\nEste monto se restará del saldo por cobrar.`,
      confirmLabel: 'Eliminar cargo',
      destructive: true,
    })
    if (!ok) return
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

  const startEditPago = (p) => {
    setEditingPagoId(p.id)
    setEditPagoMonto(String(p.monto))
    setEditPagoMetodo(p.metodo || 'efectivo')
  }

  const handleSavePago = async (oldPago) => {
    const monto = +editPagoMonto
    if (!monto || monto <= 0) { toast('Monto inválido', 'error'); return }
    setSavingPago(true)
    const { error } = await updatePago(oldPago.id, { monto, metodo: editPagoMetodo }, oldPago)
    setSavingPago(false)
    if (error) { toast(error, 'error'); return }
    toast('Pago actualizado', 'success')
    setEditingPagoId(null)
  }

  const handleDeletePago = async (p) => {
    const ok = await confirm({
      title: `Eliminar este cobro`,
      message: `$${(+p.monto).toLocaleString()} · ${METHOD_LABEL[p.metodo] || p.metodo}\n\nEl saldo por cobrar se ajustará automáticamente.`,
      confirmLabel: 'Eliminar cobro',
      destructive: true,
    })
    if (!ok) return
    const { error } = await deletePago(p.id)
    if (error) { toast(error, 'error'); return }
    toast('Pago eliminado — saldo actualizado')
  }

  const handleSave = async (form) => {
    const result = await updateSession(session.id, form)
    if (result.error) { toast(result.error, 'error'); return result }
    toast('Sesión actualizada', 'success')
    setEditOpen(false)
    return result
  }

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Cancelar esta sesión',
      message: `${session.nombre} · ${fmtDate(session.fecha)}\n\nLa sesión queda con estatus "Cancelada" pero los registros se conservan.`,
      confirmLabel: 'Cancelar sesión',
      cancelLabel: 'No, mantener',
      destructive: true,
    })
    if (!ok) return
    await updateSession(session.id, { estatus: 'Cancelada' })
    toast('Sesión cancelada')
    onClose()
  }

  const handleDeletePermanent = async () => {
    setDeleting(true)
    const result = await deleteSession(session.id)
    setDeleting(false)
    if (result?.error) { toast(result.error, 'error'); return }
    toast('Sesión eliminada', 'success')
    onClose()
  }

  return (
    <>
      <aside className="details-panel open" role="dialog" aria-modal="true" aria-label="Detalles de la sesión">

        {/* Drag handle (mobile only via CSS) */}
        <div className="dp-grip" onClick={onClose} aria-hidden="true" />

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
            <button className="btn btn-xs" onClick={handleSyncPagos} disabled={syncing}>{syncing ? '…' : 'Sincronizar'}</button>
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
            {sessionExtras.map(e => (
              <div key={e.id} className="dp-meta-row">
                <span className="dp-meta-label">
                  {e.concepto}{(e.cantidad > 1) ? ` ×${e.cantidad}` : ''}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="dp-meta-value" style={{ color: 'var(--amber-l)' }}>+${(+e.monto).toLocaleString()}</span>
                  {deleteExtra && (
                    <button onClick={() => handleDeleteExtra(e)}
                      style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
                  )}
                </span>
              </div>
            ))}

            {/* Quantity pickers from config */}
            {conceptos.length > 0 ? (
              <>
                {conceptos.map(c => {
                  const qty = extraQtys[c.id] || 0
                  const subtotal = qty * c.precio_unitario
                  return (
                    <div key={c.id} className="dp-meta-row" style={{ paddingBlock: 7 }}>
                      <span className="dp-meta-label">{c.nombre}
                        <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>${(c.precio_unitario || 0).toLocaleString()}/u</span>
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
                  const total = conceptos.reduce((s, c) => s + (extraQtys[c.id] || 0) * (c.precio_unitario || 0), 0)
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
        {(hasPending || +session.descuento > 0) && (
          <div className="dp-section">
            <div className="dp-section-label">Descuento</div>
            {+session.descuento > 0 && (
              <div className="dp-meta-row" style={{ marginBottom: 8 }}>
                <span className="dp-meta-label">Descuento aplicado</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="dp-meta-value" style={{ color: 'var(--green-l)' }}>
                    −${(+session.descuento).toLocaleString()}
                  </span>
                  <button
                    onClick={handleRevertDescuento}
                    title="Quitar descuento (restaura el saldo)"
                    style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}
                  >×</button>
                </span>
              </div>
            )}
            {hasPending && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                type="number"
                inputMode="decimal"
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
                inputMode="decimal"
                min="1"
                max={session.restante}
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder={`Máx. $${(+session.restante).toLocaleString()}`}
              />
              {!payAmount && +session.restante > 0 && (
                <button
                  type="button"
                  onClick={() => setPayAmount(String(+session.restante))}
                  style={{
                    background: 'transparent', border: '1px dashed var(--border2)',
                    borderRadius: 'var(--r3)', padding: '6px 10px',
                    fontSize: 11.5, color: 'var(--text2)', cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Liquidar todo · ${(+session.restante).toLocaleString()}
                </button>
              )}
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
                {paying ? 'Guardando…' : (+payAmount > 0 ? `Cobrar $${(+payAmount).toLocaleString()}` : 'Cobrar')}
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
            <div className="dp-section-label">Historial de cobros</div>
            {sessionPagos.map(p => (
              <div key={p.id} style={{ marginBottom: 6 }}>
                {editingPagoId === p.id ? (
                  /* ── Inline edit form ── */
                  <div style={{
                    background: 'var(--bg3)', border: '1px solid var(--border)',
                    borderRadius: 'var(--r2)', padding: '12px 14px',
                  }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div className="form-label" style={{ marginBottom: 4 }}>Monto</div>
                        <input
                          className="form-input"
                          type="number"
                          inputMode="decimal"
                          min="0.01"
                          step="0.01"
                          value={editPagoMonto}
                          onChange={e => setEditPagoMonto(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="method-tabs" style={{ marginBottom: 10 }}>
                      {METHODS.map(m => (
                        <button
                          key={m.key}
                          type="button"
                          className={`method-tab${editPagoMetodo === m.key ? ' active' : ''}`}
                          onClick={() => setEditPagoMetodo(m.key)}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-primary btn-xs"
                        onClick={() => handleSavePago(p)}
                        disabled={savingPago}
                        style={{ flex: 1 }}
                      >
                        {savingPago ? '…' : 'Guardar'}
                      </button>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => setEditingPagoId(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Display row ── */
                  <div className="dp-meta-row">
                    <span className="dp-meta-label" style={{ textTransform: 'capitalize' }}>
                      {METHOD_LABEL[p.metodo] || p.metodo}
                      {p.nota ? <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>· {p.nota}</span> : null}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="dp-meta-value" style={{ color: 'var(--green-l)', fontWeight: 600 }}>
                        ${(+p.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                      {updatePago && (
                        <button
                          onClick={() => startEditPago(p)}
                          title="Editar pago"
                          style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z"/>
                          </svg>
                        </button>
                      )}
                      {deletePago && (
                        <button
                          onClick={() => handleDeletePago(p)}
                          title="Eliminar pago"
                          style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M3 5h10M6 5V3.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V5M5 5l.5 8h5L11 5"/>
                          </svg>
                        </button>
                      )}
                    </span>
                  </div>
                )}
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
          {(+session.ninos > 0) && (
            <div className="dp-meta-row">
              <span className="dp-meta-label">Niños &lt;2 años</span>
              <span className="dp-meta-value">{session.ninos}</span>
            </div>
          )}
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
          {deleteSession && deleteStep === 0 && (
            <button
              className="btn btn-sm"
              onClick={() => setDeleteStep(1)}
              style={{ width: '100%', color: 'var(--red)', borderColor: 'var(--red)', marginTop: 2 }}
            >
              Eliminar permanentemente
            </button>
          )}
        </div>

        {/* ── Doble confirmación de eliminación ── */}
        {deleteSession && deleteStep >= 1 && (() => {
          const totalPagos  = sessionPagos.reduce((s, p) => s + (+p.monto || 0), 0)
          const totalExtras = sessionExtras.reduce((s, e) => s + (+e.monto || 0), 0)
          const comisionPagos = sessionPagos.filter(p => p.metodo === 'tarjeta').length
          const hasAnticipo   = +session.anticipo > 0
          const hasAntComis   = session.metodo_anticipo === 'tarjeta' && hasAnticipo
          const comisionCount = (hasAntComis ? 1 : 0) + comisionPagos

          return (
            <div style={{
              margin: '8px 0 0',
              border: '1px solid var(--red)',
              borderRadius: 'var(--r2)',
              overflow: 'hidden',
            }}>
              {deleteStep === 1 && (
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--red)', marginBottom: 10 }}>
                    ⚠ Registros que se eliminarán
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                    {hasAnticipo && (
                      <div className="dp-meta-row">
                        <span className="dp-meta-label">Anticipo</span>
                        <span className="dp-meta-value" style={{ color: 'var(--text2)' }}>
                          ${(+session.anticipo).toLocaleString()}
                          {session.metodo_anticipo ? <span style={{ color: 'var(--text3)', marginLeft: 4, textTransform: 'capitalize' }}>({session.metodo_anticipo})</span> : null}
                        </span>
                      </div>
                    )}
                    {sessionPagos.length > 0 && (
                      <div className="dp-meta-row">
                        <span className="dp-meta-label">Cobros de saldo ({sessionPagos.length})</span>
                        <span className="dp-meta-value" style={{ color: 'var(--text2)' }}>${totalPagos.toLocaleString()}</span>
                      </div>
                    )}
                    {sessionExtras.length > 0 && (
                      <div className="dp-meta-row">
                        <span className="dp-meta-label">Cargos adicionales ({sessionExtras.length})</span>
                        <span className="dp-meta-value" style={{ color: 'var(--text2)' }}>${totalExtras.toLocaleString()}</span>
                      </div>
                    )}
                    {comisionCount > 0 && (
                      <div className="dp-meta-row">
                        <span className="dp-meta-label">Comisiones bancarias</span>
                        <span className="dp-meta-value" style={{ color: 'var(--red)' }}>{comisionCount} gasto{comisionCount > 1 ? 's' : ''} auto</span>
                      </div>
                    )}
                    {!hasAnticipo && sessionPagos.length === 0 && sessionExtras.length === 0 && comisionCount === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>Sin registros financieros vinculados</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-sm"
                      onClick={() => setDeleteStep(2)}
                      style={{ flex: 1, color: 'var(--red)', borderColor: 'var(--red)' }}
                    >
                      Entiendo, continuar →
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDeleteStep(0)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {deleteStep === 2 && (
                <div style={{ padding: '14px 16px', background: 'color-mix(in srgb, var(--red) 8%, transparent)' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--red)', marginBottom: 6 }}>
                    Esta acción NO puede deshacerse
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.5 }}>
                    Se eliminarán permanentemente la sesión de <strong>{session.nombre}</strong> y todos sus registros financieros asociados.
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={handleDeletePermanent}
                      disabled={deleting}
                      style={{ flex: 1 }}
                    >
                      {deleting ? 'Eliminando…' : 'Eliminar definitivamente'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDeleteStep(0)} disabled={deleting}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

      </aside>

      {editOpen && (
        <SessionModal
          session={session}
          onSave={handleSave}
          onClose={() => setEditOpen(false)}
          onDelete={handleDelete}
          createPago={createPago}
          sessions={sessions}
        />
      )}
    </>
  )
}
