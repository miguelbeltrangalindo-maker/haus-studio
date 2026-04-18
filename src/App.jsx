import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { format } from 'date-fns'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Hoy from './pages/Hoy'
import Agenda from './pages/Agenda'
import Sesiones from './pages/Sesiones'
import Gastos from './pages/Gastos'
import Estadisticas from './pages/Estadisticas'
import Config from './pages/Config'
import Clientes from './pages/Clientes'
import SessionDetails from './components/SessionDetails'
import { ToastProvider, useToast } from './hooks/useToast'
import { ConfigProvider, useConfig } from './hooks/useConfig'
import { useSessions } from './hooks/useSessions'
import { useGastos } from './hooks/useGastos'
import { usePagos } from './hooks/usePagos'
import { useExtras } from './hooks/useExtras'

// ── helpers ──────────────────────────────────────────────────────────────────
const todayFecha = () => format(new Date(), 'yyyy-MM-dd')

function AppInner() {
  const { sessions, loading, createSession, updateSession, deleteSession, fetch } = useSessions()
  const {
    gastos, loading: gastosLoading, tableError, comisionSchemaReady,
    createGasto, updateGasto, deleteGasto,
    createComisionGasto, updateComisionByRef, deleteComisionByRef,
  } = useGastos()
  const { pagos, createPago, updatePago, deletePago } = usePagos()
  const { extras, createExtra, updateExtra, deleteExtra, tableError: extrasTableError } = useExtras()
  const { config } = useConfig()
  const toast = useToast()
  const [selectedId, setSelectedId] = useState(null)
  const location = useLocation()

  useEffect(() => { setSelectedId(null) }, [location.pathname])

  const currentSelected = selectedId ? (sessions.find(s => s.id === selectedId) || null) : null

  const onSelectSession = (ses) => {
    if (!ses) { setSelectedId(null); return }
    if (window.matchMedia('(min-width: 769px)').matches) setSelectedId(ses.id)
  }

  // ── Comisión bancaria helpers ─────────────────────────────────────────────
  const comisionPct = config.payment_settings?.comision_tarjeta || 0

  const comisionMonto = (monto) =>
    Math.round((+monto || 0) * (comisionPct / 100) * 100) / 100

  const comisionConcepto = (nombre) =>
    `Comisión tarjeta · ${nombre || 'cliente'}`

  // Crea o actualiza la comisión del anticipo de una sesión
  const syncAnticipoComision = async (session, prevSession = null) => {
    if (!comisionSchemaReady || comisionPct <= 0) return
    const ref = `anticipo:${session.id}`
    const metodo = session.metodo_anticipo
    const monto  = +session.anticipo || 0

    const prevMetodo = prevSession?.metodo_anticipo
    const prevMonto  = +prevSession?.anticipo || 0

    if (metodo === 'tarjeta' && monto > 0) {
      const cm = comisionMonto(monto)
      // Check if a commission already exists for this session
      if (!prevSession || prevMetodo !== 'tarjeta') {
        // New tarjeta anticipo → create
        await createComisionGasto(ref, cm, comisionConcepto(session.nombre), session.fecha || todayFecha())
      } else if (prevMonto !== monto) {
        // Same tarjeta but amount changed → update
        await updateComisionByRef(ref, cm)
      }
    } else if (prevMetodo === 'tarjeta' && metodo !== 'tarjeta') {
      // Changed away from tarjeta → delete commission
      await deleteComisionByRef(ref)
    } else if (metodo === 'tarjeta' && monto === 0) {
      // Tarjeta but anticipo zeroed → delete
      await deleteComisionByRef(ref)
    }
  }

  // ── Session CRUD with extras + comisión ──────────────────────────────────
  const createSessionWithExtras = async (form) => {
    const result = await createSession(form)
    if (result.error) return result

    const session = result.data

    // Auto-add "Persona Adicional" extras when personas > 4
    const extra = (+form.personas || 0) - 4
    if (extra > 0) {
      const conceptos = config.extra_conceptos || []
      const concepto = conceptos.find(c =>
        c.nombre.toLowerCase().replace(/\s+/g, ' ').trim() === 'persona adicional'
      ) || conceptos.find(c => c.nombre.toLowerCase().includes('persona adicional'))
      if (concepto) {
        const monto = extra * (+concepto.precio_unitario || 0)
        await createExtra(session.id, concepto.nombre, monto, extra, +concepto.precio_unitario || 0)
      }
    }

    // Comisión por anticipo con tarjeta
    if (comisionPct > 0 && form.metodo_anticipo === 'tarjeta' && +form.anticipo > 0) {
      await createComisionGasto(
        `anticipo:${session.id}`,
        comisionMonto(form.anticipo),
        comisionConcepto(form.nombre),
        form.fecha || todayFecha(),
      )
    }

    // Send booking confirmation via WA if configured
    if (config.wa_settings?.on_booking && session?.id) {
      try {
        const waRes  = await window.fetch('/api/send-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: session.id }),
        })
        const waData = await waRes.json()
        if (waData.sent)              toast('WA enviado al cliente', 'success')
        else if (waData.skipped)      toast(`WA omitido: ${waData.skipped}`, 'info')
        else if (waData.code)         toast(`WA error ${waData.code}`, 'error')
        else if (!session.telefono)   toast('Sin teléfono — WA no enviado', 'info')
      } catch { toast('WA: error de red', 'error') }
    }

    return result
  }

  // updateSession wrapper: syncs comisión when anticipo/método cambia
  const updateSessionWithComision = async (id, updates) => {
    const result = await updateSession(id, updates)
    if (result?.error) return result

    const prev = sessions.find(s => s.id === id)
    const next = { ...prev, ...updates }

    // Only re-sync if anticipo-related fields changed
    const antipoChanged =
      updates.anticipo !== undefined ||
      updates.metodo_anticipo !== undefined

    if (antipoChanged) {
      await syncAnticipoComision(next, prev)
    }

    return result
  }

  // deleteSession wrapper: cleans up comisión del anticipo
  const deleteSessionWithComision = async (id) => {
    const session = sessions.find(s => s.id === id)
    const result  = await deleteSession(id)
    if (result?.error) return result

    if (session?.metodo_anticipo === 'tarjeta' && +session?.anticipo > 0) {
      await deleteComisionByRef(`anticipo:${id}`)
    }

    return result
  }

  // createPago wrapper: auto-comisión cuando el método es tarjeta
  const createPagoWithComision = async (session_id, monto, metodo, nota = '') => {
    const result = await createPago(session_id, monto, metodo, nota)
    if (result.error) return result

    if (comisionPct > 0 && metodo === 'tarjeta' && +monto > 0) {
      const session = sessions.find(s => s.id === session_id)
      await createComisionGasto(
        `pago:${result.data.id}`,
        comisionMonto(monto),
        comisionConcepto(session?.nombre),
        todayFecha(),
      )
    }

    return result
  }

  // updatePago wrapper: recalcula sesión y sincroniza comisión
  const updatePagoWithComision = async (pagoId, updates, oldPago) => {
    const { error } = await updatePago(pagoId, updates)
    if (error) return { error }

    const newMonto  = +updates.monto  ?? +oldPago.monto
    const newMetodo = updates.metodo  ?? oldPago.metodo
    const oldMonto  = +oldPago.monto  || 0
    const oldMetodo = oldPago.metodo

    // Recalcular campos de la sesión
    const sess = sessions.find(s => s.id === oldPago.session_id)
    if (sess) {
      const delta = newMonto - oldMonto
      await updateSession(oldPago.session_id, {
        pagos:       String(Math.max(0, (+sess.pagos    || 0) + delta)),
        restante:    String(Math.max(0, (+sess.restante || 0) - delta)),
        metodo_pago: newMetodo,
      })
    }

    // Sincronizar comisión
    if (comisionPct > 0 && comisionSchemaReady) {
      const ref = `pago:${pagoId}`
      if (oldMetodo === 'tarjeta' && newMetodo === 'tarjeta') {
        await updateComisionByRef(ref, comisionMonto(newMonto))
      } else if (oldMetodo === 'tarjeta' && newMetodo !== 'tarjeta') {
        await deleteComisionByRef(ref)
      } else if (oldMetodo !== 'tarjeta' && newMetodo === 'tarjeta') {
        const s = sessions.find(s => s.id === oldPago.session_id)
        await createComisionGasto(ref, comisionMonto(newMonto), comisionConcepto(s?.nombre), todayFecha())
      }
    }

    return {}
  }

  // deletePago wrapper: recalcula sesión y elimina comisión
  const deletePagoWithComision = async (pagoId) => {
    const pago = pagos.find(p => p.id === pagoId)
    const result = await deletePago(pagoId)
    if (result?.error) return result

    if (pago) {
      // Devolver el monto a restante y descontar de pagos
      const sess = sessions.find(s => s.id === pago.session_id)
      if (sess) {
        await updateSession(pago.session_id, {
          pagos:    String(Math.max(0, (+sess.pagos    || 0) - (+pago.monto || 0))),
          restante: String(          (+sess.restante || 0) + (+pago.monto || 0)),
        })
      }
      await deleteComisionByRef(`pago:${pagoId}`)
    }

    return {}
  }

  const shared = {
    sessions, loading,
    createSession: createSessionWithExtras,
    updateSession: updateSessionWithComision,
    deleteSession: deleteSessionWithComision,
    fetch,
    onSelectSession,
  }

  return (
    <div className="app">
      <Sidebar />
      <main className={`main${currentSelected ? ' panel-open' : ''}`}>
        <Routes>
          <Route path="/"             element={<Dashboard    {...shared} />} />
          <Route path="/hoy"          element={<Hoy          {...shared} />} />
          <Route path="/agenda"       element={<Agenda       {...shared} />} />
          <Route path="/sesiones"     element={<Sesiones     {...shared} />} />
          <Route path="/clientes"     element={<Clientes sessions={sessions} loading={loading} onSelectSession={onSelectSession} />} />
          <Route path="/gastos"       element={
            <Gastos
              gastos={gastos} loading={gastosLoading} tableError={tableError}
              comisionSchemaReady={comisionSchemaReady}
              createGasto={createGasto} updateGasto={updateGasto} deleteGasto={deleteGasto}
            />
          } />
          <Route path="/estadisticas" element={
            <Estadisticas sessions={sessions} gastos={gastos} pagos={pagos} extras={extras} extrasTableError={extrasTableError} />
          } />
          <Route path="/config"       element={<Config comisionSchemaReady={comisionSchemaReady} />} />
        </Routes>
      </main>
      {currentSelected && (
        <SessionDetails
          session={currentSelected}
          onClose={() => setSelectedId(null)}
          updateSession={updateSessionWithComision}
          deleteSession={deleteSessionWithComision}
          sessionPagos={pagos.filter(p => p.session_id === currentSelected?.id)}
          createPago={createPagoWithComision}
          updatePago={updatePagoWithComision}
          deletePago={deletePagoWithComision}
          sessionExtras={extras.filter(e => e.session_id === currentSelected?.id)}
          createExtra={createExtra}
          updateExtra={updateExtra}
          deleteExtra={deleteExtra}
          sessions={sessions}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <ConfigProvider>
        <AppInner />
      </ConfigProvider>
    </ToastProvider>
  )
}
