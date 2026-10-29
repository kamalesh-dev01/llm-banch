import React from 'react'
import { motion } from 'framer-motion'

export default function SplitText({
  text,
  className = '',
  highlightWords = [],
  highlightClassName = 'brand-gradient-text',
}) {
  const words = text.split(' ')

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.04,
      },
    },
  }

  const child = {
    hidden: {
      opacity: 0,
      y: 16,
      filter: 'blur(6px)',
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: 0.45,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  }

  return (
    <motion.span
      variants={container}
      initial="hidden"
      animate="visible"
      className={`inline-block ${className}`}
    >
      {words.map((word, index) => {
        const clean = word.toLowerCase().replace(/[.,!?;:]/g, '')
        const isHighlight = highlightWords.some(
          (hw) => hw.toLowerCase() === clean
        )

        return (
          <span
            key={index}
            className="inline-block whitespace-nowrap mr-[0.25em]"
          >
            <motion.span
              variants={child}
              className={`inline-block ${isHighlight ? highlightClassName : ''}`}
            >
              {word}
            </motion.span>
          </span>
        )
      })}
    </motion.span>
  )
}
