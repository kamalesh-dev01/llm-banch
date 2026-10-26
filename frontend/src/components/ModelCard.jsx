import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import useHardwareStore from '../store/hardwareStore'
import { Download, CheckCircle2, AlertCircle } from 'lucide-react'

const FAMILY_COLORS = {
  llama: '#38bdf8',     // Cyan
  qwen: '#a855f7',      // Purple
  phi: '#2dd4bf',       // Teal
  mistral: '#f97316',   // Orange
  gemma: '#f43f5e',     // Rose
  deepseek: '#3b82f6',  // Royal Blue
  smollm: '#eab308',    // Amber
  tinyllama: '#84cc16', // Lime
}

const getFamilyColor = (family = '') => {
  const key = family.toLowerCase().trim()
  return FAMILY_COLORS[key] || '#8b929c'
}

export default function ModelCard({ model, index = 0 }) {
  const { hardware } = useHardwareStore()

  // Compute hardware compatibility if scan data exists
  let fitsPc = null
  if (hardware && model.min_vram_gb !== undefined) {
    fitsPc = hardware.vram_gb >= model.min_vram_gb
  }

  // Quality score color
  const quality = model.quality_score || 0
  let qualityColor = 'bg-not-recommended'
  if (quality >= 0.65) qualityColor = 'bg-recommended'
  else if (quality >= 0.5) qualityColor = 'bg-minimum'

  const downloads = model.downloads_last_month || 0
  const familyColor = getFamilyColor(model.family)
  const modelId = model.id || model.model_id

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
      className="h-full flex flex-col"
    >
      <Link 
        to={`/models/${modelId}`} 
        className="glass glow-border rounded-xl p-5 hover:border-accent/40 transition group flex flex-col h-full cursor-pointer relative overflow-hidden"
      >
        {/* Family-colored accent top stripe */}
        <div 
          className="absolute top-0 left-0 right-0 h-1 transition-all duration-300 group-hover:h-1.5"
          style={{ backgroundColor: familyColor }}
        />

        {/* Header: Name + Family badge */}
        <div className="flex justify-between items-start mb-2 pt-1">
          <h3 className="text-lg font-heading font-bold text-text group-hover:text-accent transition truncate pr-2">
            {model.name}
          </h3>
          <span 
            className="px-2.5 py-0.5 text-[11px] font-mono font-medium rounded-full border whitespace-nowrap"
            style={{ 
              borderColor: `${familyColor}40`, 
              color: familyColor,
              backgroundColor: `${familyColor}15`
            }}
          >
            {model.family}
          </span>
        </div>
        
        {/* Parameter count */}
        <div className="font-mono text-xs text-accent font-semibold mb-2.5">
          {model.params_b}B params
        </div>
        
        {/* Description */}
        <p className="text-muted text-xs line-clamp-2 mb-4 flex-grow leading-relaxed">
          {model.description || 'No description available for this model.'}
        </p>

        {/* Quality Score Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1 font-mono">
            <span className="text-muted">Quality Score</span>
            <span className="text-text font-semibold">{(quality * 100).toFixed(0)}%</span>
          </div>
          <div className="h-1.5 w-full bg-elevated rounded-full overflow-hidden border border-border/50">
            <div 
              className={`h-full ${qualityColor} rounded-full transition-all duration-500`} 
              style={{ width: `${quality * 100}%` }}
            />
          </div>
        </div>
        
        {/* Footer Metrics */}
        <div className="flex justify-between items-center mt-auto pt-3 border-t border-border/60">
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted">
            <Download size={13} className="text-muted/70" />
            <span>{downloads.toLocaleString()}</span>
          </div>
          
          {fitsPc !== null && (
            fitsPc ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-recommended/15 text-recommended text-[11px] font-mono font-semibold rounded-full border border-recommended/30">
                <CheckCircle2 size={11} />
                <span>Fits your PC</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-not-recommended/15 text-not-recommended text-[11px] font-mono font-semibold rounded-full border border-not-recommended/30">
                <AlertCircle size={11} />
                <span>Too large</span>
              </span>
            )
          )}
        </div>
      </Link>
    </motion.div>
  )
}
