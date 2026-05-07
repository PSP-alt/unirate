/* ═══════════════════════════════════════════════════
   Утилита cn() — объединение CSS-классов

   Зачем: позволяет удобно комбинировать Tailwind-классы
   и условно добавлять/убирать их. tailwind-merge
   умно разрешает конфликты (например, "p-2" + "p-4" = "p-4").

   Использование:
     cn('base-class', isActive && 'active-class', className)
   ═══════════════════════════════════════════════════ */

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
