/* ═══════════════════════════════════════════════════
   Компонент Card — Apple Style
   ═══════════════════════════════════════════════════ */

import { cn } from '../../utils/cn'

export default function Card({
  children,
  hoverable = false,
  className,
  ...props
}) {
  return (
    <div
      className={cn(
        'bg-surface-container-lowest',
        'border border-border',
        'rounded-xl',
        'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
        hoverable && [
          'hover:shadow-apple-hover',
          'hover:-translate-y-0.5',
          'cursor-pointer',
        ],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
