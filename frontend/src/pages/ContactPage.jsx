import React from 'react'
import { Mail, MessageSquare, Send } from 'lucide-react'

function GithubIcon({ size = 14, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  )
}

export default function ContactPage() {
  const contactEmail = "support@llmbench.local"

  return (
    <div className="max-w-2xl mx-auto py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-mono mb-4">
          <Mail size={14} />
          <span>Get in Touch</span>
        </div>
        <h1 className="text-4xl font-heading font-bold text-text mb-3">
          Contact LLM Bench
        </h1>
        <p className="text-muted text-sm max-w-md mx-auto">
          Have feedback on model benchmarks, compatibility inaccuracies, or partnership inquiries? Send us a direct email.
        </p>
      </div>

      {/* Main Mailto Card */}
      <div className="glass p-8 text-center space-y-6 glow-border">
        <div className="w-16 h-16 rounded-2xl bg-elevated border border-border flex items-center justify-center mx-auto text-accent shadow-inner">
          <MessageSquare size={32} />
        </div>

        <div>
          <h2 className="text-xl font-heading font-semibold text-text mb-2">
            Direct Developer Inbox
          </h2>
          <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
            We respond to benchmark submissions and model correction pull requests within 2 business days.
          </p>
        </div>

        <div className="p-4 bg-surface rounded-lg border border-border font-mono text-sm text-text select-all">
          {contactEmail}
        </div>

        <div>
          <a
            href={`mailto:${contactEmail}?subject=LLM%20Bench%20Feedback`}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-accent text-bg font-semibold hover:bg-accent/90 transition shadow-lg shadow-accent/20"
          >
            <Send size={16} />
            <span>Open Email Client</span>
          </a>
        </div>

        <div className="pt-6 border-t border-border flex items-center justify-center gap-6 text-xs text-muted">
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:text-accent transition flex items-center gap-1.5"
          >
            <GithubIcon size={14} />
            <span>Report on GitHub</span>
          </a>
        </div>
      </div>
    </div>
  )
}
