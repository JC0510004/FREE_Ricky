import { useState, useEffect, useCallback } from 'react'
import API from '../api/axios'

export default function useFetch(url, { enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const active = enabled && !!url
  const isLoading = active ? loading : false

  useEffect(() => {
    if (!enabled || !url) {
      return
    }

    const controller = new AbortController()
    let cancelled = false

    const doFetch = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await API.get(url, { signal: controller.signal })
        if (!cancelled) setData(response.data)
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') setError(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    doFetch()
    return () => { cancelled = true; controller.abort() }
  }, [url, enabled])

  const refetch = useCallback(() => {
    const controller = new AbortController()
    API.get(url, { signal: controller.signal })
      .then(r => setData(r.data))
      .catch(() => {})
  }, [url])

  return { data, loading: isLoading, error, refetch }
}
