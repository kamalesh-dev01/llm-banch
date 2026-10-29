import React from 'react'
import { Link } from 'react-router-dom'
import { Cpu, ExternalLink } from 'lucide-react'

function GithubIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  )
}

export default function Footer() {
  const githubUrl = import.meta.env.VITE_GITHUB_URL || 'https://github.com'

  return (
    <footer className="mt-auto bg-surface border-t border-line text-muted font-sans" role="contentinfo">
      <div className="max-w-content mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12 mb-12">
          {/* Brand & Mission column */}
          <div className="col-span-2 space-y-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2.5 font-heading font-bold text-lg text-text hover:text-primary transition"
            >
              <div className="w-7 h-7 rounded-btn bg-primary-soft text-primary flex items-center justify-center">
                <Cpu size={16} />
              </div>
              <span>LLM Bench</span>
            </Link>
            <p className="text-sm leading-relaxed max-w-sm">
              Find out which open-weight language models run smoothly on your computer before downloading them.
            </p>
            <p className="text-xs text-muted">
              Model data from Ollama and Hugging Face.
            </p>
          </div>

          {/* Product links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
              Product
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/models" className="hover:text-text transition">
                  Models
                </Link>
              </li>
              <li>
                <Link to="/leaderboard" className="hover:text-text transition">
                  Leaderboard
                </Link>
              </li>
              <li>
                <Link to="/scanner" className="hover:text-text transition">
                  Scanner
                </Link>
              </li>
              <li>
                <Link to="/check" className="hover:text-text transition">
                  Check my PC
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
              Resources
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/how-it-works" className="hover:text-text transition">
                  How it works
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-text transition">
                  FAQ
                </Link>
              </li>
              {githubUrl && (
                <li>
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-text transition inline-flex items-center gap-1.5"
                  >
                    <GithubIcon size={14} />
                    <span>GitHub</span>
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* Company & Legal links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
              Company
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/about" className="hover:text-text transition">
                  About
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-text transition">
                  Contact
                </Link>
              </li>
              <li className="pt-2 border-t border-line">
                <Link to="/privacy" className="hover:text-text transition text-xs font-medium">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright bar */}
        <div className="pt-8 border-t border-line flex flex-col sm:flex-row items-center justify-between text-xs text-muted gap-4">
          <p>&copy; {new Date().getFullYear()} LLM Bench. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-text transition">
              Privacy
            </Link>
            <span>&bull;</span>
            <Link to="/about" className="hover:text-text transition">
              About
            </Link>
            <span>&bull;</span>
            <Link to="/contact" className="hover:text-text transition">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
