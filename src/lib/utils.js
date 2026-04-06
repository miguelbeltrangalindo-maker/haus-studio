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
  }
  return map[s] || 'reservada'
}

export const statusColor = (s) => {
  const map = {
    'Reservada':            '#9b87f5',
    'Confirmada':           '#60a5fa',
    'Llegó':                '#22d3ee',
    'En sesión':            '#fbbf24',
    'Completada':           '#34d399',
    'Pendiente de entrega': '#fb923c',
    'Entregada':            '#6ee7b7',
    'Cancelada':            '#f87171',
    'Pendiente de pago':    '#f59e0b',
  }
  return map[s] || '#888'
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
