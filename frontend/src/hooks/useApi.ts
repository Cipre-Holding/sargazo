import { useState, useEffect, useCallback, useRef } from "react"

const API_BASE = "/api"

interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useApi<T>(endpoint: string | null) {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: !!endpoint, error: null })
  const abortRef = useRef<AbortController | null>(null)

  const refetch = useCallback(async () => {
    abortRef.current?.abort()
    if (!endpoint) {
      setState({ data: null, loading: false, error: null })
      return
    }
    const ac = new AbortController()
    abortRef.current = ac
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, { signal: ac.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!ac.signal.aborted) setState({ data, loading: false, error: null })
    } catch (e) {
      if ((e as Error).name === "AbortError") return
      setState((s) => ({ ...s, data: s.data, loading: false, error: (e as Error).message }))
    }
  }, [endpoint])

  useEffect(() => {
    refetch()
    return () => abortRef.current?.abort()
  }, [refetch])

  return { ...state, refetch }
}
