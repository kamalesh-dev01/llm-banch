// Axios instance with base URL pointing to FastAPI backend
// Default dev: http://localhost:8000, production configured via VITE_API_URL

import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
export const SITE_URL = import.meta.env.VITE_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

// All API functions the frontend needs:

// Models
export const getModels = (params) =>
  API.get('/api/models', { params })
// params can include: search, family, task, max_vram, min_params, max_params

export const getModelById = (id) =>
  API.get(`/api/models/${id}`)

export const getModel = (ref) =>
  API.get(`/api/models/${ref}`)

export const getModelBenchmarks = (ref) =>
  API.get(`/api/models/${ref}/benchmarks`)

export const getModelRequirements = (ref, quant, token) =>
  API.get(`/api/models/${ref}/requirements`, { params: { quant, token } })

export const getSimilarModels = (ref, limit = 4) =>
  API.get(`/api/models/${ref}/similar`, { params: { limit } })

export const getModelByTag = (tag) =>
  API.get(`/api/models/tag/${tag}`)

export const getModelQuants = (id) =>
  API.get(`/api/models/${id}/quants`)

export const getDbStats = () =>
  API.get('/api/stats')

export const getFamilies = () =>
  API.get('/api/families')

export const getFilters = () =>
  API.get('/api/filters')

// Hardware & Scanner
export const getScannerInfo = () =>
  API.get('/api/scanner/info')

export const createScanSession = () =>
  API.post('/api/scan-sessions')

export const getGpus = () =>
  API.get('/api/gpus')

export const submitHardwareScan = (data) =>
  API.post('/api/hardware-scan', data)

export const getHardwareScan = (token) =>
  API.get(`/api/hardware-scan/${token}`)

export const getScanResults = (token) =>
  API.get(`/api/results/${token}`)

export const getModelScanResult = (token, modelId) =>
  API.get(`/api/results/${token}/model/${modelId}`)

export const updateSessionVram = (token, vram_gb) =>
  API.patch(`/api/results/${token}/vram`, { vram_gb })

export const getVerdict = (modelId, token, quant) =>
  API.get(`/api/verdict/${modelId}`, { params: { token, quant } })

// Recommend
export const getRecommendations = (token, task, limit) =>
  API.get('/api/recommend', { params: { token, task, limit } })

// Leaderboard
export const getLeaderboard = (metric, limit) =>
  API.get('/api/leaderboard', { params: { metric, limit } })

// ML Predictor
export const getMlInfo = () =>
  API.get('/api/ml/info')

export const getPrediction = (modelId, token, quant) =>
  API.get('/api/predict', { params: { model_id: modelId, token, quant } })

export default API
