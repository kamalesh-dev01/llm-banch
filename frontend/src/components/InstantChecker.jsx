import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGpus, submitHardwareScan } from '../api/client'
import useHardwareStore from '../store/hardwareStore'
import { Cpu, Search, Check, ChevronDown, Terminal, Sparkles, Loader2 } from 'lucide-react'

// Comprehensive fallback list if backend is momentarily unreachable
const DEFAULT_GPUS = [
  { name: "RTX 4090", vram_gb: 24 },
  { name: "RTX 4080", vram_gb: 16 },
  { name: "RTX 4070 Ti", vram_gb: 12 },
  { name: "RTX 4070 Super", vram_gb: 12 },
  { name: "RTX 4070", vram_gb: 12 },
  { name: "RTX 4060 Ti", vram_gb: 16 },
  { name: "RTX 4060", vram_gb: 8 },
  { name: "RTX 4050", vram_gb: 6 },
  { name: "RTX 3090", vram_gb: 24 },
  { name: "RTX 3080 Ti", vram_gb: 12 },
  { name: "RTX 3080", vram_gb: 10 },
  { name: "RTX 3070 Ti", vram_gb: 8 },
  { name: "RTX 3070", vram_gb: 8 },
  { name: "RTX 3060", vram_gb: 12 },
  { name: "RTX 3060 Ti", vram_gb: 8 },
  { name: "RTX 3050", vram_gb: 8 },
  { name: "RTX 3050 Laptop", vram_gb: 4 },
  { name: "RTX 2080 Ti", vram_gb: 11 },
  { name: "RTX 2070", vram_gb: 8 },
  { name: "RTX 2060", vram_gb: 6 },
  { name: "RTX 2050", vram_gb: 4 },
  { name: "GTX 1080 Ti", vram_gb: 11 },
  { name: "GTX 1070", vram_gb: 8 },
  { name: "GTX 1060", vram_gb: 6 },
  { name: "Apple M3 Max", vram_gb: 36 },
  { name: "Apple M3 Pro", vram_gb: 18 },
  { name: "Apple M2 Max", vram_gb: 32 },
  { name: "Apple M2 Pro", vram_gb: 16 },
  { name: "Apple M1", vram_gb: 8 },
  { name: "RX 7900 XTX", vram_gb: 24 },
  { name: "RX 7800 XT", vram_gb: 16 },
  { name: "RX 6700 XT", vram_gb: 12 },
]

const RAM_OPTIONS = [8, 16, 32, 64]

