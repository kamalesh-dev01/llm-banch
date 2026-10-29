import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  getModel, 
  getModelBenchmarks, 
  getModelRequirements, 
  getSimilarModels, 
  getVerdict, 
  getGpus, 
  getHardwareScan 
} from '../api/client'
import useHardwareStore from '../store/hardwareStore'
import MlInsight from '../components/MlInsight'
import ModelCard from '../components/ModelCard'
import AdSlot from '../components/AdSlot'
import { 
  ArrowLeft, 
  Copy, 
  Check, 
  Terminal, 
  ExternalLink, 
  Cpu, 
  Monitor, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Zap, 
  Calendar, 
  Download, 
  Heart, 
  Globe, 
  Shield, 
  Clock, 
  Eye, 
  Wrench, 
  Sparkles, 
  Binary, 
  HelpCircle,
  HardDrive
} from 'lucide-react'

// Family soft gradient and accent configuration
const FAMILY_CONFIG = {
  llama: {
    gradient: 'from-accent/25 via-accent/10 to-transparent',
    border: 'border-accent/40',
    badge: 'bg-accent/10 text-accent border-accent/30',
    glow: 'rgba(168, 85, 247, 0.15)',
  },
  qwen: {
    gradient: 'from-primary/25 via-primary/10 to-transparent',
    border: 'border-primary/40',
    badge: 'bg-primary-soft text-primary border-primary/30',
    glow: 'rgba(56, 189, 248, 0.15)',
  },
  phi: {
    gradient: 'from-success/25 via-success/10 to-transparent',
    border: 'border-success/40',
    badge: 'bg-success-soft text-success border-success/30',
    glow: 'rgba(34, 197, 94, 0.15)',
  },
  mistral: {
    gradient: 'from-warning/25 via-warning/10 to-transparent',
    border: 'border-warning/40',
    badge: 'bg-warning-soft text-warning border-warning/30',
    glow: 'rgba(234, 179, 8, 0.15)',
  },
  gemma: {
    gradient: 'from-danger/25 via-danger/10 to-transparent',
    border: 'border-danger/40',
    badge: 'bg-danger-soft text-danger border-danger/30',
    glow: 'rgba(239, 68, 68, 0.15)',
  },
  deepseek: {
    gradient: 'from-primary/25 via-primary/10 to-transparent',
    border: 'border-primary/40',
    badge: 'bg-primary-soft text-primary border-primary/30',
    glow: 'rgba(56, 189, 248, 0.15)',
  },
}

function getFamilyConfig(family = '') {
  const key = family.toLowerCase().trim()
  return FAMILY_CONFIG[key] || {
    gradient: 'from-surface-2 via-surface-2/60 to-transparent',
    border: 'border-line',
    badge: 'bg-surface-2 text-text border-line',
    glow: 'rgba(255, 255, 255, 0.05)',
  }
}

