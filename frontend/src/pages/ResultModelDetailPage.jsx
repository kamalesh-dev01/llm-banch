import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion, AnimatePresence } from 'framer-motion'
import { getModelScanResult } from '../api/client'
import { 
  Monitor, 
  Cpu, 
  HardDrive, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info, 
  Terminal, 
  Copy, 
  Check, 
  ArrowLeft, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp,
  Sparkles,
  HelpCircle
} from 'lucide-react'

export default function ResultModelDetailPage() {
  const { token, modelId } = useParams()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  // Requirements tab: 'minimum' vs 'recommended'
  const [reqTab, setReqTab] = useState('recommended')
  // Selected quantization (defaults to best_quant)
  const [selectedQuant, setSelectedQuant] = useState(null)
  // Collapsible explainer toggle
  const [isExplainerOpen, setIsExplainerOpen] = useState(false)
  // Clipboard copy feedback
  const [copiedOllama, setCopiedOllama] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)

    getModelScanResult(token, modelId)
      .then(res => {
        setData(res.data)
        setSelectedQuant(res.data.best_quant || (res.data.quants?.[0]?.quant ?? 'Q4_K_M'))
      })
      .catch(err => {
        console.error('Failed to load model scan detail:', err)
        setError('Could not load hardware verdict for this model. The session may have expired.')
      })
      .finally(() => setLoading(false))
  }, [token, modelId])

  const handleCopyCommand = (cmd) => {
    navigator.clipboard.writeText(cmd)
    setCopiedOllama(true)
    setTimeout(() => setCopiedOllama(false), 2000)
  }

  // --------------------------------------------------------------------------
  // Loading Skeleton
  // --------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-text py-10 max-w-4xl mx-auto px-4 sm:px-6 animate-pulse space-y-6">
        <div className="h-6 w-32 bg-surface-2 rounded-btn" />
        <div className="h-32 bg-surface rounded-card border border-line" />
        <div className="h-64 bg-surface rounded-card border border-line" />
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // Error State
  // --------------------------------------------------------------------------
  if (error || !data) {
    return (
      <div className="min-h-screen bg-bg text-text py-16 max-w-xl mx-auto px-4 text-center">
        <div className="p-8 rounded-card bg-surface border border-line shadow-card space-y-4">
          <AlertTriangle size={32} className="mx-auto text-warning" />
          <h1 className="text-xl font-bold text-text">Verdict Not Available</h1>
          <p className="text-sm text-muted">{error || 'Data could not be retrieved.'}</p>
          <div className="pt-2">
            <Link
              to={token ? `/results/${token}` : '/check'}
              className="px-5 py-2.5 rounded-btn bg-primary text-white text-xs font-semibold inline-flex items-center gap-2"
            >
              <ArrowLeft size={14} />
              <span>Back to results</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Active quant details
  const activeQuantData = data.quants?.find(q => q.quant === selectedQuant) || data.quants?.[0] || {}
  const tier = activeQuantData.tier || data.tier

  const getTierBadge = (t) => {
    switch (t) {
      case 'gpu':
        return { label: 'Runs fully on GPU', color: 'bg-success-soft text-success border-success/30' }
      case 'offload':
        return { label: 'Runs with CPU help', color: 'bg-primary-soft text-primary border-primary/30' }
      case 'heavy':
        return { label: 'Very slow (CPU heavy)', color: 'bg-warning-soft text-warning border-warning/30' }
      case 'too_large':
        return { label: 'Too large for PC', color: 'bg-danger-soft text-danger border-danger/30' }
      default:
        return { label: 'Hardware compatible', color: 'bg-surface-2 text-muted border-line' }
    }
  }

  const tierBadge = getTierBadge(tier)

  const getStatusChip = (status) => {
    switch (status) {
      case 'ok':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-success-soft text-success border border-success/30 font-semibold text-xs font-mono">
            <CheckCircle2 size={13} />
            <span>Passed</span>
          </span>
        )
      case 'warn':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-warning-soft text-warning border border-warning/30 font-semibold text-xs font-mono">
            <AlertTriangle size={13} />
            <span>Sub-optimal</span>
          </span>
        )
      case 'fail':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-danger-soft text-danger border border-danger/30 font-semibold text-xs font-mono">
            <XCircle size={13} />
            <span>Below requirement</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-surface-2 text-muted border border-line font-medium text-xs font-mono">
            <Info size={13} />
            <span>Info</span>
          </span>
        )
    }
  }

  const getComponentIcon = (key) => {
    switch (key) {
      case 'vram': return <Monitor size={16} className="text-primary" />
      case 'ram': return <Layers size={16} className="text-primary" />
      case 'disk': return <HardDrive size={16} className="text-primary" />
      case 'cpu': return <Cpu size={16} className="text-primary" />
      default: return <Info size={16} className="text-muted" />
    }
  }

  const ollamaCmd = activeQuantData.ollama_command || `ollama run ${data.ollama_tag || data.name.toLowerCase()}`

  return (
    <div className="min-h-screen bg-bg text-text py-8 sm:py-12">
      <Helmet>
        <title>{data.name} Hardware Compatibility &bull; LLM Bench</title>
        <meta name="description" content={`Can your PC run ${data.name}? Detailed hardware requirement comparison.`} />
      </Helmet>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between text-xs font-mono">
          <Link
            to={`/results/${token}`}
            className="inline-flex items-center gap-1.5 text-muted hover:text-text transition"
          >
            <ArrowLeft size={14} />
            <span>Back to all models</span>
          </Link>

          <Link
            to={`/models/${data.model_id}`}
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <span>View model benchmarks</span>
            <ExternalLink size={12} />
          </Link>
        </div>

        {/* ======================================================== */}
        {/* 1. VERDICT HEADER                                        */}
        {/* ======================================================== */}
        <section className="bg-surface border border-line rounded-card p-6 sm:p-8 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-surface-2 border border-line text-muted font-medium">
                  {data.family}
                </span>
                <span className="text-xs font-mono text-muted">
                  {data.params_b}B parameters
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-text tracking-tight">
                {data.name}
              </h1>
            </div>

            <div className={`px-4 py-2 rounded-btn border text-xs sm:text-sm font-semibold flex items-center gap-2 self-start sm:self-auto ${tierBadge.color}`}>
              <CheckCircle2 size={16} />
              <span>{tierBadge.label}</span>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            {activeQuantData.reason || data.description}
          </p>

          {/* Quick Quant Selector Bar */}
          <div className="pt-3 border-t border-line flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-muted mr-1">Quantization:</span>
            {data.quants?.map(q => (
              <button
                key={q.quant}
                onClick={() => setSelectedQuant(q.quant)}
                className={`px-3 py-1 rounded-btn font-mono text-xs transition cursor-pointer ${
                  selectedQuant === q.quant
                    ? 'bg-primary text-white font-bold shadow-soft'
                    : 'bg-surface-2 hover:bg-surface text-muted hover:text-text border border-line'
                }`}
              >
                {q.quant} ({q.file_size_gb} GB)
              </button>
            ))}
          </div>
        </section>

        {/* ======================================================== */}
        {/* 2. COMPONENT COMPARISON TABLE                            */}
        {/* ======================================================== */}
        <section className="bg-surface border border-line rounded-card p-6 sm:p-7 shadow-card space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
            <div>
              <h2 className="text-lg font-bold text-text">System Requirements Comparison</h2>
              <p className="text-xs text-muted">
                How your detected hardware stacks up against requirements for {selectedQuant}
              </p>
            </div>

            {/* Minimum vs Recommended Selector Tabs */}
            <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-btn border border-line self-start">
              <button
                onClick={() => setReqTab('minimum')}
                className={`px-3 py-1.5 rounded-btn text-xs font-semibold transition cursor-pointer ${
                  reqTab === 'minimum' ? 'bg-surface text-text shadow-soft' : 'text-muted hover:text-text'
                }`}
              >
                Minimum (CPU Help)
              </button>
              <button
                onClick={() => setReqTab('recommended')}
                className={`px-3 py-1.5 rounded-btn text-xs font-semibold transition cursor-pointer ${
                  reqTab === 'recommended' ? 'bg-surface text-text shadow-soft' : 'text-muted hover:text-text'
                }`}
              >
                Recommended (100% GPU)
              </button>
            </div>
          </div>

          {/* Requirements Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-muted font-mono uppercase text-[11px]">
                  <th className="py-3 px-3">Component</th>
                  <th className="py-3 px-3">{reqTab === 'minimum' ? 'Minimum Required' : 'Recommended Spec'}</th>
                  <th className="py-3 px-3">Your Hardware</th>
                  <th className="py-3 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.comparison?.map(row => (
                  <tr key={row.key} className="hover:bg-surface-2/50 transition">
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5 font-semibold text-text">
                        {getComponentIcon(row.key)}
                        <span>{row.label}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-muted">
                      {reqTab === 'minimum' ? row.minimum : row.recommended}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-text font-mono">
                      {row.you_have}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      {getStatusChip(row.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 3. COPYABLE OLLAMA COMMAND BOX                           */}
        {/* ======================================================== */}
        <section className="bg-surface-2 border border-line rounded-card p-5 sm:p-6 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-primary" />
              <h3 className="font-bold text-sm text-text">Run with Ollama</h3>
            </div>
            <span className="text-[11px] font-mono text-muted">Single command execution</span>
          </div>

          <div className="flex items-center justify-between gap-3 bg-surface border border-line p-3 rounded-btn font-mono text-xs">
            <code className="text-text select-all">{ollamaCmd}</code>
            <button
              onClick={() => handleCopyCommand(ollamaCmd)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition cursor-pointer flex-shrink-0"
            >
              {copiedOllama ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedOllama ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 4. COLLAPSIBLE "HOW WE CALCULATE THIS" EXPLAINER        */}
        {/* ======================================================== */}
        <section className="bg-surface border border-line rounded-card overflow-hidden shadow-soft">
          <button
            onClick={() => setIsExplainerOpen(!isExplainerOpen)}
            className="w-full p-5 flex items-center justify-between text-left hover:bg-surface-2/60 transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5 font-bold text-sm text-text">
              <HelpCircle size={16} className="text-primary" />
              <span>How we calculate this</span>
            </div>
            {isExplainerOpen ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
          </button>

          <AnimatePresence>
            {isExplainerOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="px-5 pb-6 pt-1 text-xs text-muted border-t border-line space-y-3 leading-relaxed"
              >
                <p>
                  Our hardware compatibility calculations are physically grounded using linear memory transfer physics, verified across diverse GPU and CPU architectures:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 font-mono text-[11px]">
                  <li>
                    <strong className="text-text">Loaded Footprint:</strong> Weights size + 10% KV cache overhead + 0.1 GB base context buffer (<code className="bg-surface-2 px-1 py-0.5 rounded">1.1 &times; size + 0.1</code>).
                  </li>
                  <li>
                    <strong className="text-text">OS VRAM Reserve:</strong> ~1.85 GB reserved for the Windows display compositor and desktop window manager.
                  </li>
                  <li>
                    <strong className="text-text">Offload Fraction:</strong> <code className="bg-surface-2 px-1 py-0.5 rounded">f = (VRAM - Reserve) / Footprint</code>. When &ge; 95%, the model fits fully on the GPU. When between 40% and 95%, weights partition across GPU and system RAM.
                  </li>
                  <li>
                    <strong className="text-text">Token Speed (tok/s):</strong> Derived from the memory bandwidth bottleneck (<code className="bg-surface-2 px-1 py-0.5 rounded">x_gpu = (f &times; Footprint) / GPU_Bandwidth</code> and <code className="bg-surface-2 px-1 py-0.5 rounded">x_cpu = ((1-f) &times; Footprint) / RAM_Bandwidth</code>). If outside measured training ranges, honest out-of-range tags are displayed instead of arbitrary guesses.
                  </li>
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

      </div>
    </div>
  )
}
