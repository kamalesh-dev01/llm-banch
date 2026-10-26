import { useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import MetricRow from '../components/MetricRow'

export default function OverlayPage() {
  const [metrics, setMetrics] = useState(null)
  const [config, setConfig] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem('llmbench_overlay_config') || 'null'
      ) || getDefaultConfig()
    } catch {
      return getDefaultConfig()
    }
  })

  useEffect(() => {
    // Listen for hardware metrics from Tauri sidecar
    const unlisten = listen('hardware-metrics', (event) => {
      try {
        const data = JSON.parse(event.payload)
        setMetrics(data)
      } catch { /* ignore parse errors */ }
    })
    return () => { unlisten.then(f => f()) }
  }, [])

  if (!metrics) {
    return (
      <div className="overlay-panel flex items-center justify-center h-full">
        <span className="text-xs text-[#6a6a72]">Connecting...</span>
      </div>
    )
  }

  const vramPct = metrics.vram_total_gb > 0
    ? (metrics.vram_used_gb / metrics.vram_total_gb) * 100
    : 0

  return (
    <div className="overlay-panel select-none">

      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-1
                      border-b border-[rgba(255,255,255,0.08)]">
        <span className="text-[10px] font-bold tracking-widest
                         text-[#3a6aaa] uppercase">
          LLM Bench
        </span>
        {metrics.model_running && (
          <span className="text-[9px] text-[#3cb080] font-medium truncate
                           max-w-[120px]">
            ● {metrics.model_name}
          </span>
        )}
      </div>

      {/* Metric rows */}
      {config.metrics?.gpu_utilization && (
        <MetricRow
          label="GPU"
          value={`${metrics.gpu_utilization}%`}
          percent={metrics.gpu_utilization}
          colorByValue={metrics.gpu_utilization}
          thresholds={[50, 80]}
        />
      )}

      {config.metrics?.vram_used && (
        <MetricRow
          label="VRAM"
          value={`${metrics.vram_used_gb}/${metrics.vram_total_gb}G`}
          percent={vramPct}
          colorByValue={vramPct}
          thresholds={[60, 85]}
        />
      )}

      {config.metrics?.gpu_temperature && (
        <MetricRow
          label="Temp"
          value={`${metrics.gpu_temperature}°C`}
          percent={metrics.gpu_temperature}
          colorByValue={metrics.gpu_temperature}
          thresholds={[60, 80]}
        />
      )}

      {config.metrics?.ram_used && (
        <MetricRow
          label="RAM"
          value={`${metrics.ram_used_gb}G`}
          percent={(metrics.ram_used_gb / metrics.ram_total_gb) * 100}
          colorByValue={
            (metrics.ram_used_gb / metrics.ram_total_gb) * 100
          }
          thresholds={[60, 85]}
        />
      )}

      {config.metrics?.cpu_utilization && (
        <MetricRow
          label="CPU"
          value={`${metrics.cpu_utilization}%`}
          percent={metrics.cpu_utilization}
          colorByValue={metrics.cpu_utilization}
          thresholds={[50, 80]}
        />
      )}

      {config.metrics?.tokens_per_sec && metrics.model_running && (
        <MetricRow
          label="tok/s"
          value={`${metrics.tokens_per_sec || '—'}`}
          percent={Math.min((metrics.tokens_per_sec / 60) * 100, 100)}
          colorByValue={0}
          thresholds={[999, 999]}
          forceColor="green"
        />
      )}

      {/* Footer */}
      {!metrics.model_running && (
        <div className="mt-2 pt-1 border-t border-[rgba(255,255,255,0.05)]">
          <span className="text-[9px] text-[#4a4a52]">
            No model running
          </span>
        </div>
      )}
    </div>
  )
}

function getDefaultConfig() {
  return {
    metrics: {
      gpu_utilization: true,
      vram_used: true,
      gpu_temperature: true,
      ram_used: true,
      cpu_utilization: false,
      tokens_per_sec: true,
    }
  }
}
