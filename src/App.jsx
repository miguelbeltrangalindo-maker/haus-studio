import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Agenda from './pages/Agenda'
import Sesiones from './pages/Sesiones'
import Config from './pages/Config'
import { ToastProvider } from './hooks/useToast'
import { ConfigProvider } from './hooks/useConfig'
import { useSessions } from './hooks/useSessions'

function AppInner() {
  const { sessions, loading, createSession, updateSession, deleteSession, fetch } = useSessions()

  const sharedProps = { sessions, loading, createSession, updateSession, deleteSession, fetch }

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard {...sharedProps} />} />
          <Route path="/agenda" element={<Agenda {...sharedProps} />} />
          <Route path="/sesiones" element={<Sesiones {...sharedProps} />} />
          <Route path="/config" element={<Config />} />
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
