import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getModels } from '../api/client'
import ModelCard from '../components/ModelCard'
import InstantChecker from '../components/InstantChecker'
import StatCounter from '../components/StatCounter'
import { ArrowRight, Compass, Cpu, CheckCircle2, Zap, Layers, Terminal } from 'lucide-react'

export default function HomePage() {
  const [topModels, setTopModels] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch top models by quality score
    getModels({ sort: 'quality', limit: 6 })
      .then(res => {
        const models = Array.isArray(res.data) ? res.data : (res.data.models || [])
        models.sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0))
        setTopModels(models.slice(0, 6))
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const firstModel = topModels[0]
  const otherModels = topModels.slice(1)

  return (
    <div className="pb-16 space-y-24">
      {/* HERO SECTION */}
      <section className="relative pt-8 pb-16 text-center overflow-hidden">
        {/* Animated ambient glow behind hero */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[340px] bg-gradient-to-tr from-accent/20 via-recommended/10 to-transparent blur-[110px] rounded-full pointer-events-none -z-10 animate-pulse duration-[6000ms]" />

        <div className="relative z-10 max-w-4xl mx-auto space-y-6">
          {/* Subtle badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-elevated border border-border text-xs font-mono text-muted mb-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
            <span>Telemetry-Backed LLM Hardware Analyzer</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-heading font-extrabold text-text tracking-tight leading-[1.15]">
            Find the Right Local LLM for <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-cyan-300 to-recommended">Your Hardware</span>
          </h1>

          <p className="text-base sm:text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            Stop guessing if an open-weight model fits. Compare speed, VRAM thresholds, and real inference metrics before downloading gigabytes of weights.
          </p>

          {/* INSTANT CHECKER CARD INSIDE HERO */}
          <div className="pt-6">
            <InstantChecker />
          </div>
        </div>
      </section>

      {/* STAT COUNTERS (Count up on scroll) */}
      <section className="border-y border-border bg-surface/70 backdrop-blur-md py-8 grid-bg">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 divide-y sm:divide-y-0 sm:divide-x divide-border">
            <StatCounter 
              endValue={20} 
              suffix="+" 
              label="Verified Models" 
              colorClass="text-accent" 
            />
            <StatCounter 
              endValue={60} 
              suffix="+" 
              label="Tested Quantizations" 
              colorClass="text-recommended" 
            />
            <StatCounter 
              endValue={100} 
              suffix="%" 
              label="Free &amp; Client-Side" 
              colorClass="text-minimum" 
            />
          </div>
        </div>
      </section>

      {/* FEATURED MODELS: BENTO-STYLE GRID */}
      <section className="container mx-auto px-4 max-w-6xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-accent uppercase tracking-wider font-semibold mb-1">
              <Zap size={14} />
              <span>Benchmark Leaderboard</span>
            </div>
            <h2 className="text-3xl font-heading font-bold text-text">
              Top Models by Quality
            </h2>
          </div>
          <Link 
            to="/models" 
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent/80 transition"
          >
            <span>View all models</span>
            <ArrowRight size={16} />
          </Link>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 h-64 shimmer rounded-xl border border-border"></div>
            <div className="h-64 shimmer rounded-xl border border-border"></div>
            <div className="h-60 shimmer rounded-xl border border-border"></div>
            <div className="h-60 shimmer rounded-xl border border-border"></div>
            <div className="h-60 shimmer rounded-xl border border-border"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* First card in bento grid is larger */}
            {firstModel && (
              <div className="md:col-span-2">
                <div className="h-full relative">
                  <div className="absolute top-3 right-4 z-20">
                    <span className="px-2.5 py-1 rounded-full bg-accent/20 border border-accent/40 text-accent text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                      <SparkleIcon size={12} /> #1 Quality Pick
                    </span>
                  </div>
                  <ModelCard model={firstModel} index={0} />
                </div>
              </div>
            )}

            {/* Remaining models in bento layout */}
            {otherModels.map((model, idx) => (
              <div key={model.id} className="h-full">
                <ModelCard model={model} index={idx + 1} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* HOW IT WORKS: 3 STEPS WITH CONNECTING LINE AND ICONS */}
      <section className="container mx-auto px-4 max-w-5xl">
        <div className="glass p-8 md:p-12 rounded-2xl relative overflow-hidden">
          <div className="text-center mb-12">
            <span className="text-xs font-mono uppercase tracking-widest text-muted font-semibold">
              Three-Step Workflow
            </span>
            <h2 className="text-3xl font-heading font-bold text-text mt-1">
              How LLM Bench Works
            </h2>
          </div>

          <div className="relative">
            {/* Connecting line between the 3 steps */}
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-border -translate-y-1/2 z-0" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-elevated border border-border flex items-center justify-center text-accent mb-4 shadow-lg group-hover:border-accent transition">
                  <Compass size={28} />
                </div>
                <div className="text-xs font-mono text-accent font-bold mb-1">01 &bull; BROWSE</div>
                <h3 className="text-lg font-heading font-bold text-text mb-2">Browse Models</h3>
                <p className="text-xs text-muted leading-relaxed max-w-xs">
                  Explore quantized open-weights with verified parameter sizes, context lengths, and quality benchmarks.
                </p>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-elevated border border-border flex items-center justify-center text-recommended mb-4 shadow-lg">
                  <Cpu size={28} />
                </div>
                <div className="text-xs font-mono text-recommended font-bold mb-1">02 &bull; TELEMETRY</div>
                <h3 className="text-lg font-heading font-bold text-text mb-2">Check Hardware</h3>
                <p className="text-xs text-muted leading-relaxed max-w-xs">
                  Pick your GPU and RAM in the instant checker, or run our 3-second self-deleting scanner.
                </p>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-elevated border border-border flex items-center justify-center text-minimum mb-4 shadow-lg">
                  <CheckCircle2 size={28} />
                </div>
                <div className="text-xs font-mono text-minimum font-bold mb-1">03 &bull; VERDICT</div>
                <h3 className="text-lg font-heading font-bold text-text mb-2">Get Verdict</h3>
                <p className="text-xs text-muted leading-relaxed max-w-xs">
                  See instantly which quantization fits into VRAM, estimated tokens/second, and copy ready-to-run Ollama commands.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function SparkleIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
    </svg>
  )
}
