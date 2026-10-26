// Axios instance with base URL pointing to FastAPI backend
// Base URL: http://localhost:8000

import axios from 'axios'

const API = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 10000,
})

// All API functions the frontend needs:

// Models
export const getModels = (params) =>
  API.get('/api/models', { params })
// params can include: search, family, task, max_vram, min_params, max_params

export const getModelById = (id) =>
  API.get(`/api/models/${id}`)

export const getModelByTag = (tag) =>
  API.get(`/api/models/tag/${tag}`)

export const getModelQuants = (id) =>
  API.get(`/api/models/${id}/quants`)

// Hardware
export const getGpus = () =>
  API.get('/api/gpus')

export const submitHardwareScan = (data) =>
  API.post('/api/hardware-scan', data)

export const getHardwareScan = (token) =>
  API.get(`/api/hardware-scan/${token}`)

export const getVerdict = (modelId, token, quant) =>
  API.get(`/api/verdict/${modelId}`, { params: { token, quant } })

// Recommend
export const getRecommendations = (token, task, limit) =>
  API.get('/api/recommend', { params: { token, task, limit } })

// Leaderboard
export const getLeaderboard = (metric, limit) =>
  API.get('/api/leaderboard', { params: { metric, limit } })

export default API
