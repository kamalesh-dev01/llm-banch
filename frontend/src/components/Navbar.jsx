import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import useHardwareStore from '../store/hardwareStore'
import { Cpu, Menu, X, Terminal, Trash2 } from 'lucide-react'

export default function Navbar() {
  const { hardware, clearScan } = useHardwareStore()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()

  const isActive = (path) => location.pathname === path

  return (
    <nav className="sticky top-0 z-50 bg-surface/85 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 font-heading text-lg font-bold text-text hover:text-accent transition">
          <div className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center text-accent shadow-inner">
            <Cpu size={18} />
          </div>
          <span>LLM Bench</span>
        </Link>

        {/* Center Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8 font-medium text-sm">
          <Link 
            to="/models" 
            className={`transition hover:text-accent ${isActive('/models') ? 'text-accent font-semibold' : 'text-muted'}`}
          >
            Models
          </Link>
          <Link 
            to="/leaderboard" 
            className={`transition hover:text-accent ${isActive('/leaderboard') ? 'text-accent font-semibold' : 'text-muted'}`}
          >
            Leaderboard
          </Link>
          <Link 
            to="/about" 
            className={`transition hover:text-accent ${isActive('/about') ? 'text-accent font-semibold' : 'text-muted'}`}
          >
            About
          </Link>
        </div>

        {/* Right Action / Telemetry */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3">
            {hardware ? (
              <div className="flex items-center gap-2 text-xs font-mono bg-elevated border border-border px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-recommended animate-pulse"></span>
                <span className="text-text font-semibold truncate max-w-[170px]" title={hardware.gpu_name}>
                  {hardware.gpu_name}
                </span>
                <span className="text-accent font-bold">
                  {hardware.vram_gb}GB
                </span>
                <button 
                  onClick={clearScan}
                  title="Clear hardware scan"
                  className="ml-1 text-muted hover:text-not-recommended transition cursor-pointer"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              <a 
                href="http://localhost:8000/api/scanner/download"
                className="flex items-center gap-2 text-xs font-semibold bg-elevated border border-border text-text px-3.5 py-2 rounded-lg hover:border-accent hover:text-accent transition shadow-sm"
              >
                <Terminal size={14} className="text-accent" />
                <span>Download Scanner</span>
              </a>
            )}
          </div>
          
          {/* Mobile Menu Toggle Button */}
          <button 
            type="button"
            className="md:hidden p-2 text-muted hover:text-text rounded-lg hover:bg-elevated transition"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className="md:hidden bg-surface border-b border-border px-4 py-5 flex flex-col gap-4 shadow-xl">
          <Link 
            to="/models" 
            onClick={() => setIsMenuOpen(false)} 
            className={`text-sm py-1 transition ${isActive('/models') ? 'text-accent font-semibold' : 'text-muted'}`}
          >
            Models
          </Link>
          <Link 
            to="/leaderboard" 
            onClick={() => setIsMenuOpen(false)} 
            className={`text-sm py-1 transition ${isActive('/leaderboard') ? 'text-accent font-semibold' : 'text-muted'}`}
          >
            Leaderboard
          </Link>
          <Link 
            to="/about" 
            onClick={() => setIsMenuOpen(false)} 
            className={`text-sm py-1 transition ${isActive('/about') ? 'text-accent font-semibold' : 'text-muted'}`}
          >
            About
          </Link>
          <Link 
            to="/privacy" 
            onClick={() => setIsMenuOpen(false)} 
            className={`text-sm py-1 transition ${isActive('/privacy') ? 'text-accent font-semibold' : 'text-muted'}`}
          >
            Privacy Policy
          </Link>
          <Link 
            to="/contact" 
            onClick={() => setIsMenuOpen(false)} 
            className={`text-sm py-1 transition ${isActive('/contact') ? 'text-accent font-semibold' : 'text-muted'}`}
          >
            Contact
          </Link>

          <div className="pt-3 border-t border-border flex flex-col gap-2">
            {hardware ? (
              <div className="flex items-center justify-between text-xs font-mono bg-elevated border border-border p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-recommended animate-pulse"></span>
                  <span className="text-text font-semibold">{hardware.gpu_name} ({hardware.vram_gb}GB)</span>
                </div>
                <button 
                  onClick={() => { clearScan(); setIsMenuOpen(false); }}
                  className="text-xs text-not-recommended hover:underline"
                >
                  Clear
                </button>
              </div>
            ) : (
              <a 
                href="http://localhost:8000/api/scanner/download"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-center gap-2 text-xs font-semibold bg-accent text-bg px-4 py-2.5 rounded-lg hover:bg-accent/90 transition w-full shadow-sm"
              >
                <Terminal size={14} />
                <span>Download Scanner (EXE)</span>
              </a>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
