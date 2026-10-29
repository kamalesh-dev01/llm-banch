import React from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { AlertTriangle, Home } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <>
      <Helmet>
        <title>Page Not Found — LLM Bench</title>
      </Helmet>

      <div className="flex flex-col items-center justify-center min-h-[55vh] text-center px-4 py-16">
        <div className="w-16 h-16 rounded-2xl bg-surface border border-line flex items-center justify-center text-warning mb-6 shadow-soft">
          <AlertTriangle size={32} />
        </div>
        <h1 className="text-6xl sm:text-7xl font-mono font-bold text-muted/40 mb-2 select-none">
          404
        </h1>
        <h2 className="text-2xl font-bold text-text mb-3">
          Page Not Found
        </h2>
        <p className="text-muted text-sm max-w-sm mb-8 leading-relaxed">
          The requested page could not be found. Please check the URL or return to the home page.
        </p>
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-btn font-medium text-sm transition shadow-soft btn-press"
        >
          <Home size={16} />
          <span>Return Home</span>
        </Link>
      </div>
    </>
  )
}
