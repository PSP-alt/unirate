/* ═══════════════════════════════════════════════════
   Компонент Avatar — аватар пользователя (Apple Style)
   ═══════════════════════════════════════════════════ */

import { cn } from '../../utils/cn'

const sizes = {
  sm: 'w-9 h-9 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-20 h-20 text-xl',
  xl: 'w-[120px] h-[120px] text-3xl',
}

function getInitials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function Avatar({
  src,
  name = '',
  size = 'md',
  className,
}) {
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center',
        'font-body font-semibold',
        'overflow-hidden flex-shrink-0',
        !src && 'bg-surface-high text-on-surface-variant',
        sizes[size],
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  )
}
