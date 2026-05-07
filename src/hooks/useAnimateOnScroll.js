/* ═══════════════════════════════════════════════════
   Хук useAnimateOnScroll — запуск анимации при скролле

   Использует Intersection Observer, чтобы определить,
   когда элемент появляется в зоне видимости.
   Возвращает ref (привязать к элементу) и isVisible.

   Пример:
     const { ref, isVisible } = useAnimateOnScroll()
     <div ref={ref}>{isVisible && <Анимация />}</div>
   ═══════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react'

export function useAnimateOnScroll(threshold = 0.2) {
  const ref = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        /* Анимация срабатывает один раз — при первом появлении */
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(element)
        }
      },
      { threshold },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, isVisible }
}
