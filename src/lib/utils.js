import { format, parseISO, isToday, isTomorrow, startOfWeek, endOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'

export const fmtDate = (d) => {
  if (!d) return '-'
  const date = typeof d === 'string' ? parseISO(d) : d
  return format(date, 'dd/MM/yyyy')
}

export const fmtDateInput = (d) => {
  if (!d) return ''
  const date = typeof d === 'string' ? parseISO(d) : d
  return format(date, 'yyyy-MM-dd')
}

export const fmtDateLong = (d) => {
  if (!d) return ''
  const date = typeof d === 'string' ? parseISO(d) : d
  return format(date, "EEEE d 'de' MMMM yyyy", { locale: es })
}

export const fmtMonthYear = (d) => {
  const date = typeof d === 'string' ? parseISO(d) : d
  return format(date, "MMMM yyyy", { locale: es })
}

export const todayStr = () => format(new Date(), 'yyyy-MM-dd')
export const tomorrowStr = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return format(d, 'yyyy-MM-dd')
}

export const initials = (name) =>
  (name || '').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')

export const statusClass = (s) => {
  const map = {
    'Reservada': 'reservada',
    'Confirmada': 'confirmada',
    'Completada': 'completada',
    'Pendiente de entrega': 'pendiente',
    'Entregada': 'entregada',
    'Cancelada': 'cancelada',
  }
  return map[s] || 'reservada'
}

export const statusColor = (s) => {
  const map = {
    'Reservada': '#7c3aed',
    'Confirmada': '#3b82f6',
    'Completada': '#22c55e',
    'Pendiente de entrega': '#f59e0b',
    'Entregada': '#6ee7b7',
    'Cancelada': '#ef4444',
  }
  return map[s] || '#666'
}

export const ALL_STATUSES = [
  'Reservada', 'Confirmada', 'Completada',
  'Pendiente de entrega', 'Entregada', 'Cancelada'
]

export const getTimeSlots = (open = '09:00', close = '20:00', block = 30) => {
  const [oh, om] = open.split(':').map(Number)
  const [ch, cm] = close.split(':').map(Number)
  const slots = []
  let cur = oh * 60 + om
  const end = ch * 60 + cm
  while (cur < end) {
    const h = Math.floor(cur / 60), m = cur % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    cur += block
  }
  return slots
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

export const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
