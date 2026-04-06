import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Hoy from './pages/Hoy'
import Agenda from './pages/Agenda'
import Sesiones from './pages/Sesiones'
import Config from './pages/Config'
import { ToastProvider } from './hooks/useToast'
import { ConfigProvider } from './hooks/useConfig'
import { useSessions } from './hooks/useSessions'

function AppInner() {
  const { sessions, loading, createSession, updateSession, deleteSession, fetch } = useSessions()
  const shared = { sessions, loading, createSession, updateSession, deleteSession, fetch }

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/"        element={<Dashboard {...shared} />} />
          <Route path="/hoy"     element={<Hoy       {...shared} />} />
          <Route path="/agenda"  element={<Agenda    {...shared} />} />
          <Route path="/sesiones" element={<Sesiones {...shared} />} />
          <Route path="/config"  element={<Config />} />
        </Routes>
      </main>
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
