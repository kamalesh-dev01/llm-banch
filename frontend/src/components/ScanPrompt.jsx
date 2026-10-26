import React from 'react'
import { Cpu, Check, Terminal, Shield } from 'lucide-react'

export default function ScanPrompt() {
  return (
    <div className="w-full glass glow-border rounded-xl p-10 text-center my-8 relative overflow-hidden group shadow-xl">
      <div className="relative z-10 flex flex-col items-center">
        <div className="text-accent mb-6 bg-accent/10 border border-accent/20 p-5 rounded-2xl shadow-inner">
          <Cpu size={40} />
        </div>
        
        <h2 className="text-2xl md:text-3xl font-heading font-bold text-text mb-3">
          Check Your Hardware Compatibility
        </h2>
        <p className="text-muted text-sm max-w-md mb-8">
          Run our lightweight scanner to automatically detect your GPU, VRAM, and RAM, or use the instant checker on the home page.
        </p>
        
        <div className="text-left text-text mb-8 space-y-2.5 max-w-sm w-full bg-surface/90 p-5 rounded-lg border border-border font-mono text-xs">
          <p className="flex items-center gap-2.5 text-muted">
            <Check size={16} className="text-recommended flex-shrink-0" />
            <span>GPU model &amp; Dedicated VRAM</span>
          </p>
          <p className="flex items-center gap-2.5 text-muted">
            <Check size={16} className="text-recommended flex-shrink-0" />
            <span>Total System RAM capacity</span>
          </p>
          <p className="flex items-center gap-2.5 text-muted">
            <Check size={16} className="text-recommended flex-shrink-0" />
            <span>Physical CPU cores &amp; instruction sets</span>
          </p>
          <p className="flex items-center gap-2.5 text-muted">
            <Check size={16} className="text-recommended flex-shrink-0" />
            <span>Available disk storage for weights</span>
          </p>
        </div>
        
        <a 
          href="http://localhost:8000/api/scanner/download" 
          className="inline-flex items-center justify-center gap-2.5 bg-accent text-bg px-8 py-3.5 rounded-lg font-semibold hover:bg-accent/90 transition cursor-pointer shadow-lg shadow-accent/20 text-sm"
        >
          <Terminal size={18} />
          <span>Download Scanner (Windows EXE)</span>
        </a>
        
        <p className="text-[11px] font-mono text-muted/80 mt-5 flex flex-wrap justify-center items-center gap-3">
          <span>Open Source</span> &bull; <span>Runs in 3 seconds</span> &bull; <span>Self-deleting</span>
        </p>
      </div>
    </div>
  )
}
