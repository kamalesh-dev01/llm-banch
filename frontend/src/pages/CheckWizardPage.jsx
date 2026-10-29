import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  createScanSession, 
  getScannerInfo, 
  getHardwareScan, 
  getModels,
  API_BASE_URL
} from '../api/client'
import useHardwareStore from '../store/hardwareStore'
import InstantChecker from '../components/InstantChecker'
import { 
  Download, 
  Cpu, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  RotateCcw, 
  ArrowRight, 
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Sliders,
  FileCheck2,
  Loader2
} from 'lucide-react'

const STEPS = [
  { id: 1, name: 'Start', desc: 'Choose scan method' },
  { id: 2, name: 'Prepare', desc: 'Session & download' },
  { id: 3, name: 'Run scanner', desc: 'Hardware inspection' },
  { id: 4, name: 'Results', desc: 'View model report' },
]

export default function CheckWizardPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setToken, setHardware } = useHardwareStore()

  const [currentStep, setCurrentStep] = useState(Number(searchParams.get('step')) || 1)
  const [scanMethod, setScanMethod] = useState('scanner') // 'scanner' | 'manual'
  const [selectedModelId, setSelectedModelId] = useState(searchParams.get('model') || '')
  const [availableModels, setAvailableModels] = useState([])

  // Session & scanner info state
  const [sessionToken, setSessionToken] = useState(searchParams.get('token') || null)
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null)
  const [scannerInfo, setScannerInfo] = useState(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [initError, setInitError] = useState(null)

  // Polling state for Step 3
  const [pollStatus, setPollStatus] = useState('waiting') // 'waiting' | 'success' | 'expired' | 'error'
  const [scannedHardware, setScannedHardware] = useState(null)
  const [timeLeftSec, setTimeLeftSec] = useState(1800)
  const pollTimerRef = useRef(null)

  // Fetch real model list for the optional "Check one model" selector
  useEffect(() => {
    getModels({ limit: 40 })
      .then(res => {
        if (Array.isArray(res.data)) {
          setAvailableModels(res.data)
        }
      })
      .catch(err => {
        console.warn('Failed to load models list for wizard select:', err)
      })

    // Preload scanner info
    getScannerInfo()
      .then(res => setScannerInfo(res.data))
      .catch(err => console.warn('Failed to load scanner info:', err))
  }, [])

  useEffect(() => {
    if (currentStep >= 2 && !sessionToken) {
      initializeScanSession()
    }
  }, [currentStep, sessionToken])

  // Step 2 initialization: creates a pending scan session
  const initializeScanSession = async () => {
    setIsInitializing(true)
    setInitError(null)
    try {
      const res = await createScanSession()
      const token = res.data.token
      const expiresAt = res.data.expires_at
      setSessionToken(token)
      setSessionExpiresAt(expiresAt)
      if (expiresAt) {
        const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
        setTimeLeftSec(diff)
      }
      return token
    } catch (err) {
      console.error('Failed to create scan session:', err)
      setInitError('Could not connect to the scan server. You can use the manual picker instead.')
      return null
    } finally {
      setIsInitializing(false)
    }
  }

  // Handle advancing to Prepare step
  const handleProceedToPrepare = async () => {
    setScanMethod('scanner')
    setCurrentStep(2)
    if (!sessionToken) {
      await initializeScanSession()
    }
  }

  // Handle clicking Download button in Step 2 -> advances to Step 3
  const handleDownloadClick = () => {
    if (!sessionToken) return
    setCurrentStep(3)
    setPollStatus('waiting')
  }

  // Polling in Step 3
  useEffect(() => {
    if (currentStep !== 3 || !sessionToken) return

    let isMounted = true

    // Countdown interval
    const intervalTimer = setInterval(() => {
      setTimeLeftSec(prev => {
        if (prev <= 1) {
          setPollStatus('expired')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Polling function
    const checkSessionStatus = async () => {
      try {
        const res = await getHardwareScan(sessionToken)
        if (!isMounted) return

        if (res.status === 200 && res.data?.status === 'complete') {
          // Hardware successfully scanned and submitted!
          setScannedHardware(res.data)
          setPollStatus('success')
          setHardware(res.data)
          setToken(sessionToken)
          clearInterval(intervalTimer)

          // Auto-advance to results after brief visual confirmation
          setTimeout(() => {
            if (selectedModelId) {
              navigate(`/results/${sessionToken}/${selectedModelId}`)
            } else {
              navigate(`/results/${sessionToken}`)
            }
          }, 1600)
        }
      } catch (err) {
        if (!isMounted) return
        if (err.response?.status === 410) {
          setPollStatus('expired')
          clearInterval(intervalTimer)
        } else if (err.response?.status !== 202) {
          // Non-pending error
          console.warn('Scan polling warning:', err)
        }
      }
    }

    // Initial check + 2s polling interval
    checkSessionStatus()
    pollTimerRef.current = setInterval(checkSessionStatus, 2000)

    return () => {
      isMounted = false
      clearInterval(intervalTimer)
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [currentStep, sessionToken, navigate, selectedModelId, setHardware, setToken])

  // Format MM:SS for countdown timer
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const handleReset = () => {
    setCurrentStep(1)
    setPollStatus('waiting')
    setSessionToken(null)
    setSessionExpiresAt(null)
  }

  const downloadUrl = sessionToken 
    ? `${API_BASE_URL}/api/scanner/download?token=${sessionToken}`
    : `${API_BASE_URL}/api/scanner/download`

  return (
    <div className="min-h-screen bg-bg text-text py-10 sm:py-14">
      <Helmet>
        <title>Can I Run It? Hardware Setup Wizard &bull; LLM Bench</title>
        <meta name="description" content="Check which local AI models run on your hardware. Fast 2-second scan or manual GPU picker." />
      </Helmet>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Wizard Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ======================================================== */}
          {/* LEFT: VERTICAL STEPPER                                   */}
          {/* ======================================================== */}
          <div className="lg:col-span-4 bg-surface border border-line rounded-card p-6 shadow-soft sticky top-24">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-line">
              <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center font-bold">
                <Cpu size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text">Hardware Wizard</h2>
                <p className="text-xs text-muted">Model compatibility setup</p>
              </div>
            </div>

            <nav aria-label="Wizard Steps" className="space-y-4">
              {STEPS.map((step, idx) => {
                const isPassed = currentStep > step.id
                const isCurrent = currentStep === step.id
                const isUpcoming = currentStep < step.id

                return (
                  <div key={step.id} className="relative flex items-start gap-3.5 group">
                    {/* Connecting vertical line */}
                    {idx < STEPS.length - 1 && (
                      <div 
                        className={`absolute left-4 top-8 -bottom-4 w-0.5 transition-colors duration-300 ${
                          currentStep > step.id ? 'bg-primary' : 'bg-line'
                        }`} 
                      />
                    )}

                    {/* Step Icon Badge */}
                    <div 
                      className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all duration-300 ${
                        isPassed 
                          ? 'bg-primary text-white shadow-soft' 
                          : isCurrent 
                            ? 'bg-primary-soft text-primary border-2 border-primary ring-4 ring-primary/10' 
                            : 'bg-surface-2 text-muted border border-line'
                      }`}
                    >
                      {isPassed ? <CheckCircle2 size={16} /> : step.id}
                    </div>

                    {/* Step Labels */}
                    <div className="pt-0.5">
                      <div className={`text-xs font-semibold transition-colors ${
                        isCurrent ? 'text-primary' : isPassed ? 'text-text' : 'text-muted'
                      }`}>
                        {step.name}
                      </div>
                      <div className="text-[11px] text-muted">
                        {step.desc}
                      </div>
                    </div>
                  </div>
                )
              })}
            </nav>

            <div className="mt-8 pt-5 border-t border-line text-xs text-muted space-y-2">
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <ShieldCheck size={14} className="text-success" />
                <span>Zero telemetry or tracking</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Only GPU memory, system RAM, and CPU core count are read to calculate token rates.
              </p>
            </div>
          </div>

          {/* ======================================================== */}
          {/* RIGHT: DYNAMIC STEP CONTENT                              */}
          {/* ======================================================== */}
          <div className="lg:col-span-8 bg-surface border border-line rounded-card p-6 sm:p-8 shadow-card min-h-[460px] flex flex-col justify-between">
            <AnimatePresence mode="wait">

              {/* ---------------------------------------------------- */}
              {/* STEP 1: START (CHOOSE METHOD & OPTIONAL MODEL)        */}
              {/* ---------------------------------------------------- */}
              {currentStep === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-text tracking-tight mb-2">
                      Can I run it on my PC?
                    </h1>
                    <p className="text-sm text-muted">
                      Select how you would like to detect your hardware specifications.
                    </p>
                  </div>

                  {/* Optional: Check a specific model select */}
                  <div className="p-4 rounded-card bg-surface-2 border border-line space-y-2">
                    <label htmlFor="model-select" className="block text-xs font-semibold text-text">
                      Optional: Check a specific model
                    </label>
                    <select
                      id="model-select"
                      value={selectedModelId}
                      onChange={(e) => setSelectedModelId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-btn bg-surface border border-line text-text text-sm font-sans focus:outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="">All models (full compatibility report)</option>
                      {availableModels.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.params_b}B &bull; {m.family})
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted">
                      You can evaluate all models or jump straight to a target model&apos;s system requirements.
                    </p>
                  </div>

                  {/* Two Option Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {/* Option 1: Scanner (Recommended) */}
                    <div 
                      onClick={handleProceedToPrepare}
                      className="border-2 border-primary/50 hover:border-primary bg-primary-soft/30 hover:bg-primary-soft/50 rounded-card p-5 cursor-pointer transition-all space-y-3 group text-left relative"
                    >
                      <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-mono font-bold uppercase tracking-wider">
                        Recommended
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-primary text-white flex items-center justify-center shadow-soft">
                        <Download size={20} />
                      </div>
                      <h3 className="text-base font-bold text-text group-hover:text-primary transition">
                        Run the scanner
                      </h3>
                      <p className="text-xs text-muted leading-relaxed">
                        Accurately inspects your dedicated VRAM, system RAM, CPU architecture, and storage in 2 seconds.
                      </p>
                      <div className="pt-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <span>Continue with scanner</span>
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    {/* Option 2: Manual Picker */}
                    <div 
                      onClick={() => setScanMethod('manual')}
                      className={`border rounded-card p-5 cursor-pointer transition-all space-y-3 text-left ${
                        scanMethod === 'manual' 
                          ? 'border-text bg-surface-2' 
                          : 'border-line hover:border-muted bg-surface hover:bg-surface-2'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-surface-2 border border-line text-text flex items-center justify-center">
                        <Sliders size={20} />
                      </div>
                      <h3 className="text-base font-bold text-text">
                        Pick my GPU manually
                      </h3>
                      <p className="text-xs text-muted leading-relaxed">
                        Select your graphics card and system RAM from our database without running any software.
                      </p>
                      <div className="pt-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
                        <span>Use manual dropdown</span>
                        <ArrowRight size={14} />
                      </div>
                    </div>
                  </div>

                  {/* If Manual Chosen: Display InstantChecker inline */}
                  {scanMethod === 'manual' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="pt-4 border-t border-line"
                    >
                      <InstantChecker />
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* ---------------------------------------------------- */}
              {/* STEP 2: PREPARE (DOWNLOAD SCANNER)                   */}
              {/* ---------------------------------------------------- */}
              {currentStep === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-extrabold text-text tracking-tight mb-2">
                      Ready to scan your hardware
                    </h2>
                    <p className="text-sm text-muted">
                      A personalized session token has been created for your PC.
                    </p>
                  </div>

                  {isInitializing ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted">
                      <Loader2 size={28} className="animate-spin text-primary" />
                      <span className="text-sm font-mono">Creating secure scan session...</span>
                    </div>
                  ) : initError ? (
                    <div className="p-4 rounded-card bg-danger-soft border border-danger/30 text-danger text-sm space-y-3">
                      <div className="flex items-center gap-2 font-semibold">
                        <AlertTriangle size={18} />
                        <span>Connection notice</span>
                      </div>
                      <p className="text-xs text-muted">{initError}</p>
                      <button
                        onClick={() => setScanMethod('manual')}
                        className="px-4 py-2 rounded-btn bg-danger text-white text-xs font-semibold"
                      >
                        Switch to manual picker
                      </button>
                    </div>
                  ) : scannerInfo && !scannerInfo.available ? (
                    <div className="p-4 rounded-card bg-warning-soft border border-warning/30 text-warning text-sm space-y-3">
                      <div className="flex items-center gap-2 font-semibold">
                        <AlertTriangle size={18} />
                        <span>Scanner updating</span>
                      </div>
                      <p className="text-xs text-muted">
                        The downloadable executable is currently being updated. Please use the manual picker to continue.
                      </p>
                      <button
                        onClick={() => {
                          setScanMethod('manual')
                          setCurrentStep(1)
                        }}
                        className="px-4 py-2 rounded-btn bg-primary text-white text-xs font-semibold"
                      >
                        Pick GPU manually
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Session Info Card */}
                      <div className="p-4 rounded-card bg-surface-2 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                        <div>
                          <span className="text-muted block text-[11px]">Session Token:</span>
                          <span className="font-bold text-text text-sm">{sessionToken}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-muted block text-[11px]">File Size:</span>
                          <span className="font-semibold text-text">{scannerInfo?.size_mb ? `${scannerInfo.size_mb} MB` : '31.7 MB'}</span>
                        </div>
                      </div>

                      {/* Download CTA Button */}
                      <div className="text-center py-4 space-y-3">
                        <a
                          href={downloadUrl}
                          download={`LLMBench-Scanner-${sessionToken}.exe`}
                          onClick={handleDownloadClick}
                          className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-btn bg-primary hover:bg-primary-hover text-white text-base font-semibold shadow-soft hover:shadow-hover transition-all active:scale-[0.99] cursor-pointer"
                        >
                          <Download size={20} />
                          <span>Download Scanner</span>
                          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono">
                            {scannerInfo?.size_mb ? `${scannerInfo.size_mb} MB` : '31.7 MB'}
                          </span>
                        </a>
                        <p className="text-xs text-muted font-mono">
                          Clicking download will advance to the next step.
                        </p>
                      </div>

                      {/* Transparency checklist */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-line text-xs text-muted">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-success flex-shrink-0" />
                          <span>No installation</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-success flex-shrink-0" />
                          <span>No administrator rights</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-success flex-shrink-0" />
                          <span>Self-deletes when closed</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Back button */}
                  <div className="pt-4 flex items-center justify-between">
                    <button
                      onClick={() => setCurrentStep(1)}
                      className="text-xs font-mono text-muted hover:text-text transition cursor-pointer"
                    >
                      &larr; Back to start
                    </button>
                    <button
                      onClick={() => {
                        setScanMethod('manual')
                        setCurrentStep(1)
                      }}
                      className="text-xs font-mono text-primary hover:underline cursor-pointer"
                    >
                      Use manual picker instead
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ---------------------------------------------------- */}
              {/* STEP 3: RUN SCANNER & LIVE POLLING PULSE             */}
              {/* ---------------------------------------------------- */}
              {currentStep === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-extrabold text-text tracking-tight mb-2">
                      Run the scanner on your PC
                    </h2>
                    <p className="text-sm text-muted">
                      Follow the 3 quick steps below. This page will update automatically.
                    </p>
                  </div>

                  {/* 3 Numbered Mini-steps */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-4 rounded-card bg-surface-2 border border-line space-y-1.5">
                      <div className="w-6 h-6 rounded-full bg-primary-soft text-primary font-mono text-xs font-bold flex items-center justify-center">
                        1
                      </div>
                      <div className="font-semibold text-xs text-text">Open file</div>
                      <p className="text-[11px] text-muted leading-relaxed">
                        Open the downloaded <code className="bg-surface px-1 py-0.5 rounded text-[10px]">LLMBench-Scanner.exe</code> in your Downloads folder.
                      </p>
                    </div>

                    <div className="p-4 rounded-card bg-warning-soft/50 border border-warning/30 space-y-2">
                      <div className="w-6 h-6 rounded-full bg-warning/20 text-warning font-mono text-xs font-bold flex items-center justify-center">
                        2
                      </div>
                      <div className="font-semibold text-xs text-warning flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4"/><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636-2.87L13.637 3.59a1.914 1.914 0 0 0-3.274 0z"/><path d="M12 17h.01"/></svg>
                        Windows SmartScreen — this is normal!
                      </div>
                      <p className="text-[11px] text-muted leading-relaxed">
                        Since the scanner is brand new, Windows shows a warning. It's safe — the code is open-source.
                      </p>
                      <ol className="text-[11px] text-muted leading-relaxed list-decimal list-inside space-y-1">
                        <li>Click the small <strong className="text-text">"More info"</strong> text on the warning</li>
                        <li>Click the <strong className="text-text">"Run anyway"</strong> button that appears</li>
                      </ol>
                    </div>

                    <div className="p-4 rounded-card bg-surface-2 border border-line space-y-1.5">
                      <div className="w-6 h-6 rounded-full bg-primary-soft text-primary font-mono text-xs font-bold flex items-center justify-center">
                        3
                      </div>
                      <div className="font-semibold text-xs text-text">Wait for Done</div>
                      <p className="text-[11px] text-muted leading-relaxed">
                        The inspection runs in 2 seconds. When it says <strong className="text-text">&ldquo;All done!&rdquo;</strong>, this page opens your report.
                      </p>
                    </div>
                  </div>

                  {/* Live Waiting Pulse Card & Real-time Inspection Checklist */}
                  <div className="p-6 rounded-card bg-surface-2 border border-line text-center space-y-5">
                    {pollStatus === 'waiting' && (
                      <div className="space-y-4">
                        <div className="relative inline-flex items-center justify-center">
                          <span className="w-4 h-4 rounded-full bg-primary animate-ping absolute" />
                          <span className="w-3.5 h-3.5 rounded-full bg-primary relative" />
                        </div>
                        <div>
                          <div className="text-base font-bold text-text">
                            Waiting for scanner signal...
                          </div>
                          <p className="text-xs text-muted max-w-md mx-auto mt-1">
                            Listening on session <code className="font-mono text-primary bg-surface px-1.5 py-0.5 rounded">{sessionToken}</code>
                          </p>
                        </div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-line font-mono text-xs text-muted">
                          <Clock size={13} />
                          <span>Session expires in {formatTime(timeLeftSec)}</span>
                        </div>
                      </div>
                    )}

                    {/* Shared Inspection Checklist matching the Desktop Scanner */}
                    <div className="p-4 rounded-btn bg-surface border border-line text-left space-y-2.5 max-w-md mx-auto text-xs font-mono">
                      <div className="flex items-center justify-between text-muted pb-2 border-b border-line text-[11px] font-sans font-semibold uppercase tracking-wider">
                        <span>Hardware Inspection</span>
                        <span className={pollStatus === 'success' ? 'text-success font-mono font-bold' : 'text-primary font-mono'}>
                          {pollStatus === 'success' ? '✔ Synchronized' : 'Listening...'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 text-text">
                        {pollStatus === 'success' ? (
                          <CheckCircle2 size={15} className="text-success flex-shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-primary/50 border-t-transparent animate-spin flex-shrink-0" />
                        )}
                        <span className="truncate">
                          {pollStatus === 'success' && scannedHardware?.gpu_name
                            ? `Graphics card: ${scannedHardware.gpu_name} (${scannedHardware.vram_gb} GB)`
                            : 'Graphics card: Inspecting GPU & VRAM...'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 text-text">
                        {pollStatus === 'success' ? (
                          <CheckCircle2 size={15} className="text-success flex-shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-primary/50 border-t-transparent animate-spin flex-shrink-0" />
                        )}
                        <span className="truncate">
                          {pollStatus === 'success' && scannedHardware?.ram_gb
                            ? `Memory: ${scannedHardware.ram_gb} GB RAM`
                            : 'Memory: Inspecting system RAM...'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 text-text">
                        {pollStatus === 'success' ? (
                          <CheckCircle2 size={15} className="text-success flex-shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-primary/50 border-t-transparent animate-spin flex-shrink-0" />
                        )}
                        <span className="truncate">
                          {pollStatus === 'success' && scannedHardware?.cpu_name
                            ? `Processor: ${scannedHardware.cpu_name}`
                            : 'Processor: Inspecting CPU cores...'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 text-text">
                        {pollStatus === 'success' ? (
                          <CheckCircle2 size={15} className="text-success flex-shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-primary/50 border-t-transparent animate-spin flex-shrink-0" />
                        )}
                        <span className="truncate">
                          {pollStatus === 'success'
                            ? 'Storage: Free disk space verified'
                            : 'Storage: Inspecting free disk space...'}
                        </span>
                      </div>
                    </div>

                    {pollStatus === 'success' && (
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="pt-2 text-success space-y-1"
                      >
                        <div className="text-sm font-bold text-text">Hardware synced! Opening your report...</div>
                      </motion.div>
                    )}

                    {pollStatus === 'expired' && (
                      <div className="py-2 space-y-3 text-danger">
                        <AlertTriangle size={36} className="mx-auto" />
                        <div className="text-base font-bold text-text">Scan session expired</div>
                        <p className="text-xs text-muted max-w-md mx-auto">
                          Sessions expire after 30 minutes for security. Please create a fresh session or use the manual picker.
                        </p>
                        <button
                          onClick={handleReset}
                          className="px-4 py-2 rounded-btn bg-primary text-white text-xs font-semibold"
                        >
                          Start over
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions & Fallbacks */}
                  <div className="pt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleReset}
                        className="flex items-center gap-1.5 text-muted hover:text-text transition cursor-pointer"
                      >
                        <RotateCcw size={13} />
                        <span>Start over</span>
                      </button>
                      <span className="text-line">&bull;</span>
                      <a
                        href={downloadUrl}
                        download={`LLMBench-Scanner-${sessionToken}.exe`}
                        className="text-primary hover:underline cursor-pointer"
                      >
                        Re-download scanner
                      </a>
                    </div>

                    <button
                      onClick={() => {
                        setScanMethod('manual')
                        setCurrentStep(1)
                      }}
                      className="text-primary hover:underline cursor-pointer"
                    >
                      Use manual picker instead
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

        </div>
      </div>
    </div>
  )
}
