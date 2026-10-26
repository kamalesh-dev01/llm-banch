import React, { useState, useEffect } from 'react'
import { getModels } from '../api/client'
import ModelCard from '../components/ModelCard'
import AdSlot from '../components/AdSlot'
import useHardwareStore from '../store/hardwareStore'
import { X, Check, Search, Filter, SlidersHorizontal, RotateCcw } from 'lucide-react'

export default function ModelsPage() {
  const { hardware } = useHardwareStore()
  
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Filters state
  const [search, setSearch] = useState('')
  const [family, setFamily] = useState('All')
  const [tasks, setTasks] = useState([])
  const [maxVram, setMaxVram] = useState(24)
  const [paramsFilter, setParamsFilter] = useState('All')
  const [sort, setSort] = useState('quality') 
  const [showHardwareBanner, setShowHardwareBanner] = useState(true)

  // Options
  const families = ['All', 'llama', 'qwen', 'phi', 'mistral', 'gemma', 'deepseek', 'smollm', 'other']
  const availableTasks = ['chat', 'coding', 'summarization', 'qa', 'vision', 'multilingual']
  const paramOptions = ['All', '<3B', '3-9B', '9-15B', '15B+']

  const handleTaskToggle = (t) => {
    setTasks(prev => 
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    )
  }

  const handleReset = () => {
    setSearch('')
    setFamily('All')
    setTasks([])
    setMaxVram(24)
    setParamsFilter('All')
    setSort('quality')
  }

  // Active filter count and checks
  const hasActiveFilters = search || family !== 'All' || tasks.length > 0 || maxVram < 24 || paramsFilter !== 'All'

  // Debounced API fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true)
      const queryParams = { sort }
      
      if (search) queryParams.search = search
      if (family !== 'All') queryParams.family = family
      if (tasks.length > 0) queryParams.task = tasks.join(',')
      if (maxVram < 24) queryParams.max_vram = maxVram
      
      if (paramsFilter === '<3B') queryParams.max_params = 3
      else if (paramsFilter === '3-9B') { queryParams.min_params = 3; queryParams.max_params = 9 }
      else if (paramsFilter === '9-15B') { queryParams.min_params = 9; queryParams.max_params = 15 }
      else if (paramsFilter === '15B+') queryParams.min_params = 15
      
      getModels(queryParams)
        .then(res => {
          let data = Array.isArray(res.data) ? res.data : (res.data.models || [])
          setModels(data)
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false))
    }, 280)
    
    return () => clearTimeout(timer)
  }, [search, family, tasks, maxVram, paramsFilter, sort])

  return (
    <div className="flex flex-col md:flex-row gap-8 pb-16">
      {/* LEFT SIDEBAR FILTERS (Using .glass with tidy spacing) */}
      <aside className="w-full md:w-64 flex-shrink-0 glass p-5 space-y-6 md:sticky md:top-24 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border/80">
          <div className="flex items-center gap-2 font-heading font-bold text-text text-base">
            <SlidersHorizontal size={16} className="text-accent" />
            <span>Filter Engine</span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="text-[11px] font-mono text-muted hover:text-accent transition flex items-center gap-1 cursor-pointer"
              title="Reset all filters"
            >
              <RotateCcw size={11} />
              <span>Reset</span>
            </button>
          )}
        </div>
        
        {/* Search */}
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-muted mb-2 font-semibold">
            Search
          </label>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search model tags..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg pl-8 pr-8 py-2 text-xs font-mono text-text focus:outline-none focus:border-accent transition"
            />
            <Search size={14} className="absolute left-2.5 top-2.5 text-muted pointer-events-none" />
            {search && (
              <button 
                onClick={() => setSearch('')} 
                className="absolute right-2.5 top-2.5 text-muted hover:text-text cursor-pointer transition"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        
        {/* Family */}
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-muted mb-2.5 font-semibold">
            Model Family
          </label>
          <div className="flex flex-wrap gap-1.5">
            {families.map(f => (
              <button 
                key={f} 
                onClick={() => setFamily(f)}
                className={`px-2.5 py-1 text-xs rounded-md border transition cursor-pointer capitalize font-mono ${
                  family === f 
                    ? 'bg-accent/15 border-accent text-accent font-bold' 
                    : 'bg-surface border-border text-muted hover:border-muted hover:text-text'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Task Capabilities */}
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-muted mb-2.5 font-semibold">
            Tasks &amp; Modality
          </label>
          <div className="space-y-2">
            {availableTasks.map(t => (
              <label key={t} className="flex items-center gap-2.5 cursor-pointer group text-xs font-mono select-none">
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition ${
                  tasks.includes(t) ? 'bg-accent border-accent text-bg' : 'bg-surface border-border group-hover:border-muted'
                }`}>
                  {tasks.includes(t) && <Check size={11} className="stroke-[3]" />}
                </div>
                <span className="text-muted group-hover:text-text capitalize">{t}</span>
              </label>
            ))}
          </div>
        </div>

        {/* VRAM Slider */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-mono uppercase tracking-wider text-muted font-semibold">
              Max VRAM
            </label>
            <span className="text-xs font-mono font-bold text-accent">
              {maxVram} GB
            </span>
          </div>
          <input 
            type="range" 
            min="2" max="24" step="1" 
            value={maxVram}
            onChange={(e) => setMaxVram(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-elevated rounded-lg appearance-none cursor-pointer accent-accent"
          />
          <div className="flex justify-between text-[10px] font-mono text-muted/60 mt-1">
            <span>2 GB</span>
            <span>12 GB</span>
            <span>24 GB</span>
          </div>
        </div>

        {/* Parameters */}
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-muted mb-2.5 font-semibold">
            Parameter Size
          </label>
          <div className="flex flex-wrap gap-1.5">
            {paramOptions.map(p => (
              <button 
                key={p} 
                onClick={() => setParamsFilter(p)}
                className={`px-2.5 py-1 text-xs rounded-md border transition cursor-pointer font-mono ${
                  paramsFilter === p 
                    ? 'bg-accent/15 border-accent text-accent font-bold' 
                    : 'bg-surface border-border text-muted hover:border-muted hover:text-text'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {hasActiveFilters && (
          <button 
            onClick={handleReset}
            className="w-full py-2 text-xs font-mono text-muted border border-border rounded-lg hover:text-text hover:border-accent bg-surface transition cursor-pointer font-semibold"
          >
            Clear All Filters
          </button>
        )}
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-grow min-w-0">
        {/* Active Hardware Telemetry Banner */}
        {hardware && showHardwareBanner && (
          <div className="glass p-3.5 mb-6 flex items-center justify-between border-l-4 border-l-accent shadow-sm">
            <div className="flex items-center gap-3 text-xs font-mono text-accent truncate">
              <span className="w-2 h-2 rounded-full bg-accent animate-ping flex-shrink-0" />
              <span className="truncate">
                Showing compatibility for: <strong className="text-text font-bold">{hardware.gpu_name}</strong> ({hardware.vram_gb} GB VRAM &bull; {hardware.ram_gb} GB RAM)
              </span>
            </div>
            <button 
              onClick={() => setShowHardwareBanner(false)} 
              className="text-muted hover:text-text cursor-pointer transition ml-2 flex-shrink-0"
              title="Dismiss banner"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* ACTIVE FILTER CHIPS (Requirement: shown above the grid with an 'x' to remove each) */}
        {hasActiveFilters && (
          <div className="mb-5 flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-mono text-muted mr-1">Active filters:</span>
            
            {search && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-elevated border border-border text-xs font-mono text-text">
                <span>&ldquo;{search}&rdquo;</span>
                <button onClick={() => setSearch('')} className="text-muted hover:text-not-recommended">
                  <X size={12} />
                </button>
              </span>
            )}

            {family !== 'All' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-elevated border border-border text-xs font-mono text-text capitalize">
                <span>Family: {family}</span>
                <button onClick={() => setFamily('All')} className="text-muted hover:text-not-recommended">
                  <X size={12} />
                </button>
              </span>
            )}

            {tasks.map(t => (
              <span key={t} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-elevated border border-border text-xs font-mono text-text capitalize">
                <span>Task: {t}</span>
                <button onClick={() => handleTaskToggle(t)} className="text-muted hover:text-not-recommended">
                  <X size={12} />
                </button>
              </span>
            ))}

            {maxVram < 24 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-elevated border border-border text-xs font-mono text-text">
                <span>VRAM &le; {maxVram} GB</span>
                <button onClick={() => setMaxVram(24)} className="text-muted hover:text-not-recommended">
                  <X size={12} />
                </button>
              </span>
            )}

            {paramsFilter !== 'All' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-elevated border border-border text-xs font-mono text-text">
                <span>Params: {paramsFilter}</span>
                <button onClick={() => setParamsFilter('All')} className="text-muted hover:text-not-recommended">
                  <X size={12} />
                </button>
              </span>
            )}

            <button
              onClick={handleReset}
              className="text-xs font-mono text-accent hover:underline ml-2"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Toolbar: Model count & Sort select */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <span className="text-muted text-xs font-mono">
            Showing <strong className="text-text">{models.length}</strong> models matching criteria
          </span>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-muted">Sort by:</span>
            <select 
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-text focus:outline-none focus:border-accent cursor-pointer transition"
            >
              <option value="quality">Best Quality Score</option>
              <option value="speed">Fastest Inference</option>
              <option value="vram">Lowest Minimum VRAM</option>
              <option value="downloads">Most Downloads</option>
            </select>
          </div>
        </div>

        {/* GRID OF MODELS & IN-FEED ADS */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 shimmer rounded-xl border border-border p-5 flex flex-col justify-between">
                <div className="h-5 bg-border/40 rounded w-2/3"></div>
                <div className="h-12 bg-border/40 rounded w-full"></div>
                <div className="h-4 bg-border/40 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : models.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {models.map((model, index) => {
              const shouldShowInFeedAd = (index + 1) % 9 === 0 && index !== models.length - 1
              return (
                <React.Fragment key={model.id}>
                  <ModelCard model={model} index={index % 9} />
                  {/* Requirement: one in-feed slot after every 9th card */}
                  {shouldShowInFeedAd && (
                    <div className="col-span-full">
                      <AdSlot slot={`models-in-feed-${index + 1}`} format="inline" />
                    </div>
                  )}
                </React.Fragment>
              )
            })}
          </div>
        ) : (
          <div className="glass p-16 text-center rounded-2xl flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-elevated border border-border flex items-center justify-center text-muted">
              <Filter size={28} />
            </div>
            <h3 className="text-xl font-heading font-bold text-text">No models match your filters</h3>
            <p className="text-sm text-muted max-w-sm">
              Try adjusting your parameter range, VRAM limit, or clearing the search query.
            </p>
            <button 
              onClick={handleReset}
              className="bg-accent text-bg px-6 py-2.5 rounded-lg text-xs font-mono font-bold hover:bg-accent/90 transition shadow-md shadow-accent/20 cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
