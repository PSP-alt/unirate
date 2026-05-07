/* ═══════════════════════════════════════════════════
   Компонент Skeleton — заглушка при загрузке данных

   Вместо скучного спиннера показываем «скелет» —
   серые пульсирующие блоки на месте будущего контента.
   Это создаёт ощущение, что страница загружается быстро.

   Пример:
     <Skeleton className="h-6 w-48" />      — строка текста
     <Skeleton className="h-40 w-full" />   — карточка
     <Skeleton circle className="w-12 h-12" /> — аватар
   ═══════════════════════════════════════════════════ */

import { cn } from '../../utils/cn'

export default function Skeleton({
  className,
  circle = false,
}) {
  return (
    <div
      className={cn(
        'animate-pulse bg-gray-200',
        circle ? 'rounded-full' : 'rounded-lg',
        className,
      )}
    />
  )
}
