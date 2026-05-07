/* ═══════════════════════════════════════════════════
   SVG-иллюстрация для hero-секции главной страницы

   Декоративная стопка книг с золотыми акцентами
   в академическом стиле.
   ═══════════════════════════════════════════════════ */

export default function HeroIllustration({ className }) {
  return (
    <svg
      viewBox="0 0 400 350"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Тень под книгами */}
      <ellipse cx="200" cy="310" rx="140" ry="15" fill="#1A3A5C" opacity="0.06" />

      {/* Нижняя книга — синяя */}
      <rect x="80" y="230" width="240" height="35" rx="4" fill="#1A3A5C" />
      <rect x="85" y="233" width="4" height="29" rx="2" fill="#C5A028" />
      <text x="110" y="253" fontFamily="Georgia" fontSize="12" fill="white" opacity="0.7">
        Учебные материалы
      </text>

      {/* Средняя книга — светлая */}
      <rect x="95" y="190" width="220" height="35" rx="4" fill="#EBF2FA" stroke="#1A3A5C" strokeWidth="1" />
      <rect x="100" y="193" width="4" height="29" rx="2" fill="#C5A028" />
      <text x="125" y="213" fontFamily="Georgia" fontSize="12" fill="#1A3A5C" opacity="0.7">
        Методические пособия
      </text>

      {/* Верхняя книга — тёмная */}
      <rect x="110" y="150" width="200" height="35" rx="4" fill="#142d47" />
      <rect x="115" y="153" width="4" height="29" rx="2" fill="#C5A028" />
      <text x="140" y="173" fontFamily="Georgia" fontSize="12" fill="white" opacity="0.7">
        Научные работы
      </text>

      {/* Золотая медаль / звезда — символ рейтинга */}
      <circle cx="300" cy="130" r="35" fill="#FFF8E1" stroke="#C5A028" strokeWidth="2" />
      <polygon
        points="300,102 306,118 323,118 310,128 315,145 300,135 285,145 290,128 277,118 294,118"
        fill="#C5A028"
      />

      {/* Декоративная шапочка выпускника */}
      <polygon points="160,80 200,60 240,80 200,95" fill="#1A3A5C" />
      <rect x="195" y="60" width="10" height="4" fill="#1A3A5C" />
      <line x1="200" y1="60" x2="200" y2="45" stroke="#C5A028" strokeWidth="2" />
      <circle cx="200" cy="43" r="4" fill="#C5A028" />
      <rect x="185" y="92" width="30" height="8" rx="2" fill="#1A3A5C" />

      {/* Маленькие декоративные точки */}
      <circle cx="70" cy="170" r="3" fill="#C5A028" opacity="0.3" />
      <circle cx="340" cy="200" r="3" fill="#C5A028" opacity="0.3" />
      <circle cx="350" cy="170" r="2" fill="#1A3A5C" opacity="0.2" />
      <circle cx="60" cy="250" r="2" fill="#1A3A5C" opacity="0.2" />
    </svg>
  )
}
