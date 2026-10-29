import React, { useState } from 'react'
import VerdictBadge from './VerdictBadge'
import { Copy, Check } from 'lucide-react'

export default function QuantTable({ quants, userVram }) {
  const [copiedId, setCopiedId] = useState(null)

  if (!quants || quants.length === 0) {
    return (
      <p className="text-muted p-4 bg-surface rounded-card border border-line font-mono text-xs">
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
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-soft">
      <table className="w-full text-left text-sm border-collapse min-w-[720px]">
        <thead className="bg-surface-2 text-muted text-xs uppercase font-mono border-b border-line">
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
        <tbody className="divide-y divide-line font-mono text-xs">
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

            const minVramColor = (userVram && userVram < q.min_vram_gb) ? 'text-danger font-bold' : 'text-text'
            const recVramColor = (userVram && userVram < q.rec_vram_gb && userVram >= q.min_vram_gb) ? 'text-warning font-bold' : 'text-text'
            const cmd = q.ollama_url || `ollama run ${q.quant}`

            return (
              <tr 
                key={q.id} 
                className={`hover:bg-surface-2/60 transition ${isHighlight ? 'border-l-2 border-l-primary bg-primary-soft/30' : ''}`}
              >
                <td className="px-5 py-3.5 font-bold text-text font-mono">{q.quant}</td>
                <td className="px-4 py-3.5 text-muted">{q.size_gb} GB</td>
                <td className={`px-4 py-3.5 ${minVramColor}`}>{q.min_vram_gb} GB</td>
                <td className={`px-4 py-3.5 ${recVramColor}`}>{q.rec_vram_gb} GB</td>
                <td className="px-4 py-3.5 text-primary font-semibold">
                  {q.est_tps_low ? `~${q.est_tps_low} tok/s` : '-'}
                </td>
                <td className="px-4 py-3.5">
                  <VerdictBadge verdict={verdict} />
                </td>
                <td className="px-5 py-3.5">
                  <div 
                    onClick={() => handleCopy(q.id, cmd)}
                    className="flex items-center justify-between bg-surface-2 border border-line rounded-btn px-2.5 py-1.5 group cursor-pointer hover:border-primary transition max-w-[240px]" 
                  >
                    <code className="text-[11px] font-mono text-text truncate" title={cmd}>
                      {cmd}
                    </code>
                    <button 
                      type="button"
                      className="text-muted group-hover:text-text transition ml-2 flex-shrink-0 cursor-pointer" 
                      title="Copy command"
                    >
                      {copiedId === q.id ? (
                        <Check size={13} className="text-success" />
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
