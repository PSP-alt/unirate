/* ═══════════════════════════════════════════════════
   Компонент PasswordStrength — индикатор надёжности пароля

   Показывает цветную полоску и текст:
   слабый / средний / надёжный / отличный
   ═══════════════════════════════════════════════════ */

import { cn } from '../../utils/cn'

/* Определяем надёжность пароля по простым правилам */
function getStrength(password) {
  if (!password) return 0
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 10) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return Math.min(score, 4)
}

const levels = [
  { label: '', color: 'bg-gray-200', width: '0%' },
  { label: 'Слабый', color: 'bg-error', width: '25%' },
  { label: 'Средний', color: 'bg-warning', width: '50%' },
  { label: 'Надёжный', color: 'bg-accent-gold', width: '75%' },
  { label: 'Отличный', color: 'bg-success', width: '100%' },
]

export default function PasswordStrength({ password = '' }) {
  const strength = getStrength(password)
  const level = levels[strength]

  if (!password) return null

  return (
    <div className="mt-2">
      {/* Полоска прогресса */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', level.color)}
          style={{ width: level.width }}
        />
      </div>
      {/* Подпись */}
      <p className={cn('text-xs mt-1', strength <= 1 ? 'text-error' : strength === 2 ? 'text-warning' : 'text-success')}>
        {level.label}
      </p>
    </div>
  )
}
