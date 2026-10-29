import React from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { 
  Cpu, 
  Database, 
  ShieldCheck, 
  Terminal, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  HelpCircle,
  Zap
} from 'lucide-react'

export default function AboutPage() {
  return (
    <>
      <Helmet>
        <title>About &amp; Methodology — LLM Bench</title>
        <meta
          name="description"
          content="Learn about LLM Bench, our physics-guided inference speed predictor, and our methodology: what is measured, what is estimated, and what is not available yet."
        />
      </Helmet>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl py-8 pb-16">
        {/* Page Title */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-pill bg-primary-soft text-primary text-xs font-mono mb-4">
            <Cpu size={14} />
            <span>Platform Overview &amp; Methodology</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-text mb-4">
            About LLM Bench
          </h1>
          <p className="text-base sm:text-lg text-muted leading-relaxed">
            LLM Bench is an open, honest hardware compatibility and inference speed prediction platform for locally hosted Large Language Models.
          </p>
        </div>

        {/* Main Sections */}
        <div className="space-y-8">
          {/* Core Mission */}
          <section className="bg-surface border border-line rounded-card p-6 sm:p-8 shadow-soft">
            <h2 className="text-xl sm:text-2xl font-bold text-text mb-4 flex items-center gap-3">
              <Cpu className="text-primary" size={22} />
              <span>Why LLM Bench Exists</span>
            </h2>
            <p className="text-muted leading-relaxed mb-4 text-sm sm:text-base">
              Running LLMs locally provides privacy, low latency, and sovereignty from cloud providers. However, predicting whether an open-weight model will actually run smoothly on your laptop or desktop has historically required guesswork and frustrating Out-Of-Memory (OOM) crashes.
            </p>
            <p className="text-muted leading-relaxed text-sm sm:text-base">
              LLM Bench bridges the gap between raw model parameter specifications and real-world consumer hardware. We compute loaded memory footprint boundaries for every quantization level, so you know exactly which model fits your VRAM before waiting hours for a download.
            </p>
          </section>

          {/* METHODOLOGY SECTION (#methodology) */}
          <section id="methodology" className="bg-surface border-2 border-primary/40 rounded-card p-6 sm:p-8 shadow-card scroll-mt-24">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-btn bg-primary-soft border border-primary/30 flex items-center justify-center text-primary">
                <HelpCircle size={22} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-text">
                  Data Methodology &amp; Transparency
                </h2>
                <p className="text-xs font-mono text-muted">
                  Full disclosure of our data sources, evaluation boundaries, and estimations.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              {/* 1. What is Measured */}
              <div className="bg-surface-2 border border-line rounded-btn p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-success font-mono text-xs uppercase font-bold tracking-wider mb-2.5">
                    <CheckCircle2 size={15} />
                    <span>What is Measured</span>
                  </div>
                  <ul className="text-xs text-muted space-y-2 leading-relaxed">
                    <li>
                      <strong className="text-text font-bold">Inference speed:</strong> Verified generation throughput (tok/s) and Time-to-First-Token (TTFT) recorded across multiple automated prompt runs using local Ollama.
                    </li>
                    <li>
                      <strong className="text-text font-bold">Memory consumption:</strong> Peak physical VRAM used and system RAM allocated during active inference.
                    </li>
                    <li>
                      <strong className="text-text font-bold">GPU/CPU split:</strong> The exact offload layer fraction (<code className="text-primary font-mono">gpu_offload_fraction</code>) verified on actual physical test machines.
                    </li>
                  </ul>
                </div>
                <div className="mt-4 pt-3 border-t border-line text-[11px] font-mono text-success">
                  Source: Physical benchmark harness
                </div>
              </div>

              {/* 2. What is Estimated */}
              <div className="bg-surface-2 border border-line rounded-btn p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase font-bold tracking-wider mb-2.5">
                    <Zap size={15} />
                    <span>What is Estimated</span>
                  </div>
                  <ul className="text-xs text-muted space-y-2 leading-relaxed">
                    <li>
                      <strong className="text-text font-bold">Hardware requirements:</strong> Loaded memory footprints and VRAM thresholds calculated from quantization weight sizes and runtime buffer factors.
                    </li>
                    <li>
                      <strong className="text-text font-bold">Unmeasured speeds:</strong> Extrapolated throughput estimates for untested hardware/model pairs generated by our physics-guided memory bandwidth model (accounting for PCIe transfer penalties and CPU memory bus limits).
                    </li>
                  </ul>
                </div>
                <div className="mt-4 pt-3 border-t border-line text-[11px] font-mono text-primary">
                  Source: Physics memory model
                </div>
              </div>

              {/* 3. What is Not Available Yet */}
              <div className="bg-surface-2 border border-line rounded-btn p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-warning font-mono text-xs uppercase font-bold tracking-wider mb-2.5">
                    <Clock size={15} />
                    <span>Not Available Yet</span>
                  </div>
                  <ul className="text-xs text-muted space-y-2 leading-relaxed">
                    <li>
                      <strong className="text-text font-bold">Quality scores:</strong> We explicitly do not display synthetic parameter-size mappings as &ldquo;quality&rdquo; scores.
                    </li>
                    <li>
                      Standardized evaluations (such as MMLU, MT-Bench, and HumanEval) will be displayed on the Leaderboard and model pages only after official, measured evaluation runs are conducted.
                    </li>
                  </ul>
                </div>
                <div className="mt-4 pt-3 border-t border-line text-[11px] font-mono text-warning">
                  Status: Pending measured evaluations
                </div>
              </div>
            </div>
          </section>

          {/* Data Verification */}
          <section className="bg-surface border border-line rounded-card p-6 sm:p-8 shadow-soft">
            <h2 className="text-xl sm:text-2xl font-bold text-text mb-6 flex items-center gap-3">
              <Database className="text-success" size={22} />
              <span>How Our Data Is Verified</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-surface-2 border border-line p-5 rounded-btn">
                <div className="text-primary font-mono text-sm font-semibold mb-2 flex items-center gap-2">
                  <Terminal size={16} />
                  <span>1. Real Ollama Runs</span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  We execute automated benchmark runs using local Ollama endpoints, recording actual tokens/second, time-to-first-token (TTFT), and GPU offload memory layers.
                </p>
              </div>

              <div className="bg-surface-2 border border-line p-5 rounded-btn">
                <div className="text-success font-mono text-sm font-semibold mb-2 flex items-center gap-2">
                  <Layers size={16} />
                  <span>2. Verified Model Specs</span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Context windows, tokenizer specs, and architectures are synced from upstream Hugging Face repositories and official GGUF quantizers.
                </p>
              </div>

              <div className="bg-surface-2 border border-line p-5 rounded-btn">
                <div className="text-warning font-mono text-sm font-semibold mb-2 flex items-center gap-2">
                  <Cpu size={16} />
                  <span>3. Hardware Profiling</span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Memory consumption and bandwidth limits are calibrated using standard hardware interfaces to prevent unrealistic speed claims.
                </p>
              </div>
            </div>
          </section>

          {/* The Scanner */}
          <section className="bg-surface border border-line rounded-card p-6 sm:p-8 shadow-soft">
            <h2 className="text-xl sm:text-2xl font-bold text-text mb-4 flex items-center gap-3">
              <ShieldCheck className="text-primary" size={22} />
              <span>The Lightweight Scanner</span>
            </h2>
            <p className="text-muted leading-relaxed mb-4 text-sm sm:text-base">
              Our Windows hardware scanner is a standalone utility with zero installer, zero dependencies, and zero persistent background processes. It queries your display adapter VRAM, system RAM, and CPU core count in under 3 seconds, returns a temporary session token, and automatically deletes itself from your disk.
            </p>
            <div className="pt-2">
              <Link to="/models" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                <span>Explore verified model catalog &rarr;</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
