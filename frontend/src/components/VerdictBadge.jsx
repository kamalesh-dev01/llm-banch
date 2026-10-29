import React from 'react'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

/**
 * VerdictBadge displaying compatibility with semantic colors and icons.
 */
export default function VerdictBadge({ verdict, className = '' }) {
  if (!verdict) return null

  const normalized = verdict.toLowerCase().replace('-', '_')

  if (normalized === 'recommended') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 bg-recommended/15 text-recommended text-xs font-semibold rounded-full border border-recommended/30 shadow-sm ${className}`}>
        <CheckCircle2 size={13} className="flex-shrink-0" />
        <span>Recommended</span>
      </span>
    )
  }
  
  if (normalized === 'minimum') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 bg-minimum/15 text-minimum text-xs font-semibold rounded-full border border-minimum/30 shadow-sm ${className}`}>
        <AlertTriangle size={13} className="flex-shrink-0" />
        <span>Minimum</span>
      </span>
    )
  }
  
  if (normalized === 'not_recommended') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 bg-not-recommended/15 text-not-recommended text-xs font-semibold rounded-full border border-not-recommended/30 shadow-sm ${className}`}>
        <XCircle size={13} className="flex-shrink-0" />
        <span>Not Recommended</span>
      </span>
    )
  }

  return null
}
