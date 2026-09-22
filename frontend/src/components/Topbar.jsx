import { LogOut } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

const links = [
  { to: '/dashboard', label: 'Огляд' },
  { to: '/transactions', label: 'Транзакції' },
  { to: '/budget', label: 'Бюджет' },
  { to: '/categories', label: 'Категорії' },
]

export default function Topbar({ user, onLogout, onSectionNavigate, showDashboardSections = false }) {
  const location = useLocation()
  const navigate = useNavigate()

  function handleLogout() {
    localStorage.removeItem('fintrack_access_token')
    localStorage.removeItem('fintrack_refresh_token')
    localStorage.removeItem('fintrack_user')
    onLogout?.()
    navigate('/login', { replace: true })
  }

  return <header className="topbar">
    <Link className="brand-lockup" to="/dashboard"><span className="brand-dot" /> FinTrack</Link>
    <nav>{links.map((link) => <Link className={location.pathname === link.to ? 'nav-active' : ''} key={link.to} to={link.to}>{link.label}</Link>)}{showDashboardSections && <><a href="#spending" onClick={(event) => { event.preventDefault(); onSectionNavigate?.('spending') }}>Витрати</a><a href="#limits" onClick={(event) => { event.preventDefault(); onSectionNavigate?.('limits') }}>Ліміти</a></>}</nav>
    <div className="user-menu"><span className="avatar">{user?.full_name?.charAt(0) || 'U'}</span><span className="user-name">{user?.full_name || user?.email || 'Користувач'}</span><button className="icon-button" title="Вийти" onClick={handleLogout}><LogOut size={17} /></button></div>
  </header>
}
