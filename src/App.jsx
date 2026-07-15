import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { format } from 'date-fns'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Hoy from './pages/Hoy'
import Agenda from './pages/Agenda'
import Sesiones from './pages/Sesiones'
import Gastos from './pages/Gastos'
import Config from './pages/Config'
import Clientes from './pages/Clientes'
import SessionDetails from './components/SessionDetails'
import GlobalSearch from './components/GlobalSearch'
import { ToastProvider, useToast } from './hooks/useToast'
import { ConfigProvider, useConfig } from './hooks/useConfig'
import { ConfirmProvider } from './components/ConfirmDialog'
import { useSessions } from './hooks/useSessions'
import { useGastos } from './hooks/useGastos'
import { usePagos } from './hooks/usePagos'
import { useExtras } from './hooks/useExtras'

// Estadísticas carga recharts (~400 KB) — solo se descarga al entrar a la ruta
const Estadisticas = lazy(() => import('./pages/Estadisticas'))

// ── helpers ──────────────────────────────────────────────────────────────────
const todayFecha = () => format(new Date(), 'yyyy-MM-dd')

function AppInner() {
  const { sessions, loading, loadError, createSession, updateSession, deleteSession, fetch } = useSessions()
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
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()

  useEffect(() => { setSelectedId(null) }, [location.pathname])

  // Búsqueda global: ⌘K / Ctrl+K, o "/" fuera de un campo de texto
  useEffect(() => {
    const onKey = (e) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(v => !v)
      } else if (e.key === '/' && !typing) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const currentSelected = selectedId ? (sessions.find(s => s.id === selectedId) || null) : null

  const onSelectSession = (ses) => {
    if (!ses) { setSelectedId(null); return }
    setSelectedId(ses.id)
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
      const cr = await createComisionGasto(
        `anticipo:${session.id}`,
        comisionMonto(form.anticipo),
        comisionConcepto(form.nombre),
        form.fecha || todayFecha(),
      )
      if (cr?.error) toast('La comisión bancaria no se registró — agrégala manualmente en Gastos', 'error')
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
        if (waData.sent)              toast('WhatsApp enviado al cliente', 'success')
        else if (waData.skipped === 'already sent') toast('WhatsApp ya se había enviado', 'info')
        else if (waData.skipped)      toast(`WhatsApp omitido: ${waData.skipped}`, 'info')
        else if (waData.code)         toast(`Error de WhatsApp (${waData.code})`, 'error')
        else if (!session.telefono)   toast('Sin teléfono — WhatsApp no enviado', 'info')
      } catch { toast('WhatsApp: sin conexión', 'error') }
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

  // deleteSession wrapper: limpia todos los registros financieros vinculados
  const deleteSessionWithComision = async (id) => {
    // 1. Eliminar comisiones y registros de cada cobro de saldo
    const sessionPagosToDelete = pagos.filter(p => p.session_id === id)
    for (const pago of sessionPagosToDelete) {
      await deleteComisionByRef(`pago:${pago.id}`)
      await deletePago(pago.id)
    }

    // 2. Eliminar comisión del anticipo (maybeSingle — no falla si no existe)
    await deleteComisionByRef(`anticipo:${id}`)

    // 3. Eliminar cargos adicionales (extras)
    const sessionExtrasToDelete = extras.filter(e => e.session_id === id)
    for (const extra of sessionExtrasToDelete) {
      await deleteExtra(extra.id)
    }

    // 4. Eliminar la sesión
    const result = await deleteSession(id)
    return result
  }

  // createPago wrapper: auto-comisión cuando el método es tarjeta
  const createPagoWithComision = async (session_id, monto, metodo, nota = '') => {
    const result = await createPago(session_id, monto, metodo, nota)
    if (result.error) return result

    if (comisionPct > 0 && metodo === 'tarjeta' && +monto > 0) {
      const session = sessions.find(s => s.id === session_id)
      const cr = await createComisionGasto(
        `pago:${result.data.id}`,
        comisionMonto(monto),
        comisionConcepto(session?.nombre),
        todayFecha(),
      )
      if (cr?.error) toast('La comisión bancaria no se registró — agrégala manualmente en Gastos', 'error')
    }

    return result
  }

  // updatePago wrapper: recalcula sesión y sincroniza comisión
  const updatePagoWithComision = async (pagoId, updates, oldPago) => {
    const newMonto  = updates.monto  != null ? +updates.monto : +oldPago.monto
    const newMetodo = updates.metodo != null ?  updates.metodo :  oldPago.metodo
    const oldMonto  = +oldPago.monto  || 0
    const oldMetodo = oldPago.metodo

    const sess  = sessions.find(s => s.id === oldPago.session_id)
    const delta = newMonto - oldMonto

    // El aumento no puede superar el saldo pendiente de la sesión
    if (sess && delta > (+sess.restante || 0)) {
      const maxMonto = oldMonto + (+sess.restante || 0)
      return { error: `El monto no puede superar $${maxMonto.toLocaleString()} (pago original + saldo pendiente)` }
    }

    const { error } = await updatePago(pagoId, updates)
    if (error) return { error }

    // Recalcular campos de la sesión
    if (sess) {
      const sessionUpdates = {
        pagos:    String(Math.max(0, (+sess.pagos    || 0) + delta)),
        restante: String(Math.max(0, (+sess.restante || 0) - delta)),
      }
      // metodo_pago refleja el último cobro real — solo se toca si este pago es el más reciente
      const sessPagos = pagos.filter(p => p.session_id === oldPago.session_id)
      const latest = sessPagos[sessPagos.length - 1]
      if (!latest || latest.id === pagoId) sessionUpdates.metodo_pago = newMetodo
      await updateSession(oldPago.session_id, sessionUpdates)
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
    createPago: createPagoWithComision,
    deletePago: deletePagoWithComision,
    fetch,
    onSelectSession,
  }

  return (
    <div className="app">
      <Sidebar onSearch={() => setSearchOpen(true)} />
      <main className={`main${currentSelected ? ' panel-open' : ''}`}>
        {loadError && (
          <div className="app-error-banner" role="alert">
            <span>No se pudieron cargar las sesiones — revisa tu conexión.</span>
            <button className="btn btn-sm" onClick={fetch}>Reintentar</button>
          </div>
        )}
        <div className="route-in" key={location.pathname}>
        <Routes>
          <Route path="/"             element={<Dashboard    {...shared} />} />
          <Route path="/hoy"          element={<Hoy          {...shared} pagos={pagos} gastos={gastos} />} />
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
            <Suspense fallback={<div className="page-content" style={{ padding: 24, color: 'var(--text3)', fontSize: 13 }}>Cargando estadísticas…</div>}>
              <Estadisticas sessions={sessions} gastos={gastos} pagos={pagos} extras={extras} extrasTableError={extrasTableError} />
            </Suspense>
          } />
          <Route path="/config"       element={<Config comisionSchemaReady={comisionSchemaReady} />} />
        </Routes>
        </div>
      </main>
      {searchOpen && (
        <GlobalSearch
          sessions={sessions}
          onSelect={onSelectSession}
          onClose={() => setSearchOpen(false)}
        />
      )}
      {currentSelected && (
        <>
          <div className="details-backdrop" onClick={() => setSelectedId(null)} />
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
        </>
      )}
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <ConfigProvider>
          <AppInner />
        </ConfigProvider>
      </ConfirmProvider>
    </ToastProvider>
  )
}
