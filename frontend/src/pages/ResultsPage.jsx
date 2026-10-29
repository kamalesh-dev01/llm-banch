import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion, AnimatePresence } from 'framer-motion'
import { getScanResults, updateSessionVram, getGpus } from '../api/client'
import useHardwareStore from '../store/hardwareStore'
import AdSlot from '../components/AdSlot'
import { 
  Cpu, 
  Monitor, 
  HardDrive, 
  Server, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Filter, 
  Copy, 
  Check, 
  RotateCcw, 
  ArrowRight, 
  Zap, 
  Clock, 
  Layers, 
  ChevronRight,
  Sparkles,
  Download,
  Terminal,
  Sliders
} from 'lucide-react'

// Helper to shorten verbose GPU names
function getShortGpuName(fullName = '') {
  return fullName
    .replace(/^NVIDIA\s+GeForce\s+/i, '')
    .replace(/^NVIDIA\s+/i, '')
    .replace(/^AMD\s+Radeon\s+/i, '')
    .replace(/^AMD\s+/i, '')
    .replace(/^Intel\s+/i, '')
    .replace(/\s+Laptop\s+GPU/i, ' Laptop')
    .replace(/\s+Graphics/i, '')
    .trim()
}

export default function ResultsPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { setToken, setHardware } = useHardwareStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [resultsData, setResultsData] = useState(null)

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState('gpu') // 'gpu' | 'offload' | 'heavy' | 'too_large'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTask, setSelectedTask] = useState('all')
  const [sortBy, setSortBy] = useState('quality') // 'quality' | 'params_asc' | 'params_desc' | 'speed'

  // Clipboard copy feedback
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedOllama, setCopiedOllama] = useState(null)

  // Inline VRAM Selector (when VRAM is 0)
  const [overrideVram, setOverrideVram] = useState(4)
  const [isUpdatingVram, setIsUpdatingVram] = useState(false)

  const fetchResults = async () => {
    if (!token) {
      setError('No scan token provided.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await getScanResults(token)
      if (res.status === 202) {
        setError({
          type: 'pending',
          message: 'Hardware scan is still pending. Please run the scanner application to submit your specs.',
        })
      } else {
        setResultsData(res.data)
        setToken(token)
        if (res.data?.hardware) {
          setHardware(res.data.hardware)
        }
      }
    } catch (err) {
      const status = err.response?.status
      if (status === 410) {
        setError({
          type: 'expired',
          message: 'This scan session has expired (sessions last 30 minutes). Please run a quick scan again.',
        })
      } else if (status === 404) {
        setError({
          type: 'not_found',
          message: 'Scan results not found. Please check your link or perform a new hardware scan.',
        })
      } else {
        setError({
          type: 'network',
          message: 'Could not connect to the LLM Bench server. Please try again.',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchResults()
  }, [token])

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleCopyOllama = (cmd, modelId) => {
    navigator.clipboard.writeText(cmd)
    setCopiedOllama(modelId)
    setTimeout(() => setCopiedOllama(null), 2000)
  }

  const handleVramSubmit = async (e) => {
    e.preventDefault()
    setIsUpdatingVram(true)
    try {
      await updateSessionVram(token, parseFloat(overrideVram))
      await fetchResults()
    } catch (err) {
      console.error('Failed to update VRAM:', err)
    } finally {
      setIsUpdatingVram(false)
    }
  }

  // Derive unique tasks for filter dropdown
  const allTasks = React.useMemo(() => {
    if (!resultsData?.models) return []
    const set = new Set()
    resultsData.models.forEach(m => {
      if (Array.isArray(m.tasks)) {
        m.tasks.forEach(t => set.add(t))
      }
    })
    return Array.from(set).sort()
  }, [resultsData])

  // Filter & sort models in active tab
  const filteredModels = React.useMemo(() => {
    if (!resultsData?.models) return []
    let list = resultsData.models.filter(m => m.tier === activeTab)

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(m => 
        m.name.toLowerCase().includes(q) ||
        m.family.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q))
      )
    }

    // Task filter
    if (selectedTask !== 'all') {
      list = list.filter(m => Array.isArray(m.tasks) && m.tasks.includes(selectedTask))
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'quality') {
        return (b.quality_score || 0) - (a.quality_score || 0)
      } else if (sortBy === 'params_asc') {
        return (a.params_b || 0) - (b.params_b || 0)
      } else if (sortBy === 'params_desc') {
        return (b.params_b || 0) - (a.params_b || 0)
      } else if (sortBy === 'speed') {
        // Models with in_range speed first, fastest first
        const tpsA = a.in_range && a.tps !== null ? a.tps : -1
        const tpsB = b.in_range && b.tps !== null ? b.tps : -1
        return tpsB - tpsA
      }
      return 0
    })

    return list
  }, [resultsData, activeTab, searchQuery, selectedTask, sortBy])

  // --------------------------------------------------------------------------
  // Loading Skeleton State
  // --------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-text py-10 max-w-5xl mx-auto px-4 sm:px-6 animate-pulse space-y-6">
        <div className="h-8 w-64 bg-surface-2 rounded-btn" />
        <div className="h-40 bg-surface rounded-card border border-line" />
        <div className="h-16 bg-surface-2 rounded-card" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-48 bg-surface rounded-card border border-line" />
          ))}
        </div>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // Error States (Pending, Expired, Not Found)
  // --------------------------------------------------------------------------
  if (error) {
    return (
      <div className="min-h-screen bg-bg text-text py-16 max-w-xl mx-auto px-4 text-center">
        <div className="p-8 rounded-card bg-surface border border-line shadow-card space-y-5">
          <div className="w-12 h-12 rounded-full bg-warning-soft text-warning flex items-center justify-center mx-auto">
            <AlertTriangle size={24} />
          </div>
          <h1 className="text-xl font-bold text-text">
            {error.type === 'pending' ? 'Scan In Progress' : 'Scan Not Available'}
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            {error.message}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link
              to="/check"
              className="px-5 py-2.5 rounded-btn bg-primary text-white text-xs font-semibold shadow-soft hover:bg-primary-hover transition"
            >
              Start New Scan
            </Link>
            <button
              onClick={fetchResults}
              className="px-4 py-2.5 rounded-btn bg-surface-2 text-text text-xs font-medium border border-line hover:bg-surface transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  const hw = resultsData?.hardware || {}
  const counts = resultsData?.tier_counts || { gpu: 0, offload: 0, heavy: 0, too_large: 0, total: 0 }
  const shortGpu = getShortGpuName(hw.gpu_name)

  return (
    <div className="min-h-screen bg-bg text-text py-8 sm:py-12">
      <Helmet>
        <title>Hardware Compatibility Report &bull; LLM Bench</title>
        <meta name="description" content={`Model compatibility results for ${hw.gpu_name || 'your PC'}.`} />
      </Helmet>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* ======================================================== */}
        {/* 1. HARDWARE CARD                                         */}
        {/* ======================================================== */}
        <section className="bg-surface border border-line rounded-card p-6 sm:p-7 shadow-card relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-line">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-success"></span>
                <span className="text-xs font-mono uppercase tracking-wider text-muted font-bold">
                  Hardware Profile
                </span>
                {hw.vram_source === 'database' && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-2 border border-line text-muted">
                    VRAM from database
                  </span>
                )}
                {hw.vram_source === 'user' && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary-soft text-primary border border-primary/20">
                    User selected
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-text tracking-tight">
                {shortGpu || 'Detected Hardware'} &bull; {hw.vram_gb} GB VRAM
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-btn bg-surface-2 hover:bg-surface border border-line text-xs font-medium text-text transition cursor-pointer"
                title="Copy shareable link to results"
              >
                {copiedLink ? <Check size={14} className="text-success" /> : <Copy size={14} className="text-muted" />}
                <span>{copiedLink ? 'Copied link' : 'Copy link'}</span>
              </button>

              <Link
                to="/check"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-btn bg-primary-soft hover:bg-primary/20 text-primary text-xs font-semibold transition"
              >
                <RotateCcw size={13} />
                <span>Scan again</span>
              </Link>
            </div>
          </div>

          {/* Hardware Specs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 text-xs">
            {/* GPU */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted font-mono text-[11px]">
                <Monitor size={14} className="text-primary" />
                <span>Graphics (GPU)</span>
              </div>
              <div className="font-semibold text-text text-sm truncate" title={hw.gpu_name}>
                {shortGpu || hw.gpu_name}
              </div>
              <div className="text-muted font-mono text-[11px]">{hw.vram_gb} GB Dedicated VRAM</div>
            </div>

            {/* RAM */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted font-mono text-[11px]">
                <Layers size={14} className="text-primary" />
                <span>System Memory</span>
              </div>
              <div className="font-semibold text-text text-sm">{hw.ram_gb} GB RAM</div>
              <div className="text-muted font-mono text-[11px]">Dual-channel bandwidth</div>
            </div>

            {/* CPU */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted font-mono text-[11px]">
                <Cpu size={14} className="text-primary" />
                <span>Processor</span>
              </div>
              <div className="font-semibold text-text text-sm truncate" title={hw.cpu_name}>
                {hw.cpu_name}
              </div>
              <div className="text-muted font-mono text-[11px]">{hw.cpu_cores} Physical Cores</div>
            </div>

            {/* Disk & OS */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted font-mono text-[11px]">
                <HardDrive size={14} className="text-primary" />
                <span>Free Storage</span>
              </div>
              <div className="font-semibold text-text text-sm">{hw.disk_free_gb} GB Free</div>
              <div className="text-muted font-mono text-[11px]">{hw.os}</div>
            </div>
          </div>

          {/* Inline VRAM Selector when VRAM is 0 */}
          {hw.vram_gb === 0 && (
            <div className="mt-5 pt-4 border-t border-line bg-warning-soft/40 p-4 rounded-card flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="space-y-1 text-left">
                <span className="font-bold text-text block">VRAM not detected</span>
                <span className="text-muted">
                  Your GPU was identified, but dedicated VRAM capacity couldn&apos;t be read automatically. Select your card&apos;s VRAM:
                </span>
              </div>
              <form onSubmit={handleVramSubmit} className="flex items-center gap-2">
                <select
                  value={overrideVram}
                  onChange={(e) => setOverrideVram(e.target.value)}
                  className="px-3 py-1.5 rounded-btn bg-surface border border-line text-xs font-mono font-semibold"
                >
                  <option value={2}>2 GB</option>
                  <option value={4}>4 GB</option>
                  <option value={6}>6 GB</option>
                  <option value={8}>8 GB</option>
                  <option value={12}>12 GB</option>
                  <option value={16}>16 GB</option>
                  <option value={24}>24 GB</option>
                </select>
                <button
                  type="submit"
                  disabled={isUpdatingVram}
                  className="px-3 py-1.5 rounded-btn bg-primary text-white text-xs font-semibold cursor-pointer"
                >
                  {isUpdatingVram ? 'Saving...' : 'Update'}
                </button>
              </form>
            </div>
          )}
        </section>

        {/* ======================================================== */}
        {/* 2. REAL SUMMARY BANNER                                   */}
        {/* ======================================================== */}
        <section className="p-5 sm:p-6 rounded-card bg-surface-2 border border-line shadow-soft flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold text-text">
              Your PC runs <span className="text-success font-extrabold">{counts.gpu} models</span> fully on GPU,{' '}
              <span className="text-primary font-extrabold">{counts.offload}</span> with CPU help;{' '}
              <span className="text-muted font-bold">{counts.too_large}</span> are too large.
            </h2>
            <p className="text-xs text-muted">
              Model parameters, quantized footprints, and token generation rates are calculated directly for your hardware.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="px-2.5 py-1 rounded-pill bg-success-soft text-success border border-success/30 font-bold">
              {counts.gpu} GPU
            </span>
            <span className="px-2.5 py-1 rounded-pill bg-primary-soft text-primary border border-primary/30 font-bold">
              {counts.offload} Offload
            </span>
            <span className="px-2.5 py-1 rounded-pill bg-warning-soft text-warning border border-warning/30 font-bold">
              {counts.heavy} Slow
            </span>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 3. TIER TABS & FILTERS                                   */}
        {/* ======================================================== */}
        <section className="space-y-5">
          {/* Tabs Bar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
            {[
              { id: 'gpu', label: 'Runs on GPU', count: counts.gpu, color: 'text-success' },
              { id: 'offload', label: 'Runs with CPU help', count: counts.offload, color: 'text-primary' },
              { id: 'heavy', label: 'Very slow', count: counts.heavy, color: 'text-warning' },
              { id: 'too_large', label: 'Too large', count: counts.too_large, color: 'text-danger' },
            ].map(tab => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-btn text-xs sm:text-sm font-semibold transition flex items-center gap-2 cursor-pointer ${
                    isActive 
                      ? 'bg-primary text-white shadow-soft' 
                      : 'bg-surface hover:bg-surface-2 text-muted hover:text-text border border-line'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-surface-2 text-muted'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Search, Task Filter & Sort Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
            <div className="relative flex-grow max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models or families..."
                className="w-full pl-9 pr-3 py-2 rounded-btn bg-surface border border-line text-text placeholder-muted focus:outline-none focus:border-primary font-sans"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Task filter */}
              <select
                value={selectedTask}
                onChange={(e) => setSelectedTask(e.target.value)}
                className="px-3 py-2 rounded-btn bg-surface border border-line text-text focus:outline-none focus:border-primary font-sans cursor-pointer"
              >
                <option value="all">All tasks</option>
                {allTasks.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              {/* Sort selector */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 rounded-btn bg-surface border border-line text-text focus:outline-none focus:border-primary font-sans cursor-pointer"
              >
                <option value="quality">Sort: Quality score</option>
                <option value="speed">Sort: Measured speed</option>
                <option value="params_asc">Sort: Parameters (smallest)</option>
                <option value="params_desc">Sort: Parameters (largest)</option>
              </select>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 4. MODEL LIST CARDS                                      */}
          {/* ======================================================== */}
          {filteredModels.length === 0 ? (
            <div className="p-12 text-center rounded-card bg-surface border border-line text-muted text-sm space-y-2">
              <p className="font-semibold text-text">No models found in this tier</p>
              <p className="text-xs">Try switching tabs or resetting your search filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredModels.map((m, idx) => (
                <div
                  key={m.model_id}
                  className="bg-surface border border-line hover:border-primary/40 rounded-card p-5 shadow-soft transition-all space-y-4 flex flex-col justify-between group"
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <Link
                        to={`/results/${token}/${m.model_id}`}
                        className="font-bold text-base text-text group-hover:text-primary transition flex items-center gap-1.5"
                      >
                        <span>{m.name}</span>
                        <ChevronRight size={15} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-primary" />
                      </Link>

                      <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-surface-2 border border-line text-muted">
                        {m.family}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs text-muted mb-2">
                      <span className="text-primary font-semibold">{m.params_b}B params</span>
                      <span>&bull;</span>
                      <span>Quality: {(m.quality_score * 100).toFixed(0)}%</span>
                      <span>&bull;</span>
                      <span className="font-semibold text-text bg-surface-2 px-1.5 py-0.2 rounded border border-line">
                        {m.best_quant}
                      </span>
                    </div>

                    <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                      {m.description}
                    </p>
                  </div>

                  {/* Memory & Offload Bar */}
                  <div className="space-y-1.5 text-xs font-mono pt-2 border-t border-line">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted">GPU Offload</span>
                      <span className="font-semibold text-text">{(m.offload_fraction * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden border border-line">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          m.offload_fraction >= 0.95 ? 'bg-success' : m.offload_fraction >= 0.40 ? 'bg-primary' : 'bg-warning'
                        }`}
                        style={{ width: `${Math.min(100, m.offload_fraction * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted">
                      <span>File: {m.file_size_gb} GB</span>
                      <span>Footprint: {m.footprint_gb} GB</span>
                    </div>
                  </div>

                  {/* Speed Line Rule: In Range vs Extrapolated */}
                  <div className="p-2.5 rounded-btn bg-surface-2 border border-line flex items-center justify-between text-xs font-mono">
                    <span className="text-muted text-[11px]">Speed:</span>
                    {m.in_range && m.tps !== null ? (
                      <span className="font-bold text-success">
                        ~{m.tps} tok/s ({m.tps_range?.[0] || m.tps} - {m.tps_range?.[1] || m.tps} tok/s)
                      </span>
                    ) : (
                      <span className="text-muted text-[11px] italic">
                        Slow - we have no measured speed for this size yet
                      </span>
                    )}
                  </div>

                  {/* Plain English Reason */}
                  <div className="text-[11px] text-muted leading-relaxed">
                    {m.reason}
                  </div>

                  {/* Footer: Copy Ollama command & Link to Details */}
                  <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleCopyOllama(m.ollama_command, m.model_id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-surface-2 hover:bg-surface border border-line text-xs font-mono text-text transition cursor-pointer"
                      title="Copy Ollama run command"
                    >
                      <Terminal size={12} className="text-muted" />
                      <span>{copiedOllama === m.model_id ? 'Copied!' : m.ollama_command}</span>
                      {copiedOllama === m.model_id ? <Check size={12} className="text-success" /> : <Copy size={12} className="text-muted" />}
                    </button>

                    <Link
                      to={`/results/${token}/${m.model_id}`}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      <span>Check spec</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ======================================================== */}
        {/* 5. AD SLOT BELOW THE LIST (AWAY FROM BUTTONS)            */}
        {/* ======================================================== */}
        <section className="pt-6">
          <AdSlot slotId="results-bottom" />
        </section>

      </div>
    </div>
  )
}
