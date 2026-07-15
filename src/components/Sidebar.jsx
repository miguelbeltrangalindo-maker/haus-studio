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
const IconReceipt = () => (
  <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 2h10v13l-2-1.5-2 1.5-2-1.5L5 15 3 13.5V2z"/>
    <path d="M6 6h4M6 9h4M6 12h2"/>
  </svg>
)
const IconChart = () => (
  <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 12V7M6 12V4M10 12V9M14 12V6"/>
    <path d="M1 12.5h14"/>
  </svg>
)
const IconCog = () => (
  <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="2.5"/>
    <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/>
  </svg>
)
const IconPeople = () => (
  <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="6" cy="4.5" r="2.5"/>
    <path d="M1 13c0-2.76 2.24-5 5-5s5 2.24 5 5"/>
    <circle cx="12" cy="5" r="2"/>
    <path d="M14.5 13c0-2.21-1.12-4-2.5-4"/>
  </svg>
)

const IconSearch = () => (
  <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="7" cy="7" r="4.5"/>
    <path d="M10.5 10.5L14 14"/>
  </svg>
)

const navLink = ({ isActive }) => `nav-item ${isActive ? 'active' : ''}`

export default function Sidebar({ onSearch }) {
  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-name">HAUS</div>
        <div className="logo-sub">Studio System</div>
      </div>

      <nav className="nav">
        <button type="button" className="nav-item nav-search" onClick={onSearch}>
          <IconSearch /><span>Buscar</span>
          <kbd className="nav-search-kbd">⌘K</kbd>
        </button>
        <NavLink to="/" end className={navLink}>
          <IconGrid /><span>Dashboard</span>
        </NavLink>
        <NavLink to="/hoy" className={({ isActive }) => `nav-item nav-item-hoy ${isActive ? 'active' : ''}`}>
          <IconToday /><span>Hoy</span>
        </NavLink>
        <NavLink to="/agenda" className={navLink}>
          <IconCal /><span>Agenda</span>
        </NavLink>
        <NavLink to="/sesiones" className={navLink}>
          <IconList /><span>Sesiones</span>
        </NavLink>
        <NavLink to="/clientes" className={navLink}>
          <IconPeople /><span>Clientes</span>
        </NavLink>
        <NavLink to="/gastos" className={({ isActive }) => `nav-item nav-item-gastos ${isActive ? 'active' : ''}`}>
          <IconReceipt /><span>Gastos</span>
        </NavLink>
        <NavLink to="/estadisticas" className={({ isActive }) => `nav-item nav-item-stats ${isActive ? 'active' : ''}`}>
          <IconChart /><span>Estadísticas</span>
        </NavLink>
        <NavLink to="/config" className={navLink}>
          <IconCog /><span>Configuración</span>
        </NavLink>
      </nav>

      <div className="sidebar-bottom">
        <div style={{ fontSize: 11, color: 'var(--text3)', padding: '2px 14px' }}>HAUS Studio v1.3</div>
      </div>
    </aside>
  )
}
