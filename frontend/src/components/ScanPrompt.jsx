import React from 'react'
import { Link } from 'react-router-dom'
import { Cpu, Check, Download, ArrowRight } from 'lucide-react'

export default function ScanPrompt() {
  return (
    <div className="w-full bg-surface border border-line rounded-card p-8 sm:p-10 text-center my-8 relative overflow-hidden shadow-soft">
      <div className="relative z-10 flex flex-col items-center">
        <div className="text-primary mb-5 bg-primary-soft p-4 rounded-2xl">
          <Cpu size={36} />
        </div>
        
        <h2 className="text-2xl sm:text-3xl font-extrabold text-text mb-3">
          Check Your Hardware Compatibility
        </h2>
        <p className="text-muted text-sm max-w-md mb-8">
          Run our lightweight scanner to automatically detect your GPU, VRAM, and RAM, or use the instant checker on the home page.
        </p>
        
        <div className="text-left text-text mb-8 space-y-2.5 max-w-sm w-full bg-surface-2 p-5 rounded-btn border border-line font-mono text-xs">
          <p className="flex items-center gap-2.5 text-text">
            <Check size={16} className="text-success flex-shrink-0" />
            <span>GPU model &amp; Dedicated VRAM</span>
          </p>
          <p className="flex items-center gap-2.5 text-text">
            <Check size={16} className="text-success flex-shrink-0" />
            <span>Total System RAM capacity</span>
          </p>
          <p className="flex items-center gap-2.5 text-text">
            <Check size={16} className="text-success flex-shrink-0" />
            <span>CPU architecture &amp; core count</span>
          </p>
          <p className="flex items-center gap-2.5 text-text">
            <Check size={16} className="text-success flex-shrink-0" />
            <span>Available disk storage for model weights</span>
          </p>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link 
            to="/scanner" 
            className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white px-7 py-3 rounded-btn font-medium transition cursor-pointer shadow-soft text-sm btn-press"
          >
            <Download size={16} />
            <span>Download Scanner</span>
          </Link>

          <Link
            to="/check"
            className="inline-flex items-center justify-center gap-2 bg-surface hover:bg-surface-2 border border-line text-text px-6 py-3 rounded-btn font-medium transition cursor-pointer text-sm btn-press"
          >
            <span>Instant web checker</span>
            <ArrowRight size={15} />
          </Link>
        </div>
        
        <p className="text-xs font-mono text-muted mt-5 flex flex-wrap justify-center items-center gap-3">
          <span>Open Source</span> &bull; <span>Runs in 3 seconds</span> &bull; <span>No installation</span>
        </p>
      </div>
    </div>
  )
}
