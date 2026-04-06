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
    <>
      {/* Shown only in landscape on mobile — blocks the app */}
      <div className="rotate-overlay">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .4 }}>
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M12 18h.01" />
        </svg>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, color: 'var(--text2)', textAlign: 'center', lineHeight: 1.6 }}>
          Rota tu dispositivo<br />
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>HAUS funciona en modo vertical</span>
        </div>
      </div>

      <div className="app">
        <Sidebar />
        <main className="main">
          <Routes>
            <Route path="/"         element={<Dashboard {...shared} />} />
            <Route path="/hoy"      element={<Hoy       {...shared} />} />
            <Route path="/agenda"   element={<Agenda    {...shared} />} />
            <Route path="/sesiones" element={<Sesiones  {...shared} />} />
            <Route path="/config"   element={<Config />} />
          </Routes>
        </main>
      </div>
    </>
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
