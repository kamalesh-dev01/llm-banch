import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getLeaderboard } from '../api/client'
import AdSlot from '../components/AdSlot'
import { Trophy, ArrowUpDown, ChevronRight, Activity } from 'lucide-react'

export default function LeaderboardPage() {
  const [metric, setMetric] = useState('quality')
  const [leaders, setLeaders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getLeaderboard(metric, 15)
      .then(res => setLeaders(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [metric])

  const tabs = [
    { id: 'quality', label: 'Quality Score' },
    { id: 'speed', label: 'Tokens / Sec' },
    { id: 'efficiency', label: 'VRAM Efficiency' }
  ]

  return (
    <div className="max-w-5xl mx-auto pb-16">
      {/* Title & Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-minimum/10 border border-minimum/20 text-minimum text-xs font-mono mb-4">
          <Trophy size={14} />
          <span>Verified Benchmarks</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-heading font-bold text-text mb-3">
          Model Leaderboard
        </h1>
        <p className="text-muted text-sm max-w-xl mx-auto leading-relaxed">
          Inference performance rankings based on real hardware runs, tokens-per-second velocity, and memory density.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="bg-surface/80 p-1.5 rounded-xl border border-border inline-flex gap-1 shadow-inner">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setMetric(tab.id)}
              className={`px-5 py-2 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                metric === tab.id 
                  ? 'bg-accent text-bg shadow-md' 
                  : 'text-muted hover:text-text hover:bg-elevated'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="glass overflow-hidden border border-border rounded-xl shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-muted shimmer font-mono text-sm">
            Calculating rankings...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead className="bg-elevated/80 text-muted text-xs uppercase font-mono border-b border-border">
                <tr>
                  <th className="px-5 py-4 font-semibold text-center w-16">Rank</th>
                  <th className="px-5 py-4 font-semibold">Model</th>
                  <th className="px-4 py-4 font-semibold hidden md:table-cell">Family</th>
                  <th className="px-4 py-4 font-semibold">Parameters</th>
                  <th className="px-4 py-4 font-semibold">
                    {metric === 'quality' ? 'Quality Score' : metric === 'speed' ? 'Tok / Sec' : 'Efficiency'}
                  </th>
                  <th className="px-4 py-4 font-semibold hidden md:table-cell">Min VRAM</th>
                  <th className="px-5 py-4 font-semibold text-right">Specs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs font-mono">
                {leaders.map((model, index) => {
                  let rankBadge = "text-muted font-mono"
                  if (index === 0) rankBadge = "text-[#fbbf24] font-bold text-sm" // Gold
                  else if (index === 1) rankBadge = "text-[#94a3b8] font-bold text-sm" // Silver
                  else if (index === 2) rankBadge = "text-[#d97706] font-bold text-sm" // Bronze
                  
                  return (
                    <tr key={model.id} className="hover:bg-elevated/70 transition">
                      <td className={`px-5 py-4 text-center ${rankBadge}`}>
                        #{index + 1}
                      </td>
                      <td className="px-5 py-4">
                        <Link 
                          to={`/models/${model.id}`} 
                          className="font-bold text-text hover:text-accent transition font-heading text-sm"
                        >
                          {model.name}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-muted hidden md:table-cell uppercase">
                        {model.family}
                      </td>
                      <td className="px-4 py-4 text-text font-mono">
                        {model.params_b}B
                      </td>
                      <td className="px-4 py-4 font-mono font-bold text-accent">
                        {model.metric_value?.toFixed(1) || model.quality_score}
                      </td>
                      <td className="px-4 py-4 text-muted hidden md:table-cell font-mono">
                        {model.min_vram_gb ? `${model.min_vram_gb} GB` : 'N/A'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link 
                          to={`/models/${model.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-mono border border-border hover:border-accent hover:text-accent px-2.5 py-1.5 rounded transition"
                        >
                          <span>View</span>
                          <ChevronRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ad slot below the table (Requirement: one slot below the table) */}
      <AdSlot slot="leaderboard-below-table" format="banner" className="mt-12" />
    </div>
  )
}
