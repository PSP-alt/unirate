import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="w-full mt-auto bg-[#1A1613] text-[#E6D9C9]">

      {/* ── Верхняя декоративная линия ── */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 pt-16 pb-10">
        <div className="flex items-center gap-4 opacity-40 mb-14">
          <div className="h-px flex-1 bg-[#3A322A]" />
          <span className="font-display italic text-[#B8A999] text-sm">∼</span>
          <div className="h-px flex-1 bg-[#3A322A]" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-8 md:gap-10">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="font-display italic text-[32px] leading-none flex items-baseline">
              <span className="text-[#F4EBDB]">Uni</span>
              <span className="text-[var(--color-rust)]">rate</span>
            </Link>
            <p className="mt-5 text-[13px] leading-relaxed text-[#B8A999] max-w-xs">
              Платформа честных отзывов о преподавании.
              Пять критериев, ручная модерация, диалог вместо войны рейтингов.
            </p>
            <p className="mt-6 text-[11px] tracking-[0.18em] uppercase text-[#8B827A]">
              Сделано с <span className="text-[var(--color-rust)]">любовью</span> в СПбГУПТД
            </p>
          </div>

          {/* Nav: platform */}
          <div>
            <p className="label-muted mb-5">Платформа</p>
            <ul className="space-y-3">
              {[
                { to: '/teachers',  label: 'Преподаватели' },
                { to: '/materials', label: 'Материалы'     },
                { to: '/about',     label: 'Как это работает' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-[14px] text-[#E6D9C9] hover:text-[var(--color-rust)] transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Nav: company */}
          <div>
            <p className="label-muted mb-5">О нас</p>
            <ul className="space-y-3">
              {[
                { to: '/about',   label: 'Команда' },
                { to: '/privacy', label: 'Конфиденциальность' },
                { to: '/terms',   label: 'Условия' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-[14px] text-[#E6D9C9] hover:text-[var(--color-rust)] transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacts */}
          <div>
            <p className="label-muted mb-5">Связь</p>
            <ul className="space-y-3">
              <li>
                <Link to="/support" className="text-[14px] text-[#E6D9C9] hover:text-[var(--color-rust)] transition-colors">
                  Поддержка
                </Link>
              </li>
              <li>
                <a href="mailto:support@unirate.ru" className="text-[14px] text-[#E6D9C9] hover:text-[var(--color-rust)] transition-colors">
                  support@unirate.ru
                </a>
              </li>
              <li>
                <a href="https://t.me/unirate_spb" target="_blank" rel="noreferrer" className="text-[14px] text-[#E6D9C9] hover:text-[var(--color-rust)] transition-colors">
                  @unirate_spb
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Нижняя панель ── */}
      <div className="border-t border-[#3A322A]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-[11px] tracking-[0.15em] uppercase text-[#8B827A]">
            © {new Date().getFullYear()} Unirate · Все отзывы принадлежат их авторам
          </p>
          <p className="text-[11px] tracking-[0.15em] uppercase text-[#8B827A]">
            v 1.0
          </p>
        </div>
      </div>
    </footer>
  )
}
