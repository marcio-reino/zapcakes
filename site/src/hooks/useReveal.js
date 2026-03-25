import { useEffect, useRef } from 'react'

export function useReveal() {
  const ref = useRef(null)

  useEffect(() => {
    const elements = ref.current?.querySelectorAll('.reveal')
    if (!elements?.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.05, rootMargin: '0px 0px -10px 0px' }
    )

    // Pequeno delay para garantir que o layout esteja pronto
    requestAnimationFrame(() => {
      elements.forEach((el) => observer.observe(el))
    })

    return () => observer.disconnect()
  }, [])

  return ref
}
