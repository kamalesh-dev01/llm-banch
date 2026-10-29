import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Download, 
  CheckCircle2, 
  Calendar, 
  Shield, 
  User, 
  Eye, 
  Wrench, 
  Sparkles, 
  Binary 
} from 'lucide-react'

// Semantic family colors using CSS variables
const FAMILY_CLASSES = {
  llama: 'border-accent/40 text-accent bg-accent/10',
  qwen: 'border-primary/40 text-primary bg-primary-soft',
  phi: 'border-success/40 text-success bg-success-soft',
  mistral: 'border-warning/40 text-warning bg-warning-soft',
  gemma: 'border-danger/40 text-danger bg-danger-soft',
  deepseek: 'border-primary/40 text-primary bg-primary-soft',
  smollm: 'border-warning/40 text-warning bg-warning-soft',
  tinyllama: 'border-success/40 text-success bg-success-soft',
}

const FAMILY_STRIPES = {
  llama: 'bg-accent',
  qwen: 'bg-primary',
  phi: 'bg-success',
  mistral: 'bg-warning',
  gemma: 'bg-danger',
  deepseek: 'bg-primary',
  smollm: 'bg-warning',
  tinyllama: 'bg-success',
}

const getFamilyBadge = (family = '') => {
  const key = family.toLowerCase().trim()
  return FAMILY_CLASSES[key] || 'border-line text-muted bg-surface-2'
}

const getFamilyStripe = (family = '') => {
  const key = family.toLowerCase().trim()
  return FAMILY_STRIPES[key] || 'bg-primary'
}

export const getSizeClass = (paramsB) => {
  const p = parseFloat(paramsB) || 0
  if (p < 2.0) return 'Tiny (<2B)'
  if (p < 5.0) return 'Small (2-5B)'
  if (p <= 10.0) return 'Medium (5-10B)'
  return 'Large (>10B)'
}

const getTierChip = (tier) => {
  switch (tier) {
    case 'gpu':
      return {
        label: 'Runs on GPU',
        style: 'bg-success-soft text-success border-success/30',
      }
    case 'offload':
      return {
        label: 'Runs with CPU help',
        style: 'bg-primary-soft text-primary border-primary/30',
      }
    case 'heavy':
      return {
        label: 'Very slow',
        style: 'bg-warning-soft text-warning border-warning/30',
      }
    case 'too_large':
      return {
        label: 'Too large',
        style: 'bg-danger-soft text-danger border-danger/30',
      }
    default:
      return null
  }
}

