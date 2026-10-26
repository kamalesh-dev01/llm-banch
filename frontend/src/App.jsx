import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import useHardwareStore from './store/hardwareStore'
import Navbar from './components/Navbar'
import Footer from './components/Footer'

// Core Pages
import HomePage from './pages/HomePage'
import ModelsPage from './pages/ModelsPage'
import ModelDetailPage from './pages/ModelDetailPage'
import VerdictPage from './pages/VerdictPage'
import LeaderboardPage from './pages/LeaderboardPage'
import NotFoundPage from './pages/NotFoundPage'

// AdSense Required Pages
import AboutPage from './pages/AboutPage'
import PrivacyPage from './pages/PrivacyPage'
import ContactPage from './pages/ContactPage'

function AnimatedRoutes() {
  const location = useLocation()
  const { setToken } = useHardwareStore()
  
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const token = params.get('token')
    if (token) {
      setToken(token)
    }
  }, [location.search, setToken])

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeInOut' }}
        className="flex-grow container mx-auto px-4 py-8"
      >
        <Routes location={location}>
          <Route path="/" element={<HomePage />} />
          <Route path="/models" element={<ModelsPage />} />
          <Route path="/models/:id" element={<ModelDetailPage />} />
          <Route path="/scan-result" element={<VerdictPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg text-text flex flex-col selection:bg-accent/20 selection:text-accent">
        <Navbar />
        <main className="flex-grow flex flex-col">
          <AnimatedRoutes />
        </main>
        {/* Footer on every page */}
        <Footer />
      </div>
    </BrowserRouter>
  )
}
