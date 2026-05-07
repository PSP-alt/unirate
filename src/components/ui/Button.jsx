/* ═══════════════════════════════════════════════════
   Компонент Button — кнопка (Apple Style)
   ═══════════════════════════════════════════════════ */

import { cn } from '../../utils/cn'

const variants = {
  primary:
    'bg-primary text-on-primary hover:shadow-lg hover:shadow-primary/20 active:scale-95',
  secondary:
    'bg-surface-high text-on-surface hover:bg-surface-highest active:scale-95',
  danger:
    'bg-error text-white hover:opacity-90 active:scale-95',
  ghost:
    'bg-transparent text-primary hover:bg-primary/5',
}

const sizes = {
  sm: 'px-5 py-2 text-sm',
  md: 'px-6 py-2.5 text-sm',
  lg: 'px-8 py-3.5 text-base',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className,
  ...props
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2',
        'font-body font-semibold',
        'rounded-xl',
        'transition-all duration-200',
        'cursor-pointer select-none',
        variants[variant],
        sizes[size],
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
