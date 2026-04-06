import { NavLink } from 'react-router-dom'

const IconDash = () => (
  <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/>
    <rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
  </svg>
)
const IconCal = () => (
  <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1" y="2" width="14" height="13" rx="1.5"/><path d="M5 1v2M11 1v2M1 6h14"/>
  </svg>
)
const IconList = () => (
  <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 4h12M2 8h12M2 12h8"/>
  </svg>
)
const IconCog = () => (
  <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="2.5"/>
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41"/>
  </svg>
)

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-name">HAUS</div>
        <div className="logo-sub">Studio System</div>
      </div>
      <nav className="nav">
        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <IconDash /><span>Dashboard</span>
        </NavLink>
        <NavLink to="/agenda" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <IconCal /><span>Agenda</span>
        </NavLink>
        <NavLink to="/sesiones" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <IconList /><span>Sesiones</span>
        </NavLink>
        <NavLink to="/config" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <IconCog /><span>Configuración</span>
        </NavLink>
      </nav>
      <div className="sidebar-bottom">
        <div style={{ fontSize: 11, color: 'var(--text3)', padding: '4px 12px' }}>HAUS Studio v1.0</div>
      </div>
    </aside>
  )
}
