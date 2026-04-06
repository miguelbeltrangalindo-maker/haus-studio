import { Fragment, useState, useEffect } from 'react'
import { format, addDays, startOfWeek, addWeeks, subWeeks, addMonths, subMonths, getDaysInMonth, startOfMonth, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { getTimeSlots, statusClass, weekDays, fmtDate, todayStr } from '../lib/utils'
import { useConfig } from '../hooks/useConfig'
import { useToast } from '../hooks/useToast'
import SessionModal from '../components/SessionModal'

export default function Agenda({ sessions, createSession, updateSession, onSelectSession }) {
  const { config } = useConfig()
  const toast = useToast()
  const [view, setView] = useState('day')
  const [current, setCurrent] = useState(new Date())
  const [modal, setModal] = useState(null)

  const slots = getTimeSlots(config.open_time, config.close_time, config.block_minutes)
  const todayS = todayStr()

  // On mobile, week view doesn't fit — fall back to day
  useEffect(() => {
    if (view === 'week' && window.matchMedia('(max-width: 768px)').matches) {
      setView('day')
    }
  }, [])

  const nav = (dir) => {
    if (view === 'day') setCurrent(d => addDays(d, dir))
    else if (view === 'week') setCurrent(d => dir > 0 ? addWeeks(d, 1) : subWeeks(d, 1))
    else setCurrent(d => dir > 0 ? addMonths(d, 1) : subMonths(d, 1))
  }

  const calTitle = () => {
    if (view === 'day') return format(current, "EEEE d 'de' MMMM yyyy", { locale: es })
    if (view === 'week') {
      const mon = startOfWeek(current, { weekStartsOn: 1 })
      const sun = addDays(mon, 6)
      return `${format(mon, 'd MMM', { locale: es })} – ${format(sun, 'd MMM yyyy', { locale: es })}`
    }
    return format(current, "MMMM yyyy", { locale: es })
  }

  const getSessionsAt = (dateStr, hora) =>
    sessions.filter(s => s.fecha === dateStr && s.hora?.slice(0, 5) === hora && s.estatus !== 'Cancelada')

  const openNew = (date, hora) => setModal({ prefillDate: date, prefillHora: hora })
  const openEdit = (session) => setModal({ session })

  const handleSessionClick = (ses) => {
    if (window.matchMedia('(min-width: 769px)').matches) {
      onSelectSession?.(ses)
    } else {
      openEdit(ses)
    }
  }

  const handleSave = async (form) => {
    let result
    if (modal?.session?.id) {
      result = await updateSession(modal.session.id, form)
    } else {
      result = await createSession(form)
    }
    if (result.error) { toast(result.error, 'error'); return }
    toast(modal?.session?.id ? 'Sesión actualizada' : 'Sesión creada', 'success')
    setModal(null)
  }

  const handleDelete = async () => {
    if (!modal?.session?.id) return
    if (!confirm('¿Cancelar esta sesión?')) return
    await updateSession(modal.session.id, { estatus: 'Cancelada' })
    toast('Sesión cancelada')
    setModal(null)
  }

  // ── Day view (timeline) ──
  const DayView = () => {
    const dateStr = format(current, 'yyyy-MM-dd')
    const isToday = dateStr === todayS

    const nowMinutes = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : null
    const [openH, openM] = (config.open_time || '09:00').split(':').map(Number)
    const openMinutes = openH * 60 + openM

    // Daily summary metrics
    const dayActive = sessions.filter(s => s.fecha === dateStr && !['Cancelada', 'No show'].includes(s.estatus))
    const dayCount   = dayActive.length
    const dayAnticipo = dayActive.reduce((a, s) => a + (+s.anticipo || 0), 0)
    const dayRestante = dayActive.reduce((a, s) => a + (+s.restante || 0), 0)

    return (
      <>
        {dayCount > 0 && (
          <div className="daily-summary">
            <div className="ds-item">
              <div className="ds-label">Sesiones</div>
              <div className="ds-value">{dayCount}</div>
            </div>
            {dayAnticipo > 0 && (
              <div className="ds-item">
                <div className="ds-label">Anticipos</div>
                <div className="ds-value green">${dayAnticipo.toLocaleString()}</div>
              </div>
            )}
            {dayRestante > 0 && (
              <div className="ds-item">
                <div className="ds-label">Por cobrar</div>
                <div className="ds-value amber">${dayRestante.toLocaleString()}</div>
              </div>
            )}
          </div>
        )}

        <div className="timeline">
          {slots.map(slot => {
            const [h, m] = slot.split(':').map(Number)
            const slotMinutes = h * 60 + m
            const isHourStart = m === 0
            const slotSessions = getSessionsAt(dateStr, slot)
            const showNow = nowMinutes !== null &&
              nowMinutes >= slotMinutes &&
              nowMinutes < slotMinutes + (config.block_minutes || 30)

            return (
              <div key={slot} className={`timeline-slot${isHourStart ? ' hour-start' : ''}`}>
                <div className="timeline-time">{slot}</div>
                <div
                  className="timeline-body"
                  onClick={() => slotSessions.length === 0 && openNew(dateStr, slot)}
                >
                  {showNow && <div className="timeline-now" />}
                  {slotSessions.map(ses => (
                    <div
                      key={ses.id}
                      className={`timeline-session ${statusClass(ses.estatus)}`}
                      onClick={e => { e.stopPropagation(); handleSessionClick(ses) }}
                    >
                      <div className="timeline-session-header">
                        <div className="timeline-session-name">{ses.nombre}</div>
                        <div className="timeline-session-meta">
                          {ses.personas} {ses.personas === 1 ? 'persona' : 'personas'} · {ses.estatus}
                        </div>
                      </div>
                      {ses.notas && (
                        <div className="timeline-session-notes">{ses.notas}</div>
                      )}
                      {(+ses.anticipo > 0 || +ses.restante > 0) && (
                        <div className="timeline-session-money">
                          {+ses.anticipo > 0 && (
                            <span className="tsm-anticipo">${(+ses.anticipo).toLocaleString()} ant.</span>
                          )}
                          {+ses.restante > 0 && (
                            <span className="tsm-restante">${(+ses.restante).toLocaleString()} saldo</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </>
    )
  }

  // ── Week view ──
  const WeekView = () => {
    const mon = startOfWeek(current, { weekStartsOn: 1 })
    const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i))
    return (
      <div className="week-scroll">
        <div className="week-grid">
          <div className="day-header" style={{ borderRight: '1px solid var(--border)' }} />
          {days.map((d, i) => {
            const ds = format(d, 'yyyy-MM-dd')
            const isToday = ds === todayS
            return (
              <div key={i} className="day-header" style={{ background: isToday ? 'rgba(200,184,154,.06)' : undefined }}>
                <div className="day-name">{weekDays[i]}</div>
                <div className={`day-num ${isToday ? 'today' : ''}`}>{d.getDate()}</div>
              </div>
            )
          })}

          {slots.map(slot => (
            <Fragment key={slot}>
              <div className="time-label">{slot}</div>
              {days.map((d, i) => {
                const ds = format(d, 'yyyy-MM-dd')
                const slotSessions = getSessionsAt(ds, slot)
                return (
                  <div
                    key={`${i}-${slot}`}
                    className="cal-cell"
                    onClick={() => slotSessions.length === 0 && openNew(ds, slot)}
                  >
                    {slotSessions.map(ses => (
                      <div
                        key={ses.id}
                        className={`session-block ${statusClass(ses.estatus)}`}
                        title={`${ses.nombre} · ${ses.estatus}`}
                        onClick={e => { e.stopPropagation(); handleSessionClick(ses) }}
                      >
                        <div className="session-block-name">{ses.nombre.split(' ')[0]}</div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
    )
  }

  // ── Month view ──
  const MonthView = () => {
    const y = current.getFullYear(), m = current.getMonth()
    const first = startOfMonth(current)
    const startDay = getDay(first) === 0 ? 6 : getDay(first) - 1
    const daysInMonth = getDaysInMonth(current)
    const cells = []
    for (let i = 0; i < startDay; i++) {
      cells.push({ date: new Date(y, m, 1 - startDay + i), out: true })
    }
    for (let day = 1; day <= daysInMonth; day++) cells.push({ date: new Date(y, m, day), out: false })
    const remaining = (7 - cells.length % 7) % 7
    for (let i = 1; i <= remaining; i++) cells.push({ date: new Date(y, m + 1, i), out: true })

    return (
      <div className="month-grid-wrap">
        <div className="month-grid" style={{ background: 'var(--bg3)' }}>
          {weekDays.map(n => <div key={n} className="month-header-cell">{n}</div>)}
        </div>
        <div className="month-grid">
          {cells.map((cell, idx) => {
            const ds = format(cell.date, 'yyyy-MM-dd')
            const daySes = sessions.filter(s => s.fecha === ds && s.estatus !== 'Cancelada')
            const isToday = ds === todayS
            return (
              <div
                key={idx}
                className={`month-cell ${cell.out ? 'other-month' : ''}`}
                onClick={() => { setCurrent(cell.date); setView('day') }}
              >
                <div className={`month-day-num ${isToday ? 'today-num' : ''}`}>{cell.date.getDate()}</div>
                {daySes.length > 0 && (
                  <div className={`month-ses-count ${daySes.length >= 9 ? 'red' : daySes.length >= 6 ? 'amber' : 'green'}`}>
                    {daySes.length}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Agenda</div>
        <div className="topbar-right">
          <button className="btn btn-primary btn-sm" onClick={() => setModal({})}>+ Nueva sesión</button>
        </div>
      </div>

      <div className="page-content">
        <div className="agenda-controls">
          <div className="view-tabs">
            {[['day', 'Día', ''], ['week', 'Semana', 'view-tab-week'], ['month', 'Mes', '']].map(([v, label, extra]) => (
              <button key={v} className={`view-tab ${view === v ? 'active' : ''} ${extra}`} onClick={() => setView(v)}>
                {label}
              </button>
            ))}
          </div>

          <div className="agenda-nav">
            <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)}>‹</button>
            <span className="agenda-nav-title">{calTitle()}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => nav(1)}>›</button>
          </div>

          <button className="btn btn-sm" onClick={() => setCurrent(new Date())}>Hoy</button>
        </div>

        {view === 'day' && <DayView />}
        {view === 'week' && <WeekView />}
        {view === 'month' && <MonthView />}
      </div>

      {modal !== null && (
        <SessionModal
          session={modal.session}
          prefillDate={modal.prefillDate}
          prefillHora={modal.prefillHora}
          onSave={handleSave}
          onClose={() => setModal(null)}
          onDelete={handleDelete}
        />
      )}
    </>
  )
}
