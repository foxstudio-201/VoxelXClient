import { useState, useEffect, useRef, useCallback } from 'react'

const isElectron = typeof window !== 'undefined' && window.electronAPI

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDownloads(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}
function fmtBytes(b) {
  if (!b) return ''
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024).toFixed(0)} KB`
}

// ─── Version modal ────────────────────────────────────────────────────────────
function VersionModal({ project, server, projectType, onClose }) {
  const [versions, setVersions]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null)
  const [installing, setInstalling] = useState(false)
  const [done, setDone]           = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    if (!isElectron) return
    setLoading(true)
    // Filter versions by game version of server
    const filters = { game_versions: [server.gameVersion] }
    window.electronAPI.modrinthGetVersions(project.project_id || project.id, filters)
      .then(r => {
        const list = Array.isArray(r) ? r : (r?.data || [])
        setVersions(list)
        if (list.length > 0) setSelected(list[0])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [project.project_id || project.id, server.gameVersion])

  async function handleInstall() {
    if (!selected || !isElectron) return
    const file = selected.files?.[0]
    if (!file?.url) { setError('Không tìm thấy file tải xuống'); return }

    setInstalling(true)
    setError('')
    try {
      // Download file and save to server's plugins/ or mods/ folder
      const subDir = projectType === 'plugin' ? 'plugins' : 'mods'
      const r = await window.electronAPI.serverInstallMod({
        serverId:  server.id,
        url:       file.url,
        fileName:  file.filename,
        subDir,
      })
      if (r?.error) { setError(r.error); return }
      setDone(true)
      setTimeout(onClose, 1200)
    } catch (e) {
      setError(e.message || 'Lỗi không xác định')
    } finally {
      setInstalling(false)
    }
  }

  const loaderLabel = projectType === 'plugin' ? 'Plugin' : 'Mod'

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'rgba(12,12,12,0.99)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 32px 80px rgba(0,0,0,0.8)', maxHeight: '80vh' }}>

        {/* Header */}
        <div className="flex items-start gap-3 p-4 border-b border-white/5">
          {project.icon_url
            ? <img src={project.icon_url} alt={project.title} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-white/5" />
            : <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white/20">
                  <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/>
                </svg>
              </div>
          }
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-sm truncate">{project.title}</h3>
            <p className="text-white/40 text-xs mt-0.5 line-clamp-2">{project.description}</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Version list */}
        <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-3">
            Chọn phiên bản — {server.gameVersion}
          </p>
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-white/30">
              <svg className="animate-spin w-4 h-4 text-green-400/50" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <span className="text-xs">Đang tải phiên bản...</span>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white/30 text-sm">Không có phiên bản nào cho {server.gameVersion}</p>
              <p className="text-white/20 text-xs mt-1">Thử tìm phiên bản khác trên Modrinth</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {versions.map(v => {
                const file = v.files?.[0]
                const isSelected = selected?.id === v.id
                return (
                  <button key={v.id} onClick={() => setSelected(v)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-green-500/12 border border-green-500/25'
                        : 'bg-white/3 border border-white/6 hover:bg-white/6 hover:border-white/12'
                    }`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      isSelected ? 'border-green-400 bg-green-400' : 'border-white/20'
                    }`}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold ${isSelected ? 'text-green-400' : 'text-white/80'}`}>
                          {v.name || v.version_number}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                          v.version_type === 'release' ? 'bg-green-500/15 text-green-400' :
                          v.version_type === 'beta'    ? 'bg-yellow-500/15 text-yellow-400' :
                                                         'bg-white/8 text-white/30'
                        }`}>{v.version_type}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-white/30">{v.game_versions?.join(', ')}</span>
                        {file && <span className="text-[10px] text-white/20">{fmtBytes(file.size)}</span>}
                      </div>
                    </div>
                    {isSelected && (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-green-400 flex-shrink-0">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 flex flex-col gap-2">
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/50 hover:text-white border border-white/8 hover:bg-white/5 transition-all">
              Huỷ
            </button>
            <button onClick={handleInstall} disabled={!selected || installing || done || versions.length === 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: done ? 'rgba(34,197,94,0.3)' : 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 4px 16px rgba(34,197,94,0.2)' }}>
              {done ? (
                <><svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>Đã cài!</>
              ) : installing ? (
                <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>Đang tải...</>
              ) : (
                <><svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>Tải {loaderLabel}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Project card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, onClick }) {
  return (
    <div onClick={() => onClick(project)}
      className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all group"
      style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(74,222,128,0.25)'; e.currentTarget.style.background = 'rgba(74,222,128,0.04)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}>

      {/* Icon */}
      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-white/5 border border-white/8">
        {project.icon_url
          ? <img src={project.icon_url} alt={project.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white/15">
                <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/>
              </svg>
            </div>
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-white/90 truncate group-hover:text-white transition-colors">{project.title}</p>
          <div className="flex items-center gap-1 flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white/25">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            <span className="text-[10px] text-white/30 font-mono">{fmtDownloads(project.downloads)}</span>
          </div>
        </div>
        <p className="text-[11px] text-white/40 mt-0.5 line-clamp-2 leading-relaxed">{project.description}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {project.categories?.slice(0, 3).map(c => (
            <span key={c} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/6 text-white/30 font-medium">{c}</span>
          ))}
          {project.follows > 0 && (
            <span className="text-[9px] text-white/20 flex items-center gap-0.5 ml-auto">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              {fmtDownloads(project.follows)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main tab component ───────────────────────────────────────────────────────
export default function ServerPluginModTab({ server, projectType }) {
  // projectType: 'plugin' | 'mod'
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [page, setPage]           = useState(0)
  const [hasMore, setHasMore]     = useState(true)
  const [selected, setSelected]   = useState(null)
  const searchRef                 = useRef(null)
  const debounceRef               = useRef(null)

  const LIMIT = 20

  const doSearch = useCallback(async (q, p = 0) => {
    if (!isElectron) return
    setLoading(true)
    try {
      // Modrinth: plugin = project_type:plugin, mod = project_type:mod
      // For plugins, also filter by server-side loaders (bukkit, spigot, paper, purpur, etc.)
      const facets = projectType === 'plugin'
        ? [['project_type:plugin'], [`versions:${server.gameVersion}`]]
        : [['project_type:mod'],    [`versions:${server.gameVersion}`]]

      const r = await window.electronAPI.modrinthSearch({
        query:  q || '',
        facets: JSON.stringify(facets),
        limit:  LIMIT,
        offset: p * LIMIT,
        index:  'downloads',
      })
      const hits = r?.hits || []
      if (p === 0) {
        setResults(hits)
      } else {
        setResults(prev => [...prev, ...hits])
      }
      setHasMore(hits.length === LIMIT)
    } catch {}
    finally { setLoading(false) }
  }, [server.gameVersion, projectType])

  // Initial load
  useEffect(() => {
    setPage(0)
    setResults([])
    doSearch('', 0)
  }, [projectType, server.gameVersion])

  // Debounced search on query change
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(0)
      doSearch(query, 0)
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  function loadMore() {
    const next = page + 1
    setPage(next)
    doSearch(query, next)
  }

  const label = projectType === 'plugin' ? 'Plugin' : 'Mod'
  const placeholder = projectType === 'plugin'
    ? 'Tìm plugin (EssentialsX, WorldEdit...)'
    : 'Tìm mod (JEI, Optifine...)'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search bar */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-white/5 bg-black/10">
        <div className="relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none">
            <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-white/5 border border-white/8 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white/80 placeholder-white/25 focus:outline-none focus:border-green-500/40 transition-all"
          />
          {query && (
            <button onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          )}
        </div>
        <p className="text-[10px] text-white/25 mt-1.5">
          {label} cho <span className="text-green-400/70">{server.gameVersion}</span> · Nguồn: Modrinth
        </p>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5"
        style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {results.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-8 h-8 text-white/10">
              <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
            </svg>
            <p className="text-white/25 text-xs">
              {query ? `Không tìm thấy "${query}"` : `Không có ${label.toLowerCase()} nào`}
            </p>
          </div>
        )}

        {results.map(p => (
          <ProjectCard key={p.project_id || p.id} project={p} onClick={setSelected} />
        ))}

        {/* Load more */}
        {hasMore && results.length > 0 && (
          <button onClick={loadMore} disabled={loading}
            className="w-full py-2.5 rounded-xl text-xs text-white/40 hover:text-white/70 border border-white/6 hover:border-white/12 bg-white/2 hover:bg-white/5 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            {loading
              ? <><svg className="animate-spin w-3.5 h-3.5 text-green-400/50" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>Đang tải...</>
              : 'Tải thêm'
            }
          </button>
        )}

        {loading && results.length === 0 && (
          <div className="flex items-center justify-center py-10 gap-2 text-white/30">
            <svg className="animate-spin w-4 h-4 text-green-400/50" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="text-xs">Đang tải {label.toLowerCase()}...</span>
          </div>
        )}
      </div>

      {/* Version modal */}
      {selected && (
        <VersionModal
          project={selected}
          server={server}
          projectType={projectType}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
