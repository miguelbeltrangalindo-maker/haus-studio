import { Fragment, useState, useEffect } from 'react'
import { format, addDays, startOfWeek, addWeeks, subWeeks, addMonths, subMonths, getDaysInMonth, startOfMonth, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { getTimeSlots, statusClass, weekDays, fmtDate, todayStr } from '../lib/utils'
import { useConfig } from '../hooks/useConfig'
import { useToast } from '../hooks/useToast'
import { useConfirm } from '../components/ConfirmDialog'
import Badge from '../components/Badge'
import SessionModal from '../components/SessionModal'

export default function Agenda({ sessions, createSession, updateSession, createPago, onSelectSession }) {
  const { config } = useConfig()
  const toast = useToast()
  const confirm = useConfirm()
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
    if (result.error) { toast(result.error, 'error'); return result }
    toast(modal?.session?.id ? 'Sesión actualizada' : 'Sesión creada', 'success')
    setModal(null)
    return result
  }

  const handleDelete = async () => {
    if (!modal?.session?.id) return
    const ok = await confirm({
      title: 'Cancelar esta sesión',
      message: `${modal.session.nombre || 'Sesión'} · ${fmtDate(modal.session.fecha)}`,
      confirmLabel: 'Cancelar sesión',
      cancelLabel: 'No, mantener',
      destructive: true,
    })
    if (!ok) return
    await updateSession(modal.session.id, { estatus: 'Cancelada' })
    toast('Sesión cancelada')
    setModal(null)
  }

  // ── Day view (timeline) ──
  const DayView = () => {
    const dateStr = format(current, 'yyyy-MM-dd')
    const isToday  = dateStr === todayS
    const nowMinutes = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : null
    const blockDur   = config.block_minutes || 30

    // Daily metrics
    const dayActive   = sessions.filter(s => s.fecha === dateStr && !['Cancelada', 'No show'].includes(s.estatus))
    const dayAnticipo = dayActive.reduce((a, s) => a + (+s.anticipo || 0), 0)
    const dayRestante = dayActive.reduce((a, s) => a + (+s.restante || 0), 0)

    // Featured: in-session first, then next upcoming today
    const upcomingOrActive = dayActive
      .filter(s => ['Reservada', 'Confirmada', 'Llegó', 'En sesión'].includes(s.estatus))
      .sort((a, b) => (a.hora || '') > (b.hora || '') ? 1 : -1)

    const featuredSes = (() => {
      const enSesion = upcomingOrActive.find(s => s.estatus === 'En sesión')
      if (enSesion) return enSesion
      if (!isToday || nowMinutes === null) return upcomingOrActive[0] || null
      return upcomingOrActive.find(s => {
        const [h, m] = (s.hora || '00:00').split(':').map(Number)
        return (h * 60 + m) >= nowMinutes - 15
      }) || null
    })()

    const etaLabel = (() => {
      if (!featuredSes || !isToday || nowMinutes === null) return null
      if (featuredSes.estatus === 'En sesión') return 'EN SESIÓN · AHORA'
      const [h, m] = (featuredSes.hora || '00:00').split(':').map(Number)
      const diff = (h * 60 + m) - nowMinutes
      if (diff <= 0) return 'LLEGANDO'
      if (diff < 60) return `EN ${diff} MIN`
      const hrs = Math.floor(diff / 60)
      const mins = diff % 60
      return `EN ${hrs}H${mins > 0 ? ` ${mins}MIN` : ''}`
    })()

    return (
      <>
        {/* Day metrics header */}
        {dayActive.length > 0 && (
          <div className="day-header-v2">
            <div className="dhv2-item">
              <div className="dhv2-value">{dayActive.length}</div>
              <div className="dhv2-label">sesiones</div>
            </div>
            {dayAnticipo > 0 && (
              <div className="dhv2-item">
                <div className="dhv2-value green">${dayAnticipo.toLocaleString()}</div>
                <div className="dhv2-label">cobrado</div>
              </div>
            )}
            {dayRestante > 0 && (
              <div className="dhv2-item">
                <div className="dhv2-value amber">${dayRestante.toLocaleString()}</div>
                <div className="dhv2-label">pendiente</div>
              </div>
            )}
          </div>
        )}

        {/* Featured / Next session card */}
        {featuredSes && (
          <div
            className={`nsc ${statusClass(featuredSes.estatus)}`}
            onClick={() => handleSessionClick(featuredSes)}
          >
            {etaLabel && <div className="nsc-eta">{etaLabel}</div>}
            <div className="nsc-row">
              <div className="nsc-name">{featuredSes.nombre}</div>
              <Badge status={featuredSes.estatus} />
            </div>
            <div className="nsc-meta">
              {featuredSes.hora?.slice(0, 5)}
              {' · '}{featuredSes.personas} {featuredSes.personas === 1 ? 'persona' : 'personas'}
              {featuredSes.telefono && ` · ${featuredSes.telefono}`}
            </div>
            {(+featuredSes.anticipo > 0 || +featuredSes.restante > 0) && (
              <div className="nsc-money">
                {+featuredSes.anticipo > 0 && (
                  <span className="nsc-anticipo">${(+featuredSes.anticipo).toLocaleString()} anticipo</span>
                )}
                {+featuredSes.restante > 0 && (
                  <span className="nsc-restante">${(+featuredSes.restante).toLocaleString()} saldo</span>
                )}
              </div>
            )}
            {featuredSes.notas && <div className="nsc-notes">{featuredSes.notas}</div>}
          </div>
        )}

        {/* Timeline */}
        <div className="tl-timeline">
          {slots.map(slot => {
            const [h, m] = slot.split(':').map(Number)
            const slotMinutes  = h * 60 + m
            const isHourStart  = m === 0
            const slotSessions = getSessionsAt(dateStr, slot)
            const isPast    = nowMinutes !== null && slotMinutes + blockDur <= nowMinutes
            const isNowSlot = nowMinutes !== null && nowMinutes >= slotMinutes && nowMinutes < slotMinutes + blockDur

            return (
              <div
                key={slot}
                className={`tl-row${isHourStart ? ' hour-start' : ''}${isPast && slotSessions.length === 0 ? ' past-empty' : ''}`}
              >
                <div className={`tl-time${isHourStart ? ' hour' : ''}${isPast ? ' past' : ''}`}>{slot}</div>
                <div
                  className="tl-body"
                  onClick={() => slotSessions.length === 0 && openNew(dateStr, slot)}
                >
                  {isNowSlot && slotSessions.length === 0 && <div className="tl-now-line" />}
                  {slotSessions.length === 0 && !isNowSlot && <div className="tl-empty-hint">+</div>}
                  {slotSessions.map(ses => (
                    <div
                      key={ses.id}
                      className={`tl-session ${statusClass(ses.estatus)}${isPast && !['En sesión', 'Llegó'].includes(ses.estatus) ? ' past' : ''}`}
                      onClick={e => { e.stopPropagation(); handleSessionClick(ses) }}
                    >
                      <div className="tl-ses-row">
                        <div className="tl-ses-name">{ses.nombre}</div>
                        <Badge status={ses.estatus} />
                      </div>
                      <div className="tl-ses-meta">
                        {ses.personas} {ses.personas === 1 ? 'persona' : 'personas'}
                        {ses.telefono && ` · ${ses.telefono}`}
                      </div>
                      {(+ses.anticipo > 0 || +ses.restante > 0) && (
                        <div className="tl-ses-money">
                          {+ses.anticipo > 0 && (
                            <span className="tl-anticipo">${(+ses.anticipo).toLocaleString()} ant.</span>
                          )}
                          {+ses.restante > 0 && (
                            <span className="tl-restante">${(+ses.restante).toLocaleString()} saldo</span>
                          )}
                        </div>
                      )}
                      {ses.notas && <div className="tl-ses-notes">{ses.notas}</div>}
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
          createPago={createPago}
          sessions={sessions}
        />
      )}
    </>
  )
}
