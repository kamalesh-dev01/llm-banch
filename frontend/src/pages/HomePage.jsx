import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { getModels, getDbStats, getFamilies, getScannerInfo } from '../api/client'
import ModelCard from '../components/ModelCard'
import InstantChecker from '../components/InstantChecker'
import StatCounter from '../components/StatCounter'
import Reveal from '../components/motion/Reveal'
import SplitText from '../components/motion/SplitText'
import CountUp from '../components/motion/CountUp'
import Marquee from '../components/motion/Marquee'
import { 
  ArrowRight, 
  Cpu, 
  CheckCircle2, 
  Download, 
  Sparkles, 
  ChevronDown, 
  HelpCircle,
  HardDrive,
  Activity,
  Layers,
  ShieldCheck,
  Check
} from 'lucide-react'

export default function HomePage() {
  const [stats, setStats] = useState(null)
  const [families, setFamilies] = useState([])
  const [topModel, setTopModel] = useState(null)
  const [featuredModels, setFeaturedModels] = useState([])
  const [scannerSize, setScannerSize] = useState(null)
  const [activeTab, setActiveTab] = useState('quality')
  const [loadingFeatured, setLoadingFeatured] = useState(true)
  const [openFaq, setOpenFaq] = useState(null)

  // Fetch initial data: stats, families, top quality model
  useEffect(() => {
    getDbStats()
      .then(res => setStats(res.data))
      .catch(err => console.warn('Could not load stats:', err))

    getFamilies()
      .then(res => {
        if (Array.isArray(res.data)) {
          setFamilies(res.data)
        }
      })
      .catch(err => console.warn('Could not load families:', err))

    getModels({ sort: 'quality', limit: 1 })
      .then(res => {
        const raw = Array.isArray(res.data) ? res.data : (res.data.models || [])
        if (raw.length > 0) {
          setTopModel(raw[0])
        }
      })
      .catch(err => console.warn('Could not load top model:', err))

    getScannerInfo()
      .then(res => {
        if (res.data?.available && res.data?.size_mb) {
          setScannerSize(res.data.size_mb)
        }
      })
      .catch(err => console.warn('Could not load scanner info:', err))
  }, [])

  // Fetch tabbed featured models whenever activeTab changes
  useEffect(() => {
    setLoadingFeatured(true)
    getModels({ sort: activeTab, limit: 6 })
      .then(res => {
        const raw = Array.isArray(res.data) ? res.data : (res.data.models || [])
        setFeaturedModels(raw.slice(0, 6))
      })
      .catch(err => console.warn('Could not load featured models:', err))
      .finally(() => setLoadingFeatured(false))
  }, [activeTab])

  const toggleFaq = (idx) => {
    setOpenFaq(prev => prev === idx ? null : idx)
  }

  const faqItems = [
    {
      q: "Is the scanner safe to run?",
      a: "Yes. The scanner is open-source and strictly read-only. It queries only your GPU model, VRAM size, system RAM, and CPU specifications. It never scans your documents, never accesses your browser or passwords, and does not require administrator privileges."
    },
    {
      q: "What data do you collect?",
      a: "When you run the scanner or submit the instant web checker, only four hardware parameters (GPU name, VRAM size, RAM size, CPU model) are sent to our server to match against model memory requirements. We never collect IP addresses, usernames, personal identities, or data from running models."
    },
    {
      q: "How accurate are the speed estimates?",
      a: "Our speed predictor is calibrated on real Ollama inference benchmarks measuring tokens per second across varied hardware memory bandwidth limits. When a model fits entirely within GPU VRAM, estimates are typically within ~15–20% of actual generation speed. If weights spill into CPU memory, the estimate accurately reflects the speed drop."
    },
    {
      q: "Does it work on Mac or Linux?",
      a: "The instant web checker supports all hardware including Apple Silicon (M1, M2, M3, M4) and Linux systems with NVIDIA or AMD GPUs. The standalone downloadable executable is currently built for Windows 10/11 64-bit; Mac and Linux users can use the instant checker."
    },
    {
      q: "Why is the scanner Windows-only?",
      a: "Windows represents the largest share of desktop GPUs and workstations running local Ollama inference. We are actively developing lightweight terminal commands and native binaries for macOS and Linux."
    }
  ]

  return (
    <>
      <Helmet>
        <title>LLM Bench — Find the AI models your PC can actually run</title>
        <meta
          name="description"
          content="Find open-source AI models that fit your GPU and RAM. Get realistic tokens/sec speed estimates and one-click Ollama commands based on real hardware benchmarks."
        />
      </Helmet>

      <div className="w-full pb-20 space-y-24 sm:space-y-32">
        {/* ======================================================== */}
        {/* 1. HERO SECTION                                          */}
        {/* ======================================================== */}
        <section className="relative pt-8 sm:pt-14 pb-12 overflow-hidden">
          {/* Subtle background ambient glow */}
          <div className="hero-blob-1" />
          <div className="hero-blob-2" />

          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
              {/* Left Column: Headlines & Call to Actions */}
              <div className="lg:col-span-6 text-left space-y-6">
                <Reveal>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-pill bg-surface-2 border border-line text-xs font-mono text-muted">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    <span>Real Ollama Benchmarks &bull; No Guesswork</span>
                  </div>
                </Reveal>

                <div className="space-y-3">
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-text tracking-tight leading-[1.08]">
                    Find the AI models your PC can{' '}
                    <span className="brand-gradient-text">actually run</span>.
                  </h1>
                  <p className="text-base sm:text-lg text-muted max-w-xl leading-relaxed">
                    Check your GPU VRAM, memory bandwidth, and system RAM to see which open-source LLMs fit and how fast they&apos;ll generate tokens.
                  </p>
                </div>

                <Reveal delay={0.15}>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Link
                      to="/check"
                      className="px-6 py-3 rounded-btn bg-primary hover:bg-primary-hover text-white font-medium text-sm transition shadow-soft hover:shadow-hover flex items-center gap-2 btn-press cursor-pointer"
                    >
                      <Cpu size={16} />
                      <span>Check my PC</span>
                    </Link>
                    <Link
                      to="/models"
                      className="px-6 py-3 rounded-btn bg-surface hover:bg-surface-2 border border-line text-text font-medium text-sm transition flex items-center gap-2 btn-press"
                    >
                      <span>Browse models</span>
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                </Reveal>
              </div>

              {/* Right Column: Instant Checker Card */}
              <div className="lg:col-span-6">
                <Reveal delay={0.2}>
                  <InstantChecker />
                </Reveal>
              </div>
            </div>

            {/* Live Database Stat Counters */}
            {stats && (
              <div className="mt-16 pt-10 border-t border-line">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                  <StatCounter
                    endValue={stats.models || 20}
                    suffix="+"
                    label="Verified Models"
                    colorClass="text-primary"
                  />
                  <StatCounter
                    endValue={stats.quants || 47}
                    suffix="+"
                    label="Quantizations"
                    colorClass="text-accent"
                  />
                  <StatCounter
                    endValue={stats.families || 7}
                    label="Model Families"
                    colorClass="text-success"
                  />
                  <StatCounter
                    endValue={stats.gpus_supported || 133}
                    suffix="+"
                    label="Indexed GPUs"
                    colorClass="text-warning"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ======================================================== */}
        {/* 2. FAMILIES MARQUEE                                      */}
        {/* ======================================================== */}
        {families.length > 0 && (
          <section className="py-4 border-y border-line bg-surface-2/40 overflow-hidden">
            <div className="container mx-auto px-4 mb-3 text-center">
              <span className="text-xs font-mono uppercase tracking-wider text-muted font-semibold">
                Supported Model Families &amp; Architectures
              </span>
            </div>
            <Marquee
              speed={28}
              items={families}
              renderItem={(item) => (
                <Link
                  key={item.family}
                  to={`/models?family=${item.family}`}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-pill bg-surface border border-line hover:border-primary text-xs font-mono text-text transition shadow-soft mr-3"
                >
                  <span className="font-bold capitalize">{item.family}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-surface-2 text-muted text-[10px]">
                    {item.count} models
                  </span>
                </Link>
              )}
            />
          </section>
        )}

        {/* ======================================================== */}
        {/* 3. HOW IT WORKS                                          */}
        {/* ======================================================== */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <Reveal>
            <div className="text-center mb-14 space-y-2">
              <span className="text-xs font-mono uppercase tracking-wider text-primary font-bold">
                Simple 3-Step Verification
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-text">
                How LLM Bench Works
              </h2>
              <p className="text-sm text-muted max-w-lg mx-auto">
                No guessing required. We match your hardware limits with real loaded memory footprints.
              </p>
            </div>
          </Reveal>

          <div className="relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-1/2 left-[15%] right-[15%] h-0.5 bg-line -translate-y-1/2 z-0" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
              {/* Step 1 */}
              <Reveal delay={0.1}>
                <div className="bg-surface border border-line rounded-card p-6 text-center space-y-3 shadow-soft h-full">
                  <div className="w-12 h-12 rounded-full bg-primary-soft text-primary font-mono font-bold text-base flex items-center justify-center mx-auto mb-2">
                    01
                  </div>
                  <h3 className="font-bold text-text text-base">Pick your GPU or run scanner</h3>
                  <p className="text-xs text-muted leading-relaxed">
                    Select your graphics card and RAM in the instant checker, or run our fast read-only Windows scanner.
                  </p>
                </div>
              </Reveal>

              {/* Step 2 */}
              <Reveal delay={0.2}>
                <div className="bg-surface border border-line rounded-card p-6 text-center space-y-3 shadow-soft h-full">
                  <div className="w-12 h-12 rounded-full bg-primary-soft text-primary font-mono font-bold text-base flex items-center justify-center mx-auto mb-2">
                    02
                  </div>
                  <h3 className="font-bold text-text text-base">We compare real model sizes</h3>
                  <p className="text-xs text-muted leading-relaxed">
                    We compare your VRAM against actual loaded memory sizes, including context window and KV cache allocations.
                  </p>
                </div>
              </Reveal>

              {/* Step 3 */}
              <Reveal delay={0.3}>
                <div className="bg-surface border border-line rounded-card p-6 text-center space-y-3 shadow-soft h-full">
                  <div className="w-12 h-12 rounded-full bg-primary-soft text-primary font-mono font-bold text-base flex items-center justify-center mx-auto mb-2">
                    03
                  </div>
                  <h3 className="font-bold text-text text-base">Get compatibility &amp; speeds</h3>
                  <p className="text-xs text-muted leading-relaxed">
                    See what runs completely in VRAM, what runs slowly via system RAM, and copy verified launch commands.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 4. SHOW, DON'T TELL (Real Model & Real Verdict Preview)   */}
        {/* ======================================================== */}
        {topModel && (
          <section className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
            <Reveal>
              <div className="bg-surface border border-line rounded-card p-6 sm:p-10 shadow-card">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  {/* Left: What our verdict looks like */}
                  <div className="lg:col-span-6 space-y-4 text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-pill bg-success-soft text-success text-xs font-mono font-semibold">
                      <Sparkles size={13} />
                      <span>Live Compatibility Preview</span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-extrabold text-text leading-tight">
                      Clear answers before you download gigabytes of weights.
                    </h2>

                    <p className="text-sm text-muted leading-relaxed">
                      Every model page shows whether weights fit in VRAM, predicted tokens per second based on memory bandwidth, and the exact quantization to use.
                    </p>

                    <div className="pt-2">
                      <Link
                        to="/about"
                        className="inline-flex items-center gap-1.5 text-xs text-primary font-mono hover:underline"
                      >
                        <span>How accurate are the speed estimates? Read our methodology</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>

                  {/* Right: Real Model Card */}
                  <div className="lg:col-span-6">
                    <ModelCard model={topModel} index={0} />
                  </div>
                </div>
              </div>
            </Reveal>
          </section>
        )}

        {/* ======================================================== */}
        {/* 5. FEATURED MODELS (Interactive Tabs)                    */}
        {/* ======================================================== */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4 border-b border-line pb-5">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-text">
                Featured Open-Source Models
              </h2>
              <p className="text-xs sm:text-sm text-muted mt-1">
                Explore popular models benchmarked on consumer GPUs
              </p>
            </div>

            {/* 3 Tabs: Top quality | Most downloaded | Lightest */}
            <div className="flex items-center p-1 rounded-btn bg-surface-2 border border-line">
              {[
                { id: 'quality', label: 'Top Quality' },
                { id: 'downloads', label: 'Most Downloaded' },
                { id: 'vram', label: 'Lightest (Low VRAM)' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-btn text-xs font-medium transition cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-surface text-text shadow-soft font-bold'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loadingFeatured ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-64 rounded-card bg-surface border border-line shimmer" />
              ))}
            </div>
          ) : featuredModels.length === 0 ? (
            <div className="text-center py-16 text-muted font-mono bg-surface border border-line rounded-card">
              No models found for this category.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredModels.map((model, idx) => (
                <ModelCard key={model.id} model={model} index={idx} />
              ))}
            </div>
          )}

          <div className="mt-10 text-center">
            <Link
              to="/models"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-btn bg-surface hover:bg-surface-2 border border-line text-sm font-medium text-text transition shadow-soft group"
            >
              <span>Explore all models in catalog</span>
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 6. SCANNER BAND                                          */}
        {/* ======================================================== */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <Reveal>
            <div className="bg-surface border border-line rounded-card p-8 sm:p-10 shadow-soft flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-left">
                <span className="text-xs font-mono uppercase tracking-wider text-primary font-bold">
                  Automated Hardware Detection
                </span>
                <h3 className="text-2xl font-extrabold text-text">
                  Want exact results? Run the free scanner.
                </h3>
                <p className="text-sm text-muted max-w-lg">
                  A single {scannerSize ? `${scannerSize} MB ` : ''}binary for Windows. No install, no admin privileges, self-contained. Automatically opens your results in your browser.
                </p>
              </div>

              <Link
                to="/scanner"
                className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3.5 rounded-btn bg-primary hover:bg-primary-hover text-white font-medium text-sm transition shadow-soft hover:shadow-hover btn-press"
              >
                <Download size={16} />
                <span>Download scanner</span>
              </Link>
            </div>
          </Reveal>
        </section>

        {/* ======================================================== */}
        {/* 7. FAQ ACCORDION                                         */}
        {/* ======================================================== */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <Reveal>
            <div className="text-center mb-10 space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-text">
                Frequently Asked Questions
              </h2>
              <p className="text-sm text-muted">
                Honest answers about hardware detection, privacy, and speed estimation.
              </p>
            </div>
          </Reveal>

          <div className="space-y-3">
            {faqItems.map((item, idx) => {
              const isOpen = openFaq === idx
              return (
                <Reveal key={idx} delay={idx * 0.05}>
                  <div className="bg-surface border border-line rounded-card overflow-hidden transition-all shadow-soft">
                    <button
                      type="button"
                      onClick={() => toggleFaq(idx)}
                      className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-surface-2/60 transition"
                      aria-expanded={isOpen}
                    >
                      <span className="font-bold text-text text-sm sm:text-base">
                        {item.q}
                      </span>
                      <ChevronDown
                        size={18}
                        className={`text-muted transition-transform duration-200 flex-shrink-0 ${
                          isOpen ? 'rotate-180 text-primary' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-sm text-muted leading-relaxed border-t border-line/60 pt-3">
                        {item.a}
                      </div>
                    )}
                  </div>
                </Reveal>
              )
            })}
          </div>
        </section>

        {/* ======================================================== */}
        {/* 8. FINAL CTA BAND                                        */}
        {/* ======================================================== */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <Reveal>
            <div className="bg-surface-2 border border-line rounded-card p-10 sm:p-14 text-center space-y-6 shadow-soft">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-text max-w-xl mx-auto">
                Ready to see what your PC can run?
              </h2>
              <p className="text-sm sm:text-base text-muted max-w-lg mx-auto">
                Test your hardware in seconds. No account required, completely free.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                <Link
                  to="/check"
                  className="px-7 py-3.5 rounded-btn bg-primary hover:bg-primary-hover text-white font-medium text-sm transition shadow-soft hover:shadow-hover btn-press cursor-pointer flex items-center gap-2"
                >
                  <Cpu size={16} />
                  <span>Check my PC</span>
                </Link>
                <Link
                  to="/scanner"
                  className="px-7 py-3.5 rounded-btn bg-surface hover:bg-surface-2 border border-line text-text font-medium text-sm transition shadow-soft btn-press flex items-center gap-2"
                >
                  <Download size={16} />
                  <span>Download scanner</span>
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </div>
    </>
  )
}
