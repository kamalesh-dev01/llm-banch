import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function AnimatedHeroTitle({ models = [] }) {
  // Extract real model names from DB models list, or use real DB fallback names
  const modelNames = models.length > 0 
    ? models.map(m => m.name).slice(0, 8) 
    : ['DeepSeek R1', 'Llama 3.2', 'Mistral 7B', 'Qwen 2.5', 'Phi 4', 'Gemma 2']

  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (modelNames.length === 0) return
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % modelNames.length)
    }, 2800)
    return () => clearInterval(interval)
  }, [modelNames.length])

  return (
    <div className="space-y-4">
      <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-heading font-extrabold text-text tracking-tight leading-[1.1] max-w-4xl mx-auto">
        <span>Can your hardware run </span>
        <span className="inline-block relative">
          <AnimatePresence mode="wait">
            <motion.span
              key={modelNames[currentIndex]}
              initial={{ y: 24, opacity: 0, filter: 'blur(8px)' }}
              animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
              exit={{ y: -24, opacity: 0, filter: 'blur(8px)' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-accent via-cyan-200 to-recommended tech-glow"
            >
              {modelNames[currentIndex]}?
            </motion.span>
          </AnimatePresence>
        </span>
      </h1>

      <p className="text-sm sm:text-base md:text-lg text-muted max-w-2xl mx-auto leading-relaxed font-sans">
        Compare loaded memory footprints, physics-calibrated tokens/second, and exact VRAM offload limits before downloading gigabytes of weights.
      </p>
    </div>
  )
}
