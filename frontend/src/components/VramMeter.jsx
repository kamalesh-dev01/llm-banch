import React from 'react'

/**
 * VRAM Meter Bar showing model size vs user's VRAM, with markers for min and recommended.
 */
export default function VramMeter({ userVram = 0, minVram = 0, recVram = 0, modelSize = 0 }) {
  // Compute scale maximum with headroom
  const maxScale = Math.max(userVram * 1.15, recVram * 1.25, minVram * 1.3, 8)
  
  // Calculate percentage positions
  const userPct = Math.min(Math.max((userVram / maxScale) * 100, 2), 100)
  const minPct = Math.min(Math.max((minVram / maxScale) * 100, 2), 100)
  const recPct = Math.min(Math.max((recVram / maxScale) * 100, 2), 100)
  const modelPct = modelSize > 0 ? Math.min(Math.max((modelSize / maxScale) * 100, 2), 100) : 0

  // Determine user VRAM status color
  let barColor = 'bg-not-recommended'
  let statusText = 'Below Minimum VRAM'
  let statusBadge = 'text-not-recommended bg-not-recommended/10 border-not-recommended/30'

  if (userVram >= recVram && recVram > 0) {
    barColor = 'bg-recommended'
    statusText = 'Full GPU Offload Capable'
    statusBadge = 'text-recommended bg-recommended/10 border-recommended/30'
  } else if (userVram >= minVram && minVram > 0) {
    barColor = 'bg-minimum'
    statusText = 'Meets Minimum (Partial Offload)'
    statusBadge = 'text-minimum bg-minimum/10 border-minimum/30'
  }

  return (
    <div className="w-full space-y-4">
      {/* Title & Status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-muted font-semibold">
            VRAM Capacity &amp; Memory Fit
          </span>
          <div className="text-sm font-heading font-bold text-text">
            Your GPU: {userVram} GB VRAM
          </div>
        </div>
        <span className={`px-2.5 py-1 text-xs font-mono font-medium rounded border ${statusBadge}`}>
          {statusText}
        </span>
      </div>

      {/* Visual Meter Bar Container */}
      <div className="relative pt-6 pb-8">
        {/* Min Marker Label */}
        {minVram > 0 && (
          <div 
            className="absolute top-0 -translate-x-1/2 flex flex-col items-center pointer-events-none"
            style={{ left: `${minPct}%` }}
          >
            <span className="text-[10px] font-mono text-minimum font-bold px-1 rounded bg-elevated border border-minimum/30 whitespace-nowrap">
              Min {minVram}G
            </span>
            <div className="w-0.5 h-2 bg-minimum/70 mt-0.5" />
          </div>
        )}

        {/* Rec Marker Label */}
        {recVram > 0 && (
          <div 
            className="absolute top-0 -translate-x-1/2 flex flex-col items-center pointer-events-none"
            style={{ left: `${recPct}%` }}
          >
            <span className="text-[10px] font-mono text-recommended font-bold px-1 rounded bg-elevated border border-recommended/30 whitespace-nowrap">
              Rec {recVram}G
            </span>
            <div className="w-0.5 h-2 bg-recommended/70 mt-0.5" />
          </div>
        )}

        {/* Track */}
        <div className="h-4 w-full bg-surface border border-border rounded-full relative overflow-visible shadow-inner">
          {/* User VRAM fill bar */}
          <div 
            className={`h-full ${barColor} rounded-full transition-all duration-700 opacity-90`}
            style={{ width: `${userPct}%` }}
          />

          {/* Vertical marker tick for Min */}
          {minVram > 0 && (
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-minimum border-r border-black/50 z-10"
              style={{ left: `${minPct}%` }}
              title={`Minimum Required: ${minVram} GB`}
            />
          )}

          {/* Vertical marker tick for Rec */}
          {recVram > 0 && (
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-recommended border-r border-black/50 z-10"
              style={{ left: `${recPct}%` }}
              title={`Recommended: ${recVram} GB`}
            />
          )}

          {/* Model weight size pin if available */}
          {modelPct > 0 && (
            <div
              className="absolute -top-1 w-2.5 h-6 bg-accent border border-black rounded-sm shadow z-20 -translate-x-1/2"
              style={{ left: `${modelPct}%` }}
              title={`Model Weight Size: ${modelSize} GB`}
            />
          )}
        </div>

        {/* User VRAM indicator label below bar */}
        <div 
          className="absolute bottom-1 -translate-x-1/2 flex flex-col items-center pointer-events-none"
          style={{ left: `${userPct}%` }}
        >
          <div className="w-0.5 h-2 bg-accent/70 mb-0.5" />
          <span className="text-[10px] font-mono text-accent font-bold px-1 rounded bg-elevated border border-accent/30 whitespace-nowrap">
            ▲ You: {userVram} GB
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/50 text-center font-mono">
        <div className="bg-surface/60 p-2 rounded border border-border/50">
          <div className="text-[10px] text-muted">Min VRAM</div>
          <div className="text-xs font-bold text-text">{minVram} GB</div>
        </div>
        <div className="bg-surface/60 p-2 rounded border border-border/50">
          <div className="text-[10px] text-muted">Rec VRAM</div>
          <div className="text-xs font-bold text-text">{recVram} GB</div>
        </div>
        <div className="bg-surface/60 p-2 rounded border border-border/50">
          <div className="text-[10px] text-muted">VRAM Headroom</div>
          <div className={`text-xs font-bold ${userVram >= recVram ? 'text-recommended' : userVram >= minVram ? 'text-minimum' : 'text-not-recommended'}`}>
            {userVram >= recVram ? `+${(userVram - recVram).toFixed(1)} GB` : `${(userVram - minVram).toFixed(1)} GB`}
          </div>
        </div>
      </div>
    </div>
  )
}
