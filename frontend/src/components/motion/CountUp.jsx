import React, { useEffect, useState, useRef } from 'react'
import { useInView } from 'framer-motion'

export default function CountUp({
  endValue,
  suffix = '',
  prefix = '',
  duration = 1.4,
  className = '',
}) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-40px' })

  useEffect(() => {
    if (isInView && endValue > 0) {
      let startTime = null
      const start = 0
      const end = parseInt(endValue, 10) || 0

      const step = (timestamp) => {
        if (!startTime) startTime = timestamp
        const progress = Math.min((timestamp - startTime) / (duration * 1000), 1)
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
    <span ref={ref} className={className}>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  )
}
