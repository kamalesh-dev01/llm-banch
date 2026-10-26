import React from 'react'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

/**
 * Circular Verdict Gauge
 * Renders an SVG ring with glowing accent color matching the hardware verdict.
 */
export default function VerdictGauge({ verdict, estTps }) {
  const normalized = (verdict || '').toLowerCase().replace('-', '_')

  let strokeColor = '#f87171' // not_recommended
  let label = 'Not Recommended'
  let Icon = XCircle
  let percentage = 33

  if (normalized === 'recommended') {
    strokeColor = '#34d399'
    label = 'Recommended'
    Icon = CheckCircle2
    percentage = 100
  } else if (normalized === 'minimum') {
    strokeColor = '#fbbf24'
    label = 'Minimum Fit'
    Icon = AlertTriangle
    percentage = 66
  }

  const radius = 64
  const strokeWidth = 8
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative w-44 h-44 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
          {/* Background Track */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="#1f232b"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Active Colored Arc */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{
              transition: 'stroke-dashoffset 0.8s ease-in-out',
              filter: `drop-shadow(0 0 6px ${strokeColor}40)`
            }}
          />
        </svg>

        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
          <Icon size={26} style={{ color: strokeColor }} className="mb-1" />
          <span className="font-heading font-bold text-sm tracking-wide text-text leading-tight">
            {label}
          </span>
          {estTps ? (
            <span className="font-mono text-xs text-accent mt-1">
              ~{estTps} tok/s
            </span>
          ) : (
            <span className="font-mono text-[11px] text-muted mt-1">
              {normalized === 'recommended' ? 'Full Offload' : 'Partial / CPU'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
