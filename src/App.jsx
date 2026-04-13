import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
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
import { ToastProvider } from './hooks/useToast'
import { ConfigProvider, useConfig } from './hooks/useConfig'
import { useSessions } from './hooks/useSessions'
import { useGastos } from './hooks/useGastos'
import { usePagos } from './hooks/usePagos'
import { useExtras } from './hooks/useExtras'

function AppInner() {
  const { sessions, loading, createSession, updateSession, deleteSession, fetch } = useSessions()
  const { gastos, loading: gastosLoading, tableError, createGasto, updateGasto, deleteGasto } = useGastos()
  const { pagos, createPago } = usePagos()
  const { extras, createExtra, updateExtra, deleteExtra, tableError: extrasTableError } = useExtras()
  const { config } = useConfig()
  const [selectedId, setSelectedId] = useState(null)
  const location = useLocation()

  useEffect(() => { setSelectedId(null) }, [location.pathname])

  const currentSelected = selectedId ? (sessions.find(s => s.id === selectedId) || null) : null

  const onSelectSession = (ses) => {
    if (!ses) { setSelectedId(null); return }
    if (window.matchMedia('(min-width: 769px)').matches) setSelectedId(ses.id)
  }

  // Auto-add "Persona Adicional" extras when personas > 4
  const createSessionWithExtras = async (form) => {
    const result = await createSession(form)
    if (result.error) return result
    const extra = (+form.personas || 0) - 4
    if (extra > 0) {
      const conceptos = config.extra_conceptos || []
      const concepto = conceptos.find(c =>
        c.nombre.toLowerCase().replace(/\s+/g, ' ').trim() === 'persona adicional'
      ) || conceptos.find(c =>
        c.nombre.toLowerCase().includes('persona adicional')
      )
      if (concepto) {
        const monto = extra * (+concepto.precio_unitario || 0)
        await createExtra(result.data.id, concepto.nombre, monto, extra, +concepto.precio_unitario || 0)
      }
    }
    // Send booking confirmation via WA if configured
    if (config.wa_on_booking && result.data?.id) {
      fetch('/api/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: result.data.id }),
      }).catch(() => {}) // fire-and-forget, don't block the UI
    }
    return result
  }

  const shared = { sessions, loading, createSession: createSessionWithExtras, updateSession, deleteSession, fetch, onSelectSession }

  return (
    <div className="app">
      <Sidebar />
      <main className={`main${currentSelected ? ' panel-open' : ''}`}>
        <Routes>
          <Route path="/"              element={<Dashboard    {...shared} />} />
          <Route path="/hoy"           element={<Hoy          {...shared} />} />
          <Route path="/agenda"        element={<Agenda       {...shared} />} />
          <Route path="/sesiones"      element={<Sesiones     {...shared} />} />
          <Route path="/clientes"      element={<Clientes sessions={sessions} loading={loading} onSelectSession={onSelectSession} />} />
          <Route path="/gastos"        element={<Gastos gastos={gastos} loading={gastosLoading} tableError={tableError} createGasto={createGasto} updateGasto={updateGasto} deleteGasto={deleteGasto} />} />
          <Route path="/estadisticas"  element={<Estadisticas sessions={sessions} gastos={gastos} pagos={pagos} extras={extras} extrasTableError={extrasTableError} />} />
          <Route path="/config"        element={<Config />} />
        </Routes>
      </main>
      {currentSelected && (
        <SessionDetails
          session={currentSelected}
          onClose={() => setSelectedId(null)}
          updateSession={updateSession}
          deleteSession={deleteSession}
          sessionPagos={pagos.filter(p => p.session_id === currentSelected?.id)}
          createPago={createPago}
          sessionExtras={extras.filter(e => e.session_id === currentSelected?.id)}
          createExtra={createExtra}
          updateExtra={updateExtra}
          deleteExtra={deleteExtra}
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
