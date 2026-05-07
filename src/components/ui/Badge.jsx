/* ═══════════════════════════════════════════════════
   Компонент Badge — бейдж-метка (Apple Style)
   ═══════════════════════════════════════════════════ */

import { cn } from '../../utils/cn'

const variants = {
  blue: 'bg-primary/5 text-primary',
  gold: 'bg-orange-50 text-orange-600',
  green: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-600',
  gray: 'bg-black/5 text-secondary',
  primary: 'bg-primary/5 text-primary',
}

export default function Badge({
  children,
  variant = 'blue',
  className,
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center',
        'rounded-full',
        'px-2.5 py-1',
        'text-[10px] font-bold uppercase tracking-wider',
        'select-none',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
