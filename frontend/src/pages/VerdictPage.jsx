import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import useHardwareStore from '../store/hardwareStore'
import { getHardwareScan, getRecommendations } from '../api/client'
import ModelCard from '../components/ModelCard'
import AdSlot from '../components/AdSlot'
import { HardDrive, Cpu, Database, Monitor, AlertCircle, Sparkles, Terminal, ArrowRight } from 'lucide-react'

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
        <div className="w-12 h-12 rounded-full border-2 border-line border-t-primary animate-spin mb-4" />
        <h2 className="text-xl font-bold text-text">
          Evaluating Hardware Specifications...
        </h2>
        <p className="text-muted text-xs font-mono">
          Matching VRAM limits, memory bandwidth, and quantization footprints.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16 bg-surface max-w-lg mx-auto mt-12 p-8 rounded-card border border-line shadow-card">
        <AlertCircle size={44} className="text-danger mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-text mb-2">Session Expired or Not Found</h2>
        <p className="text-muted text-sm mb-8 leading-relaxed">{error}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button 
            type="button"
            onClick={() => navigate('/check')} 
            className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-btn text-xs font-mono font-bold transition cursor-pointer"
          >
            Use Instant Checker
          </button>
          <Link 
            to="/scanner" 
            className="bg-surface-2 border border-line text-text px-6 py-2.5 rounded-btn text-xs font-mono font-semibold hover:border-primary transition inline-flex items-center justify-center gap-1.5"
          >
            <Terminal size={14} />
            <span>Download Scanner</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Hardware Verdict — LLM Bench</title>
        <meta
          name="description"
          content="Your hardware profile results and recommended local AI models."
        />
      </Helmet>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl py-8 pb-16">
        {/* HARDWARE PROFILE CARD */}
        <div className="bg-surface border border-line p-6 sm:p-10 mb-12 rounded-card shadow-soft relative overflow-hidden">
          <div className="flex items-center justify-between mb-8 border-b border-line pb-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-primary uppercase tracking-wider font-semibold mb-1">
                <Sparkles size={13} />
                <span>Detected Specifications</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-text">
                Your Hardware Profile
              </h1>
            </div>
            <span className="text-xs font-mono px-3 py-1 rounded-pill bg-success-soft text-success border border-success/30 font-semibold">
              Active Session
            </span>
          </div>
          
          {hardware && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 relative z-10">
              {/* GPU Card */}
              <div className="bg-surface-2 rounded-btn p-5 border border-line flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary-soft text-primary flex items-center justify-center flex-shrink-0">
                  <Monitor size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-mono text-muted uppercase tracking-wider mb-1">Graphics Card</p>
                  <p className="font-bold text-text text-sm leading-tight mb-2 truncate" title={hardware.gpu_name}>
                    {hardware.gpu_name}
                  </p>
                  <span className="inline-block bg-primary-soft text-primary text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border border-primary/20">
                    {hardware.vram_gb} GB VRAM
                  </span>
                </div>
              </div>
              
              {/* System RAM Card */}
              <div className="bg-surface-2 rounded-btn p-5 border border-line flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-success-soft text-success flex items-center justify-center flex-shrink-0">
                  <Database size={20} />
                </div>
                <div>
                  <p className="text-[11px] font-mono text-muted uppercase tracking-wider mb-1">System Memory</p>
                  <p className="font-bold text-text text-2xl font-mono">{hardware.ram_gb} GB</p>
                  <p className="text-[11px] font-mono text-muted mt-1">Available for CPU fallback</p>
                </div>
              </div>
              
              {/* CPU Card */}
              <div className="bg-surface-2 rounded-btn p-5 border border-line flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-warning-soft text-warning flex items-center justify-center flex-shrink-0">
                  <Cpu size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-mono text-muted uppercase tracking-wider mb-1">Processor</p>
                  <p className="font-bold text-text text-xs leading-tight line-clamp-2 mb-1" title={hardware.cpu_name}>
                    {hardware.cpu_name}
                  </p>
                  <p className="text-xs font-mono text-muted">{hardware.cpu_cores ? `${hardware.cpu_cores} Cores` : 'Detected Processor'}</p>
                </div>
              </div>
              
              {/* OS / Storage Card */}
              <div className="bg-surface-2 rounded-btn p-5 border border-line flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-surface border border-line flex items-center justify-center text-muted flex-shrink-0">
                  <HardDrive size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-mono text-muted uppercase tracking-wider mb-1">Operating System</p>
                  <p className="font-bold text-text text-xs mb-1 truncate">{hardware.os}</p>
                  <p className="text-xs font-mono text-muted">
                    {hardware.disk_free_gb ? `${hardware.disk_free_gb} GB free` : 'Ready for models'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RECOMMENDATIONS SECTION */}
        <div>
          <div className="mb-8">
            <div className="flex items-center gap-2 text-xs font-mono text-success uppercase tracking-wider font-semibold mb-1">
              <Sparkles size={14} />
              <span>Compatible Models</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-text">
              Recommended Models for Your System
            </h2>
            <p className="text-muted text-sm mt-1 max-w-2xl">
              Ranked by quality score. These models and recommended quantizations fit comfortably within your detected hardware limits.
            </p>
          </div>

          {recommendations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {recommendations.map((rec, idx) => (
                <ModelCard key={rec.model_id || rec.id} model={rec} index={idx} />
              ))}
            </div>
          ) : (
            <div className="bg-surface border border-line p-12 text-center rounded-card my-8 shadow-soft">
              <p className="text-muted font-mono text-sm">No models currently match this hardware profile.</p>
            </div>
          )}

          {/* Ad slot below recommendations */}
          <AdSlot slot="verdict-below-recommendations" format="banner" className="my-10" />

          {/* Primary CTA */}
          <div className="text-center pt-20 pb-8 border-t border-line">
            <button 
              type="button"
              onClick={() => navigate('/models')} 
              className="bg-primary hover:bg-primary-hover text-white px-8 py-3.5 rounded-btn font-medium text-sm transition shadow-soft hover:shadow-hover cursor-pointer btn-press inline-flex items-center gap-2"
            >
              <span>Browse All Models in Catalog</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
