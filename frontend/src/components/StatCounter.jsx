import React, { useEffect, useState, useRef } from 'react'
import { useInView } from 'framer-motion'

/**
 * Animated Stat Counter that counts up smoothly when scrolled into view.
 */
export default function StatCounter({ endValue, suffix = '', duration = 1.6, label, colorClass = 'text-accent' }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (isInView && !hasAnimated.current) {
      hasAnimated.current = true
      let startTime = null
      const start = 0
      const end = parseInt(endValue, 10) || 0

      const step = (timestamp) => {
        if (!startTime) startTime = timestamp
        const progress = Math.min((timestamp - startTime) / (duration * 1000), 1)
        // Ease-out cubic curve
        const easeOut = 1 - Math.pow(1 - progress, 3)
        setCount(Math.floor(start + (end - start) * easeOut))

        if (progress < 1) {
          window.requestAnimationFrame(step)
        } else {
          setCount(end)
        }
      }

      window.requestAnimationFrame(step)
    }
  }, [isInView, endValue, duration])

  return (
    <div ref={ref} className="text-center p-4">
      <div className={`text-4xl md:text-5xl font-mono font-bold tracking-tight ${colorClass} mb-1.5`}>
        {count}{suffix}
      </div>
      <div className="text-xs font-mono uppercase tracking-wider text-muted font-medium">
        {label}
      </div>
    </div>
  )
}
