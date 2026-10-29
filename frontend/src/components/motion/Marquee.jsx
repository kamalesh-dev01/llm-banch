import React from 'react'

export default function Marquee({ items = [], renderItem, className = '' }) {
  if (!items || items.length === 0) return null

  // Ensure enough items to fill the marquee seamlessly
  const baseItems = items.length < 5 ? [...items, ...items, ...items] : items
  const duplicated = [...baseItems, ...baseItems]

  return (
    <div
      className={`overflow-hidden relative w-full select-none ${className}`}
    >
      {/* Side fades */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-bg to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-bg to-transparent z-10 pointer-events-none" />

      <div className="animate-marquee gap-3 py-1">
        {duplicated.map((item, idx) => (
          <div key={idx} className="flex-shrink-0">
            {renderItem ? (
              renderItem(item, idx)
            ) : (
              <span className="px-4 py-1.5 rounded-pill bg-surface-2 border border-line text-sm text-muted font-medium hover:text-text hover:border-primary/40 transition">
                {typeof item === 'string' ? item : item.family || item.name}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
