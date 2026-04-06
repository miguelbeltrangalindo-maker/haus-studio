import { useState } from 'react'
import { format, addDays, startOfWeek, addWeeks, subWeeks, addMonths, subMonths, getDaysInMonth, startOfMonth, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { getTimeSlots, statusClass, statusColor, weekDays, fmtDate, todayStr } from '../lib/utils'
import { useConfig } from '../hooks/useConfig'
import { useToast } from '../hooks/useToast'
import SessionModal from '../components/SessionModal'
import Badge from '../components/Badge'

export default function Agenda({ sessions, createSession, updateSession }) {
  const { config } = useConfig()
  const toast = useToast()
  const [view, setView] = useState('day')
  const [current, setCurrent] = useState(new Date())
  const [modal, setModal] = useState(null) // { session?, prefillDate?, prefillHora? }

  const slots = getTimeSlots(config.open_time, config.close_time, config.block_minutes)
  const todayS = todayStr()

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

  const getSessionAt = (dateStr, hora) =>
    sessions.find(s => s.fecha === dateStr && s.hora === hora && s.estatus !== 'Cancelada')

  const openNew = (date, hora) => setModal({ prefillDate: date, prefillHora: hora })
  const openEdit = (session) => setModal({ session })

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

  // ── Day view ──
  const DayView = () => {
    const dateStr = format(current, 'yyyy-MM-dd')
    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {slots.map(slot => {
          const ses = getSessionAt(dateStr, slot)
          return (
            <div key={slot} className="day-slot">
              <div className="day-time">{slot}</div>
              <div className="day-content" onClick={() => ses ? openEdit(ses) : openNew(dateStr, slot)}>
                {ses && (
                  <div className={`session-block ${statusClass(ses.estatus)}`}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{ses.nombre}</div>
                    <div style={{ fontSize: 10, opacity: .8 }}>{ses.personas}p · {ses.estatus}</div>
                    <div style={{ fontSize: 10, opacity: .7, display: 'flex', gap: 6, marginTop: 2 }}>
                      {ses.reminder_sent && <span>📱✓</span>}
                      {ses.link_sent && <span>📸✓</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Week view ──
  const WeekView = () => {
    const mon = startOfWeek(current, { weekStartsOn: 1 })
    const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i))
    return (
      <div className="week-grid">
        <div className="day-header" style={{ borderRight: '1px solid var(--border)' }} />
        {days.map((d, i) => {
          const ds = format(d, 'yyyy-MM-dd')
          return (
            <div key={i} className="day-header">
              <div className="day-name">{weekDays[i]}</div>
              <div className={`day-num ${ds === todayS ? 'today' : ''}`}>{d.getDate()}</div>
            </div>
          )
        })}
        {slots.map(slot => (
          <>
            <div key={`t-${slot}`} className="time-label">{slot}</div>
            {days.map((d, i) => {
              const ds = format(d, 'yyyy-MM-dd')
              const ses = getSessionAt(ds, slot)
              return (
                <div key={`${i}-${slot}`} className="cal-cell" onClick={() => ses ? openEdit(ses) : openNew(ds, slot)}>
                  {ses && (
                    <div className={`session-block ${statusClass(ses.estatus)}`} title={ses.nombre}>
                      <div style={{ fontSize: 10, fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{ses.nombre}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        ))}
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
      const d = new Date(y, m, 1 - startDay + i)
      cells.push({ date: d, out: true })
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
              <div key={idx} className={`month-cell ${cell.out ? 'other-month' : ''}`}
                onClick={() => { setCurrent(cell.date); setView('day') }}>
                <div className={`month-day-num ${isToday ? 'today-num' : ''}`}>{cell.date.getDate()}</div>
                {daySes.slice(0, 3).map(s => (
                  <div key={s.id} className="month-ses-dot" style={{ borderLeft: `2px solid ${statusColor(s.estatus)}` }}>
                    {s.hora} {s.nombre.split(' ')[0]}
                  </div>
                ))}
                {daySes.length > 3 && <div style={{ fontSize: 10, color: 'var(--text3)', padding: '1px 4px' }}>+{daySes.length - 3} más</div>}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="view-tabs">
            {['day', 'week', 'month'].map(v => (
              <button key={v} className={`view-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
                {{ day: 'Día', week: 'Semana', month: 'Mes' }[v]}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)}>‹</button>
            <span style={{ fontSize: 14, fontWeight: 500, minWidth: 200, textAlign: 'center', textTransform: 'capitalize' }}>{calTitle()}</span>
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
