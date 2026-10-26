import React, { useState } from 'react'
import VerdictBadge from './VerdictBadge'
import { Copy, Check } from 'lucide-react'

export default function QuantTable({ quants, userVram }) {
  const [copiedId, setCopiedId] = useState(null)

  if (!quants || quants.length === 0) {
    return (
      <p className="text-muted p-4 bg-surface rounded-lg border border-border font-mono text-xs">
        No quantizations available for this model.
      </p>
    )
  }

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface/70 glass shadow-md">
      <table className="w-full text-left text-sm border-collapse min-w-[720px]">
        <thead className="bg-elevated/80 text-muted text-xs uppercase font-mono border-b border-border">
          <tr>
            <th className="px-5 py-3.5 font-semibold">Quant</th>
            <th className="px-4 py-3.5 font-semibold">Size</th>
            <th className="px-4 py-3.5 font-semibold">Min VRAM</th>
            <th className="px-4 py-3.5 font-semibold">Rec VRAM</th>
            <th className="px-4 py-3.5 font-semibold">Est Speed</th>
            <th className="px-4 py-3.5 font-semibold">Verdict</th>
            <th className="px-5 py-3.5 font-semibold">Ollama Command</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 font-mono text-xs">
          {quants.map((q) => {
            let verdict = null
            let isHighlight = false
            
            if (userVram !== undefined && userVram !== null) {
              if (userVram >= q.rec_vram_gb) verdict = 'recommended'
              else if (userVram >= q.min_vram_gb) verdict = 'minimum'
              else verdict = 'not_recommended'
              
              if (verdict === 'recommended') {
                isHighlight = true
              }
            }

            const minVramColor = (userVram && userVram < q.min_vram_gb) ? 'text-not-recommended font-bold' : 'text-text'
            const recVramColor = (userVram && userVram < q.rec_vram_gb && userVram >= q.min_vram_gb) ? 'text-minimum font-bold' : 'text-text'
            const cmd = q.ollama_url || `ollama run ${q.quant}`

            return (
              <tr 
                key={q.id} 
                className={`hover:bg-elevated/70 transition ${isHighlight ? 'border-l-2 border-l-accent bg-accent/5' : ''}`}
              >
                <td className="px-5 py-3.5 font-bold text-text font-mono">{q.quant}</td>
                <td className="px-4 py-3.5 text-muted">{q.size_gb} GB</td>
                <td className={`px-4 py-3.5 ${minVramColor}`}>{q.min_vram_gb} GB</td>
                <td className={`px-4 py-3.5 ${recVramColor}`}>{q.rec_vram_gb} GB</td>
                <td className="px-4 py-3.5 text-accent font-semibold">
                  {q.est_tps_low ? `~${q.est_tps_low} tok/s` : '-'}
                </td>
                <td className="px-4 py-3.5">
                  <VerdictBadge verdict={verdict} />
                </td>
                <td className="px-5 py-3.5">
                  <div 
                    onClick={() => handleCopy(q.id, cmd)}
                    className="flex items-center justify-between bg-elevated border border-border rounded px-2.5 py-1.5 group cursor-pointer hover:border-accent transition max-w-[240px]" 
                  >
                    <code className="text-[11px] font-mono text-text truncate" title={cmd}>
                      {cmd}
                    </code>
                    <button 
                      type="button"
                      className="text-muted group-hover:text-text transition ml-2 flex-shrink-0" 
                      title="Copy command"
                    >
                      {copiedId === q.id ? (
                        <Check size={13} className="text-recommended" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
