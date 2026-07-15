import { useState, useEffect, useRef } from 'react'
import { useToast } from '../hooks/useToast'

const METHODS = [
  { key: 'efectivo',      label: 'Efectivo' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'tarjeta',       label: 'Tarjeta' },
]

export default function QuickCobrarSheet({ session, onClose, updateSession, createPago, deletePago }) {
  const toast = useToast()
  const restante = +session?.restante || 0
  const [amount, setAmount] = useState(String(restante))
  const [method, setMethod] = useState('efectivo')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    setAmount(String(restante))
    setMethod('efectivo')
  }, [session?.id, restante])

  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 80)
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(id); window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const value = +amount
  const valid = value > 0 && value <= restante

  const handleCobrar = async () => {
    if (!valid) {
      toast(value > restante
        ? `El monto no puede superar $${restante.toLocaleString()}`
        : 'Ingresa un monto válido', 'error')
      return
    }
    setSaving(true)
    const newRestante = Math.max(0, restante - value)
    const updates = {
      restante:    String(newRestante),
      metodo_pago: method,
      pagos:       (+session.pagos || 0) + value,
      estatus:     (newRestante === 0 && session.estatus === 'Pendiente de pago') ? 'Completada' : session.estatus,
    }
    const prev = { estatus: session.estatus, metodo_pago: session.metodo_pago }
    const result = await updateSession(session.id, updates)
    if (result?.error) { toast(result.error, 'error'); setSaving(false); return }
    let pagoId = null
    if (createPago) {
      const pr = await createPago(session.id, value, method)
      if (pr?.error) { toast('El cobro se aplicó pero no quedó en el historial de pagos', 'error'); setSaving(false); onClose(); return }
      pagoId = pr?.data?.id || null
    }
    toast(`$${value.toLocaleString()} cobrado ✓`, 'success', (pagoId && deletePago) ? {
      action: {
        label: 'Deshacer',
        onClick: async () => {
          await deletePago(pagoId)          // restaura pagos/restante y elimina la comisión
          return updateSession(session.id, { estatus: prev.estatus, metodo_pago: prev.metodo_pago || null })
        },
      },
    } : undefined)
    setSaving(false)
    onClose()
  }

  if (!session) return null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div
        className="modal qc-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qc-title"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 440 }}
      >
        <div id="qc-title" className="modal-title" style={{ fontSize: 22, marginBottom: 4 }}>
          Cobrar a {(session.nombre || '').split(' ')[0] || session.nombre}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 18 }}>
          Por cobrar: <strong style={{ color: 'var(--amber-l)' }}>${restante.toLocaleString()}</strong>
        </div>

        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label" htmlFor="qc-amount">Monto a cobrar</label>
          <input
            id="qc-amount"
            ref={inputRef}
            className="form-input"
            type="number"
            inputMode="decimal"
            min="1"
            max={restante}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{ fontSize: 18, fontWeight: 500 }}
          />
          {value > 0 && value < restante && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
              Quedará pendiente: ${(restante - value).toLocaleString()}
            </div>
          )}
          {value >= restante && value > 0 && (
            <div style={{ fontSize: 12, color: 'var(--green-l)', marginTop: 6 }}>
              Saldo liquidado ✓
            </div>
          )}
        </div>

        <div className="form-group" style={{ marginBottom: 18 }}>
          <label className="form-label">Método</label>
          <div className="method-tabs">
            {METHODS.map(m => (
              <button
                key={m.key}
                type="button"
                className={`method-tab ${method === m.key ? 'active' : ''}`}
                onClick={() => setMethod(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ flex: 1 }}
            onClick={handleCobrar}
            disabled={!valid || saving}
          >
            {saving ? 'Guardando…' : (valid ? `Cobrar $${value.toLocaleString()}` : 'Cobrar')}
          </button>
        </div>
      </div>
    </div>
  )
}