export default function ModelCard({ model, index = 0, view = 'grid' }) {
  const quality = model.quality_score || 0
  let qualityBarColor = 'bg-danger'
  if (quality >= 0.70) qualityBarColor = 'bg-success'
  else if (quality >= 0.50) qualityBarColor = 'bg-warning'

  const minVram = model.min_vram !== undefined ? model.min_vram : model.min_vram_gb
  const downloads = model.downloads_last_month || model.downloads || 0
  const modelSlug = model.ollama_tag || model.id || model.model_id
  const badgeStyle = getFamilyBadge(model.family)
  const stripeColor = getFamilyStripe(model.family)

  const tierInfo = model.tier ? getTierChip(model.tier) : null
  const tagline = model.tagline || model.description || 'No description available for this model.'
  const contextK = model.context_length ? `${Math.round(model.context_length / 1024)}k` : null
  const hasRealQuality = model.quality_source && model.quality_source !== 'size_estimate'
  const sizeClass = getSizeClass(model.params_b)

  // Parse capabilities
  let capabilities = []
  try {
    if (Array.isArray(model.capabilities)) capabilities = model.capabilities
    else if (typeof model.capabilities === 'string') capabilities = JSON.parse(model.capabilities)
  } catch (e) {
    capabilities = []
  }

  // LIST ROW VIEW
  if (view === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.25) }}
        className="w-full"
      >
        <Link
          to={`/models/${modelSlug}`}
          className="relative bg-surface border border-line rounded-card p-4 sm:p-5 card-hover flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer overflow-hidden group shadow-soft transition"
        >
          {/* Family Accent Left Stripe */}
          <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${stripeColor}`} />

          {/* Left Block: Name, Tagline, Details */}
          <div className="flex-1 min-w-0 pl-1.5 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-text group-hover:text-primary transition truncate">
                {model.name}
              </h3>
              {model.family && (
                <span className={`px-2 py-0.5 text-[11px] font-mono font-medium rounded-pill border capitalize ${badgeStyle}`}>
                  {model.family}
                </span>
              )}
              {tierInfo && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-mono font-semibold rounded-pill border ${tierInfo.style}`}>
                  <CheckCircle2 size={11} />
                  <span>{tierInfo.label}</span>
                </span>
              )}
            </div>

            <p className="text-muted text-xs line-clamp-1 leading-relaxed">
              {tagline}
            </p>

            {/* Chips: params, context, capabilities */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="px-2 py-0.5 rounded bg-surface-2 border border-line text-[11px] font-mono text-primary font-bold">
                {model.params_b}B
              </span>
              {contextK && (
                <span className="px-2 py-0.5 rounded bg-surface-2 border border-line text-[11px] font-mono text-muted">
                  {contextK} ctx
                </span>
              )}
              {minVram > 0 && (
                <span className="px-2 py-0.5 rounded bg-surface-2 border border-line text-[11px] font-mono text-muted">
                  Min {minVram.toFixed(1)} GB VRAM
                </span>
              )}
              {capabilities.map(cap => (
                <span
                  key={cap}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-2 border border-line text-[11px] font-mono text-text capitalize"
                >
                  {cap === 'vision' && <Eye size={11} className="text-accent" />}
                  {cap === 'tools' && <Wrench size={11} className="text-primary" />}
                  {cap === 'thinking' && <Sparkles size={11} className="text-warning" />}
                  {cap === 'embedding' && <Binary size={11} className="text-success" />}
                  <span>{cap}</span>
                </span>
              ))}
            </div>

            {/* Extra Metadata: Publisher, License, Released */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-muted pt-1">
              {model.publisher && (
                <span className="inline-flex items-center gap-1">
                  <User size={11} className="text-muted" />
                  <span className="text-text font-medium">{model.publisher}</span>
                </span>
              )}
              {model.licence && (
                <span className="inline-flex items-center gap-1">
                  <Shield size={11} className="text-muted" />
                  <span>{model.licence}</span>
                </span>
              )}
              {model.released_at && (
                <span className="inline-flex items-center gap-1">
                  <Calendar size={11} className="text-muted" />
                  <span>{new Date(model.released_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}</span>
                </span>
              )}
            </div>
          </div>

          {/* Right Block: Quality Bar (if real) OR Size Class Chip & Downloads */}
          <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 md:w-36 flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-line">
            {hasRealQuality ? (
              <div className="w-full max-w-[130px]">
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="text-muted">Quality</span>
                  <span className="text-text font-bold">{Math.round(quality * 100)}%</span>
                </div>
                <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden border border-line">
                  <div
                    className={`h-full ${qualityBarColor} rounded-full`}
                    style={{ width: `${quality * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <span className="px-2.5 py-1 rounded-btn bg-surface-2 border border-line text-[11px] font-mono font-bold text-text">
                {sizeClass}
              </span>
            )}

            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-muted">
              <Download size={12} className="text-muted" />
              <span>{downloads.toLocaleString()}</span>
            </div>
          </div>
        </Link>
      </motion.div>
    )
  }

  // GRID CARD VIEW (Default)
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
      className="h-full flex flex-col"
    >
      <Link 
        to={`/models/${modelSlug}`} 
        className="bg-surface border border-line rounded-card p-5 card-hover flex flex-col h-full cursor-pointer relative overflow-hidden group shadow-soft"
      >
        {/* Family Accent Top Stripe */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${stripeColor}`} />

        {/* Header: Name + Family badge */}
        <div className="flex justify-between items-start gap-2 mb-2 pt-1">
          <h3 className="text-base font-bold text-text group-hover:text-primary transition truncate">
            {model.name}
          </h3>
          <span className={`px-2.5 py-0.5 text-xs font-mono font-medium rounded-pill border whitespace-nowrap capitalize ${badgeStyle}`}>
            {model.family}
          </span>
        </div>
        
        {/* Tagline (clamped to 2 lines) */}
        <p className="text-muted text-xs line-clamp-2 mb-3.5 flex-grow leading-relaxed">
          {tagline}
        </p>

        {/* Chips: params, context, capabilities */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <span className="px-2 py-0.5 rounded bg-surface-2 border border-line text-[11px] font-mono text-primary font-bold">
            {model.params_b}B
          </span>
          {contextK && (
            <span className="px-2 py-0.5 rounded bg-surface-2 border border-line text-[11px] font-mono text-muted">
              {contextK} ctx
            </span>
          )}
          {minVram > 0 && (
            <span className="px-2 py-0.5 rounded bg-surface-2 border border-line text-[11px] font-mono text-muted">
              Min {minVram.toFixed(1)} GB
            </span>
          )}
          {capabilities.slice(0, 2).map(cap => (
            <span
              key={cap}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-2 border border-line text-[11px] font-mono text-text capitalize"
            >
              {cap === 'vision' && <Eye size={10} className="text-accent" />}
              {cap === 'tools' && <Wrench size={10} className="text-primary" />}
              {cap === 'thinking' && <Sparkles size={10} className="text-warning" />}
              {cap === 'embedding' && <Binary size={10} className="text-success" />}
              <span>{cap}</span>
            </span>
          ))}
        </div>

        {/* Quality Score Bar (only if real) OR Size class chip */}
        {hasRealQuality ? (
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1.5 font-mono">
              <span className="text-muted">Quality Score</span>
              <span className="text-text font-semibold">{(quality * 100).toFixed(0)}%</span>
            </div>
            <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden border border-line">
              <div 
                className={`h-full ${qualityBarColor} rounded-full transition-all duration-500`} 
                style={{ width: `${quality * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="mb-4 flex items-center justify-between text-xs font-mono py-1.5 px-3 bg-surface-2 rounded-btn border border-line">
            <span className="text-muted">Size Class</span>
            <span className="text-text font-bold">{sizeClass}</span>
          </div>
        )}
        
        {/* Footer: Downloads & Tier Chip */}
        <div className="flex justify-between items-center mt-auto pt-3 border-t border-line">
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted">
            <Download size={13} className="text-muted" />
            <span>{downloads.toLocaleString()}</span>
          </div>
          
          {tierInfo ? (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-mono font-semibold rounded-pill border ${tierInfo.style}`}>
              <CheckCircle2 size={12} />
              <span>{tierInfo.label}</span>
            </span>
          ) : (
            <span className="text-[11px] font-mono text-muted">
              {model.tasks ? (typeof model.tasks === 'string' ? JSON.parse(model.tasks || '[]')[0] : model.tasks[0]) : ''}
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}
