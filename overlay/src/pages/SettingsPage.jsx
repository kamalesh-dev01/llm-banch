import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import SidebarNav from '../components/SidebarNav'
import ToggleSwitch from '../components/ToggleSwitch'

const DEFAULT_CONFIG = {
  metrics: {
    gpu_utilization: true,
    vram_used: true,
    gpu_temperature: true,
    ram_used: true,
    cpu_utilization: false,
    tokens_per_sec: true,
  },
  style: {
    position: 'top-right',
    font_size: 13,
    opacity: 85,
    panel_width: 220,
  },
  behaviour: {
    auto_show_on_model: true,
    start_minimized: false,
    submit_community_data: false,
  }
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('metrics')
  const [config, setConfig] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem('llmbench_overlay_config') || 'null'
      ) || DEFAULT_CONFIG
    } catch { return DEFAULT_CONFIG }
  })
  const [liveMetrics, setLiveMetrics] = useState(null)
  const [overlayVisible, setOverlayVisible] = useState(false)

  // Listen for live metrics to show status
  useEffect(() => {
    const unlisten = listen('hardware-metrics', (event) => {
      try {
        setLiveMetrics(JSON.parse(event.payload))
      } catch {}
    })
    return () => { unlisten.then(f => f()) }
  }, [])

  const saveConfig = () => {
    localStorage.setItem(
      'llmbench_overlay_config',
      JSON.stringify(config)
    )
  }

  const toggleOverlay = async () => {
    await invoke('toggle_overlay_window')
    setOverlayVisible(v => !v)
  }

  const setPosition = async (pos) => {
    updateConfig('style', 'position', pos)
    await invoke('set_overlay_position', { position: pos })
  }

  const updateConfig = (section, key, value) => {
    setConfig(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value }
    }))
  }

  const tabs = [
    { id: 'metrics',   label: 'Metrics' },
    { id: 'style',     label: 'Style' },
    { id: 'behaviour', label: 'Behaviour' },
    { id: 'about',     label: 'About' },
  ]

  return (
    <div className="flex h-screen bg-[#0d0d0f] text-[#e0dfd6]
                    overflow-hidden">

      {/* Sidebar */}
      <SidebarNav
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">

          {/* METRICS TAB */}
          {activeTab === 'metrics' && (
            <div className="space-y-6">
              <div>
                <p className="text-xs text-[#6a6a72] uppercase
                              tracking-widest font-semibold mb-3">
                  Hardware
                </p>
                <div className="space-y-3">
                  {[
                    ['gpu_utilization', 'GPU Utilisation %'],
                    ['vram_used',       'VRAM Used / Total'],
                    ['gpu_temperature', 'GPU Temperature °C'],
                    ['ram_used',        'RAM Used / Total'],
                    ['cpu_utilization', 'CPU Utilisation %'],
                  ].map(([key, label]) => (
                    <div key={key}
                         className="flex items-center justify-between
                                    bg-[#13131a] border border-[#1e1e28]
                                    rounded-lg px-4 py-3">
                      <span className="text-sm">{label}</span>
                      <ToggleSwitch
                        checked={config.metrics[key]}
                        onChange={v => updateConfig('metrics', key, v)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-[#6a6a72] uppercase
                              tracking-widest font-semibold mb-3">
                  Model
                </p>
                <div className="space-y-3">
                  {[
                    ['tokens_per_sec', 'Tokens per Second'],
                  ].map(([key, label]) => (
                    <div key={key}
                         className="flex items-center justify-between
                                    bg-[#13131a] border border-[#1e1e28]
                                    rounded-lg px-4 py-3">
                      <span className="text-sm">{label}</span>
                      <ToggleSwitch
                        checked={config.metrics[key]}
                        onChange={v => updateConfig('metrics', key, v)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Test Mode button */}
              <div className="bg-[#1e2a4a] border border-[#3a6aaa]
                              rounded-lg p-4">
                <p className="text-sm font-semibold text-[#6baee0] mb-1">
                  Demo mode
                </p>
                <p className="text-xs text-[#6a6a72] mb-3">
                  Show overlay with simulated metrics
                  (no model needed)
                </p>
                <button
                  onClick={toggleOverlay}
                  className="bg-[#3a6aaa] text-white text-sm px-4 py-2
                             rounded-lg hover:bg-opacity-90 transition
                             cursor-pointer font-semibold"
                >
                  {overlayVisible ? 'Hide Overlay' : 'Show Overlay'}
                </button>
              </div>
            </div>
          )}

          {/* STYLE TAB */}
          {activeTab === 'style' && (
            <div className="space-y-6">
              <div>
                <label className="text-xs text-[#6a6a72] uppercase
                                  tracking-widest font-semibold block mb-3">
                  Position
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['top-left','top-right',
                    'bottom-left','bottom-right'].map(pos => (
                    <button
                      key={pos}
                      onClick={() => setPosition(pos)}
                      className={`py-2 px-3 text-sm rounded-lg border
                                  transition cursor-pointer font-medium
                                  capitalize ${
                        config.style.position === pos
                          ? 'bg-[#1e2a4a] border-[#3a6aaa] text-[#6baee0]'
                          : 'bg-[#13131a] border-[#1e1e28] text-[#6a6a72]'
                      }`}
                    >
                      {pos.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opacity slider */}
              <div>
                <label className="text-xs text-[#6a6a72] uppercase
                                  tracking-widest font-semibold block mb-3">
                  Opacity — {config.style.opacity}%
                </label>
                <input
                  type="range" min="20" max="100"
                  value={config.style.opacity}
                  onChange={e => updateConfig(
                    'style', 'opacity', parseInt(e.target.value)
                  )}
                  className="w-full accent-[#3a6aaa]"
                />
              </div>

              {/* Font size slider */}
              <div>
                <label className="text-xs text-[#6a6a72] uppercase
                                  tracking-widest font-semibold block mb-3">
                  Font size — {config.style.font_size}px
                </label>
                <input
                  type="range" min="10" max="18"
                  value={config.style.font_size}
                  onChange={e => updateConfig(
                    'style', 'font_size', parseInt(e.target.value)
                  )}
                  className="w-full accent-[#3a6aaa]"
                />
              </div>
            </div>
          )}

          {/* BEHAVIOUR TAB */}
          {activeTab === 'behaviour' && (
            <div className="space-y-3">
              {[
                ['auto_show_on_model',
                 'Auto-show when model starts'],
                ['start_minimized',
                 'Start minimized to tray'],
                ['submit_community_data',
                 'Submit anonymous benchmark data'],
              ].map(([key, label]) => (
                <div key={key}
                     className="flex items-center justify-between
                                bg-[#13131a] border border-[#1e1e28]
                                rounded-lg px-4 py-3">
                  <span className="text-sm">{label}</span>
                  <ToggleSwitch
                    checked={config.behaviour[key]}
                    onChange={v => updateConfig('behaviour', key, v)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* ABOUT TAB */}
          {activeTab === 'about' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="text-4xl mb-4">🧪</div>
                <h2 className="text-xl font-bold text-[#e0dfd6] mb-2">
                  LLM Bench Overlay
                </h2>
                <p className="text-[#6a6a72] text-sm mb-1">
                  Version 1.0.0
                </p>
                <p className="text-[#6a6a72] text-sm">
                  Real-time inference monitoring for local LLMs
                </p>
              </div>

              {/* Live metrics preview */}
              {liveMetrics && (
                <div className="bg-[#13131a] border border-[#1e1e28]
                                rounded-lg p-4">
                  <p className="text-xs text-[#6a6a72] uppercase
                                tracking-widest mb-3">
                    Live status
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-[#6a6a72]">GPU</span>
                    <span>{liveMetrics.gpu_name}</span>
                    <span className="text-[#6a6a72]">VRAM</span>
                    <span>
                      {liveMetrics.vram_used_gb}/
                      {liveMetrics.vram_total_gb} GB
                    </span>
                    <span className="text-[#6a6a72]">Model</span>
                    <span className={
                      liveMetrics.model_running
                        ? 'text-[#3cb080]' : 'text-[#6a6a72]'
                    }>
                      {liveMetrics.model_running
                        ? liveMetrics.model_name
                        : 'None running'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[#1e1e28] px-6 py-3
                        flex items-center justify-between
                        bg-[#0d0d0f]">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              liveMetrics?.model_running
                ? 'bg-[#3cb080]' : 'bg-[#3a3a42]'
            }`} />
            <span className="text-xs text-[#6a6a72]">
              {liveMetrics?.model_running
                ? `Model: ${liveMetrics.model_name}`
                : 'No model detected'}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleOverlay}
              className="text-xs px-3 py-1.5 border border-[#1e1e28]
                         rounded-lg text-[#6a6a72] hover:text-white
                         hover:border-[#6a6a72] transition cursor-pointer"
            >
              Toggle Overlay
            </button>
            <button
              onClick={saveConfig}
              className="text-xs px-3 py-1.5 bg-[#3a6aaa] text-white
                         rounded-lg hover:bg-opacity-90 transition
                         cursor-pointer font-semibold"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
