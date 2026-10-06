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

// ── Dinero ─────────────────────────────────────────────────────
// metodo_anticipo 'cupon' = cortesía: el anticipo registra el valor regalado, no dinero recibido
export const esCortesia = (s) => s?.metodo_anticipo === 'cupon'
export const ingresoAnticipo = (s) => esCortesia(s) ? 0 : (+s?.anticipo || 0)

// ── Apartados sin fecha ────────────────────────────────────────
// Un apartado es una sesión con anticipo cuyo cliente aún no elige día (fecha/hora null).
// `apartado` se marca al crearla así y no se borra al agendar: permite medir conversión.
export const sinFecha = (s) => !s?.fecha
export const apartadoPendiente = (s) => sinFecha(s) && !['Cancelada', 'No show'].includes(s?.estatus)
export const diasEsperando = (s) => {
  if (!s?.created_at) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(s.created_at).getTime()) / 86400000))
}
// "12/10/2026 · 10:00" o "Sin fecha"
export const fmtFechaHora = (s) =>
  sinFecha(s) ? 'Sin fecha' : `${fmtDate(s.fecha)} · ${s.hora?.slice(0, 5) || ''}`
// Mensaje de seguimiento para que el cliente elija su fecha
export const mensajeApartado = (s, studio = 'HAUS') => {
  const monto = esCortesia(s) ? 0 : (+s?.anticipo || 0)
  return `Hola, ${s?.nombre || ''}. Te saludamos de ${studio}. ` +
    (monto > 0 ? `Tienes un apartado de $${monto.toLocaleString()} con nosotros. ` : 'Tienes una sesión apartada con nosotros. ') +
    '¿Qué día te gustaría agendar tu sesión? Con gusto te compartimos los horarios disponibles.'
}

// Resumen de apartados para Estadísticas y Excel.
// Los pendientes son una foto actual (no dependen del período): su anticipo aún no entra en
// "Cobrado" porque los ingresos se reconocen por fecha de sesión.
export const resumenApartados = (sessions = []) => {
  const pendientes = sessions.filter(apartadoPendiente)
    .sort((a, b) => (a.created_at || '') > (b.created_at || '') ? 1 : -1)
  const dias = pendientes.map(diasEsperando)
  const historicos = sessions.filter(s => s.apartado)
  const perdidos   = historicos.filter(s => ['Cancelada', 'No show'].includes(s.estatus))
  const agendados  = historicos.filter(s => s.fecha && !perdidos.includes(s))
  const cerrados   = agendados.length + perdidos.length
  return {
    pendientes,
    anticipoRetenido: pendientes.reduce((a, s) => a + ingresoAnticipo(s), 0),
    porCobrar:        pendientes.reduce((a, s) => a + (+s.restante || 0), 0),
    diasPromedio:     dias.length ? Math.round(dias.reduce((a, d) => a + d, 0) / dias.length) : 0,
    totalHistorico:   historicos.length,
    agendados:        agendados.length,
    perdidos:         perdidos.length,
    // Conversión sobre apartados ya resueltos (agendados o perdidos), no sobre los que siguen esperando
    tasaAgendado:     cerrados > 0 ? Math.round((agendados.length / cerrados) * 100) : null,
  }
}
