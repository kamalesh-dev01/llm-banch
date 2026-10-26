import React from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Home } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh] text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center text-minimum mb-6 shadow-inner">
        <AlertTriangle size={32} />
      </div>
      <h1 className="text-7xl md:text-8xl font-mono font-bold text-border mb-2 select-none">
        404
      </h1>
      <h2 className="text-2xl font-heading font-bold text-text mb-3">
        Endpoint or Page Not Found
      </h2>
      <p className="text-muted text-sm max-w-sm mb-8 leading-relaxed">
        The requested URL was not found on this benchmark server. Please verify the address or return home.
      </p>
      <Link 
        to="/" 
        className="inline-flex items-center gap-2 bg-accent text-bg px-6 py-3 rounded-lg font-heading font-bold hover:bg-accent/90 transition shadow-lg shadow-accent/20 text-sm"
      >
        <Home size={16} />
        <span>Return to Benchmark Home</span>
      </Link>
    </div>
  )
}
