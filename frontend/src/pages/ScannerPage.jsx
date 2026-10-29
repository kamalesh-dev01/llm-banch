import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { getScannerInfo, API_BASE_URL } from '../api/client'
import Reveal from '../components/motion/Reveal'
import {
  Download,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Monitor,
  HardDrive,
  Cpu,
  Lock,
  ArrowRight,
  Info,
  Terminal,
  ExternalLink
} from 'lucide-react'

export default function ScannerPage() {
  const [scannerInfo, setScannerInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copiedSha, setCopiedSha] = useState(false)

  useEffect(() => {
    getScannerInfo()
      .then(res => setScannerInfo(res.data))
      .catch(err => {
        console.warn('Could not load scanner info from API:', err)
        setScannerInfo({
          available: false,
          version: null,
          size_mb: null,
          sha256: null,
          filename: 'LLMBench-Scanner.exe'
        })
      })
      .finally(() => setLoading(false))
  }, [])

  const handleCopySha = () => {
    if (scannerInfo?.sha256) {
      navigator.clipboard.writeText(scannerInfo.sha256)
      setCopiedSha(true)
      setTimeout(() => setCopiedSha(false), 2000)
    }
  }

  const downloadUrl = `${API_BASE_URL}/api/scanner/download`
  const isAvailable = scannerInfo?.available !== false

  return (
    <>
      <Helmet>
        <title>Download Scanner — LLM Bench</title>
        <meta
          name="description"
          content="Download the lightweight LLM Bench hardware scanner for Windows. Checks VRAM, RAM, and CPU in 3 seconds to find compatible local AI models."
        />
      </Helmet>

      <div className="w-full pb-20">
        {/* ======================================================== */}
        {/* 1. HERO SECTION                                          */}
        {/* ======================================================== */}
        <section className="relative pt-12 pb-16 overflow-hidden">
          {/* Subtle gradient background blobs */}
          <div className="hero-blob-1" />
          <div className="hero-blob-2" />

          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl text-center relative z-10">
            <Reveal>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-2 border border-line text-xs font-mono text-muted mb-6">
                <ShieldCheck size={14} className="text-success" />
                <span>Open Source &bull; Read-Only &bull; No Installation</span>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-text tracking-tight mb-5">
                LLM Bench Scanner
              </h1>
            </Reveal>

            <Reveal delay={0.2}>
              <p className="text-base sm:text-lg text-muted max-w-2xl mx-auto mb-8 leading-relaxed">
                A single lightweight binary for Windows that inspects your GPU VRAM, system RAM, and CPU in under 3 seconds. It automatically opens your browser with your personalized model compatibility verdict.
              </p>
            </Reveal>

            {/* Download CTA Button & Real Specs */}
            <Reveal delay={0.3}>
              <div className="flex flex-col items-center justify-center gap-4">
                {isAvailable ? (
                  <a
                    href={downloadUrl}
                    download="LLMBench-Scanner.exe"
                    className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-btn bg-primary hover:bg-primary-hover text-white font-medium text-base shadow-soft hover:shadow-hover transition-all active:scale-[0.99] cursor-pointer"
                  >
                    <Download size={20} />
                    <span>Download for Windows (64-bit)</span>
                    {scannerInfo?.size_mb && (
                      <span className="text-xs opacity-80 font-mono bg-white/20 px-2 py-0.5 rounded-full ml-1">
                        {scannerInfo.size_mb} MB
                      </span>
                    )}
                  </a>
                ) : (
                  <div className="p-4 rounded-card bg-surface border border-line text-muted text-sm font-mono">
                    Scanner executable is currently updating. Use the instant web checker below.
                  </div>
                )}

                <div className="text-xs font-mono text-muted flex flex-wrap items-center justify-center gap-3">
                  <span>Version {scannerInfo?.version || '1.0.0'}</span>
                  <span>&bull;</span>
                  <span>Windows 10 / 11 (64-bit)</span>
                  <span>&bull;</span>
                  <span>Self-contained EXE</span>
                </div>

                <div className="pt-2">
                  <Link
                    to="/check"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-mono"
                  >
                    <span>Prefer not to install? Use the instant checker</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 2. WHAT IT CHECKS vs WHAT IT NEVER TOUCHES               */}
        {/* ======================================================== */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* What it checks */}
            <Reveal delay={0.1}>
              <div className="bg-surface border border-line rounded-card p-6 sm:p-8 h-full shadow-soft">
                <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-line">
                  <div className="w-8 h-8 rounded-lg bg-success-soft text-success flex items-center justify-center">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-text">What it checks</h2>
                    <p className="text-xs text-muted">Hardware specifications needed for model memory sizing</p>
                  </div>
                </div>

                <ul className="space-y-4 text-sm text-text">
                  <li className="flex items-start gap-3">
                    <Monitor size={17} className="text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="font-semibold block">GPU Model &amp; Dedicated VRAM</strong>
                      <span className="text-xs text-muted">Checks NVIDIA (NVML), AMD, or Intel GPU to verify memory capacity.</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Cpu size={17} className="text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="font-semibold block">System RAM (Installed &amp; Available)</strong>
                      <span className="text-xs text-muted">Identifies if larger models can partially offload to system memory.</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <HardDrive size={17} className="text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="font-semibold block">CPU Architecture &amp; Core Count</strong>
                      <span className="text-xs text-muted">Measures CPU thread capacity for CPU-fallback generation.</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <HardDrive size={17} className="text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="font-semibold block">Free Disk Storage</strong>
                      <span className="text-xs text-muted">Ensures your drive has enough room to download GGUF weight files.</span>
                    </div>
                  </li>
                </ul>
              </div>
            </Reveal>

            {/* What it never touches */}
            <Reveal delay={0.2}>
              <div className="bg-surface border border-line rounded-card p-6 sm:p-8 h-full shadow-soft">
                <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-line">
                  <div className="w-8 h-8 rounded-lg bg-danger-soft text-danger flex items-center justify-center">
                    <XCircle size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-text">What it never touches</h2>
                    <p className="text-xs text-muted">Strict privacy boundaries built into the scanner code</p>
                  </div>
                </div>

                <ul className="space-y-4 text-sm text-text">
                  <li className="flex items-start gap-3">
                    <Lock size={17} className="text-danger mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="font-semibold block">Personal Files &amp; Documents</strong>
                      <span className="text-xs text-muted">Never reads or scans your hard drive directories, documents, or media.</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Lock size={17} className="text-danger mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="font-semibold block">Browser History &amp; Cookies</strong>
                      <span className="text-xs text-muted">Zero access to web browsers, cookies, logins, or active sessions.</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Lock size={17} className="text-danger mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="font-semibold block">User Accounts &amp; Passwords</strong>
                      <span className="text-xs text-muted">Does not query credentials, keychain, or account registries.</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Lock size={17} className="text-danger mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="font-semibold block">Third-Party Network Requests</strong>
                      <span className="text-xs text-muted">Only sends the 4 detected hardware numbers to LLM Bench to create your session.</span>
                    </div>
                  </li>
                </ul>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 3. THREE-STEP RUN INSTRUCTIONS                           */}
        {/* ======================================================== */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl py-12">
          <Reveal>
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-text mb-2">
                How to Run the Scanner
              </h2>
              <p className="text-sm text-muted">No installer, no background service, no administrator rights.</p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Reveal delay={0.1}>
              <div className="bg-surface border border-line rounded-card p-6 text-center space-y-3 h-full">
                <div className="w-12 h-12 rounded-full bg-primary-soft text-primary font-mono font-bold text-lg flex items-center justify-center mx-auto">
                  1
                </div>
                <h3 className="font-bold text-text text-base">Download</h3>
                <p className="text-xs text-muted leading-relaxed">
                  Download <code className="bg-surface-2 px-1.5 py-0.5 rounded text-text font-mono text-[11px]">LLMBench-Scanner.exe</code> to your Downloads folder or desktop.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="bg-surface border border-line rounded-card p-6 text-center space-y-3 h-full">
                <div className="w-12 h-12 rounded-full bg-primary-soft text-primary font-mono font-bold text-lg flex items-center justify-center mx-auto">
                  2
                </div>
                <h3 className="font-bold text-text text-base">Run</h3>
                <p className="text-xs text-muted leading-relaxed">
                  Double-click the file to execute. The scan finishes in about 2 seconds without installing anything.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.3}>
              <div className="bg-surface border border-line rounded-card p-6 text-center space-y-3 h-full">
                <div className="w-12 h-12 rounded-full bg-primary-soft text-primary font-mono font-bold text-lg flex items-center justify-center mx-auto">
                  3
                </div>
                <h3 className="font-bold text-text text-base">See Results</h3>
                <p className="text-xs text-muted leading-relaxed">
                  Your browser will open automatically with your personalized hardware report and model recommendations.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 4. WINDOWS SMARTSCREEN NOTE                              */}
        {/* ======================================================== */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl py-6">
          <Reveal>
            <div className="bg-warning-soft border border-warning/30 rounded-card p-6 sm:p-7 flex flex-col sm:flex-row items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-warning/20 text-warning flex items-center justify-center flex-shrink-0 mt-0.5">
                <Info size={20} />
              </div>
              <div className="space-y-2 text-sm">
                <h3 className="font-bold text-text text-base">
                  Windows SmartScreen notice
                </h3>
                <p className="text-muted leading-relaxed">
                  Because LLM Bench is an independent open-source project and our binary is not yet code-signed with a commercial EV certificate, Windows SmartScreen may show <span className="font-medium text-text">&ldquo;Windows protected your PC&rdquo;</span> on first run.
                </p>
                <p className="text-xs font-mono text-muted">
                  To continue: click <span className="font-bold text-text">More info</span>, then click <span className="font-bold text-text">Run anyway</span>.
                </p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ======================================================== */}
        {/* 5. VERIFICATION CHECKSUM (SHA-256)                       */}
        {/* ======================================================== */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl py-6">
          <Reveal>
            <div className="bg-surface border border-line rounded-card p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono uppercase tracking-wider text-muted font-semibold">
                  SHA-256 Checksum Verification
                </div>
                <button
                  type="button"
                  onClick={handleCopySha}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-surface-2 hover:bg-line border border-line text-xs font-mono text-text transition cursor-pointer"
                >
                  {copiedSha ? (
                    <>
                      <Check size={13} className="text-success" />
                      <span className="text-success font-semibold">Copied hash</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} className="text-muted" />
                      <span>Copy SHA-256</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-surface-2 p-3 rounded-lg border border-line font-mono text-xs text-text break-all select-all">
                {scannerInfo?.sha256 || 'Loading verification hash...'}
              </div>

              <p className="text-[11px] text-muted font-mono">
                Verify in PowerShell: <code className="text-text font-bold">Get-FileHash .\LLMBench-Scanner.exe</code>
              </p>
            </div>
          </Reveal>
        </section>

        {/* ======================================================== */}
        {/* 6. SYSTEM REQUIREMENTS & ALTERNATIVE                     */}
        {/* ======================================================== */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl py-8 text-center">
          <Reveal>
            <div className="p-8 rounded-card bg-surface border border-line space-y-4">
              <h3 className="text-lg font-bold text-text">
                System Requirements
              </h3>
              <p className="text-xs sm:text-sm text-muted max-w-xl mx-auto">
                Compatible with Windows 10 and Windows 11 (64-bit). Works on systems with NVIDIA GeForce / RTX, AMD Radeon, Intel Arc, and integrated Intel / AMD graphics.
              </p>
              <div className="pt-2">
                <Link
                  to="/check"
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-btn bg-surface-2 hover:bg-line border border-line text-xs font-mono font-semibold text-text transition"
                >
                  <span>Prefer the web version? Check hardware instantly</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </div>
    </>
  )
}
