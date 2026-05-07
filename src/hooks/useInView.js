import { useEffect, useRef, useState } from 'react'

/**
 * Returns [ref, inView].
 * Once the element enters the viewport, inView flips to true and stays true.
 */
export function useInView(options = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          obs.unobserve(el)
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px', ...options }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return [ref, inView]
}
