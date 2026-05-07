import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { logoutUser } from '../../services/auth'
import { ChevronDown, LogOut, User, Menu, X, BookOpen, GraduationCap, Home } from 'lucide-react'

export default function Navbar() {
  const { user, userData } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  async function handleLogout() {
    await logoutUser()
    setMenuOpen(false)
    navigate('/')
  }

  const links = [
    { to: '/',          label: 'Главная',       icon: Home       },
    { to: '/teachers',  label: 'Преподаватели', icon: GraduationCap },
    { to: '/materials', label: 'Материалы',     icon: BookOpen   },
  ]

  const avatarLetter = userData?.firstName?.[0] || user?.email?.[0]?.toUpperCase()

  return (
    <header className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/40 shadow-sm">
      <nav className="flex justify-between items-center h-16 px-6 md:px-12 max-w-7xl mx-auto w-full">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xl font-bold tracking-tight text-primary font-headline">UniRate</span>
          <span className="hidden sm:block w-1.5 h-1.5 rounded-full bg-secondary" />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(({ to, label }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={[
                  "px-4 py-2 rounded-xl text-sm font-medium tracking-tight transition-all duration-200",
                  active
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                ].join(' ')}
              >
                {label}
              </Link>
            )
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-surface-container-low transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-on-primary font-bold text-xs flex-shrink-0">
                  {avatarLetter}
                </div>
                <span className="hidden md:block text-sm font-medium text-on-surface">
                  {userData?.firstName || 'Профиль'}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-on-surface-variant transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-lg border border-slate-200/60 py-1.5 z-50">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-on-surface font-headline truncate">
                      {userData?.firstName} {userData?.lastName}
                    </p>
                    <p className="text-xs text-on-surface-variant truncate mt-0.5">{user.email}</p>
                  </div>
                  <Link
                    to={userData?.role === 'teacher' ? `/teachers/${user.uid}` : '/profile'}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                  >
                    <User size={16} className="text-on-surface-variant" />
                    Мой профиль
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={16} />
                    Выйти
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-3">
              <Link
                to="/login"
                className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors px-3 py-2"
              >
                Войти
              </Link>
              <Link
                to="/register"
                className="text-sm font-semibold px-4 py-2 bg-secondary text-on-secondary rounded-xl hover:brightness-95 transition-all shadow-lime"
              >
                Регистрация
              </Link>
            </div>
          )}

          {/* Mobile burger */}
          <button
            className="md:hidden p-2 rounded-xl hover:bg-surface-container-low transition-colors text-on-surface"
            onClick={() => setMobileOpen(v => !v)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-slate-200/40 px-6 py-4 space-y-1">
          {links.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={[
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                  active ? "bg-primary text-on-primary" : "text-on-surface hover:bg-surface-container-low"
                ].join(' ')}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}

          {!user && (
            <div className="pt-2 border-t border-slate-100 mt-2 flex flex-col gap-2">
              <Link to="/login" className="px-4 py-3 text-sm font-medium text-on-surface rounded-xl hover:bg-surface-container-low">
                Войти
              </Link>
              <Link to="/register" className="px-4 py-3 text-sm font-semibold bg-secondary text-on-secondary rounded-xl text-center">
                Регистрация
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
