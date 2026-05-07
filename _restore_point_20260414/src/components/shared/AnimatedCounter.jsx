/* ═══════════════════════════════════════════════════
   Компонент AnimatedCounter — анимированный счётчик

   Плавно «считает» от 0 до target при появлении
   в зоне видимости. Используется в блоке статистики
   на главной странице.

   Пример: <AnimatedCounter target={1250} suffix="+" />
   ═══════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useAnimateOnScroll } from '../../hooks/useAnimateOnScroll'

export default function AnimatedCounter({
  target,
  duration = 2000,
  suffix = '',
  prefix = '',
}) {
  const { ref, isVisible } = useAnimateOnScroll(0.3)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isVisible) return

    let startTime = null
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp
      /* Прогресс от 0 до 1 */
      const progress = Math.min((timestamp - startTime) / duration, 1)
      /* Плавное замедление в конце (easeOut) */
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))

      if (progress < 1) {
        requestAnimationFrame(step)
      }
    }

    requestAnimationFrame(step)
  }, [isVisible, target, duration])

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{count}{suffix}
    </span>
  )
}
