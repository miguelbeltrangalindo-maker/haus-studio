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
import SessionDetails from './components/SessionDetails'
import { ToastProvider } from './hooks/useToast'
import { ConfigProvider } from './hooks/useConfig'
import { useSessions } from './hooks/useSessions'
import { useGastos } from './hooks/useGastos'

function AppInner() {
  const { sessions, loading, createSession, updateSession, deleteSession, fetch } = useSessions()
  const { gastos, loading: gastosLoading, tableError, createGasto, deleteGasto } = useGastos()
  const [selectedId, setSelectedId] = useState(null)
  const location = useLocation()

  useEffect(() => { setSelectedId(null) }, [location.pathname])

  const currentSelected = selectedId ? (sessions.find(s => s.id === selectedId) || null) : null

  const onSelectSession = (ses) => {
    if (!ses) { setSelectedId(null); return }
    if (window.matchMedia('(min-width: 769px)').matches) setSelectedId(ses.id)
  }

  const shared = { sessions, loading, createSession, updateSession, deleteSession, fetch, onSelectSession }

  return (
    <div className="app">
      <Sidebar />
      <main className={`main${currentSelected ? ' panel-open' : ''}`}>
        <Routes>
          <Route path="/"              element={<Dashboard    {...shared} />} />
          <Route path="/hoy"           element={<Hoy          {...shared} />} />
          <Route path="/agenda"        element={<Agenda       {...shared} />} />
          <Route path="/sesiones"      element={<Sesiones     {...shared} />} />
          <Route path="/gastos"        element={<Gastos gastos={gastos} loading={gastosLoading} tableError={tableError} createGasto={createGasto} deleteGasto={deleteGasto} />} />
          <Route path="/estadisticas"  element={<Estadisticas sessions={sessions} gastos={gastos} />} />
          <Route path="/config"        element={<Config />} />
        </Routes>
      </main>
      {currentSelected && (
        <SessionDetails
          session={currentSelected}
          onClose={() => setSelectedId(null)}
          updateSession={updateSession}
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
