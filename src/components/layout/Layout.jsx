import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import { useAuth } from '../../context/AuthContext'

/* ── Tokens: сочетается с палитрой Unirate ── */

/* ── Баннер для заблокированных / удалённых аккаунтов ── */
function BanBanner() {
  const { userData } = useAuth()
  // Показываем только для заблокированных/удалённых.
  // Ожидающие одобрения (isActive=false без blockReason и не удалены) — не трогаем.
  if (!userData || userData.isActive !== false) return null
  if (!userData.blockReason && !userData.isDeleted) return null

  const isDeleted = userData.isDeleted

  let until = null
  if (userData.blockedUntil && !isDeleted) {
    const d = userData.blockedUntil.toDate
      ? userData.blockedUntil.toDate()
      : new Date(userData.blockedUntil)
    until = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className={`w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-medium ${
      isDeleted
        ? 'bg-[#1A1613] text-[#E6D9C9]'
        : 'bg-[var(--color-danger)] text-[#FFFDF7]'
    }`}>
      <span className="material-symbols-outlined text-[18px] flex-shrink-0">
        {isDeleted ? 'person_off' : 'block'}
      </span>
      <span>
        {isDeleted
          ? 'Ваш аккаунт удалён администратором'
          : until
            ? `Аккаунт заблокирован до ${until}`
            : 'Ваш аккаунт заблокирован'}
      </span>
      {userData.blockReason && !isDeleted && (
        <>
          <span className="opacity-50">·</span>
          <span className="opacity-80 font-normal">{userData.blockReason}</span>
        </>
      )}
    </div>
  )
}

export default function Layout() {
  const location = useLocation()
  const isLanding = location.pathname === '/'
  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-cream)]">
      <Navbar />
      <BanBanner />
      {/* На лендинге navbar absolute/fixed — контент не нуждается в отступе,
         он сам рисует тёмный hero с pt-32. На остальных — sticky navbar в потоке. */}
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
