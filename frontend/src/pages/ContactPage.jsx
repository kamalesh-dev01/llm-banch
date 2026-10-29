import React from 'react'
import { Helmet } from 'react-helmet-async'
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
    <>
      <Helmet>
        <title>Contact — LLM Bench</title>
        <meta
          name="description"
          content="Contact the LLM Bench maintainers with questions, benchmark data, or model corrections."
        />
      </Helmet>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl py-12 pb-16">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-pill bg-primary-soft text-primary text-xs font-mono mb-4">
            <Mail size={14} />
            <span>Get in Touch</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-text mb-3">
            Contact LLM Bench
          </h1>
          <p className="text-muted text-sm max-w-md mx-auto">
            Have questions about model benchmarks, compatibility inaccuracies, or suggestions? Send us an email.
          </p>
        </div>

        {/* Main Mailto Card */}
        <div className="bg-surface border border-line rounded-card p-8 text-center space-y-6 shadow-soft">
          <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-line flex items-center justify-center mx-auto text-primary">
            <MessageSquare size={30} />
          </div>

          <div>
            <h2 className="text-lg font-bold text-text mb-2">
              Developer &amp; Community Inbox
            </h2>
            <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
              We review benchmark logs, accuracy reports, and model correction requests regularly.
            </p>
          </div>

          <div className="p-4 bg-surface-2 rounded-btn border border-line font-mono text-sm text-text select-all">
            {contactEmail}
          </div>

          <div>
            <a
              href={`mailto:${contactEmail}?subject=LLM%20Bench%20Feedback`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-btn bg-primary hover:bg-primary-hover text-white font-medium text-sm transition shadow-soft btn-press"
            >
              <Send size={15} />
              <span>Open Email Client</span>
            </a>
          </div>

          <div className="pt-6 border-t border-line flex items-center justify-center gap-6 text-xs text-muted">
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-primary transition flex items-center gap-1.5"
            >
              <GithubIcon size={14} />
              <span>Report on GitHub</span>
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
