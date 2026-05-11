import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

const isElectron = typeof window !== 'undefined' && window.electronAPI

// ─── Search hook ──────────────────────────────────────────────────────────────
export function useTechnicSearch(filters) {
  const [results, setResults] = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const offsetRef    = useRef(0)
  const loadingRef   = useRef(false)
  const cancelledRef = useRef(false)
  const filtersRef   = useRef(filters)
  const allHitsRef   = useRef(null)  // cache full result set from API
  filtersRef.current = filters

  // ── Core fetch ──────────────────────────────────────────────────────────────
  const fetchPage = useCallback(async (offset, append) => {
    if (!isElectron) return
    if (loadingRef.current) return

    loadingRef.current = true
    cancelledRef.current = false
    setLoading(true)
    setError(null)

    try {
      const data = await window.electronAPI.technicSearch({
        ...filtersRef.current,
        offset,
        // Pass cached allHits so backend skips re-fetching from API on page 2+
        allHits: allHitsRef.current,
      })

      if (cancelledRef.current) return
      if (data?.error) { setError(data.error); return }

      // Cache the full result set returned on first fetch
      if (data.allHits) allHitsRef.current = data.allHits

      const hits = data.hits || []
      if (append) {
        setResults(prev => {
          const existing = new Set(prev.map(r => r.project_id))
          return [...prev, ...hits.filter(h => !existing.has(h.project_id))]
        })
      } else {
        setResults(hits)
      }
      setTotal(data.total_hits || 0)
      offsetRef.current = offset + hits.length
    } catch (err) {
      if (!cancelledRef.current) setError(err.message)
    } finally {
      loadingRef.current = false
      if (!cancelledRef.current) setLoading(false)
    }
  }, [])

  // Stable serialized keys — chỉ thay đổi khi nội dung array thực sự thay đổi
  const gameVersionsKey = useMemo(() => JSON.stringify(filters.gameVersions), [filters.gameVersions])
  const loadersKey      = useMemo(() => JSON.stringify(filters.loaders),      [filters.loaders])
  const categoriesKey   = useMemo(() => JSON.stringify(filters.categories),   [filters.categories])

  // ── Reset & search when filters change ──────────────────────────────────────
  useEffect(() => {
    cancelledRef.current = true
    loadingRef.current = false
    offsetRef.current = 0
    allHitsRef.current = null  // clear cache on new search
    setResults([])
    setTotal(0)
    setError(null)
    setLoading(false)

    const t = setTimeout(() => {
      cancelledRef.current = false
      fetchPage(0, false)
    }, 10)

    return () => {
      clearTimeout(t)
      cancelledRef.current = true
      loadingRef.current = false
    }
  }, [
    filters.query,
    filters.projectType,
    filters.sortBy,
    gameVersionsKey,
    loadersKey,
    categoriesKey,
  ])

  // ── Load more — slice next page from cached allHits ───────────────────────
  const loadMore = useCallback(() => {
    fetchPage(offsetRef.current, true)
  }, [fetchPage])

  const hasMore = results.length < total

  return { results, total, loading, error, loadMore, hasMore }
}

// ─── Project detail hook ──────────────────────────────────────────────────────
export function useTechnicProject(idOrSlug) {
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!idOrSlug || !isElectron) return
    setLoading(true)
    setError(null)
    window.electronAPI.technicGetProject(idOrSlug)
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
export function useTechnicVersions(idOrSlug, filters = {}) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  // Stable key để tránh re-run effect mỗi render
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters])

  useEffect(() => {
    if (!idOrSlug || !isElectron) return
    setLoading(true)
    setError(null)
    window.electronAPI.technicGetVersions(idOrSlug, filters)
      .then(data => {
        if (data?.error) setError(data.error)
        else setVersions(Array.isArray(data) ? data : [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [idOrSlug, filtersKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return { versions, loading, error }
}

// ─── Install hook ─────────────────────────────────────────────────────────────
export function useTechnicInstall() {
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress]     = useState(null)
  const [error, setError]           = useState(null)
  const [done, setDone]             = useState(false)

  useEffect(() => {
    if (!isElectron) return
    const unsub = window.electronAPI.onTechnicInstallProgress(p => setProgress(p))
    return unsub
  }, [])

  const install = useCallback(async (opts) => {
    if (!isElectron) return
    setInstalling(true)
    setError(null)
    setDone(false)
    setProgress(null)
    try {
      const result = await window.electronAPI.technicInstall(opts)
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
