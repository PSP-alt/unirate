/* ═══════════════════════════════════════════════════
   Компонент RatingBar — прогресс-бар оценки (Apple Style)
   ═══════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { cn } from '../../utils/cn'

export default function RatingBar({
  label,
  value = 0,
  max = 10,
  className,
}) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const percentage = (value / max) * 100

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-between text-sm font-bold uppercase tracking-widest opacity-80">
        <span className="text-on-surface-variant">
          {label}
        </span>
        <span className="text-on-surface">
          {Math.round(percentage)}%
        </span>
      </div>
      <div className="h-2 w-full bg-black/[0.05] dark:bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
          style={{ width: animated ? `${percentage}%` : '0%' }}
        />
      </div>
    </div>
  )
}
