import { format, addDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { todayStr, tomorrowStr } from '../lib/utils'
import { useConfig } from '../hooks/useConfig'
import { useIsMobile } from '../hooks/useIsMobile'
import DashboardMobile from './DashboardMobile'
import DashboardDesktop from './DashboardDesktop'

export default function Dashboard(props) {
  const { sessions } = props
  const { config }   = useConfig()
  const isMobile     = useIsMobile()

  const today    = todayStr()
  const tomorrow = tomorrowStr()

  const effectiveStart = config.stats_start || today
  const effectiveEnd   = config.stats_end   || format(addDays(new Date(), 29), 'yyyy-MM-dd')

  const rangeLabel = (() => {
    try {
      const s = parseISO(effectiveStart)
      const e = parseISO(effectiveEnd)
      return `${format(s, "d 'de' MMM", { locale: es })} — ${format(e, "d 'de' MMM yyyy", { locale: es })}`
    } catch { return '' }
  })()

  const rangeSessions = sessions.filter(s => s.fecha >= effectiveStart && s.fecha <= effectiveEnd)
  const rangeActive   = rangeSessions.filter(s => !['Cancelada', 'No show'].includes(s.estatus))

  const totalSessions  = rangeActive.length
  const confirmadas    = rangeActive.filter(s => ['Reservada', 'Confirmada', 'Llegó', 'En sesión'].includes(s.estatus))
  const pendEntrega    = rangeActive.filter(s => s.estatus === 'Pendiente de entrega')
  const pendPago       = rangeActive.filter(s => s.estatus === 'Pendiente de pago')
  const entregadas     = rangeSessions.filter(s => s.estatus === 'Entregada')
  const canceladas     = rangeSessions.filter(s => ['Cancelada', 'No show'].includes(s.estatus))
  const liquidadas     = rangeActive.filter(s =>
    ['Completada', 'Entregada', 'Pendiente de entrega'].includes(s.estatus) &&
    (+s.restante === 0 || s.restante === '' || s.restante == null)
  )
  const totalLiquidado = liquidadas.reduce((a, s) => a + (+s.pagos || 0), 0)
  const totalAnticipo  = rangeActive.reduce((a, s) => a + (+s.anticipo || 0), 0)
  const totalRestante  = rangeActive.reduce((a, s) => a + (+s.restante || 0), 0)

  const todaySes    = sessions
    .filter(s => s.fecha === today && !['Cancelada', 'No show'].includes(s.estatus))
    .sort((a, b) => a.hora > b.hora ? 1 : -1)
  const tomorrowSes = sessions
    .filter(s => s.fecha === tomorrow && !['Cancelada', 'No show'].includes(s.estatus))
    .sort((a, b) => a.hora > b.hora ? 1 : -1)

  const metrics = {
    rangeLabel, totalSessions,
    confirmadas, pendEntrega, pendPago,
    entregadas, canceladas, liquidadas,
    totalLiquidado, totalAnticipo, totalRestante,
    todaySes, tomorrowSes,
  }

  return isMobile
    ? <DashboardMobile {...props} {...metrics} />
    : <DashboardDesktop {...props} {...metrics} />
}
