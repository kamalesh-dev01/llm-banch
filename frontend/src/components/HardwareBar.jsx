import React from 'react'

export default function HardwareBar({ label, userValue = 0, minValue = 0, recValue = 0, unit = 'GB' }) {
  const maxDisplayValue = Math.max(userValue, recValue * 1.2, minValue * 1.25, 4)
  const userWidth = Math.min((userValue / maxDisplayValue) * 100, 100)

  let fillColor = 'bg-not-recommended'
  if (userValue >= recValue && recValue > 0) {
    fillColor = 'bg-recommended'
  } else if (userValue >= minValue && minValue > 0) {
    fillColor = 'bg-minimum'
  }

  return (
    <div className="mb-5 font-mono">
      <div className="flex items-center gap-3 mb-1.5">
        <span className="w-24 min-w-fit font-semibold text-text text-xs uppercase tracking-wider">{label}</span>
        
        <div className="flex-1 relative h-2.5 bg-surface border border-border rounded-full overflow-hidden shadow-inner">
          <div 
            className={`absolute top-0 left-0 h-full ${fillColor} rounded-full transition-all duration-500`} 
            style={{ width: `${userWidth}%` }}
          />
        </div>

        <span className="w-16 text-right font-bold text-accent text-xs">
          {userValue} {unit}
        </span>
      </div>
      
      <div className="flex justify-between text-[10px] text-muted pl-28 pr-1">
        <span>Min: {minValue} {unit}</span>
        <span>Rec: {recValue} {unit}</span>
      </div>
    </div>
  )
}
