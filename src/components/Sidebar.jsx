import { NavLink } from 'react-router-dom'

const IconGrid = () => (
  <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1" y="1" width="6" height="6" rx="1.5"/>
    <rect x="9" y="1" width="6" height="6" rx="1.5"/>
    <rect x="1" y="9" width="6" height="6" rx="1.5"/>
    <rect x="9" y="9" width="6" height="6" rx="1.5"/>
  </svg>
)

const IconToday = () => (
  <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="6.5"/>
    <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/>
  </svg>
)

const IconCal = () => (
  <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1.5" y="2.5" width="13" height="12" rx="1.5"/>
    <path d="M5 1.5v2M11 1.5v2M1.5 6.5h13"/>
  </svg>
)

const IconList = () => (
  <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 4h12M2 8h12M2 12h7"/>
  </svg>
)

const IconCog = () => (
  <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="2.5"/>
    <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/>
  </svg>
)

const navLink = ({ isActive }) => `nav-item ${isActive ? 'active' : ''}`

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-name">HAUS</div>
        <div className="logo-sub">Studio System</div>
      </div>

      <nav className="nav">
        <NavLink to="/" end className={navLink}>
          <IconGrid /><span>Dashboard</span>
        </NavLink>
        <NavLink to="/hoy" className={navLink}>
          <IconToday /><span>Hoy</span>
        </NavLink>
        <NavLink to="/agenda" className={navLink}>
          <IconCal /><span>Agenda</span>
        </NavLink>
        <NavLink to="/sesiones" className={navLink}>
          <IconList /><span>Sesiones</span>
        </NavLink>
        <NavLink to="/config" className={navLink}>
          <IconCog /><span>Configuración</span>
        </NavLink>
      </nav>

      <div className="sidebar-bottom">
        <div style={{ fontSize: 11, color: 'var(--text3)', padding: '2px 14px' }}>HAUS Studio v1.1</div>
      </div>
    </aside>
  )
}
