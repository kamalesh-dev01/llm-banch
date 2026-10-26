import React from 'react'
import { Link } from 'react-router-dom'
import { Cpu, Mail, Shield, Info, Terminal } from 'lucide-react'

function GithubIcon({ size = 14, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  )
}

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface/80 backdrop-blur-md">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand & Purpose */}
          <div className="md:col-span-2 space-y-3">
            <Link to="/" className="inline-flex items-center gap-2 text-lg font-heading font-bold text-text hover:text-accent transition">
              <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse"></span>
              <span>LLM Bench</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-elevated border border-border text-muted">v1.2.0</span>
            </Link>
            <p className="text-sm text-muted max-w-md leading-relaxed">
              Open hardware benchmarking and local LLM compatibility engine. Measure actual tokens/second, calculate memory fit, and find optimal quantizations for your GPU.
            </p>
            <div className="flex items-center gap-2 text-xs font-mono text-muted/70 pt-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-recommended"></span>
              <span>System operational</span>
              <span className="text-border">&bull;</span>
              <span>100% Client-Side Privacy</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-text mb-3">Platform</h4>
            <ul className="space-y-2 text-sm text-muted">
              <li>
                <Link to="/models" className="hover:text-accent transition">Browse Models</Link>
              </li>
              <li>
                <Link to="/leaderboard" className="hover:text-accent transition">Hardware Leaderboard</Link>
              </li>
              <li>
                <a href="http://localhost:8000/api/scanner/download" className="hover:text-accent transition flex items-center gap-1.5">
                  <Terminal size={14} />
                  <span>Download Scanner</span>
                </a>
              </li>
            </ul>
          </div>

          {/* AdSense Legal & Info */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-text mb-3">Information</h4>
            <ul className="space-y-2 text-sm text-muted">
              <li>
                <Link to="/about" className="hover:text-accent transition flex items-center gap-1.5">
                  <Info size={14} />
                  <span>About LLM Bench</span>
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-accent transition flex items-center gap-1.5">
                  <Shield size={14} />
                  <span>Privacy Policy</span>
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-accent transition flex items-center gap-1.5">
                  <Mail size={14} />
                  <span>Contact Us</span>
                </Link>
              </li>
              <li>
                <a 
                  href="https://github.com" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-accent transition flex items-center gap-1.5"
                >
                  <GithubIcon size={14} />
                  <span>GitHub</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between text-xs text-muted font-mono gap-4">
          <p>&copy; {new Date().getFullYear()} LLM Bench. Real inference data for local AI enthusiasts.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-text transition">Privacy</Link>
            <span>&bull;</span>
            <Link to="/about" className="hover:text-text transition">About</Link>
            <span>&bull;</span>
            <Link to="/contact" className="hover:text-text transition">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
