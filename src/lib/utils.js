import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export const fmtDate = (d) => {
  if (!d) return '–'
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
  return format(date, "EEEE, d 'de' MMMM yyyy", { locale: es })
}

export const todayStr = () => format(new Date(), 'yyyy-MM-dd')
export const tomorrowStr = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return format(d, 'yyyy-MM-dd')
}

export const initials = (name) =>
  (name || '').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')

// ── Status system ──────────────────────────────────────────────

export const ALL_STATUSES = [
  'Reservada',
  'Confirmada',
  'Llegó',
  'En sesión',
  'Completada',
  'Pendiente de entrega',
  'Entregada',
  'Cancelada',
  'Pendiente de pago',
  'No show',
]

export const statusClass = (s) => {
  const map = {
    'Reservada':            'reservada',
    'Confirmada':           'confirmada',
    'Llegó':                'llego',
    'En sesión':            'en-sesion',
    'Completada':           'completada',
    'Pendiente de entrega': 'pendiente',
    'Entregada':            'entregada',
    'Cancelada':            'cancelada',
    'Pendiente de pago':    'pendiente-pago',
    'No show':              'no-show',
  }
  return map[s] || 'reservada'
}

export const statusColor = (s) => {
  const map = {
    'Reservada':            '#F59E0B',
    'Confirmada':           '#8B5CF6',
    'Llegó':                '#A78BFA',
    'En sesión':            '#A78BFA',
    'Completada':           '#22C55E',
    'Pendiente de entrega': '#F59E0B',
    'Entregada':            '#4ADE80',
    'Cancelada':            '#EF4444',
    'Pendiente de pago':    '#F59E0B',
    'No show':              '#6B7280',
  }
  return map[s] || '#6B7280'
}

// Siguiente estado natural en el flujo de operación
export const nextStatus = (current) => {
  const flow = {
    'Reservada':            'Confirmada',
    'Confirmada':           'Llegó',
    'Llegó':                'En sesión',
    'En sesión':            'Completada',
    'Completada':           'Pendiente de entrega',
    'Pendiente de entrega': 'Entregada',
  }
  return flow[current] ?? null
}

export const nextStatusLabel = (current) => {
  const labels = {
    'Reservada':            'Confirmar',
    'Confirmada':           'Cliente llegó',
    'Llegó':                'Iniciar sesión',
    'En sesión':            'Completar sesión',
    'Completada':           'Pendiente de entrega',
    'Pendiente de entrega': 'Marcar entregada',
  }
  return labels[current] ?? null
}

// ── Calendar ───────────────────────────────────────────────────

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
