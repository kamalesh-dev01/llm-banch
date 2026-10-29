import React, { useEffect, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate, useSearchParams, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { HelmetProvider } from 'react-helmet-async'
import useHardwareStore from './store/hardwareStore'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ScrollProgress from './components/motion/ScrollProgress'

// Lazy-loaded routes for optimal bundle code-splitting
const HomePage = React.lazy(() => import('./pages/HomePage'))
const CheckWizardPage = React.lazy(() => import('./pages/CheckWizardPage'))
const ResultsPage = React.lazy(() => import('./pages/ResultsPage'))
const ResultModelDetailPage = React.lazy(() => import('./pages/ResultModelDetailPage'))
const ScannerPage = React.lazy(() => import('./pages/ScannerPage'))
const ModelsPage = React.lazy(() => import('./pages/ModelsPage'))
const ModelDetailPage = React.lazy(() => import('./pages/ModelDetailPage'))
const LeaderboardPage = React.lazy(() => import('./pages/LeaderboardPage'))
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'))

// Information & Policy Pages (lazy loaded)
const AboutPage = React.lazy(() => import('./pages/AboutPage'))
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage'))
const ContactPage = React.lazy(() => import('./pages/ContactPage'))

// Accessible route loading skeleton
function PageFallback() {
  return (
    <div className="container mx-auto px-4 py-20 flex flex-col items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
      <span className="text-xs font-mono text-muted">Loading LLM Bench...</span>
    </div>
  )
}

// Legacy redirect: /scan-result?token=X -> /results/X (one direction only)
function ScanResultRedirect() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  if (token) {
    return <Navigate to={`/results/${token}`} replace />
  }
  return <Navigate to="/check" replace />
}

function AnimatedRoutes() {
  const location = useLocation()
  const navigate = useNavigate()
  const { setToken } = useHardwareStore()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const token = params.get('token')
    if (token) {
      setToken(token)
    }
  }, [location.search, setToken])

  // Redirect any legacy hash routes to clean top-level routes
  useEffect(() => {
    if (location.hash === '#how-it-works') {
      navigate('/how-it-works', { replace: true })
    } else if (location.hash === '#faq') {
      navigate('/faq', { replace: true })
    } else if (location.hash === '#checker') {
      navigate('/check', { replace: true })
    } else if (location.hash === '#methodology') {
      navigate('/about', { replace: true })
    } else {
      window.scrollTo(0, 0)
    }
  }, [location.pathname, location.hash, navigate])

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeInOut' }}
        className="flex-grow flex flex-col w-full"
      >
        <Suspense fallback={<PageFallback />}>
          <Routes location={location}>
            <Route path="/" element={<HomePage />} />
            <Route path="/check" element={<CheckWizardPage />} />
            <Route path="/scanner" element={<ScannerPage />} />
            <Route path="/models" element={<ModelsPage />} />
            <Route path="/models/:ref" element={<ModelDetailPage />} />
            <Route path="/results/:token" element={<ResultsPage />} />
            <Route path="/results/:token/:modelId" element={<ResultModelDetailPage />} />
            <Route path="/scan-result" element={<ScanResultRedirect />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/how-it-works" element={<AboutPage />} />
            <Route path="/faq" element={<AboutPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <HelmetProvider>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <div className="min-h-screen bg-bg text-text flex flex-col selection:bg-accent/20 selection:text-accent font-sans">
            <ScrollProgress />
            {/* Accessible skip link */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-btn focus:shadow-hover focus:outline-none text-xs font-mono font-semibold"
            >
              Skip to content
            </a>
            <Navbar />
            <main id="main-content" className="flex-grow flex flex-col">
              <AnimatedRoutes />
            </main>
            <Footer />
          </div>
        </BrowserRouter>
      </MotionConfig>
    </HelmetProvider>
  )
}
