import React, { useState, useEffect } from 'react'
import { Cpu, HelpCircle, X, Activity, Info, AlertTriangle, ShieldCheck } from 'lucide-react'
import { getMlInfo } from '../api/client'

export default function MlInsight({ verdictData, modelSizeGb = 0 }) {
  const [showModal, setShowModal] = useState(false)
  const [mlInfo, setMlInfo] = useState(null)
  const [loadingInfo, setLoadingInfo] = useState(false)

  useEffect(() => {
    if (showModal && !mlInfo) {
      setLoadingInfo(true)
      getMlInfo()
        .then(res => setMlInfo(res.data))
        .catch(err => console.error('Failed to load ML info:', err))
        .finally(() => setLoadingInfo(false))
    }
  }, [showModal, mlInfo])

  if (!verdictData) return null

  // If prediction source is heuristic, show rule-of-thumb note
  if (verdictData.prediction_source === 'heuristic') {
    return (
      <div className="bg-surface border border-line p-4 rounded-card mb-12 flex items-center gap-3 text-xs text-muted font-mono">
        <Info size={16} className="text-primary flex-shrink-0" />
        <span>
          Speed estimated from baseline rule-of-thumb. Run local benchmarks to improve prediction calibration.
        </span>
      </div>
    )
  }

  const tps = verdictData.est_tps_ml ?? verdictData.est_tps
  const tpsMin = verdictData.tps_range?.[0] ?? (tps ? (tps * 0.85).toFixed(1) : 0)
  const tpsMax = verdictData.tps_range?.[1] ?? (tps ? (tps * 1.15).toFixed(1) : 0)
  const offload = verdictData.offload_fraction_ml ?? 1.0
  const offloadPct = Math.round(offload * 100)
  const isInRange = verdictData.in_range !== false

  // Memory breakdown
  const size = modelSizeGb > 0 ? modelSizeGb : (verdictData.model_req?.min_vram_gb || 4.0)
  const vramUsed = (offload * size).toFixed(1)
  const ramUsed = ((1.0 - offload) * size).toFixed(1)

  return (
    <>
      <div className="bg-surface border border-line p-6 sm:p-8 rounded-card mb-12 shadow-soft">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <Activity size={18} className="text-primary" />
            <h3 className="text-base sm:text-lg font-bold text-text">
              Predicted Inference Speed
            </h3>
          </div>
          
          <div className="flex items-center gap-3">
            <span 
              className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-warning-soft text-warning border border-warning/30 flex items-center gap-1.5"
              title="Trained on real Ollama benchmark data."
            >
              Calibrated on real benchmarks
            </span>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="text-xs font-mono text-primary hover:underline flex items-center gap-1 cursor-pointer transition"
            >
              <span>How accurate is this?</span>
              <HelpCircle size={14} />
            </button>
          </div>
        </div>

        {/* Metric Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Main TPS Stat */}
          <div className="bg-surface-2 border border-line p-5 rounded-btn">
            <div className="text-xs font-mono text-muted uppercase tracking-wider mb-2 font-semibold">
              Predicted Speed
            </div>

            {!isInRange ? (
              <div className="space-y-2">
                <div className="inline-block px-2.5 py-1.5 rounded-btn bg-warning-soft text-warning text-xs font-mono font-semibold border border-warning/30 leading-snug">
                  Rough estimate - outside the range we&apos;ve measured
                </div>
                <div className="text-xs font-mono text-muted">
                  Approx. ~{tps} tokens/sec
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-mono font-bold text-primary">
                    {tps}
                  </span>
                  <span className="text-sm font-mono text-muted">tokens/sec</span>
                </div>
                <div className="text-xs font-mono text-muted mt-2">
                  Expected range: <span className="text-text font-semibold">{tpsMin} – {tpsMax} tok/s</span> (90% CI)
                </div>
              </>
            )}
          </div>

          {/* Offload breakdown */}
          <div className="md:col-span-2 bg-surface-2 border border-line p-5 rounded-btn flex flex-col justify-between h-full">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-mono text-muted uppercase tracking-wider font-semibold">
                  Memory Allocation
                </span>
                <span className="text-xs font-mono font-bold text-primary">
                  {offloadPct}% GPU Offload
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-surface h-3 rounded-full overflow-hidden border border-line flex">
                <div 
                  className="bg-primary h-full transition-all duration-500" 
                  style={{ width: `${offloadPct}%` }}
                />
                <div 
                  className="bg-muted/30 h-full transition-all duration-500" 
                  style={{ width: `${100 - offloadPct}%` }}
                />
              </div>
            </div>

            <div className="text-xs font-mono text-muted mt-4 flex flex-wrap justify-between gap-2">
              <div>
                <span className="text-primary font-semibold">{vramUsed} GB</span> in GPU VRAM
              </div>
              <div>
                <span className="text-muted font-semibold">{ramUsed} GB</span> in System RAM
              </div>
              <div className="text-text">
                Loaded footprint: <span className="text-text font-semibold">{size.toFixed(1)} GB</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accuracy & Model Info Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface max-w-lg w-full p-6 sm:p-8 rounded-card border border-line shadow-card relative animate-in fade-in zoom-in-95 duration-150">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute top-5 right-5 text-muted hover:text-text p-1 rounded-btn hover:bg-surface-2 transition cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Activity size={20} className="text-primary" />
              <h3 className="text-lg font-bold text-text">
                Model Accuracy &amp; Validation
              </h3>
            </div>

            {/* Honest sample size notice */}
            <div className="p-3.5 rounded-btn bg-warning-soft border border-warning/30 text-warning text-xs flex gap-2.5 mb-5 leading-relaxed font-mono">
              <AlertTriangle size={17} className="flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-text block mb-0.5">Development Dataset Notice:</strong>
                Predictions are trained on measured benchmark runs across real hardware. When a requested configuration exceeds the measured boundary, estimates are labeled as rough estimates.
              </div>
            </div>

            {loadingInfo ? (
              <div className="py-8 text-center font-mono text-xs text-muted shimmer rounded">
                Loading ML validation metrics...
              </div>
            ) : mlInfo ? (
              <div className="space-y-4 font-mono text-xs">
                <div className="bg-surface-2 p-4 rounded-btn border border-line space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted">Selected Algorithm:</span>
                    <span className="text-primary font-bold">{mlInfo.selected_model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Cross-Validation MAPE:</span>
                    <span className="text-success font-bold">{mlInfo.winner_metrics?.mape_pct}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Mean Absolute Error:</span>
                    <span className="text-text font-bold">{mlInfo.winner_metrics?.mae_tps} tok/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Fitted VRAM Reserve (R):</span>
                    <span className="text-text font-bold">{mlInfo.reserve_gb} GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Footprint Map Source:</span>
                    <span className="text-text font-bold">
                      {mlInfo.footprint_map_source === 'fitted' ? 'fitted' : 'default + 15% margin'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Benchmark Configurations:</span>
                    <span className="text-text font-bold">{mlInfo.n_configs} configs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">GPU Term Support:</span>
                    <span className="text-text font-bold">{mlInfo.n_configs_gpu || mlInfo.n_configs} configs (fitted)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">CPU Term Source:</span>
                    <span className="text-text font-bold capitalize">
                      {mlInfo.cpu_term_source || 'prior'} ({mlInfo.cpu_term_source === 'prior' ? '60% RAM BW prior' : 'fitted'})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">CPU Term Support:</span>
                    <span className="text-text font-bold">
                      {mlInfo.n_configs_cpu ?? mlInfo.n_offload ?? 0} configs with offload &lt; 0.95
                    </span>
                  </div>
                  {mlInfo.trained_at && (
                    <div className="flex justify-between pt-1 border-t border-line">
                      <span className="text-muted">Trained Date:</span>
                      <span className="text-muted">{new Date(mlInfo.trained_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <p className="text-muted leading-relaxed font-sans text-xs">
                  Validation uses Leave-One-Group-Out cross-validation. When fewer than 3 benchmark configurations have offload &lt; 0.95, the CPU memory transfer term is anchored to a stated prior (60% effective bandwidth of 40 GB/s dual-channel RAM) to prevent ungrounded extrapolation.
                </p>
              </div>
            ) : (
              <div className="py-4 text-center font-mono text-xs text-muted">
                Could not retrieve ML validation metrics.
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-line flex justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-surface-2 hover:bg-line border border-line text-text rounded-btn text-xs font-mono font-semibold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
