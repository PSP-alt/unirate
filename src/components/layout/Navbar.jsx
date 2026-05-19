import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { logoutUser } from '../../services/auth'
import { ChevronDown, LogOut, User, Menu, X, ArrowRight } from 'lucide-react'

/* ════════════════════════════════════════════════════════════
   UNIRATE NAVBAR
   На лендинге ('/') — прозрачный на тёмном фоне hero.
   На остальных страницах — на кремовом фоне с тонкой границей.
════════════════════════════════════════════════════════════ */

export default function Navbar() {
  const { user, userData } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const menuRef = useRef(null)

  /* Лендинг — тёмная шапка, остальные — кремовая */
  const isLanding = location.pathname === '/'

  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 10) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  async function handleLogout() {
    await logoutUser()
    setMenuOpen(false)
    navigate('/')
  }

  const isAdmin = userData?.role === 'admin'

  /* Единый набор ссылок для всех страниц */
  const links = user
    ? [
        { to: '/teachers',  label: 'Преподаватели' },
        { to: '/materials', label: 'Материалы' },
        ...(isAdmin ? [{ to: '/admin', label: 'Админ' }] : []),
      ]
    : [
        { to: '/',          label: 'Главная' },
        { to: '/teachers',  label: 'Преподаватели' },
        { to: '/materials', label: 'Материалы' },
      ]

  const avatarLetter = userData?.firstName?.[0] || user?.email?.[0]?.toUpperCase()

  /* ── Стилистика в зависимости от темы шапки ── */
  const theme = isLanding ? {
    wrap:      `fixed top-0 w-full z-50 transition-colors duration-300 ${scrolled ? 'bg-[#1A1613]/90 backdrop-blur-xl' : 'bg-transparent'}`,
    mobileBg:  'bg-[#1A1613]/90 backdrop-blur-xl',
    text:      'text-[#E6D9C9]',
    textMuted: 'text-[#B8A999]',
    textHover: 'hover:text-[#F4EBDB]',
    pillBorder:'border-[#3A322A]',
    pillBg:    'bg-[#24201C]',
    divider:   'bg-[#3A322A]',
    menuBg:    'bg-[#24201C] border-[#3A322A]',
    menuHover: 'hover:bg-[#2E2824]',
  } : {
    wrap:      `sticky top-0 w-full z-50 bg-[var(--color-cream)]/95 backdrop-blur-xl transition-[border-color,box-shadow] duration-300 ${
                  scrolled ? 'border-b border-[var(--color-sepia)]' : 'border-b border-transparent'
                }`,
    text:      'text-[var(--color-ink)]',
    textMuted: 'text-[var(--color-muted)]',
    textHover: 'hover:text-[var(--color-ink)]',
    pillBorder:'border-[var(--color-sepia)]',
    pillBg:    'bg-[var(--color-paper)]',
    mobileBg:  'bg-[var(--color-cream)]/95 backdrop-blur-xl',
    divider:   'bg-[var(--color-sepia)]',
    menuBg:    'bg-[var(--color-paper)] border-[var(--color-sepia)]',
    menuHover: 'hover:bg-[var(--color-paper-2)]',
  }

  return (
    <header className={theme.wrap}>
      <nav className="flex justify-between items-center h-20 px-6 md:px-12 max-w-7xl mx-auto w-full">

        {/* ── Лого + пилюля ── */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <Link to="/" className="font-display italic text-[28px] leading-none tracking-[-0.01em] flex items-baseline">
            <span className={theme.text}>Uni</span>
            <span className="text-[var(--color-rust)]">rate</span>
          </Link>
        </div>

        {/* ── Центр: ссылки ── */}
        <div className="hidden lg:flex items-center gap-1">
          {links.map(({ to, label }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={[
                  "px-4 py-2 rounded-full text-[13px] font-medium transition-colors",
                  active
                    ? isLanding
                      ? 'text-[var(--color-rust)]'
                      : 'text-[var(--color-rust)] bg-[var(--color-rust-wash)]'
                    : `${theme.textMuted} ${theme.textHover}`
                ].join(' ')}
              >
                {label}
              </Link>
            )
          })}
        </div>

        {/* ── Правая часть ── */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className={`flex items-center gap-2.5 pl-3 pr-4 py-1.5 rounded-full border ${theme.pillBorder} ${theme.pillBg} ${theme.menuHover} transition-colors`}
              >
                <div className="w-7 h-7 rounded-full bg-[var(--color-rust)] flex items-center justify-center text-[#FFFDF7] font-display text-xs">
                  {avatarLetter}
                </div>
                <span className={`hidden md:block text-[13px] font-medium ${theme.text}`}>
                  {userData?.firstName || 'Профиль'}
                </span>
                <ChevronDown
                  size={14}
                  className={`${theme.textMuted} transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <div className={`absolute right-0 top-full mt-2 w-60 rounded-2xl border ${theme.menuBg} py-1.5 z-50 animate-slide-down origin-top-right shadow-lg`}>
                  <div className={`px-4 py-3 border-b ${theme.divider}/40`}>
                    <p className={`text-sm font-semibold ${theme.text} truncate`}>
                      {userData?.firstName} {userData?.lastName}
                    </p>
                    <p className={`text-xs ${theme.textMuted} truncate mt-0.5`}>{user.email}</p>
                  </div>
                  <Link
                    to={userData?.role === 'teacher' ? `/teachers/${user.uid}` : '/profile'}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm ${theme.text} ${theme.menuHover} transition-colors`}
                  >
                    <User size={16} className={theme.textMuted} />
                    Мой профиль
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[var(--color-rust)] hover:bg-[var(--color-rust-wash)]/40 transition-colors"
                  >
                    <LogOut size={16} />
                    Выйти
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Link
                to="/login"
                className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--color-rust)] text-[#FFFDF7] text-[13px] font-semibold hover:bg-[#C55830] transition-colors"
              >
                Войти
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          )}

          {/* Мобильный бургер */}
          <button
            className={`lg:hidden p-2 rounded-full ${theme.menuHover} ${theme.text} transition-colors`}
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Меню"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Мобильное меню */}
      {mobileOpen && (
        <div className={`lg:hidden ${theme.mobileBg} border-t ${theme.divider}/40 px-6 py-4 space-y-1 animate-slide-down`}>
          {links.map(({ to, label }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={[
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                  active
                    ? 'bg-[var(--color-rust-wash)] text-[var(--color-rust)]'
                    : `${theme.text} ${theme.menuHover}`
                ].join(' ')}
              >
                {label}
              </Link>
            )
          })}

          {user && (
            <div className={`pt-3 mt-2 border-t ${theme.divider}/40 space-y-1`}>
              <Link
                to={userData?.role === 'teacher' ? `/teachers/${user.uid}` : '/profile'}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${theme.text} ${theme.menuHover}`}
              >
                <User size={16} />
                {userData?.role === 'teacher' ? 'Мой профиль' : 'Личный кабинет'}
              </Link>
              <button
                onClick={() => { logoutUser(); setMobileOpen(false) }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10`}
              >
                <LogOut size={16} />
                Выйти
              </button>
            </div>
          )}

          {!user && (
            <div className={`pt-3 mt-2 border-t ${theme.divider}/40`}>
              <Link to="/login" className="block px-4 py-3 text-sm font-semibold text-center rounded-full bg-[var(--color-rust)] text-[#FFFDF7]">
                Войти
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
