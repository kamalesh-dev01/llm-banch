import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  getModels, 
  getFilters, 
  getScanResults 
} from '../api/client'
import ModelCard from '../components/ModelCard'
import AdSlot from '../components/AdSlot'
import useHardwareStore from '../store/hardwareStore'
import { 
  Search, 
  Filter, 
  SlidersHorizontal, 
  RotateCcw, 
  X, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  LayoutGrid, 
  List, 
  Monitor, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  Shield, 
  Sliders 
} from 'lucide-react'

export default function ModelsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { hardware, token } = useHardwareStore()

  // Dynamic filter metadata from DB via /api/filters
  const [filterMeta, setFilterMeta] = useState({
    families: [],
    tasks: [],
    capabilities: [],
    licenses: [],
    params: { min: 0.5, max: 70.0 },
    vram: { min: 2.0, max: 24.0 }
  })
  const [filtersLoaded, setFiltersLoaded] = useState(false)

  // Scan tiers map from /api/results/:token
  const [tierMap, setTierMap] = useState({})
  const [scanLoading, setScanLoading] = useState(false)

  // Models result state (declared first)
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [allModelsForSuggestions, setAllModelsForSuggestions] = useState([])
  const searchContainerRef = useRef(null)

  // Local state initialized from URL search params
  const [search, setSearch] = useState(searchParams.get('q') || searchParams.get('search') || '')
  const [family, setFamily] = useState(searchParams.get('family') || 'all')
  const [task, setTask] = useState(searchParams.get('task') || 'all')
  const [capability, setCapability] = useState(searchParams.get('capability') || 'all')
  const [license, setLicense] = useState(searchParams.get('license') || 'all')
  const [maxVram, setMaxVram] = useState(() => {
    const v = searchParams.get('max_vram')
    return v ? parseFloat(v) : null
  })
  const [maxParams, setMaxParams] = useState(() => {
    const p = searchParams.get('max_params')
    return p ? parseFloat(p) : null
  })
  const [minParams, setMinParams] = useState(() => {
    const p = searchParams.get('min_params')
    return p ? parseFloat(p) : null
  })
  const [sort, setSort] = useState(searchParams.get('sort') || 'downloads')
  const hasRealQuality = useMemo(() => models.some(m => m.quality_source && m.quality_source !== 'size_estimate'), [models])
  const [pcOnly, setPcOnly] = useState(searchParams.get('pc_only') === 'true')

  // UI state
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('llmbench_catalog_view') || 'grid'
  })
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [searchSuggestionsOpen, setSearchSuggestionsOpen] = useState(false)

  // Collapsible sidebar groups state
  const [openGroups, setOpenGroups] = useState({
    family: true,
    task: true,
    capabilities: true,
    license: false,
    params: true,
    vram: true,
  })

  const toggleGroup = (group) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }))
  }


  // Remember view mode preference
  const handleViewModeChange = (mode) => {
    setViewMode(mode)
    localStorage.setItem('llmbench_catalog_view', mode)
  }

  // 1. Fetch dynamic filters from DB once on mount
  useEffect(() => {
    getFilters()
      .then(res => {
        if (res.data) {
          setFilterMeta(res.data)
          setFiltersLoaded(true)
        }
      })
      .catch(err => {
        console.warn('Failed to load dynamic filters:', err)
        setFiltersLoaded(true)
      })
  }, [])

  // 2. Load scan results if a scan session token exists
  useEffect(() => {
    if (token) {
      setScanLoading(true)
      getScanResults(token)
        .then(res => {
          const list = Array.isArray(res.data) ? res.data : (res.data.results || [])
          const map = {}
          list.forEach(item => {
            const mId = item.model_id || item.id
            if (mId && item.tier) {
              map[mId] = item.tier
            }
          })
          setTierMap(map)
        })
        .catch(err => console.warn('Could not load scan results:', err))
        .finally(() => setScanLoading(false))
    }
  }, [token])

  // 3. Keep URL query params synchronized with state
  useEffect(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('q', search.trim())
    if (family && family !== 'all') params.set('family', family)
    if (task && task !== 'all') params.set('task', task)
    if (capability && capability !== 'all') params.set('capability', capability)
    if (license && license !== 'all') params.set('license', license)
    if (maxVram !== null && maxVram !== undefined && filterMeta.vram && maxVram < filterMeta.vram.max) {
      params.set('max_vram', maxVram.toString())
    }
    if (maxParams !== null && maxParams !== undefined && filterMeta.params && maxParams < filterMeta.params.max) {
      params.set('max_params', maxParams.toString())
    }
    if (minParams !== null && minParams !== undefined && filterMeta.params && minParams > filterMeta.params.min) {
      params.set('min_params', minParams.toString())
    }
    if (sort && sort !== 'downloads') params.set('sort', sort)
    if (pcOnly) params.set('pc_only', 'true')

    setSearchParams(params, { replace: true })
  }, [search, family, task, capability, license, maxVram, maxParams, minParams, sort, pcOnly, filterMeta, setSearchParams])

  // 4. Fetch filtered models from backend API
  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(() => {
      const qParams = { sort }
      if (search.trim()) qParams.search = search.trim()
      if (family && family !== 'all') qParams.family = family
      if (task && task !== 'all') qParams.task = task
      if (capability && capability !== 'all') qParams.capability = capability
      if (license && license !== 'all') qParams.license = license
      if (maxVram !== null && maxVram !== undefined) qParams.max_vram = maxVram
      if (maxParams !== null && maxParams !== undefined) qParams.max_params = maxParams
      if (minParams !== null && minParams !== undefined) qParams.min_params = minParams

      getModels(qParams)
        .then(res => {
          let data = Array.isArray(res.data) ? res.data : (res.data.models || [])
          setModels(data)
          if (allModelsForSuggestions.length === 0 && !search.trim()) {
            setAllModelsForSuggestions(data)
          }
        })
        .catch(err => {
          console.error('Failed to load models:', err)
          setModels([])
        })
        .finally(() => setLoading(false))
    }, 250)

    return () => clearTimeout(timer)
  }, [search, family, task, capability, license, maxVram, maxParams, minParams, sort])

  // Close search suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchSuggestionsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Merge tier info onto models & apply "Runs well on my PC" client toggle
  const displayModels = useMemo(() => {
    return models
      .map(m => {
        const t = tierMap[m.id]
        return t ? { ...m, tier: t } : m
      })
      .filter(m => {
        if (!pcOnly || !token) return true
        return m.tier === 'gpu' || m.tier === 'offload'
      })
  }, [models, tierMap, pcOnly, token])

  // Debounced search suggestions
  const searchSuggestions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 2) return []
    const source = allModelsForSuggestions.length > 0 ? allModelsForSuggestions : models
    return source
      .filter(m => m.name.toLowerCase().includes(q) || (m.ollama_tag && m.ollama_tag.toLowerCase().includes(q)))
      .slice(0, 5)
  }, [search, allModelsForSuggestions, models])

  // Active filters count and checking
  const activeFilters = useMemo(() => {
    const list = []
    if (search.trim()) {
      list.push({ type: 'search', label: `Search: "${search}"`, onClear: () => setSearch('') })
    }
    if (family !== 'all') {
      list.push({ type: 'family', label: `Family: ${family}`, onClear: () => setFamily('all') })
    }
    if (task !== 'all') {
      list.push({ type: 'task', label: `Task: ${task}`, onClear: () => setTask('all') })
    }
    if (capability !== 'all') {
      list.push({ type: 'capability', label: `Capability: ${capability}`, onClear: () => setCapability('all') })
    }
    if (license !== 'all') {
      list.push({ type: 'license', label: `License: ${license}`, onClear: () => setLicense('all') })
    }
    if (maxVram !== null && filterMeta.vram && maxVram < filterMeta.vram.max) {
      list.push({ type: 'vram', label: `VRAM ≤ ${maxVram} GB`, onClear: () => setMaxVram(filterMeta.vram.max) })
    }
    if (maxParams !== null && filterMeta.params && maxParams < filterMeta.params.max) {
      list.push({ type: 'params', label: `Params ≤ ${maxParams}B`, onClear: () => setMaxParams(filterMeta.params.max) })
    }
    if (pcOnly) {
      list.push({ type: 'pc', label: 'Runs well on my PC', onClear: () => setPcOnly(false) })
    }
    return list
  }, [search, family, task, capability, license, maxVram, maxParams, pcOnly, filterMeta])

  const handleClearAll = () => {
    setSearch('')
    setFamily('all')
    setTask('all')
    setCapability('all')
    setLicense('all')
    setMaxVram(filterMeta.vram ? filterMeta.vram.max : null)
    setMaxParams(filterMeta.params ? filterMeta.params.max : null)
    setMinParams(null)
    setSort('downloads')
    setPcOnly(false)
  }

  // Sidebar / Drawer filter contents component
  const FilterControls = ({ inDrawer = false, onApply }) => {
    const vramMaxVal = filterMeta.vram?.max || 24.0
    const vramMinVal = filterMeta.vram?.min || 2.0
    const currentVram = maxVram !== null ? maxVram : vramMaxVal

    const paramsMaxVal = filterMeta.params?.max || 70.0
    const paramsMinVal = filterMeta.params?.min || 0.5
    const currentMaxParams = maxParams !== null ? maxParams : paramsMaxVal

    return (
      <div className="space-y-6">
        {/* Runs well on my PC toggle (when scan is present) */}
        {token && (
          <div className="p-3.5 bg-surface-2 border border-line rounded-btn">
            <label className="flex items-center justify-between cursor-pointer select-none">
              <div className="pr-2">
                <div className="text-xs font-mono font-bold text-text flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-success" />
                  <span>Runs well on my PC</span>
                </div>
                <div className="text-[11px] font-mono text-muted mt-0.5">
                  GPU &amp; CPU-offload tiers only
                </div>
              </div>
              <input
                type="checkbox"
                checked={pcOnly}
                onChange={(e) => setPcOnly(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
            </label>
          </div>
        )}

        {/* 1. Family Group (Collapsible, real counts) */}
        <div className="border-b border-line pb-4">
          <button
            type="button"
            onClick={() => toggleGroup('family')}
            className="w-full flex items-center justify-between text-xs font-mono uppercase tracking-wider text-muted font-bold mb-2.5 hover:text-text transition cursor-pointer"
          >
            <span>Model Family</span>
            {openGroups.family ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {openGroups.family && (
            <div className="space-y-1 pt-1 max-h-48 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => setFamily('all')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-btn border transition cursor-pointer font-mono ${
                  family === 'all'
                    ? 'bg-primary-soft border-primary text-primary font-bold'
                    : 'bg-surface-2 border-transparent text-muted hover:text-text hover:bg-line/40'
                }`}
              >
                <span>All Families</span>
                <span className="text-[11px] text-muted">{models.length}</span>
              </button>
              {filterMeta.families.map((f) => {
                const isSelected = family.toLowerCase() === f.value.toLowerCase()
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFamily(isSelected ? 'all' : f.value)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-btn border transition cursor-pointer font-mono capitalize ${
                      isSelected
                        ? 'bg-primary-soft border-primary text-primary font-bold'
                        : 'bg-surface-2 border-transparent text-muted hover:text-text hover:bg-line/40'
                    }`}
                  >
                    <span>{f.value}</span>
                    <span className="text-[11px] text-muted">({f.count})</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 2. Tasks Group (Collapsible, real counts) */}
        <div className="border-b border-line pb-4">
          <button
            type="button"
            onClick={() => toggleGroup('task')}
            className="w-full flex items-center justify-between text-xs font-mono uppercase tracking-wider text-muted font-bold mb-2.5 hover:text-text transition cursor-pointer"
          >
            <span>Tasks</span>
            {openGroups.task ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {openGroups.task && (
            <div className="space-y-1 pt-1 max-h-48 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => setTask('all')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-btn border transition cursor-pointer font-mono ${
                  task === 'all'
                    ? 'bg-primary-soft border-primary text-primary font-bold'
                    : 'bg-surface-2 border-transparent text-muted hover:text-text hover:bg-line/40'
                }`}
              >
                <span>All Tasks</span>
              </button>
              {filterMeta.tasks.map((t) => {
                const isSelected = task.toLowerCase() === t.value.toLowerCase()
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTask(isSelected ? 'all' : t.value)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-btn border transition cursor-pointer font-mono capitalize ${
                      isSelected
                        ? 'bg-primary-soft border-primary text-primary font-bold'
                        : 'bg-surface-2 border-transparent text-muted hover:text-text hover:bg-line/40'
                    }`}
                  >
                    <span>{t.value}</span>
                    <span className="text-[11px] text-muted">({t.count})</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 3. Capabilities Group (Collapsible, dynamic from /api/filters) */}
        {filterMeta.capabilities?.length > 0 && (
          <div className="border-b border-line pb-4">
            <button
              type="button"
              onClick={() => toggleGroup('capabilities')}
              className="w-full flex items-center justify-between text-xs font-mono uppercase tracking-wider text-muted font-bold mb-2.5 hover:text-text transition cursor-pointer"
            >
              <span>Capabilities</span>
              {openGroups.capabilities ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {openGroups.capabilities && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {filterMeta.capabilities.map((c) => {
                  const capVal = typeof c === 'object' ? c.value : c
                  const isSelected = capability.toLowerCase() === capVal.toLowerCase()
                  return (
                    <button
                      key={capVal}
                      type="button"
                      onClick={() => setCapability(isSelected ? 'all' : capVal)}
                      className={`px-2.5 py-1 text-xs rounded-btn border transition cursor-pointer font-mono capitalize ${
                        isSelected
                          ? 'bg-primary-soft border-primary text-primary font-bold'
                          : 'bg-surface-2 border-line text-muted hover:text-text'
                      }`}
                    >
                      {capVal}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 4. Parameter Size Slider */}
        <div className="border-b border-line pb-4">
          <button
            type="button"
            onClick={() => toggleGroup('params')}
            className="w-full flex items-center justify-between text-xs font-mono uppercase tracking-wider text-muted font-bold mb-2 hover:text-text transition cursor-pointer"
          >
            <span>Max Parameters</span>
            {openGroups.params ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {openGroups.params && (
            <div className="pt-1">
              <div className="flex justify-between text-xs font-mono mb-1.5">
                <span className="text-muted">Threshold:</span>
                <span className="text-primary font-bold">{currentMaxParams.toFixed(1)}B</span>
              </div>
              <input
                type="range"
                min={paramsMinVal}
                max={paramsMaxVal}
                step="0.5"
                value={currentMaxParams}
                onChange={(e) => setMaxParams(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] font-mono text-muted mt-1">
                <span>{paramsMinVal}B</span>
                <span>{((paramsMinVal + paramsMaxVal) / 2).toFixed(0)}B</span>
                <span>{paramsMaxVal}B</span>
              </div>
            </div>
          )}
        </div>

        {/* 5. Max VRAM Slider */}
        <div className="border-b border-line pb-4">
          <button
            type="button"
            onClick={() => toggleGroup('vram')}
            className="w-full flex items-center justify-between text-xs font-mono uppercase tracking-wider text-muted font-bold mb-2 hover:text-text transition cursor-pointer"
          >
            <span>Max Minimum VRAM</span>
            {openGroups.vram ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {openGroups.vram && (
            <div className="pt-1">
              <div className="flex justify-between text-xs font-mono mb-1.5">
                <span className="text-muted">VRAM Limit:</span>
                <span className="text-primary font-bold">{currentVram.toFixed(1)} GB</span>
              </div>
              <input
                type="range"
                min={vramMinVal}
                max={vramMaxVal}
                step="0.5"
                value={currentVram}
                onChange={(e) => setMaxVram(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] font-mono text-muted mt-1">
                <span>{vramMinVal} GB</span>
                <span>{((vramMinVal + vramMaxVal) / 2).toFixed(0)} GB</span>
                <span>{vramMaxVal} GB</span>
              </div>
            </div>
          )}
        </div>

        {/* 6. License Group (Collapsible, dynamic from /api/filters) */}
        {filterMeta.licenses?.length > 0 && (
          <div className="pb-2">
            <button
              type="button"
              onClick={() => toggleGroup('license')}
              className="w-full flex items-center justify-between text-xs font-mono uppercase tracking-wider text-muted font-bold mb-2.5 hover:text-text transition cursor-pointer"
            >
              <span>License</span>
              {openGroups.license ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {openGroups.license && (
              <div className="space-y-1 pt-1 max-h-40 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => setLicense('all')}
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded-btn border transition cursor-pointer font-mono ${
                    license === 'all'
                      ? 'bg-primary-soft border-primary text-primary font-bold'
                      : 'bg-surface-2 border-transparent text-muted hover:text-text hover:bg-line/40'
                  }`}
                >
                  All Licenses
                </button>
                {filterMeta.licenses.map((lic) => {
                  const licVal = typeof lic === 'object' ? lic.value : lic
                  const isSelected = license.toLowerCase() === licVal.toLowerCase()
                  return (
                    <button
                      key={licVal}
                      type="button"
                      onClick={() => setLicense(isSelected ? 'all' : licVal)}
                      className={`w-full text-left px-2.5 py-1.5 text-xs rounded-btn border transition cursor-pointer font-mono truncate ${
                        isSelected
                          ? 'bg-primary-soft border-primary text-primary font-bold'
                          : 'bg-surface-2 border-transparent text-muted hover:text-text hover:bg-line/40'
                      }`}
                    >
                      {licVal}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {inDrawer && (
          <div className="pt-4">
            <button
              type="button"
              onClick={onApply}
              className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-btn text-xs font-mono font-bold transition shadow-soft cursor-pointer"
            >
              Apply Filters ({displayModels.length} Models)
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>AI Models Catalog — LLM Bench</title>
        <meta
          name="description"
          content="Explore the complete open-source local LLM catalog with hardware compatibility tiers, parameter ranges, and verified benchmarks."
        />
      </Helmet>

      {/* Screen Reader Aria-Live Announcement */}
      <div aria-live="polite" className="sr-only">
        Showing {displayModels.length} models
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 max-w-7xl">
        {/* HEADER SECTION: Title, Count, Prominent Search, Sort, View Toggle */}
        <div className="bg-surface border border-line rounded-card p-6 sm:p-8 mb-8 shadow-soft">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-text tracking-tight">
                  AI Models Catalog
                </h1>
                <span className="px-2.5 py-0.5 rounded-pill bg-primary-soft text-primary border border-primary/30 text-xs font-mono font-bold">
                  {displayModels.length} {displayModels.length === 1 ? 'model' : 'models'}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-mono text-muted mt-1">
                Filter and compare verified weights by parameters, memory footprint, and physical hardware requirements.
              </p>
            </div>

            {/* View Mode & Mobile Filter Trigger */}
            <div className="flex items-center gap-2 self-start md:self-auto">
              {/* Mobile Filter Button */}
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className="md:hidden inline-flex items-center gap-2 px-3.5 py-2 bg-surface-2 border border-line hover:border-primary text-text rounded-btn text-xs font-mono font-bold transition cursor-pointer"
              >
                <SlidersHorizontal size={14} className="text-primary" />
                <span>Filters</span>
                {activeFilters.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                    {activeFilters.length}
                  </span>
                )}
              </button>

              {/* Grid / List View Toggle */}
              <div className="flex items-center bg-surface-2 p-1 rounded-btn border border-line">
                <button
                  type="button"
                  onClick={() => handleViewModeChange('grid')}
                  className={`p-1.5 rounded transition cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-primary text-white shadow-soft'
                      : 'text-muted hover:text-text'
                  }`}
                  title="Grid view"
                  aria-label="Grid view"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleViewModeChange('list')}
                  className={`p-1.5 rounded transition cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-primary text-white shadow-soft'
                      : 'text-muted hover:text-text'
                  }`}
                  title="List view"
                  aria-label="List view"
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Prominent Search Bar with Debounced Real Suggestions + Sort Select */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div ref={searchContainerRef} className="relative flex-grow">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-3.5 text-muted pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by model name, tag, or publisher (e.g. Qwen, Llama 3.2, Mistral)..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setSearchSuggestionsOpen(true)
                  }}
                  onFocus={() => setSearchSuggestionsOpen(true)}
                  className="w-full bg-surface-2 border border-line rounded-btn pl-10 pr-9 py-2.5 text-xs font-mono text-text placeholder:text-muted focus:outline-none focus:border-primary transition shadow-inner"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('')
                      setSearchSuggestionsOpen(false)
                    }}
                    className="absolute right-3 top-3 text-muted hover:text-text cursor-pointer transition"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Real Suggestions Dropdown */}
              {searchSuggestionsOpen && searchSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-surface border border-line rounded-card shadow-card z-30 py-2 divide-y divide-line/60">
                  <div className="px-3 py-1 text-[10px] font-mono uppercase text-muted tracking-wider">
                    Suggested Models
                  </div>
                  {searchSuggestions.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSearch(s.name)
                        setSearchSuggestionsOpen(false)
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-surface-2 transition flex items-center justify-between text-xs font-mono cursor-pointer"
                    >
                      <div className="truncate pr-2">
                        <span className="font-bold text-text">{s.name}</span>
                        {s.publisher && <span className="text-muted text-[11px] ml-1.5">by {s.publisher}</span>}
                      </div>
                      <span className="text-[11px] text-primary font-bold flex-shrink-0">
                        {s.params_b}B
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort Select */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-mono text-muted hidden sm:inline">Sort:</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="bg-surface-2 border border-line rounded-btn px-3 py-2.5 text-xs font-mono font-semibold text-text focus:outline-none focus:border-primary cursor-pointer transition shadow-soft"
              >
                <option value="downloads">Most Downloads</option>
                {hasRealQuality && <option value="quality">Best Quality Score</option>}
                <option value="newest">Newest Released</option>
                <option value="params_asc">Smallest Parameters</option>
                <option value="params_desc">Largest Parameters</option>
                <option value="vram">Lowest Minimum VRAM</option>
              </select>
            </div>
          </div>
        </div>

        {/* SCAN PROMPT BANNER (When no scan token is present) */}
        {!token && (
          <div className="bg-surface border border-line rounded-card p-4 sm:p-5 mb-8 shadow-soft flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-btn bg-primary-soft border border-primary/30 flex items-center justify-center text-primary flex-shrink-0">
                <Monitor size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text">
                  Check your PC to see which models run well
                </h3>
                <p className="text-xs font-mono text-muted mt-0.5">
                  Scan your hardware once to reveal automatic compatibility tiers and estimated speeds on every model card.
                </p>
              </div>
            </div>
            <Link
              to="/check"
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-btn text-xs font-mono font-bold transition flex items-center gap-1.5 flex-shrink-0 shadow-soft"
            >
              <span>Scan My PC</span>
            </Link>
          </div>
        )}

        {/* ACTIVE FILTER CHIPS */}
        {activeFilters.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-muted mr-1">Active filters:</span>
            {activeFilters.map(chip => (
              <span
                key={chip.type}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-surface border border-line text-xs font-mono text-text shadow-soft"
              >
                <span>{chip.label}</span>
                <button
                  type="button"
                  onClick={chip.onClear}
                  className="text-muted hover:text-danger cursor-pointer transition ml-0.5"
                  title="Remove filter"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs font-mono text-primary hover:underline ml-2 cursor-pointer font-semibold"
            >
              Clear all
            </button>
          </div>
        )}

        {/* MAIN LAYOUT: Sidebar (Desktop) + Grid / List Content */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* DESKTOP STICKY FILTER SIDEBAR */}
          <aside className="hidden md:block md:col-span-4 lg:col-span-3 bg-surface border border-line rounded-card p-5 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto shadow-soft">
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-line">
              <div className="flex items-center gap-2 font-bold text-text text-sm">
                <SlidersHorizontal size={16} className="text-primary" />
                <span>Filters</span>
              </div>
              {activeFilters.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] font-mono text-muted hover:text-primary transition flex items-center gap-1 cursor-pointer"
                  title="Reset all filters"
                >
                  <RotateCcw size={11} />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <FilterControls />
          </aside>

          {/* CATALOG CONTENT AREA */}
          <main className="md:col-span-8 lg:col-span-9 min-w-0">
            {loading ? (
              /* SKELETON LOADERS */
              <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className={`shimmer rounded-card border border-line p-5 ${
                      viewMode === 'grid' ? 'h-64 flex flex-col justify-between' : 'h-32'
                    }`}
                  >
                    <div className="h-5 bg-line/60 rounded w-2/3 mb-3"></div>
                    <div className="h-10 bg-line/60 rounded w-full mb-3"></div>
                    <div className="h-4 bg-line/60 rounded w-1/3"></div>
                  </div>
                ))}
              </div>
            ) : displayModels.length > 0 ? (
              /* MODEL LISTING WITH IN-FEED AD */
              <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-3.5"}>
                {displayModels.map((model, index) => {
                  const showAdAfterNine = viewMode === 'grid' && index === 8 && displayModels.length > 9

                  return (
                    <React.Fragment key={model.id}>
                      <ModelCard model={model} index={index % 9} view={viewMode} />
                      {showAdAfterNine && (
                        <div className="col-span-full my-4">
                          <AdSlot slot="models-catalog-infeed" format="inline" />
                        </div>
                      )}
                    </React.Fragment>
                  )
                })}
              </div>
            ) : (
              /* EMPTY STATE */
              <div className="bg-surface border border-line p-14 text-center rounded-card flex flex-col items-center justify-center space-y-4 shadow-soft">
                <div className="w-14 h-14 rounded-full bg-surface-2 border border-line flex items-center justify-center text-muted">
                  <Filter size={24} />
                </div>
                <h3 className="text-lg font-bold text-text">No models match your selected filters</h3>
                <p className="text-xs font-mono text-muted max-w-sm leading-relaxed">
                  Try clearing your search query, increasing your VRAM threshold, or widening the parameter range.
                </p>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-btn text-xs font-mono font-bold transition shadow-soft cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw size={13} />
                  <span>Reset All Filters</span>
                </button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* MOBILE BOTTOM-SHEET FILTER DRAWER */}
      <AnimatePresence>
        {mobileDrawerOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Bottom Sheet Drawer */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="relative z-10 bg-surface border-t border-line rounded-t-card max-h-[85vh] flex flex-col shadow-card"
            >
              <div className="p-4 border-b border-line flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-text">
                  <SlidersHorizontal size={16} className="text-primary" />
                  <span>Filters</span>
                  {activeFilters.length > 0 && (
                    <span className="px-2 py-0.5 rounded-pill bg-primary-soft text-primary text-xs font-mono">
                      {activeFilters.length} active
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="text-muted hover:text-text p-1 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1">
                <FilterControls
                  inDrawer={true}
                  onApply={() => setMobileDrawerOpen(false)}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
