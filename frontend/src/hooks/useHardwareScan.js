// Custom hook that polls the backend for hardware scan results
// Polls every 2 seconds until scan data arrives or timeout (60s)

import { useState, useEffect } from 'react'
import { getHardwareScan } from '../api/client'
import useHardwareStore from '../store/hardwareStore'

export function useHardwareScan() {
  const { token, hardware, setHardware } = useHardwareStore()
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!token || hardware) return

    setPolling(true)
    let attempts = 0
    const MAX_ATTEMPTS = 30

    const interval = setInterval(async () => {
      attempts++
      try {
        const res = await getHardwareScan(token)
        // 202 means pending ("still waiting") - never store a pending response as hardware
        if (res.status === 200 && res.data && res.data.status !== 'pending') {
          setHardware(res.data)
          setPolling(false)
          clearInterval(interval)
        }
      } catch (err) {
        if (err.response?.status === 404 || err.response?.status === 410) {
          setPolling(false)
          clearInterval(interval)
          setError('Scan expired or not found')
        }
      }

      if (attempts >= MAX_ATTEMPTS) {
        setPolling(false)
        clearInterval(interval)
        setError('Scan timed out')
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [token, hardware, setHardware])

  return { polling, error }
}
