import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useHardwareStore from '../store/hardwareStore'
import { getHardwareScan, getRecommendations } from '../api/client'
import ModelCard from '../components/ModelCard'
import AdSlot from '../components/AdSlot'
import { HardDrive, Cpu, Database, Monitor, AlertCircle, Sparkles, Terminal } from 'lucide-react'

export default function VerdictPage() {
  const [searchParams] = useSearchParams()
  const { setToken, hardware, setHardware } = useHardwareStore()
  const navigate = useNavigate()
  
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const urlToken = searchParams.get('token')
    
    if (!urlToken && !localStorage.getItem('llmbench_token')) {
      navigate('/')
      return
    }

    const activeToken = urlToken || localStorage.getItem('llmbench_token')
    if (urlToken) {
      setToken(urlToken)
    }

    let isMounted = true

    const loadData = async () => {
      setLoading(true)
      try {
        const hwRes = await getHardwareScan(activeToken)
        if (isMounted) setHardware(hwRes.data)
        
        const recRes = await getRecommendations(activeToken, null, 6)
        if (isMounted) setRecommendations(recRes.data)
        
      } catch (err) {
        console.error(err)
        if (isMounted) setError('Scan session expired or not found. Please run a quick check again.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()

    return () => { isMounted = false }
  }, [searchParams, setToken, setHardware, navigate])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-36 max-w-md mx-auto text-center space-y-4">
        <div className="w-14 h-14 rounded-full border-2 border-border border-t-accent animate-spin mb-4" />
        <h2 className="text-2xl font-heading font-bold text-text">
          Analyzing Hardware Telemetry...
        </h2>
        <p className="text-muted text-xs font-mono">
          Evaluating VRAM limits, memory bandwidth, and quantization fit.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16 glass max-w-lg mx-auto mt-12 p-8 rounded-2xl shadow-xl">
        <AlertCircle size={48} className="text-not-recommended mx-auto mb-4" />
        <h2 className="text-2xl font-heading font-bold text-text mb-2">Scan Expired or Not Found</h2>
        <p className="text-muted text-sm mb-8 leading-relaxed">{error}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button 
            onClick={() => navigate('/')} 
            className="bg-accent text-bg px-6 py-2.5 rounded-lg text-xs font-mono font-bold hover:bg-accent/90 transition cursor-pointer"
          >
            Use Instant Checker
          </button>
          <a 
            href="http://localhost:8000/api/scanner/download" 
            className="bg-elevated border border-border text-text px-6 py-2.5 rounded-lg text-xs font-mono font-semibold hover:border-accent transition inline-flex items-center justify-center gap-1.5"
          >
            <Terminal size={14} />
            <span>Download Scanner</span>
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto pb-16">
      {/* HARDWARE TELEMETRY CARD */}
      <div className="glass p-8 md:p-10 mb-14 rounded-2xl shadow-xl relative overflow-hidden glow-border">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Monitor size={180} />
        </div>
        
        <div className="flex items-center justify-between mb-8 border-b border-border/80 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-accent uppercase tracking-wider font-semibold mb-1">
              <Sparkles size={13} />
              <span>System Telemetry</span>
            </div>
            <h1 className="text-3xl font-heading font-bold text-text">
              Your Hardware Profile
            </h1>
          </div>
          <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-recommended/15 text-recommended border border-recommended/30">
            Active Session
          </span>
        </div>
        
        {hardware && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 relative z-10">
            {/* GPU Card */}
            <div className="bg-surface/90 rounded-xl p-5 border border-border flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent flex-shrink-0">
                <Monitor size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-mono text-muted uppercase tracking-wider mb-1">GPU Display Adapter</p>
                <p className="font-heading font-bold text-text text-sm leading-tight mb-2 truncate" title={hardware.gpu_name}>
                  {hardware.gpu_name}
                </p>
                <span className="inline-block bg-accent/15 text-accent text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border border-accent/30">
                  {hardware.vram_gb} GB VRAM
                </span>
              </div>
            </div>
            
            {/* System RAM Card */}
            <div className="bg-surface/90 rounded-xl p-5 border border-border flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-recommended/10 border border-recommended/20 flex items-center justify-center text-recommended flex-shrink-0">
                <Database size={20} />
              </div>
              <div>
                <p className="text-[11px] font-mono text-muted uppercase tracking-wider mb-1">Total System RAM</p>
                <p className="font-heading font-bold text-text text-2xl font-mono">{hardware.ram_gb} GB</p>
                <p className="text-[11px] font-mono text-muted mt-1">Available for offload</p>
              </div>
            </div>
            
            {/* CPU Card */}
            <div className="bg-surface/90 rounded-xl p-5 border border-border flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-minimum/10 border border-minimum/20 flex items-center justify-center text-minimum flex-shrink-0">
                <Cpu size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-mono text-muted uppercase tracking-wider mb-1">Processor</p>
                <p className="font-heading font-bold text-text text-xs leading-tight line-clamp-2 mb-1" title={hardware.cpu_name}>
                  {hardware.cpu_name}
                </p>
                <p className="text-xs font-mono text-muted">{hardware.cpu_cores ? `${hardware.cpu_cores} Cores` : 'Physical Cores'}</p>
              </div>
            </div>
            
            {/* OS / Storage Card */}
            <div className="bg-surface/90 rounded-xl p-5 border border-border flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-elevated border border-border flex items-center justify-center text-muted flex-shrink-0">
                <HardDrive size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-mono text-muted uppercase tracking-wider mb-1">Environment</p>
                <p className="font-heading font-bold text-text text-xs mb-1 truncate">{hardware.os}</p>
                <p className="text-xs font-mono text-muted">
                  {hardware.disk_free_gb ? `${hardware.disk_free_gb} GB free` : 'Ready for weights'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RECOMMENDATIONS SECTION */}
      <div>
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs font-mono text-recommended uppercase tracking-wider font-semibold mb-1">
            <Sparkles size={14} />
            <span>Optimal Hardware Fit</span>
          </div>
          <h2 className="text-3xl font-heading font-bold text-text">
            Recommended Models for Your System
          </h2>
          <p className="text-muted text-sm mt-1 max-w-2xl">
            Sorted by quality score. These open-weights and specific quantizations will fit comfortably within your detected memory limits.
          </p>
        </div>

        {recommendations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {recommendations.map((rec, idx) => (
              <ModelCard key={rec.model_id || rec.id} model={rec} index={idx} />
            ))}
          </div>
        ) : (
          <div className="glass p-12 text-center rounded-xl my-8">
            <p className="text-muted font-mono text-sm">No models currently match this hardware profile.</p>
          </div>
        )}

        {/* Ad slot below recommendations (Requirement: one slot below the recommendations) */}
        <AdSlot slot="verdict-below-recommendations" format="banner" className="my-10" />

        {/* Primary CTA: spaced >200px away from ads as required by AdSense policy */}
        <div className="text-center pt-24 pb-8 border-t border-border/40">
          <button 
            onClick={() => navigate('/models')} 
            className="bg-accent text-bg px-10 py-4 rounded-xl font-heading font-bold hover:bg-accent/90 transition cursor-pointer shadow-lg shadow-accent/25 text-base"
          >
            Browse All Compatible Models
          </button>
        </div>
      </div>
    </div>
  )
}
