import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useHardwareStore from '../store/hardwareStore'
import { useThemeStore } from '../store/themeStore'
import { 
  Cpu, 
  Menu, 
  X, 
  Sun, 
  Moon, 
  ChevronDown, 
  Trash2, 
  ExternalLink,
  ShieldCheck,
  Sparkles
} from 'lucide-react'

// Helper to shorten verbose GPU names
function getShortGpuName(fullName = '') {
  return fullName
    .replace(/^NVIDIA\s+GeForce\s+/i, '')
    .replace(/^NVIDIA\s+/i, '')
    .replace(/^AMD\s+Radeon\s+/i, '')
    .replace(/^AMD\s+/i, '')
    .replace(/^Intel\s+/i, '')
    .replace(/\s+Laptop\s+GPU/i, ' Laptop')
    .replace(/\s+Graphics/i, '')
    .trim()
}

export default function Navbar() {
  const { hardware, token, clearScan } = useHardwareStore()
  const { theme, toggleTheme } = useThemeStore()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isGpuMenuOpen, setIsGpuMenuOpen] = useState(false)
  
  const location = useLocation()
  const navigate = useNavigate()
  const gpuMenuRef = useRef(null)

  // Track scroll position for transparent -> blurred navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close menus on outside click or route change
  useEffect(() => {
    setIsMenuOpen(false)
    setIsGpuMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    function handleClickOutside(e) {
      if (gpuMenuRef.current && !gpuMenuRef.current.contains(e.target)) {
        setIsGpuMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const navLinks = [
    { label: 'Models', href: '/models' },
    { label: 'Leaderboard', href: '/leaderboard' },
    { label: 'How it works', href: '/how-it-works' },
    { label: 'Scanner', href: '/scanner' },
  ]

  const shortGpu = hardware?.gpu_name ? getShortGpuName(hardware.gpu_name) : null

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-200 ${
        isScrolled
          ? 'bg-surface/85 backdrop-blur-md border-b border-line shadow-soft'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-content mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link 
          to="/" 
          className="flex items-center gap-2.5 font-heading font-bold text-lg text-text hover:text-primary transition group"
        >
          <div className="w-8 h-8 rounded-btn bg-primary-soft text-primary flex items-center justify-center transition group-hover:scale-105">
            <Cpu size={18} />
          </div>
          <span>LLM Bench</span>
        </Link>

        {/* Center Desktop Links */}
        <nav className="hidden md:flex items-center gap-1 font-sans text-sm font-medium" aria-label="Main Navigation">
          {navLinks.map((link) => {
            const isInternal = link.href.startsWith('/') && !link.href.includes('#')
            const isActive = isInternal && location.pathname === link.href

            return (
              <Link
                key={link.label}
                to={link.href}
                className={`relative px-3.5 py-1.5 rounded-btn transition-colors ${
                  isActive
                    ? 'text-primary font-semibold'
                    : 'text-muted hover:text-text hover:bg-surface-2'
                }`}
              >
                <span>{link.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute bottom-0 left-3 right-3 h-[2px] bg-primary rounded-full"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Right Actions: Theme Toggle, Hardware Pill, Check Button */}
        <div className="flex items-center gap-2.5">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="p-2 rounded-btn text-muted hover:text-text hover:bg-surface-2 transition btn-press cursor-pointer"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Hardware Scan Chip (if scanned) */}
          {hardware && (
            <div className="relative hidden sm:block" ref={gpuMenuRef}>
              <button
                onClick={() => setIsGpuMenuOpen(!isGpuMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-success-soft text-success border border-success/20 text-xs font-medium hover:border-success/40 transition cursor-pointer"
                title={`${hardware.gpu_name} (${hardware.vram_gb} GB VRAM)`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                <span className="font-semibold max-w-[120px] truncate">{shortGpu}</span>
                <span className="opacity-80">{hardware.vram_gb}GB</span>
                <ChevronDown size={12} className="opacity-60 ml-0.5" />
              </button>

              <AnimatePresence>
                {isGpuMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-48 rounded-card bg-surface border border-line shadow-card p-1.5 z-50 text-xs"
                  >
                    <div className="px-3 py-2 border-b border-line text-[11px] text-muted">
                      <div className="font-medium text-text truncate">{hardware.gpu_name}</div>
                      <div>{hardware.ram_gb} GB System RAM</div>
                    </div>

                    <Link
                      to={token ? `/results/${token}` : '/check'}
                      className="flex items-center justify-between px-3 py-2 rounded-btn text-text hover:bg-surface-2 transition mt-1"
                    >
                      <span>View my results</span>
                      <ExternalLink size={12} className="text-muted" />
                    </Link>

                    <button
                      onClick={() => {
                        clearScan()
                        setIsGpuMenuOpen(false)
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-btn text-danger hover:bg-danger-soft transition text-left cursor-pointer"
                    >
                      <span>Clear scan</span>
                      <Trash2 size={12} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Primary CTA: "Check my PC" */}
          <Link
            to="/check"
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-btn bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-semibold transition btn-press shadow-soft"
          >
            Check my PC
          </Link>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle mobile menu"
            className="md:hidden p-2 rounded-btn text-muted hover:text-text hover:bg-surface-2 transition cursor-pointer"
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Animated Slide-in Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="md:hidden bg-surface border-b border-line px-5 py-5 shadow-card space-y-4"
          >
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`px-3 py-2.5 rounded-btn text-sm font-medium transition ${
                    location.pathname === link.href
                      ? 'bg-primary-soft text-primary font-semibold'
                      : 'text-text hover:bg-surface-2'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Hardware Profile in Mobile Menu */}
            {hardware ? (
              <div className="p-3 rounded-card bg-surface-2 border border-line space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-text">{shortGpu}</span>
                  <span className="text-muted">{hardware.vram_gb} GB VRAM</span>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-line text-xs">
                  <Link
                    to={token ? `/results/${token}` : '/check'}
                    onClick={() => setIsMenuOpen(false)}
                    className="text-primary hover:underline font-medium"
                  >
                    View results
                  </Link>
                  <span className="text-muted">&bull;</span>
                  <button
                    onClick={() => {
                      clearScan()
                      setIsMenuOpen(false)
                    }}
                    className="text-danger hover:underline cursor-pointer"
                  >
                    Clear scan
                  </button>
                </div>
              </div>
            ) : null}

            {/* Mobile Check Button */}
            <Link
              to="/check"
              onClick={() => setIsMenuOpen(false)}
              className="w-full flex items-center justify-center py-2.5 rounded-btn bg-primary text-white text-sm font-semibold transition"
            >
              Check my PC
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
