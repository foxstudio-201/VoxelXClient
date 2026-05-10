import { useState, useEffect, useCallback, useRef } from 'react'

const isElectron = typeof window !== 'undefined' && window.electronAPI

// ─── Search hook ──────────────────────────────────────────────────────────────
export function useModrinthSearch(filters) {
  const [results, setResults]   = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [page, setPage]         = useState(0)
  const abortRef                = useRef(false)
  const LIMIT = 20

  const search = useCallback(async (resetPage = true) => {
    if (!isElectron) return
    abortRef.current = false
    setLoading(true)
    setError(null)
    const offset = resetPage ? 0 : page * LIMIT
    if (resetPage) setPage(0)

    try {
      const data = await window.electronAPI.modrinthSearch({
        ...filters,
        limit: LIMIT,
        offset,
      })
      if (abortRef.current) return
      if (data?.error) { setError(data.error); return }
      if (resetPage) {
        setResults(data.hits || [])
      } else {
        setResults(prev => [...prev, ...(data.hits || [])])
      }
      setTotal(data.total_hits || 0)
    } catch (err) {
      if (!abortRef.current) setError(err.message)
    } finally {
      if (!abortRef.current) setLoading(false)
    }
  }, [filters, page])

  // Re-search when filters change
  useEffect(() => {
    search(true)
    return () => { abortRef.current = true }
  }, [
    filters.query,
    filters.projectType,
    filters.sortBy,
    JSON.stringify(filters.gameVersions),
    JSON.stringify(filters.loaders),
    JSON.stringify(filters.categories),
  ])

  const loadMore = useCallback(() => {
    setPage(p => p + 1)
    search(false)
  }, [search])

  const hasMore = results.length < total

  return { results, total, loading, error, loadMore, hasMore, refresh: () => search(true) }
}

// ─── Project detail hook ──────────────────────────────────────────────────────
export function useModrinthProject(idOrSlug) {
  const [project, setProject]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  useEffect(() => {
    if (!idOrSlug || !isElectron) return
    setLoading(true)
    setError(null)
    window.electronAPI.modrinthGetProject(idOrSlug)
      .then(data => {
        if (data?.error) setError(data.error)
        else setProject(data)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [idOrSlug])

  return { project, loading, error }
}

// ─── Versions hook ────────────────────────────────────────────────────────────
export function useModrinthVersions(idOrSlug, filters = {}) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  useEffect(() => {
    if (!idOrSlug || !isElectron) return
    setLoading(true)
    setError(null)
    window.electronAPI.modrinthGetVersions(idOrSlug, filters)
      .then(data => {
        if (data?.error) setError(data.error)
        else setVersions(Array.isArray(data) ? data : [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [idOrSlug, JSON.stringify(filters)])

  return { versions, loading, error }
}

// ─── Install hook ─────────────────────────────────────────────────────────────
export function useModrinthInstall() {
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress]     = useState(null)
  const [error, setError]           = useState(null)
  const [done, setDone]             = useState(false)

  useEffect(() => {
    if (!isElectron) return
    const unsub = window.electronAPI.onModrinthInstallProgress(p => setProgress(p))
    return unsub
  }, [])

  const install = useCallback(async (opts) => {
    if (!isElectron) return
    setInstalling(true)
    setError(null)
    setDone(false)
    setProgress(null)
    try {
      const result = await window.electronAPI.modrinthInstall(opts)
      if (result?.error) setError(result.error)
      else setDone(true)
      return result
    } catch (err) {
      setError(err.message)
    } finally {
      setInstalling(false)
    }
  }, [])

  const reset = useCallback(() => {
    setInstalling(false)
    setProgress(null)
    setError(null)
    setDone(false)
  }, [])

  return { install, installing, progress, error, done, reset }
}