export default function InstantChecker() {
  const navigate = useNavigate()
  const { setToken } = useHardwareStore()

  const [gpus, setGpus] = useState(DEFAULT_GPUS)
  const [selectedGpu, setSelectedGpu] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [selectedRam, setSelectedRam] = useState(16)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const dropdownRef = useRef(null)

  // Fetch complete GPU database from backend /api/gpus
  useEffect(() => {
    getGpus()
      .then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setGpus(res.data)
        }
      })
      .catch(err => {
        console.warn('Could not load /api/gpus, using fallback list:', err)
      })
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter GPUs based on search input
  const filteredGpus = gpus.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSelectGpu = (gpu) => {
    setSelectedGpu(gpu)
    setSearchQuery(gpu.name)
    setIsDropdownOpen(false)
    setErrorMsg('')
  }

  const handleCheck = async () => {
    if (!selectedGpu) {
      setErrorMsg('Please select a GPU from the list')
      setIsDropdownOpen(true)
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')

    try {
      const payload = {
        gpu_name: selectedGpu.name,
        vram_gb: selectedGpu.vram_gb,
        ram_gb: selectedRam,
        cpu_name: "Manual entry",
        cpu_cores: 0,
        os: "Unknown"
      }

      const response = await submitHardwareScan(payload)
      const token = response.data?.token

      if (token) {
        setToken(token)
        navigate(`/scan-result?token=${token}`)
      } else {
        throw new Error('No token returned from scan')
      }
    } catch (err) {
      console.error('Instant check failed:', err)
      setErrorMsg('Could not submit hardware scan. Check backend connection.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto glass glow-border p-6 md:p-8 rounded-2xl shadow-2xl relative">
      {/* Card Header Badge */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
            <Sparkles size={15} />
          </div>
          <span className="font-heading font-bold text-sm tracking-wide text-text uppercase">
            Instant Hardware Checker
          </span>
        </div>
        <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-recommended/15 text-recommended border border-recommended/30">
          No download needed
        </span>
      </div>

      <div className="space-y-5">
        {/* GPU Selector with Search */}
        <div className="relative text-left" ref={dropdownRef}>
          <label className="block text-xs font-mono uppercase tracking-wider text-muted mb-2 font-semibold">
            1. Select Your GPU
          </label>
          
          <div className="relative">
            <input
              type="text"
              placeholder="Search GPU (e.g. RTX 3060, M2, RX 6700)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setIsDropdownOpen(true)
                if (selectedGpu && e.target.value !== selectedGpu.name) {
                  setSelectedGpu(null)
                }
              }}
              onFocus={() => setIsDropdownOpen(true)}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 pl-10 text-sm text-text font-mono placeholder:text-muted/60 focus:outline-none focus:border-accent transition shadow-inner"
            />
            <Search size={16} className="absolute left-3.5 top-3.5 text-muted pointer-events-none" />
            
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="absolute right-3.5 top-3.5 text-muted hover:text-text transition"
            >
              <ChevronDown size={16} className={`transform transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Search Dropdown Results */}
          {isDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto bg-surface/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl z-50 divide-y divide-border/50">
              {filteredGpus.length > 0 ? (
                filteredGpus.map((gpu) => (
                  <button
                    key={gpu.name}
                    type="button"
                    onClick={() => handleSelectGpu(gpu)}
                    className="w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-elevated transition cursor-pointer text-xs font-mono"
                  >
                    <span className="font-semibold text-text">{gpu.name}</span>
                    <span className="px-2 py-0.5 rounded bg-elevated border border-border text-accent font-bold">
                      {gpu.vram_gb} GB VRAM
                    </span>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-muted font-mono">
                  No matching GPU found. Try typing &ldquo;RTX&rdquo; or &ldquo;M1&rdquo;.
                </div>
              )}
            </div>
          )}

          {selectedGpu && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs font-mono text-recommended">
              <Check size={12} />
              <span>Selected: {selectedGpu.name} &bull; {selectedGpu.vram_gb} GB Dedicated VRAM</span>
            </div>
          )}
        </div>

        {/* System RAM Selector */}
        <div className="text-left">
          <label className="block text-xs font-mono uppercase tracking-wider text-muted mb-2 font-semibold">
            2. System RAM
          </label>
          <div className="grid grid-cols-4 gap-2">
            {RAM_OPTIONS.map((ram) => (
              <button
                key={ram}
                type="button"
                onClick={() => setSelectedRam(ram)}
                className={`py-2.5 rounded-xl border text-xs font-mono font-bold transition cursor-pointer flex flex-col items-center justify-center ${
                  selectedRam === ram
                    ? 'bg-accent/15 border-accent text-accent shadow-sm'
                    : 'bg-surface border-border text-muted hover:border-border/80 hover:text-text'
                }`}
              >
                <span>{ram} GB</span>
              </button>
            ))}
          </div>
        </div>

        {/* Error notification if any */}
        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-not-recommended/10 border border-not-recommended/30 text-not-recommended text-xs font-mono">
            {errorMsg}
          </div>
        )}

        {/* Primary CTA Button */}
        <div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleCheck}
            className="w-full py-3.5 px-6 rounded-xl bg-accent text-bg font-heading font-bold text-base hover:bg-accent/90 transition shadow-lg shadow-accent/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Evaluating Hardware...</span>
              </>
            ) : (
              <>
                <Cpu size={18} />
                <span>Check My Hardware</span>
              </>
            )}
          </button>
        </div>

        {/* Alternative Link for Native Scanner */}
        <div className="pt-2">
          <a
            href="http://localhost:8000/api/scanner/download"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-accent font-mono transition"
          >
            <Terminal size={12} />
            <span>Want exact automated detection? Download the scanner</span>
          </a>
        </div>
      </div>
    </div>
  )
}
