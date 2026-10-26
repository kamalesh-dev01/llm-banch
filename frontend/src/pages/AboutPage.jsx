import React from 'react'
import { Link } from 'react-router-dom'
import { Cpu, Database, Activity, ShieldCheck, Terminal, Layers } from 'lucide-react'

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto py-8">
      {/* Page Title */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-mono mb-4">
          <Activity size={14} />
          <span>System Documentation</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-heading font-bold text-text mb-4">
          About LLM Bench
        </h1>
        <p className="text-lg text-muted leading-relaxed">
          LLM Bench is an open, community-driven hardware compatibility and inference performance platform for locally hosted Large Language Models.
        </p>
      </div>

      {/* Main Sections */}
      <div className="space-y-10">
        {/* Core Mission */}
        <section className="glass p-8">
          <h2 className="text-2xl font-heading font-semibold text-text mb-4 flex items-center gap-3">
            <Cpu className="text-accent" size={24} />
            <span>Why LLM Bench Exists</span>
          </h2>
          <p className="text-muted leading-relaxed mb-4">
            Running LLMs locally has revolutionized privacy, latency, and independence from cloud providers. However, predicting whether an open-weight model will actually run smoothly on your laptop or desktop has historically required guesswork and frustrating Out-Of-Memory (OOM) crashes.
          </p>
          <p className="text-muted leading-relaxed">
            LLM Bench bridges the gap between raw model parameter specifications and real-world consumer hardware. We compute precise memory footprint boundaries for every quantization level, so you know exactly which model fits your VRAM before waiting hours for a download.
          </p>
        </section>

        {/* Data Collection */}
        <section className="glass p-8">
          <h2 className="text-2xl font-heading font-semibold text-text mb-6 flex items-center gap-3">
            <Database className="text-recommended" size={24} />
            <span>How Our Data Is Collected</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-surface/80 border border-border p-5 rounded-lg">
              <div className="text-accent font-mono text-sm font-semibold mb-2 flex items-center gap-2">
                <Terminal size={16} />
                <span>1. Real Ollama Runs</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                We execute automated benchmark runs using native Ollama endpoints, recording actual tokens/second, time-to-first-token (TTFT), and GPU offload memory layers.
              </p>
            </div>

            <div className="bg-surface/80 border border-border p-5 rounded-lg">
              <div className="text-recommended font-mono text-sm font-semibold mb-2 flex items-center gap-2">
                <Layers size={16} />
                <span>2. Hugging Face Models</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Weights, context windows, tokenizer specs, and architectures are synced from upstream Hugging Face repositories and GGUF quantizers.
              </p>
            </div>

            <div className="bg-surface/80 border border-border p-5 rounded-lg">
              <div className="text-minimum font-mono text-sm font-semibold mb-2 flex items-center gap-2">
                <Cpu size={16} />
                <span>3. Hardware Telemetry</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Memory consumption and thermal utilization are captured continuously using low-overhead NVML (`pynvml`) and OS system counters (`psutil`).
              </p>
            </div>
          </div>
        </section>

        {/* The Scanner */}
        <section className="glass p-8">
          <h2 className="text-2xl font-heading font-semibold text-text mb-4 flex items-center gap-3">
            <ShieldCheck className="text-accent" size={24} />
            <span>The Lightweight Scanner</span>
          </h2>
          <p className="text-muted leading-relaxed mb-4">
            Our Windows hardware scanner is a standalone utility with zero installer, zero dependencies, and zero persistent background processes. It queries your display adapter VRAM, system RAM, and CPU core count in under 3 seconds, returns a temporary session token, and automatically deletes itself from your disk.
          </p>
          <div className="pt-2">
            <Link to="/models" className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">
              <span>Explore verified model catalog &rarr;</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