export default function ModelDetailPage() {
  const { ref } = useParams()
  const navigate = useNavigate()
    const { hardware, setHardware, token } = useHardwareStore()

  // Auto-fetch hardware specs into store if token exists in localStorage
  useEffect(() => {
    if (token && !hardware) {
      getHardwareScan(token)
        .then(res => {
          if (res.data && res.data.status !== 'pending') {
            setHardware(res.data)
          }
        })
        .catch(() => {})
    }
  }, [token, hardware, setHardware])

  // Main state
  const [model, setModel] = useState(null)
  const [benchmarks, setBenchmarks] = useState([])
  const [requirements, setRequirements] = useState(null)
  const [similarModels, setSimilarModels] = useState([])
  const [verdictData, setVerdictData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Interactive controls
  const [selectedQuant, setSelectedQuant] = useState(null)
  const [requirementsTab, setRequirementsTab] = useState('both') // 'both' | 'min' | 'rec'
  const [howToRunTab, setHowToRunTab] = useState('ollama') // 'ollama' | 'gguf' | 'hf'
  const [copiedCmd, setCopiedCmd] = useState(null)

  // Standalone GPU Picker (when no scan exists)
  const [gpuList, setGpuList] = useState([])
  const [selectedGpuVram, setSelectedGpuVram] = useState(4.0)

  // Load Model and associated data
  useEffect(() => {
    if (!ref) return
    setLoading(true)
    setError(null)

    getModel(ref)
      .then(async (res) => {
        const m = res.data
        setModel(m)

        // Select default quant
        const defaultQuant = m.quants && m.quants.length > 0 ? m.quants[0].quant : 'Q4_K_M'
        setSelectedQuant(defaultQuant)

        // Parallel fetch: benchmarks, requirements, similar models
        try {
          const [benchRes, reqRes, simRes] = await Promise.all([
            getModelBenchmarks(ref).catch(() => ({ data: [] })),
            getModelRequirements(ref, defaultQuant, token).catch(() => ({ data: null })),
            getSimilarModels(ref, 4).catch(() => ({ data: [] }))
          ])

          setBenchmarks(benchRes.data || [])
          setRequirements(reqRes.data)
          setSimilarModels(simRes.data || [])
        } catch (err) {
          console.error('Error fetching supporting store data:', err)
        }

        // Fetch verdict if user has hardware scan token
        if (token && m.id) {
          try {
            const vRes = await getVerdict(m.id, token, defaultQuant)
            setVerdictData(vRes.data)
          } catch (err) {
            console.warn('Could not load hardware verdict:', err)
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load model:', err)
        setError(err.response?.status === 404 ? 'Model not found' : 'Failed to load model details')
      })
      .finally(() => setLoading(false))
  }, [ref, token])

  // Load GPU list for offline GPU picker
  useEffect(() => {
    if (!token) {
      getGpus()
        .then(res => {
          const gpus = res.data?.gpus || []
          setGpuList(gpus)
        })
        .catch(() => {})
    }
  }, [token])

  // Refetch requirements when user selects a different quant
  const handleQuantSelect = (quantName) => {
    setSelectedQuant(quantName)
    if (model) {
      getModelRequirements(model.id || ref, quantName, token)
        .then(res => setRequirements(res.data))
        .catch(err => console.error(err))

      if (token && model.id) {
        getVerdict(model.id, token, quantName)
          .then(res => setVerdictData(res.data))
          .catch(() => {})
      }
    }
  }

  const handleCopy = (text, key) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedCmd(key)
    setTimeout(() => setCopiedCmd(null), 2000)
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-8">
        <div className="h-6 w-32 shimmer rounded mb-6" />
        <div className="h-64 w-full shimmer rounded-card border border-line mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <div className="h-40 shimmer rounded-card border border-line" />
            <div className="h-64 shimmer rounded-card border border-line" />
          </div>
          <div className="lg:col-span-4">
            <div className="h-80 shimmer rounded-card border border-line" />
          </div>
        </div>
      </div>
    )
  }

  // Not found or error
  if (error || !model) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <div className="p-8 max-w-md mx-auto bg-surface border border-line rounded-card shadow-soft">
          <AlertTriangle size={36} className="text-warning mx-auto mb-4" />
          <h2 className="text-xl font-bold text-text mb-2">{error || 'Model not found'}</h2>
          <p className="text-muted text-xs font-mono mb-6">
            The model reference &quot;{ref}&quot; could not be located in our database.
          </p>
          <Link
            to="/models"
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-btn text-xs font-mono font-semibold transition"
          >
            Browse Models
          </Link>
        </div>
      </div>
    )
  }

  // Parse structured data safely
  let capabilities = []
  try {
    if (typeof model.capabilities === 'string') {
      capabilities = JSON.parse(model.capabilities)
    } else if (Array.isArray(model.capabilities)) {
      capabilities = model.capabilities
    }
  } catch (e) {
    capabilities = []
  }

  let tasks = []
  try {
    if (typeof model.tasks === 'string') {
      tasks = JSON.parse(model.tasks)
    } else if (Array.isArray(model.tasks)) {
      tasks = model.tasks
    }
  } catch (e) {
    tasks = []
  }

  let languages = []
  try {
    if (typeof model.languages === 'string') {
      languages = JSON.parse(model.languages)
    } else if (Array.isArray(model.languages)) {
      languages = model.languages
    }
  } catch (e) {
    languages = []
  }

  // File size range across quants
  let minFileSize = 0
  let maxFileSize = 0
  if (model.quants && model.quants.length > 0) {
    const sizes = model.quants.map(q => q.size_gb).filter(s => s && s > 0)
    if (sizes.length > 0) {
      minFileSize = Math.min(...sizes)
      maxFileSize = Math.max(...sizes)
    }
  }

  const famConfig = getFamilyConfig(model.family)
  const currentQuantObj = model.quants?.find(q => q.quant === selectedQuant) || model.quants?.[0]
  const ollamaTag = model.ollama_tag || model.name.toLowerCase().replace(/\s+/g, '')
  const pullCommand = `ollama run ${ollamaTag}`

  // Offline tier calculation when no token exists
  const offlineTier = (() => {
    if (!currentQuantObj) return 'heavy'
    const fp = (currentQuantObj.size_gb || 4.0) * 1.1 + 0.1
    const offload = Math.max(0, (selectedGpuVram - 0.5) / fp)
    if (offload >= 0.95) return 'gpu'
    if (offload >= 0.40) return 'offload'
    return 'heavy'
  })()

  // Active verdict tier: strictly follows hardware scan when token exists, else offlineTier
  const activeTier = token ? (
    verdictData ? (
      verdictData.verdict === 'recommended' ? 'gpu' : (verdictData.verdict === 'minimum' ? 'offload' : 'heavy')
    ) : 'offload'
  ) : offlineTier

  const tierBadgeMap = {
    gpu: { label: 'Runs on GPU', style: 'bg-success-soft text-success border-success/30' },
    offload: { label: 'Runs with CPU help', style: 'bg-primary-soft text-primary border-primary/30' },
    heavy: { label: 'Very slow', style: 'bg-warning-soft text-warning border-warning/30' },
    too_large: { label: 'Too large', style: 'bg-danger-soft text-danger border-danger/30' },
  }

  return (
    <>
      <Helmet>
        <title>{model.name} — LLM Bench</title>
        <meta
          name="description"
          content={model.tagline || model.about || `${model.name} (${model.params_b}B parameters) model specifications, system requirements, and measured benchmark performance.`}
        />
        <meta property="og:title" content={`${model.name} — Store & Specs`} />
        <meta property="og:description" content={model.tagline || model.description || ''} />
      </Helmet>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-6 pb-24">
        {/* Breadcrumb navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-mono text-muted mb-6">
          <Link to="/" className="hover:text-text transition">Home</Link>
          <span>/</span>
          <Link to="/models" className="hover:text-text transition">Models</Link>
          <span>/</span>
          {model.family && (
            <>
              <Link to={`/models?family=${model.family}`} className="hover:text-text transition capitalize">
                {model.family}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-text font-bold truncate max-w-[200px] sm:max-w-none">{model.name}</span>
        </nav>

        {/* HERO BAND with soft family gradient */}
        <div className={`relative overflow-hidden rounded-card border ${famConfig.border} bg-surface p-6 sm:p-10 mb-8 shadow-card`}>
          {/* Subtle gradient background */}
          <div className={`absolute inset-0 bg-gradient-to-br ${famConfig.gradient} opacity-40 pointer-events-none`} />

          <div className="relative z-10 max-w-4xl">
            {/* Title & Family badge */}
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-text tracking-tight">
                {model.name}
              </h1>
              {model.family && (
                <span className={`px-3 py-1 rounded-pill text-xs font-mono font-bold uppercase tracking-wider border ${famConfig.badge}`}>
                  {model.family}
                </span>
              )}
            </div>

            {/* Tagline from Ollama og:description */}
            {model.tagline && (
              <p className="text-base sm:text-lg text-text/90 font-medium mb-5 leading-relaxed">
                {model.tagline}
              </p>
            )}

            {/* Capability and task chips */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              {capabilities.map((cap) => (
                <span
                  key={cap}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-btn bg-surface-2 border border-line text-xs font-mono font-semibold text-text capitalize"
                >
                  {cap === 'vision' && <Eye size={13} className="text-accent" />}
                  {cap === 'tools' && <Wrench size={13} className="text-primary" />}
                  {cap === 'thinking' && <Sparkles size={13} className="text-warning" />}
                  {cap === 'embedding' && <Binary size={13} className="text-success" />}
                  {cap}
                </span>
              ))}

              {tasks.map((task) => (
                <span
                  key={task}
                  className="px-2.5 py-1 rounded-btn bg-surface/80 border border-line text-xs font-mono text-muted uppercase tracking-wider"
                >
                  {task}
                </span>
              ))}
            </div>

            {/* Fact ribbon */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs font-mono text-muted pt-4 border-t border-line/60">
              {model.publisher && (
                <div>
                  <span className="text-muted/70">Publisher:</span>{' '}
                  <span className="text-text font-bold">{model.publisher}</span>
                </div>
              )}
              {model.released_at && (
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-muted" />
                  <span>Published {new Date(model.released_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}</span>
                </div>
              )}
              {model.licence && (
                <div className="flex items-center gap-1.5">
                  <Shield size={13} className="text-muted" />
                  <span className="capitalize">{model.licence}</span>
                </div>
              )}
              {model.context_length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Clock size={13} className="text-muted" />
                  <span>{model.context_length.toLocaleString()} Context</span>
                </div>
              )}
              {model.params_b > 0 && (
                <div>
                  <span className="text-primary font-bold">{model.params_b}B</span> params
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TWO-COLUMN LAYOUT: Store Left (Content) + Store Right (Sticky Cart/Card) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ========================================================================= */}
          {/* LEFT COLUMN: Deep Specifications, Benchmarks & Requirements */}
          {/* ========================================================================= */}
          <div className="lg:col-span-8 space-y-10">

            {/* 1. About this model */}
            {(model.about || model.description) && (
              <section className="bg-surface border border-line rounded-card p-6 sm:p-8 shadow-soft">
                <h2 className="text-lg sm:text-xl font-bold text-text mb-4 flex items-center gap-2">
                  About this model
                </h2>
                <div className="text-sm text-text/85 leading-relaxed font-sans whitespace-pre-wrap">
                  {model.about || model.description}
                </div>
              </section>
            )}

            {/* 2. Highlights Grid */}
            <section className="bg-surface border border-line rounded-card p-6 sm:p-8 shadow-soft">
              <h2 className="text-lg sm:text-xl font-bold text-text mb-4">
                Highlights &amp; Specifications
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 font-mono text-xs">
                <div className="bg-surface-2 p-3.5 rounded-btn border border-line">
                  <div className="text-muted uppercase tracking-wider mb-1">Parameters</div>
                  <div className="text-base font-bold text-primary">{model.params_b}B</div>
                </div>
                <div className="bg-surface-2 p-3.5 rounded-btn border border-line">
                  <div className="text-muted uppercase tracking-wider mb-1">Context Window</div>
                  <div className="text-base font-bold text-text">
                    {model.context_length ? `${(model.context_length / 1024).toFixed(0)}k` : 'N/A'}
                  </div>
                </div>
                <div className="bg-surface-2 p-3.5 rounded-btn border border-line">
                  <div className="text-muted uppercase tracking-wider mb-1">File Size Range</div>
                  <div className="text-base font-bold text-text">
                    {minFileSize > 0 ? `${minFileSize.toFixed(1)} – ${maxFileSize.toFixed(1)} GB` : 'N/A'}
                  </div>
                </div>
                <div className="bg-surface-2 p-3.5 rounded-btn border border-line">
                  <div className="text-muted uppercase tracking-wider mb-1">Input Modalities</div>
                  <div className="text-base font-bold text-text">
                    {capabilities.includes('vision') ? 'Text, Vision' : 'Text'}
                  </div>
                </div>
                <div className="bg-surface-2 p-3.5 rounded-btn border border-line">
                  <div className="text-muted uppercase tracking-wider mb-1">
                    {model.quality_source && model.quality_source !== 'size_estimate' ? 'Quality Score' : 'Size Class'}
                  </div>
                  <div className="text-base font-bold text-text">
                    {model.quality_source && model.quality_source !== 'size_estimate' 
                      ? `${Math.round((model.quality_score || 0) * 100)}%`
                      : (model.params_b < 2 ? 'Tiny (<2B)' : model.params_b < 5 ? 'Small (2-5B)' : model.params_b <= 10 ? 'Medium (5-10B)' : 'Large (>10B)')}
                  </div>
                </div>
                {languages.length >= 2 && (
                  <div className="bg-surface-2 p-3.5 rounded-btn border border-line col-span-2">
                    <div className="text-muted uppercase tracking-wider mb-1">Supported Languages</div>
                    <div className="text-xs font-bold text-text truncate">
                      {languages.join(', ').toUpperCase()}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 3. MEASURED PERFORMANCE (/api/models/{id}/benchmarks) */}
            <section className="bg-surface border border-line rounded-card p-6 sm:p-8 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-text flex items-center gap-2">
                    <Zap size={20} className="text-primary" />
                    Measured Performance
                  </h2>
                  <p className="text-xs font-mono text-muted mt-1">
                    Verified inference benchmarks recorded on actual physical hardware.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-surface-2 border border-line rounded-pill text-[11px] font-mono text-muted">
                  {benchmarks.length} verified run{benchmarks.length !== 1 ? 's' : ''}
                </span>
              </div>

              {benchmarks.length === 0 ? (
                <div className="p-8 text-center bg-surface-2 border border-line rounded-btn font-mono text-xs text-muted">
                  Not benchmarked yet — official benchmark runs on real test machines will appear here.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-line text-muted uppercase tracking-wider">
                        <th className="pb-3 font-semibold">Test Machine / GPU</th>
                        <th className="pb-3 font-semibold">Quant</th>
                        <th className="pb-3 font-semibold text-right">Speed</th>
                        <th className="pb-3 font-semibold text-right">TTFT</th>
                        <th className="pb-3 font-semibold text-right">% in VRAM</th>
                        <th className="pb-3 font-semibold text-right">Peak VRAM</th>
                        <th className="pb-3 font-semibold text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {benchmarks.map((b) => {
                        const offloadPct = Math.round((b.offload_fraction || 1.0) * 100)
                        return (
                          <tr key={b.id} className="hover:bg-surface-2/60 transition">
                            <td className="py-3.5 pr-3">
                              <div className="font-bold text-text">{b.gpu_name || b.machine_label}</div>
                              <div className="text-[11px] text-muted">
                                {b.vram_gb} GB VRAM &bull; {b.ram_gb} GB RAM
                              </div>
                            </td>
                            <td className="py-3.5 pr-3">
                              <span className="px-2 py-0.5 bg-surface border border-line rounded text-[11px] font-semibold text-text">
                                {b.quant}
                              </span>
                            </td>
                            <td className="py-3.5 pr-3 text-right">
                              <div className="text-sm font-bold text-primary">{b.tokens_per_sec} tok/s</div>
                              {/* Visual Speed Bar */}
                              <div className="w-24 ml-auto bg-surface h-1.5 rounded-full overflow-hidden border border-line mt-1">
                                <div
                                  className="bg-primary h-full rounded-full"
                                  style={{ width: `${Math.min(100, (b.tokens_per_sec / 120) * 100)}%` }}
                                />
                              </div>
                            </td>
                            <td className="py-3.5 pr-3 text-right text-text">
                              {b.ttft_ms ? `${b.ttft_ms} ms` : '—'}
                            </td>
                            <td className="py-3.5 pr-3 text-right">
                              <span className={`font-semibold ${offloadPct >= 95 ? 'text-success' : 'text-warning'}`}>
                                {offloadPct}%
                              </span>
                            </td>
                            <td className="py-3.5 pr-3 text-right text-text">
                              {b.peak_vram_gb ? `${b.peak_vram_gb} GB` : '—'}
                            </td>
                            <td className="py-3.5 text-right text-muted text-[11px]">
                              {b.measured_at ? new Date(b.measured_at).toLocaleDateString() : 'Recent'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* 4. System Requirements (/api/models/{id}/requirements) */}
            <section className="bg-surface border border-line rounded-card p-6 sm:p-8 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-line">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-text flex items-center gap-2">
                    <Monitor size={20} className="text-primary" />
                    System Requirements
                  </h2>
                  <p className="text-xs font-mono text-muted mt-0.5">
                    Hardware thresholds calculated using real quantization memory footprints.
                  </p>
                </div>

                {/* Quantization picker */}
                {model.quants && model.quants.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted">Quant:</span>
                    <select
                      value={selectedQuant || ''}
                      onChange={(e) => handleQuantSelect(e.target.value)}
                      className="bg-surface-2 border border-line text-text px-2.5 py-1 rounded-btn text-xs font-mono font-semibold focus:outline-none focus:border-primary cursor-pointer"
                    >
                      {model.quants.map(q => (
                        <option key={q.quant} value={q.quant}>
                          {q.quant} ({q.size_gb} GB)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Requirements Table */}
              {requirements?.rows ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-line text-muted uppercase tracking-wider">
                        <th className="pb-3 font-semibold">Component</th>
                        <th className="pb-3 font-semibold">Minimum (40% GPU offload)</th>
                        <th className="pb-3 font-semibold">Recommended (Full GPU)</th>
                        {token && hardware && <th className="pb-3 font-semibold">Your System</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {requirements.rows.map((row) => (
                        <tr key={row.key} className="hover:bg-surface-2/40 transition">
                          <td className="py-3 font-bold text-text">{row.label}</td>
                          <td className="py-3 text-muted">{row.minimum}</td>
                          <td className="py-3 text-text font-semibold">{row.recommended}</td>
                          {token && hardware && (
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                {row.status === 'ok' && <CheckCircle2 size={15} className="text-success flex-shrink-0" />}
                                {row.status === 'warn' && <AlertTriangle size={15} className="text-warning flex-shrink-0" />}
                                {row.status === 'fail' && <XCircle size={15} className="text-danger flex-shrink-0" />}
                                <span className={row.status === 'ok' ? 'text-success font-semibold' : (row.status === 'fail' ? 'text-danger font-semibold' : 'text-text')}>
                                  {row.you_have || 'Detected'}
                                </span>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-xs font-mono text-muted shimmer rounded">
                  Calculating system requirements...
                </div>
              )}
            </section>

            {/* 5. Quantizations Table */}
            {model.quants && model.quants.length > 0 && (
              <section className="bg-surface border border-line rounded-card p-6 sm:p-8 shadow-soft">
                <h2 className="text-lg sm:text-xl font-bold text-text mb-4 flex items-center gap-2">
                  <Layers size={20} className="text-primary" />
                  Available Quantizations
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-line text-muted uppercase tracking-wider">
                        <th className="pb-3 font-semibold">Quantization</th>
                        <th className="pb-3 font-semibold">File Size</th>
                        <th className="pb-3 font-semibold">VRAM Needed</th>
                        <th className="pb-3 font-semibold">RAM Needed</th>
                        <th className="pb-3 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {model.quants.map((q) => {
                        const isSelected = q.quant === selectedQuant
                        return (
                          <tr
                            key={q.quant}
                            className={`hover:bg-surface-2/60 transition cursor-pointer ${isSelected ? 'bg-primary-soft/30' : ''}`}
                            onClick={() => handleQuantSelect(q.quant)}
                          >
                            <td className="py-3 font-bold text-text">
                              <span className="flex items-center gap-2">
                                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                                {q.quant}
                              </span>
                            </td>
                            <td className="py-3 text-muted">{q.size_gb} GB</td>
                            <td className="py-3 text-text font-semibold">{Math.max(2.0, (q.size_gb * 1.15 + 0.3)).toFixed(1)} GB</td>
                            <td className="py-3 text-muted">{Math.max(8.0, Math.ceil(q.size_gb * 1.5))} GB</td>
                            <td className="py-3 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleQuantSelect(q.quant)
                                }}
                                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${isSelected ? 'bg-primary text-white' : 'bg-surface-2 hover:bg-line text-muted'}`}
                              >
                                {isSelected ? 'Selected' : 'Select'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Single AdSlot placed below the quantizations table */}
            <AdSlot slot="model-detail-below-table" format="banner" className="my-8" />

            {/* 6. How to Run Tabs */}
            <section className="bg-surface border border-line rounded-card p-6 sm:p-8 shadow-soft">
              <h2 className="text-lg sm:text-xl font-bold text-text mb-4 flex items-center gap-2">
                <Terminal size={20} className="text-primary" />
                How to Run
              </h2>

              {/* Tabs */}
              <div className="flex border-b border-line mb-4 gap-2">
                <button
                  type="button"
                  onClick={() => setHowToRunTab('ollama')}
                  className={`pb-2.5 px-3 text-xs font-mono font-bold border-b-2 transition cursor-pointer ${howToRunTab === 'ollama' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}
                >
                  Ollama
                </button>
                <button
                  type="button"
                  onClick={() => setHowToRunTab('gguf')}
                  className={`pb-2.5 px-3 text-xs font-mono font-bold border-b-2 transition cursor-pointer ${howToRunTab === 'gguf' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}
                >
                  llama.cpp / GGUF
                </button>
                <button
                  type="button"
                  onClick={() => setHowToRunTab('hf')}
                  className={`pb-2.5 px-3 text-xs font-mono font-bold border-b-2 transition cursor-pointer ${howToRunTab === 'hf' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}
                >
                  Hugging Face
                </button>
              </div>

              {/* Tab Contents */}
              {howToRunTab === 'ollama' && (
                <div className="space-y-3 font-mono text-xs">
                  <p className="text-muted text-xs">Run this model locally using Ollama:</p>
                  <div
                    onClick={() => handleCopy(pullCommand, 'ollama-how')}
                    className="flex items-center justify-between p-3.5 bg-surface-2 border border-line rounded-btn hover:border-primary transition cursor-pointer group"
                  >
                    <code className="text-success font-bold truncate pr-3">{pullCommand}</code>
                    <button type="button" className="text-muted group-hover:text-text flex items-center gap-1 flex-shrink-0">
                      {copiedCmd === 'ollama-how' ? (
                        <span className="text-success flex items-center gap-1"><Check size={14} /> Copied!</span>
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {howToRunTab === 'gguf' && (
                <div className="space-y-3 font-mono text-xs">
                  <p className="text-muted text-xs">Direct GGUF weights for llama.cpp and LM Studio:</p>
                  {currentQuantObj?.gguf_url ? (
                    <a
                      href={currentQuantObj.gguf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-line border border-line rounded-btn text-text transition font-semibold"
                    >
                      <Download size={14} className="text-primary" />
                      <span>Download {selectedQuant} GGUF Weights</span>
                      <ExternalLink size={12} className="text-muted" />
                    </a>
                  ) : (
                    <div className="text-muted">GGUF download link not specified for this quantization.</div>
                  )}
                </div>
              )}

              {howToRunTab === 'hf' && (
                <div className="space-y-3 font-mono text-xs">
                  <p className="text-muted text-xs">Official model repository on Hugging Face:</p>
                  {model.hf_url ? (
                    <a
                      href={model.hf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-line border border-line rounded-btn text-text transition font-semibold"
                    >
                      <Globe size={14} className="text-primary" />
                      <span>View on Hugging Face ({model.hf_model_id})</span>
                      <ExternalLink size={12} className="text-muted" />
                    </a>
                  ) : (
                    <div className="text-muted">Hugging Face URL not available.</div>
                  )}
                </div>
              )}
            </section>

            {/* Reviews Slot (UI-4) */}
            {/* Reviews slot (UI-4) - reserved in layout, not rendered yet */}

            {/* 7. Similar Models */}
            {similarModels.length > 0 && (
              <section className="pt-6 border-t border-line">
                <h2 className="text-lg sm:text-xl font-bold text-text mb-6">
                  Similar Models
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {similarModels.map((sim, idx) => (
                    <ModelCard key={sim.id} model={sim} index={idx} />
                  ))}
                </div>
              </section>
            )}


          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: Sticky "Can you run it?" Action Card */}
          {/* ========================================================================= */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
            <div className="bg-surface border border-line rounded-card p-6 shadow-card">
              <h3 className="text-base font-bold text-text mb-3 flex items-center justify-between">
                <span>Can you run it?</span>
                <span className={`px-2.5 py-0.5 rounded-pill text-xs font-mono font-bold border ${tierBadgeMap[activeTier]?.style || 'bg-surface-2 text-muted'}`}>
                  {tierBadgeMap[activeTier]?.label}
                </span>
              </h3>

              {/* Hardware Scan Branch */}
              {token ? (
                <div className="space-y-4 mb-6 pt-2 border-t border-line">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted">Your Hardware:</span>
                    <span className="text-text font-bold truncate max-w-[170px]" title={hardware?.gpu_name || 'Detected Hardware'}>
                      {hardware?.gpu_name || 'Loading specs...'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted">Available VRAM:</span>
                    <span className="text-primary font-bold">{hardware?.vram_gb ? `${hardware.vram_gb} GB` : '—'}</span>
                  </div>

                  {/* Predicted Tok/s line: NEVER a bare number when in_range is false */}
                  {verdictData && (
                    <div className="bg-surface-2 p-3 rounded-btn border border-line font-mono text-xs">
                      {verdictData.in_range === false ? (
                        <div className="text-warning text-xs space-y-1">
                          <div className="font-semibold flex items-center gap-1.5">
                            <AlertTriangle size={13} />
                            <span>Rough estimate — outside measured range</span>
                          </div>
                          <div className="text-muted text-[11px]">
                            Speed extrapolated (~{verdictData.est_tps || 10} tok/s)
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-muted text-[11px] uppercase tracking-wider mb-0.5">Predicted Speed</div>
                          <div className="text-lg font-bold text-primary">
                            {verdictData.est_tps || '—'} <span className="text-xs text-muted font-normal">tok/s</span>
                          </div>
                          {verdictData.tps_range && (
                            <div className="text-[11px] text-muted mt-0.5">
                              Expected: {verdictData.tps_range[0]} – {verdictData.tps_range[1]} tok/s
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pull Command */}
                  <div>
                    <label className="text-[11px] font-mono text-muted uppercase tracking-wider block mb-1">
                      Pull &amp; Run
                    </label>
                    <div
                      onClick={() => handleCopy(pullCommand, 'side-pull')}
                      className="flex items-center justify-between p-2.5 bg-surface-2 border border-line rounded-btn hover:border-primary transition cursor-pointer group font-mono text-xs"
                    >
                      <code className="text-success truncate pr-2 font-bold">{pullCommand}</code>
                      <button type="button" className="text-muted group-hover:text-text flex-shrink-0">
                        {copiedCmd === 'side-pull' ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* No scan branch: Check PC button + Inline GPU picker */
                <div className="space-y-4 mb-6 pt-2 border-t border-line">
                  <p className="text-xs font-mono text-muted leading-relaxed">
                    Scan your PC once to see accurate compatibility and generation speeds.
                  </p>

                  <Link
                    to="/scanner"
                    className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white text-center rounded-btn text-xs font-mono font-bold transition flex items-center justify-center gap-2 shadow-soft"
                  >
                    <Monitor size={15} />
                    <span>Check my PC</span>
                  </Link>

                  {/* Inline GPU Picker */}
                  <div className="pt-2 border-t border-line">
                    <label className="text-[11px] font-mono text-muted uppercase tracking-wider block mb-1.5">
                      Or select your graphics card:
                    </label>
                    <select
                      value={selectedGpuVram}
                      onChange={(e) => setSelectedGpuVram(parseFloat(e.target.value))}
                      className="w-full bg-surface-2 border border-line text-text px-3 py-2 rounded-btn text-xs font-mono focus:outline-none focus:border-primary cursor-pointer"
                    >
                      <option value={2}>Entry GPU (2 GB VRAM)</option>
                      <option value={4}>Budget GPU (4 GB VRAM - RTX 2050 / 3050)</option>
                      <option value={6}>Mid-range Laptop (6 GB VRAM - RTX 3060/4050)</option>
                      <option value={8}>Mid-range Desktop (8 GB VRAM - RTX 3070/4060)</option>
                      <option value={12}>High-end GPU (12 GB VRAM - RTX 3060 12GB/4070)</option>
                      <option value={16}>Enthusiast GPU (16 GB VRAM - RTX 4080)</option>
                      <option value={24}>Flagship GPU (24 GB VRAM - RTX 3090/4090)</option>
                    </select>

                    <div className="mt-3 p-3 bg-surface-2 rounded-btn border border-line font-mono text-xs">
                      <div className="text-muted text-[11px]">With {selectedGpuVram} GB VRAM:</div>
                      <div className="text-text font-bold mt-0.5">
                        {offlineTier === 'gpu' ? 'Fits completely in VRAM' : (offlineTier === 'offload' ? 'Runs partially on GPU' : 'Mostly runs on CPU (slow)')}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ML Insight: Keep component, but hide when in_range is false */}
              {token && verdictData && (verdictData.in_range !== false) && (
                <div className="pt-4 border-t border-line">
                  <MlInsight 
                    verdictData={verdictData}
                    modelSizeGb={currentQuantObj?.size_gb || 0}
                  />
                </div>
              )}

              {/* Key Facts list */}
              <div className="pt-4 border-t border-line space-y-2.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-muted flex items-center gap-1.5"><Layers size={13} /> Size Class:</span>
                  <span className="text-text font-bold">
                    {model.params_b < 2 ? 'Tiny (<2B)' : model.params_b < 5 ? 'Small (2-5B)' : model.params_b <= 10 ? 'Medium (5-10B)' : 'Large (>10B)'}
                  </span>
                </div>
                {model.quality_source && model.quality_source !== 'size_estimate' && (
                  <div className="flex justify-between">
                    <span className="text-muted flex items-center gap-1.5"><Sparkles size={13} /> Quality Score:</span>
                    <span className="text-text font-bold">{Math.round((model.quality_score || 0) * 100)}%</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted flex items-center gap-1.5"><Download size={13} /> Downloads:</span>
                  <span className="text-text font-bold">{(model.downloads_last_month || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted flex items-center gap-1.5"><Heart size={13} /> Community Likes:</span>
                  <span className="text-text font-bold">{(model.likes || 0).toLocaleString()}</span>
                </div>
                {model.hf_updated_at && (
                  <div className="flex justify-between">
                    <span className="text-muted">Last Updated:</span>
                    <span className="text-text font-bold">{new Date(model.hf_updated_at).toLocaleDateString()}</span>
                  </div>
                )}
                {model.publisher && (
                  <div className="flex justify-between">
                    <span className="text-muted">Author / Org:</span>
                    <span className="text-text font-bold">{model.publisher}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE STICKY BOTTOM BAR */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur border-t border-line p-3 px-4 flex items-center justify-between shadow-card">
        <div className="truncate pr-3">
          <div className="text-xs font-bold text-text truncate">{model.name}</div>
          <span className={`inline-block px-2 py-0.2 text-[10px] font-mono font-bold rounded-pill border ${tierBadgeMap[activeTier]?.style}`}>
            {tierBadgeMap[activeTier]?.label}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => handleCopy(pullCommand, 'mobile-copy')}
            className="px-3 py-1.5 bg-surface-2 hover:bg-line border border-line text-text rounded-btn text-xs font-mono font-semibold flex items-center gap-1"
          >
            {copiedCmd === 'mobile-copy' ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            <span>Pull</span>
          </button>
          {!token && (
            <Link
              to="/scanner"
              className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-btn text-xs font-mono font-bold transition"
            >
              Check PC
            </Link>
          )}
        </div>
      </div>
    </>
  )
}
