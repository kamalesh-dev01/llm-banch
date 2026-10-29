import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion } from 'framer-motion'
import { getLeaderboard } from '../api/client'
import AdSlot from '../components/AdSlot'
import { 
  Trophy, 
  ChevronRight, 
  Zap, 
  Gauge, 
  Sparkles 
} from 'lucide-react'

const TABS = [
  { 
    id: 'speed', 
    label: 'Speed', 
    unit: 'tok/s',
    explanation: 'Ranked by verified generation throughput (tokens per second) measured on physical test hardware.' 
  },
  { 
    id: 'quality', 
    label: 'Quality', 
    unit: 'Score',
    explanation: 'Ranked by standardized MMLU and instruction-following quality evaluation score.' 
  },
  { 
    id: 'efficiency', 
    label: 'Efficiency', 
    unit: 'pts/GB',
    explanation: 'Ranked by quality score points achieved per gigabyte of minimum required VRAM.' 
  }
]

export default function LeaderboardPage() {
  const [metric, setMetric] = useState('speed')
  const [leaders, setLeaders] = useState([])
  const [loading, setLoading] = useState(true)

  const activeTabObj = TABS.find(t => t.id === metric) || TABS[0]

  useEffect(() => {
    setLoading(true)
    getLeaderboard(metric, 25)
      .then(res => {
        setLeaders(Array.isArray(res.data) ? res.data : [])
      })
      .catch(err => {
        console.error('Failed to load leaderboard:', err)
        setLeaders([])
      })
      .finally(() => setLoading(false))
  }, [metric])

  // Top 3 for podium
  const first = leaders[0]
  const second = leaders[1]
  const third = leaders[2]
  const hasPodium = leaders.length > 0

  return (
    <>
      <Helmet>
        <title>Model Leaderboard — LLM Bench</title>
        <meta
          name="description"
          content="Inference speed, quality, and memory efficiency rankings for local LLMs based on verified physical hardware benchmarks."
        />
      </Helmet>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl py-8 pb-20">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-pill bg-warning-soft text-warning border border-warning/30 text-xs font-mono font-bold mb-3.5 shadow-soft">
            <Trophy size={14} />
            <span>Verified Rankings</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-text tracking-tight mb-3">
            Model Leaderboard
          </h1>
          <p className="text-muted text-xs sm:text-sm font-mono max-w-xl mx-auto leading-relaxed">
            Direct physical benchmarking results, tokens-per-second velocity, and architectural efficiency metrics.
          </p>
        </div>

        {/* Metric Tabs */}
        <div className="flex flex-col items-center mb-10">
          <div className="bg-surface border border-line p-1.5 rounded-btn inline-flex gap-1 shadow-soft">
            {TABS.map(tab => {
              const isActive = metric === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setMetric(tab.id)}
                  className={`px-5 py-2 rounded-btn text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    isActive 
                      ? 'bg-primary text-white shadow-soft' 
                      : 'text-muted hover:text-text hover:bg-surface-2'
                  }`}
                >
                  {tab.id === 'speed' && <Zap size={14} />}
                  {tab.id === 'quality' && <Sparkles size={14} />}
                  {tab.id === 'efficiency' && <Gauge size={14} />}
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* One-Line Metric Explanation */}
          <p className="text-xs font-mono text-muted text-center mt-3 max-w-lg">
            {activeTabObj.explanation}
          </p>
        </div>

        {loading ? (
          /* Loading skeleton */
          <div className="space-y-6">
            <div className="h-64 shimmer rounded-card border border-line w-full" />
            <div className="h-80 shimmer rounded-card border border-line w-full" />
          </div>
        ) : leaders.length === 0 ? (
          /* Empty state for Quality/Efficiency if unmeasured, or Speed if no runs */
          <div className="bg-surface border border-line rounded-card p-14 text-center shadow-soft mb-8">
            <div className="w-14 h-14 rounded-full bg-surface-2 border border-line flex items-center justify-center text-muted mx-auto mb-4">
              {metric === 'speed' ? (
                <Zap size={24} className="text-warning" />
              ) : (
                <Sparkles size={24} className="text-warning" />
              )}
            </div>
            <h3 className="text-lg font-bold text-text mb-2">
              {metric === 'speed'
                ? 'No measured speeds yet'
                : 'Quality scores come from measured evaluations. None have been run yet.'}
            </h3>
            <p className="text-xs font-mono text-muted max-w-md mx-auto leading-relaxed mb-6">
              {metric === 'speed'
                ? 'Official speed rankings only show real benchmarks run on actual physical hardware (never synthetic estimates). Run our local benchmark tool or scanner to record results.'
                : 'We never label synthetic parameter size maps as quality scores. Real evaluation benchmarks will populate here once measured runs are completed.'}
            </p>
            {metric === 'speed' ? (
              <Link
                to="/check"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-btn text-xs font-mono font-bold transition shadow-soft"
              >
                <span>Check Your Hardware</span>
                <ChevronRight size={14} />
              </Link>
            ) : (
              <Link
                to="/about"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-btn text-xs font-mono font-bold transition shadow-soft"
              >
                <span>Read Our Methodology</span>
                <ChevronRight size={14} />
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* TOP 3 PODIUM SECTION (Renders correctly with 1, 2, or 3 entries) */}
            {hasPodium && (
              <div className="mb-12">
                <div className="text-center mb-6">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted font-bold">
                    Top Performers ({activeTabObj.label})
                  </span>
                </div>

                <div className={`grid gap-4 items-end mx-auto ${
                  leaders.length === 1 
                    ? 'grid-cols-1 max-w-sm' 
                    : (leaders.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-xl' : 'grid-cols-1 md:grid-cols-3 max-w-3xl')
                }`}>
                  {/* #2 Silver (Second Place - rendered only if second exists) */}
                  {second && (
                    <div className="order-2 md:order-1 flex flex-col items-center w-full">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                        className="w-full bg-surface border border-line hover:border-muted rounded-card p-4 text-center shadow-soft flex flex-col justify-between min-h-[240px] sm:min-h-[260px]"
                      >
                        <div>
                          <div className="w-8 h-8 rounded-full bg-surface-2 border border-line text-text text-xs font-mono font-bold flex items-center justify-center mx-auto mb-2 shadow-inner">
                            #2
                          </div>
                          <Link
                            to={`/models/${second.ollama_tag || second.id}`}
                            className="font-bold text-text hover:text-primary transition text-sm block truncate"
                          >
                            {second.name}
                          </Link>
                          <div className="text-[11px] font-mono text-muted uppercase mt-0.5">
                            {second.family} &bull; {second.params_b}B
                          </div>
                        </div>

                        <div className="pt-2 border-t border-line">
                          <div className="text-xl font-extrabold font-mono text-text">
                            {second.metric_value}
                            <span className="text-xs font-normal text-muted ml-1">{activeTabObj.unit}</span>
                          </div>
                          {metric === 'speed' && second.gpu_name && (
                            <div className="text-[10px] font-mono text-muted truncate mt-0.5" title={second.gpu_name}>
                              {second.gpu_name}
                            </div>
                          )}
                        </div>
                      </motion.div>
                      <div className="w-full h-8 bg-surface-2 border-x border-b border-line rounded-b-card flex items-center justify-center text-xs font-mono text-muted font-bold">
                        2nd
                      </div>
                    </div>
                  )}

                  {/* #1 Gold (First Place - Taller, Center) */}
                  {first && (
                    <div className={`order-1 ${leaders.length >= 3 ? 'md:order-2' : ''} flex flex-col items-center w-full`}>
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="w-full bg-surface border-2 border-warning/60 rounded-card p-5 text-center shadow-card flex flex-col justify-between min-h-[270px] sm:min-h-[290px] relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-warning via-warning to-warning" />
                        <div>
                          <div className="w-9 h-9 rounded-full bg-warning-soft border border-warning/40 text-warning text-sm font-mono font-bold flex items-center justify-center mx-auto mb-2 shadow-soft">
                            <Trophy size={16} />
                          </div>
                          <Link
                            to={`/models/${first.ollama_tag || first.id}`}
                            className="font-bold text-text hover:text-primary transition text-base block truncate"
                          >
                            {first.name}
                          </Link>
                          <div className="text-xs font-mono text-muted uppercase mt-0.5">
                            {first.family} &bull; {first.params_b}B
                          </div>
                        </div>

                        <div className="pt-3 border-t border-line">
                          <div className="text-2xl font-extrabold font-mono text-warning">
                            {first.metric_value}
                            <span className="text-xs font-normal text-muted ml-1">{activeTabObj.unit}</span>
                          </div>
                          {metric === 'speed' && first.gpu_name && (
                            <div className="text-[10px] font-mono text-muted truncate mt-0.5" title={first.gpu_name}>
                              {first.gpu_name}
                            </div>
                          )}
                        </div>
                      </motion.div>
                      <div className="w-full h-12 bg-surface-2 border-x border-b border-line rounded-b-card flex items-center justify-center text-xs font-mono text-warning font-bold">
                        1st
                      </div>
                    </div>
                  )}

                  {/* #3 Bronze (Third Place - rendered only if third exists) */}
                  {third && (
                    <div className="order-3 md:order-3 flex flex-col items-center w-full">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.15 }}
                        className="w-full bg-surface border border-line hover:border-muted rounded-card p-4 text-center shadow-soft flex flex-col justify-between min-h-[230px] sm:min-h-[250px]"
                      >
                        <div>
                          <div className="w-8 h-8 rounded-full bg-surface-2 border border-line text-muted text-xs font-mono font-bold flex items-center justify-center mx-auto mb-2 shadow-inner">
                            #3
                          </div>
                          <Link
                            to={`/models/${third.ollama_tag || third.id}`}
                            className="font-bold text-text hover:text-primary transition text-sm block truncate"
                          >
                            {third.name}
                          </Link>
                          <div className="text-[11px] font-mono text-muted uppercase mt-0.5">
                            {third.family} &bull; {third.params_b}B
                          </div>
                        </div>

                        <div className="pt-2 border-t border-line">
                          <div className="text-xl font-extrabold font-mono text-text">
                            {third.metric_value}
                            <span className="text-xs font-normal text-muted ml-1">{activeTabObj.unit}</span>
                          </div>
                          {metric === 'speed' && third.gpu_name && (
                            <div className="text-[10px] font-mono text-muted truncate mt-0.5" title={third.gpu_name}>
                              {third.gpu_name}
                            </div>
                          )}
                        </div>
                      </motion.div>
                      <div className="w-full h-6 bg-surface-2 border-x border-b border-line rounded-b-card flex items-center justify-center text-xs font-mono text-muted font-bold">
                        3rd
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FULL RANKINGS TABLE */}
            <div className="bg-surface border border-line rounded-card overflow-hidden shadow-soft">
              <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between">
                <h2 className="text-base font-bold text-text flex items-center gap-2">
                  <span>Full Rankings</span>
                  <span className="text-xs font-mono text-muted font-normal">
                    ({leaders.length} {leaders.length === 1 ? 'model' : 'models'})
                  </span>
                </h2>
                <span className="text-xs font-mono text-muted uppercase tracking-wider">
                  Sorted by {activeTabObj.label}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[680px]">
                  <thead className="bg-surface-2 text-muted text-xs uppercase font-mono border-b border-line">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold text-center w-16">Rank</th>
                      <th className="px-5 py-3.5 font-semibold">Model</th>
                      <th className="px-4 py-3.5 font-semibold hidden sm:table-cell">Family</th>
                      <th className="px-4 py-3.5 font-semibold">Parameters</th>
                      {metric === 'speed' && (
                        <>
                          <th className="px-4 py-3.5 font-semibold">Test GPU</th>
                          <th className="px-4 py-3.5 font-semibold">Measured Date</th>
                        </>
                      )}
                      <th className="px-4 py-3.5 font-semibold text-right">
                        {activeTabObj.label} ({activeTabObj.unit})
                      </th>
                      <th className="px-4 py-3.5 font-semibold hidden md:table-cell text-right">Min VRAM</th>
                      <th className="px-5 py-3.5 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-xs font-mono">
                    {leaders.map((model, index) => {
                      let rankBadge = "text-muted font-mono"
                      if (index === 0) rankBadge = "text-warning font-extrabold text-sm"
                      else if (index === 1) rankBadge = "text-muted font-bold text-sm"
                      else if (index === 2) rankBadge = "text-text font-bold text-sm"

                      return (
                        <tr key={model.id || index} className="hover:bg-surface-2/60 transition">
                          <td className={`px-5 py-3.5 text-center ${rankBadge}`}>
                            #{index + 1}
                          </td>
                          <td className="px-5 py-3.5">
                            <Link
                              to={`/models/${model.ollama_tag || model.id}`}
                              className="font-bold text-text hover:text-primary transition text-sm block"
                            >
                              {model.name}
                            </Link>
                            {model.quant && (
                              <span className="text-[10px] text-muted font-normal">
                                Quant: {model.quant}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-muted hidden sm:table-cell uppercase">
                            {model.family}
                          </td>
                          <td className="px-4 py-3.5 text-text font-mono">
                            {model.params_b}B
                          </td>

                          {metric === 'speed' && (
                            <>
                              <td className="px-4 py-3.5 text-text truncate max-w-[180px]" title={model.gpu_name}>
                                {model.gpu_name || 'Physical Hardware'}
                              </td>
                              <td className="px-4 py-3.5 text-muted">
                                {model.measured_at ? new Date(model.measured_at).toLocaleDateString() : 'Recent'}
                              </td>
                            </>
                          )}

                          <td className="px-4 py-3.5 text-right font-mono font-bold text-primary text-sm">
                            {model.metric_value !== undefined ? model.metric_value : model.quality_score}
                          </td>
                          <td className="px-4 py-3.5 text-muted hidden md:table-cell font-mono text-right">
                            {model.min_vram_gb ? `${model.min_vram_gb.toFixed(1)} GB` : '—'}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <Link
                              to={`/models/${model.ollama_tag || model.id}`}
                              className="inline-flex items-center gap-1 text-[11px] font-mono border border-line hover:border-primary hover:text-primary px-2.5 py-1 rounded-btn transition"
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
            </div>
          </>
        )}

        {/* Ad slot below table */}
        <AdSlot slot="leaderboard-below-table" format="banner" className="mt-12" />
      </div>
    </>
  )
}
