import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getModelById, getModelQuants, getVerdict, getModels } from '../api/client'
import useHardwareStore from '../store/hardwareStore'
import VerdictBadge from '../components/VerdictBadge'
import VerdictGauge from '../components/VerdictGauge'
import VramMeter from '../components/VramMeter'
import QuantTable from '../components/QuantTable'
import ScanPrompt from '../components/ScanPrompt'
import ModelCard from '../components/ModelCard'
import AdSlot from '../components/AdSlot'
import { ArrowLeft, Copy, Check, Terminal, ExternalLink } from 'lucide-react'

export default function ModelDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { hardware, token } = useHardwareStore()
  
  const [model, setModel] = useState(null)
  const [quants, setQuants] = useState([])
  const [verdictData, setVerdictData] = useState(null)
  const [verdictError, setVerdictError] = useState(null)
  const [similarModels, setSimilarModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [cmdCopied, setCmdCopied] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getModelById(id),
      getModelQuants(id)
    ]).then(async ([modelRes, quantsRes]) => {
      const m = modelRes.data
      setModel(m)
      setQuants(quantsRes.data)
      
      // Fetch similar models
      try {
        const simRes = await getModels({ family: m.family, limit: 4 })
        const sims = Array.isArray(simRes.data) ? simRes.data : (simRes.data.models || [])
        setSimilarModels(sims.filter(sm => sm.id !== m.id).slice(0, 3))
      } catch (err) {
        console.error(err)
      }

      // Verdict
      if (token && quantsRes.data.length > 0) {
        try {
          const vRes = await getVerdict(id, token, quantsRes.data[0].quant)
          setVerdictData(vRes.data)
        } catch (err) {
          console.error('Verdict error:', err)
          setVerdictError("Could not load compatibility data.")
        }
      }
    })
    .catch(err => console.error(err))
    .finally(() => setLoading(false))
  }, [id, token])

  const handleCopyCmd = (cmd) => {
    navigator.clipboard.writeText(cmd)
    setCmdCopied(true)
    setTimeout(() => setCmdCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto flex flex-col gap-6 pt-4">
        <div className="h-6 shimmer rounded w-32 mb-4"></div>
        <div className="h-44 shimmer rounded-xl w-full border border-border"></div>
        <div className="h-64 shimmer rounded-xl w-full border border-border"></div>
      </div>
    )
  }

  if (!model) {
    return (
      <div className="text-center text-muted py-20 text-xl font-mono">
        Model not found.
      </div>
    )
  }

  // Parse tasks safely
  let tasks = []
  try {
    if (typeof model.tasks === 'string') {
      tasks = JSON.parse(model.tasks || '[]')
    } else if (Array.isArray(model.tasks)) {
      tasks = model.tasks
    }
  } catch (e) {
    tasks = []
  }

  return (
    <div className="max-w-5xl mx-auto pb-16">
      {/* Back button */}
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center gap-2 text-muted hover:text-text transition cursor-pointer mb-8 font-semibold text-sm"
      >
        <ArrowLeft size={16} /> Back to Models
      </button>

      {/* Model Header */}
      <div className="mb-12">
        <h1 className="text-3xl md:text-5xl font-heading font-bold text-text mb-4">
          {model.name}
        </h1>
        
        <div className="flex flex-wrap items-center gap-2.5 mb-6">
          <span className="px-3.5 py-1 bg-surface text-text text-xs rounded-full font-mono font-bold uppercase tracking-wider border border-border">
            {model.family}
          </span>
          <span className="px-3.5 py-1 bg-accent/10 border border-accent/30 text-accent text-xs rounded-full font-mono font-bold">
            {model.params_b}B params
          </span>
          {model.context_length && (
            <span className="px-3.5 py-1 bg-elevated border border-border text-muted text-xs rounded-full font-mono">
              {model.context_length.toLocaleString()} context
            </span>
          )}
          {model.licence && (
            <span className="px-3.5 py-1 border border-border text-muted text-xs rounded-full font-mono">
              {model.licence}
            </span>
          )}
        </div>

        {tasks.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {tasks.map(t => (
              <span key={t} className="px-2.5 py-1 bg-surface border border-border text-muted text-xs rounded font-mono uppercase tracking-wider">
                {t}
              </span>
            ))}
          </div>
        )}

        <p className="text-muted max-w-3xl leading-relaxed whitespace-pre-wrap text-base">
          {model.description}
        </p>
      </div>

      {/* COMPATIBILITY SECTION with Circular Gauge and VRAM Meter */}
      {token && hardware ? (
        <div className="glass p-8 mb-16 glow-border">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-border pb-6">
            <div>
              <h2 className="text-2xl font-heading font-bold text-text flex items-center gap-3">
                Hardware Compatibility
              </h2>
              <p className="text-xs font-mono text-muted mt-1">
                Your System: {hardware.gpu_name} &bull; {hardware.vram_gb} GB VRAM &bull; {hardware.ram_gb} GB RAM
              </p>
            </div>
            {verdictData && <VerdictBadge verdict={verdictData.verdict} />}
          </div>
          
          {verdictError ? (
            <div className="py-10 text-center text-muted font-mono">{verdictError}</div>
          ) : verdictData ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Circular Gauge */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-border pb-6 lg:pb-0 lg:pr-6">
                <VerdictGauge verdict={verdictData.verdict} estTps={verdictData.est_tps} />
                <div className="text-center mt-2">
                  <div className="text-xs text-muted font-mono">Recommended Quantization</div>
                  <div className="text-sm font-bold font-mono text-accent bg-accent/10 px-3 py-1 rounded border border-accent/20 inline-block mt-1">
                    {verdictData.recommended_quant || 'None'}
                  </div>
                </div>
              </div>
              
              {/* VRAM Meter & Ollama Command */}
              <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
                <VramMeter 
                  userVram={verdictData.user_hw?.vram_gb || hardware.vram_gb}
                  minVram={verdictData.model_req?.min_vram_gb || 0}
                  recVram={verdictData.model_req?.rec_vram_gb || 0}
                  modelSize={quants.find(q => q.quant === verdictData.recommended_quant)?.size_gb || 0}
                />

                {verdictData.ollama_command && (
                  <div className="pt-2">
                    <p className="text-[11px] font-mono text-muted mb-1.5 uppercase tracking-wider font-semibold">
                      Recommended Ollama Command
                    </p>
                    <div 
                      className="flex items-center justify-between bg-surface border border-border p-3.5 rounded-lg group hover:border-accent transition cursor-pointer"
                      onClick={() => handleCopyCmd(verdictData.ollama_command)}
                    >
                      <code className="text-recommended font-mono overflow-x-auto whitespace-nowrap text-xs">
                        {verdictData.ollama_command}
                      </code>
                      <button 
                        type="button"
                        className="ml-4 flex-shrink-0 text-muted group-hover:text-text transition flex items-center gap-1"
                      >
                        {cmdCopied ? (
                          <span className="text-recommended flex items-center text-xs font-mono font-bold gap-1">
                            <Check size={14}/> Copied!
                          </span>
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-muted shimmer rounded-lg font-mono">
              Evaluating hardware compatibility...
            </div>
          )}
        </div>
      ) : (
        <ScanPrompt />
      )}

      {/* QUANTS TABLE SECTION */}
      <div className="mb-12">
        <h2 className="text-2xl font-heading font-bold mb-6 text-text">Available Quantizations</h2>
        <QuantTable quants={quants} userVram={hardware?.vram_gb} />
      </div>

      {/* Ad slot below quantization table (AdSense placement rule: below table, before similar models) */}
      <AdSlot slot="model-detail-below-table" format="banner" className="mb-14" />

      {/* SIMILAR MODELS */}
      {similarModels.length > 0 && (
        <div className="pt-8 border-t border-border">
          <h2 className="text-2xl font-heading font-bold mb-6 text-text capitalize">
            More {model.family} Models
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {similarModels.map((sim, idx) => (
              <ModelCard key={sim.id} model={sim} index={idx} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
