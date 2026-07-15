import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { todayStr, fmtDate, initials, statusClass, nextStatus, nextStatusLabel } from '../lib/utils'
import { SkeletonRows } from '../components/Skeleton'

const QUICK_FLOW = [
  ['Confirmada',           'Confirmar'],
  ['Llegó',                'Llegó'],
  ['En sesión',            'En sesión'],
  ['Completada',           'Completar'],
  ['Pendiente de entrega', 'Pend. entrega'],
  ['Entregada',            'Entregada'],
]

// Returns array of [status, label] for quick-jump buttons (up to 3 ahead)
const getQuickActions = (estatus) => {
  const nextSt = nextStatus(estatus)
  const idx = QUICK_FLOW.findIndex(([s]) => s === nextSt)
  if (idx === -1) return []
  return QUICK_FLOW.slice(idx, idx + 3)
}
import { useConfig } from '../hooks/useConfig'
import { useToast } from '../hooks/useToast'
import { useConfirm } from '../components/ConfirmDialog'
import Badge from '../components/Badge'
import SessionModal from '../components/SessionModal'
import QuickCobrarSheet from '../components/QuickCobrarSheet'
import CorteSheet from '../components/CorteSheet'

export default function Hoy({ sessions, loading, createSession, updateSession, createPago, deletePago, pagos = [], gastos = [] }) {
  const { config } = useConfig()
  const toast = useToast()
  const confirm = useConfirm()
  const [modal, setModal] = useState(null)
  const [cobrarSession, setCobrarSession] = useState(null)
  const [corteOpen, setCorteOpen] = useState(false)
  const [sendingWA, setSendingWA] = useState(new Set())

  const sendTemplate = async (s, e) => {
    e.stopPropagation()
    if (!s.telefono) { toast('Sin número de teléfono', 'error'); return }
    setSendingWA(prev => new Set(prev).add(s.id))
    try {
      const res  = await fetch('/api/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: s.id }),
      })
      const data = await res.json()
      if (data.sent)    { toast(`Plantilla enviada a ${(s.nombre || '').split(' ')[0]}`, 'success') }
      else if (data.skipped === 'already sent') { toast('WhatsApp ya se había enviado', 'info') }
      else              { toast('No se pudo enviar WhatsApp', 'error') }
    } catch { toast('No se pudo enviar WhatsApp', 'error') }
    finally { setSendingWA(prev => { const n = new Set(prev); n.delete(s.id); return n }) }
  }

  const today = todayStr()

  const todaySessions = sessions
    .filter(s => s.fecha === today && s.estatus !== 'Cancelada')
    .sort((a, b) => (a.hora || '') > (b.hora || '') ? 1 : -1)

  // "No show" se muestra en la lista pero no cuenta en las métricas del día
  const todayActivas = todaySessions.filter(s => s.estatus !== 'No show')
  const completadas  = todayActivas.filter(s => ['Completada', 'Entregada', 'Pendiente de entrega'].includes(s.estatus)).length
  const pendientes   = todayActivas.filter(s => ['Reservada', 'Confirmada', 'Llegó', 'En sesión'].includes(s.estatus)).length
  const cobrado      = todayActivas.reduce((a, s) => a + (+s.anticipo || 0) + (+s.pagos || 0), 0)
  const porCobrar    = todayActivas.reduce((a, s) => a + (+s.restante || 0), 0)

  const dateLabel = format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })

  const handleQuick = async (session, newStatus) => {
    const prevStatus = session.estatus
    const result = await updateSession(session.id, { estatus: newStatus })
    if (result.error) { toast(result.error, 'error'); return }
    toast(`${session.nombre.split(' ')[0]} → ${newStatus}`, 'success', {
      action: { label: 'Deshacer', onClick: () => updateSession(session.id, { estatus: prevStatus }) },
    })
  }

  const openWA = (s, type, e) => {
    e.stopPropagation()
    const phone = '52' + s.telefono.replace(/\D/g, '').replace(/^52/, '')
    let msg = ''
    if (type === 'reminder') {
      msg = (config.reminder_message || '')
        .replace(/{nombre}/g, s.nombre)
        .replace(/{fecha}/g, fmtDate(s.fecha))
        .replace(/{hora}/g, s.hora?.slice(0, 5) || s.hora)
      updateSession(s.id, { reminder_sent: true })
    } else {
      if (!s.link) { toast('Sin vínculo de fotos', 'error'); return }
      msg = (config.delivery_message || '')
        .replace(/{nombre}/g, s.nombre)
        .replace(/{link}/g, s.link)
      updateSession(s.id, { link_sent: true })
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const handleSave = async (form) => {
    let result
    if (modal?.session?.id) result = await updateSession(modal.session.id, form)
    else result = await createSession(form)
    if (result.error) { toast(result.error, 'error'); return result }
    toast(modal?.session?.id ? 'Sesión actualizada' : 'Sesión creada', 'success')
    setModal(null)
    return result
  }

  const handleDelete = async () => {
    if (!modal?.session?.id) return
    const ok = await confirm({
      title: 'Cancelar esta sesión',
      message: `${modal.session.nombre || 'Sesión'} · ${modal.session.hora?.slice(0, 5) || ''}`,
      confirmLabel: 'Cancelar sesión',
      cancelLabel: 'No, mantener',
      destructive: true,
    })
    if (!ok) return
    await updateSession(modal.session.id, { estatus: 'Cancelada' })
    toast('Sesión cancelada')
    setModal(null)
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Hoy</div>
        <div className="topbar-right">
          <span className="topbar-date">{dateLabel}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setCorteOpen(true)} title="Corte del día: entradas por método, gastos y neto">
            Corte
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setModal({ prefillDate: today })}>
            + Nueva sesión
          </button>
        </div>
      </div>

      {/* Encabezado con fecha y métricas del día */}
      <div className="hoy-header">
        <div className="hoy-date">{dateLabel}</div>

        {todaySessions.length > 0 && (
          <div className="hoy-summary">
            <div className="hoy-summary-item">
              <span className="hoy-summary-value" style={{ color: 'var(--violet-l)' }}>
                {todaySessions.length}
              </span>
              <span className="hoy-summary-label">sesiones</span>
            </div>
            <div className="hoy-summary-item">
              <span className="hoy-summary-value" style={{ color: 'var(--green)' }}>
                {completadas}
              </span>
              <span className="hoy-summary-label">completadas</span>
            </div>
            <div className="hoy-summary-item">
              <span className="hoy-summary-value">
                {pendientes}
              </span>
              <span className="hoy-summary-label">pendientes</span>
            </div>
            {cobrado > 0 && (
              <div className="hoy-summary-item">
                <span className="hoy-summary-value" style={{ color: 'var(--green)' }}>
                  ${cobrado.toLocaleString()}
                </span>
                <span className="hoy-summary-label">cobrados</span>
              </div>
            )}
            {porCobrar > 0 && (
              <div className="hoy-summary-item">
                <span className="hoy-summary-value" style={{ color: 'var(--amber)' }}>
                  ${porCobrar.toLocaleString()}
                </span>
                <span className="hoy-summary-label">por cobrar</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lista operativa */}
      <div className="hoy-list">
        {loading ? (
          <SkeletonRows count={4} />
        ) : todaySessions.length === 0 ? (
          <div className="hoy-empty">
            <div className="hoy-empty-glyph">◯</div>
            <div className="hoy-empty-title">Sin sesiones para hoy</div>
            <div className="hoy-empty-sub">La agenda está libre</div>
            <button className="btn btn-primary" onClick={() => setModal({ prefillDate: today })}>
              + Agendar sesión
            </button>
          </div>
        ) : (
          todaySessions.map(s => {
            const sc           = statusClass(s.estatus)
            const quickActions = getQuickActions(s.estatus)

            return (
              <div key={s.id} className={`hoy-item ${sc}`}>
                <div className="hoy-time">{s.hora?.slice(0, 5)}</div>

                <div className="hoy-info">
                  <div className="hoy-name">{s.nombre}</div>
                  <div className="hoy-meta">
                    {s.telefono}
                    {' · '}{s.personas} {s.personas === 1 ? 'persona' : 'personas'}
                    {+s.anticipo > 0 && ` · $${(+s.anticipo).toLocaleString()} anticipo`}
                    {+s.restante > 0 && (
                      <span style={{ color: 'var(--amber)' }}>
                        {` · $${(+s.restante).toLocaleString()} saldo`}
                      </span>
                    )}
                  </div>
                  {s.notas && (
                    <div className="hoy-notas">{s.notas}</div>
                  )}

                  <div className="hoy-actions">
                    {/* Quick status buttons — primary for next, ghost for skip-ahead */}
                    {quickActions.map(([st, lbl], i) => (
                      <button
                        key={st}
                        className={`btn btn-sm ${i === 0 ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => handleQuick(s, st)}
                      >
                        {lbl}
                      </button>
                    ))}

                    {/* Plantilla WA — envío directo via API */}
                    {s.telefono && (
                      <button
                        className={`btn btn-wa btn-sm ${s.reminder_sent ? 'btn-ghost' : ''}`}
                        style={s.reminder_sent ? { color: 'var(--green-l)' } : {}}
                        disabled={sendingWA.has(s.id)}
                        onClick={e => sendTemplate(s, e)}
                        title="Enviar plantilla de confirmación por WhatsApp"
                      >
                        {sendingWA.has(s.id) ? '…' : s.reminder_sent ? '✓ WA enviado' : 'Enviar WA'}
                      </button>
                    )}

                    {/* Recordatorio WA (mensaje libre) */}
                    {['Reservada', 'Confirmada', 'Llegó'].includes(s.estatus) && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={e => openWA(s, 'reminder', e)}
                        title="Abrir WhatsApp con mensaje de recordatorio"
                      >
                        📱 Mensaje
                      </button>
                    )}

                    {/* Enviar fotos WA */}
                    {s.link && ['Completada', 'Pendiente de entrega'].includes(s.estatus) && (
                      <button
                        className={`btn btn-wa btn-sm ${s.link_sent ? 'btn-ghost' : ''}`}
                        style={s.link_sent ? { color: 'var(--green-l)' } : {}}
                        onClick={e => openWA(s, 'delivery', e)}
                        title={s.link_sent ? 'Fotos ya enviadas' : 'Enviar fotos'}
                      >
                        {s.link_sent ? '✓ Enviadas' : '📸 Enviar fotos'}
                      </button>
                    )}

                    {/* Cobrar saldo en 1 paso */}
                    {+s.restante > 0 && !['Cancelada', 'No show'].includes(s.estatus) && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setCobrarSession(s)}
                        title="Cobrar saldo"
                      >
                        Cobrar ${(+s.restante).toLocaleString()}
                      </button>
                    )}

                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setModal({ session: s })}
                    >
                      Editar
                    </button>
                  </div>
                </div>

                <div className="hoy-badge-col">
                  <Badge status={s.estatus} />
                </div>
              </div>
            )
          })
        )}
      </div>

      {modal !== null && (
        <SessionModal
          session={modal.session}
          prefillDate={modal.prefillDate}
          onSave={handleSave}
          onClose={() => setModal(null)}
          onDelete={handleDelete}
          createPago={createPago}
          sessions={sessions}
        />
      )}

      {cobrarSession && (
        <QuickCobrarSheet
          session={cobrarSession}
          onClose={() => setCobrarSession(null)}
          updateSession={updateSession}
          createPago={createPago}
          deletePago={deletePago}
        />
      )}

      {corteOpen && (
        <CorteSheet
          sessions={sessions}
          pagos={pagos}
          gastos={gastos}
          onClose={() => setCorteOpen(false)}
        />
      )}
    </>
  )
}
