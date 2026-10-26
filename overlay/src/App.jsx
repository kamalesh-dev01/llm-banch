import { BrowserRouter, Routes, Route } from 'react-router-dom'
import SettingsPage from './pages/SettingsPage'
import OverlayPage from './pages/OverlayPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SettingsPage />} />
        <Route path="/overlay" element={<OverlayPage />} />
      </Routes>
    </BrowserRouter>
  )
}
