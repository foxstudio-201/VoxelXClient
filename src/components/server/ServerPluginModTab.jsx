import { useState, useEffect, useRef, useCallback } from 'react'
import modrinthIcon from '../../assets/server-icon/modrinth.png'
import spigotIcon   from '../../assets/server-icon/spigot.png'

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
function VersionModal({ project, server, projectType, source, onClose }) {
  const [versions, setVersions]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null)
  const [installing, setInstalling] = useState(false)
  const [done, setDone]           = useState(false)
  const [error, setError]         = useState('')

  const isSpigot = source === 'spigot'
  const title    = project.title || project.name || 'Unknown'
  const iconUrl  = project.icon_url || project.icon || null
  const desc     = project.description || project.tag || ''

  useEffect(() => {
    if (isSpigot) {
      // Spigot: show link to resource page, no direct download API
      setLoading(false)
      return
    }
    if (!isElectron) return
    setLoading(true)
    const filters = { game_versions: [server.gameVersion] }
    window.electronAPI.modrinthGetVersions(project.project_id || project.id, filters)
      .then(r => {
        const list = Array.isArray(r) ? r : (r?.data || [])
        setVersions(list)
        if (list.length > 0) setSelected(list[0])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [project.project_id || project.id, server.gameVersion, isSpigot])

  async function handleInstall() {
    if (!selected || !isElectron) return
    const file = selected.files?.[0]
    if (!file?.url) { setError('Không tìm thấy file tải xuống'); return }

    setInstalling(true)
    setError('')
    try {
      const subDir = projectType === 'plugin' ? 'plugins' : 'mods'
      const r = await window.electronAPI.serverInstallMod({
        serverId: server.id,
        url:      file.url,
        fileName: file.filename,
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
        <div className="flex items-start gap-3 p-5 border-b border-white/5">
          {iconUrl
            ? <img src={iconUrl} alt={title} className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-white/5" />
            : <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white/20">
                  <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/>
                </svg>
              </div>
          }
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-base truncate">{title}</h3>
            <p className="text-white/40 text-sm mt-0.5 line-clamp-2">{desc}</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5" style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          {isSpigot ? (
            /* Spigot: no direct download API, redirect to website */
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <img src={spigotIcon} alt="Spigot" className="w-12 h-12 rounded-xl object-contain opacity-60" />
              <div>
                <p className="text-white/70 text-sm font-semibold mb-1">Tải từ SpigotMC</p>
                <p className="text-white/35 text-xs leading-relaxed">
                  SpigotMC không hỗ trợ tải trực tiếp qua API.<br/>
                  Nhấn nút bên dưới để mở trang plugin trên SpigotMC và tải thủ công vào thư mục <span className="text-green-400/70 font-mono">plugins/</span> của server.
                </p>
              </div>
              <div className="w-full rounded-xl p-3 text-left"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-xs text-white/40 mb-1">Thư mục đích</p>
                <p className="text-xs text-green-400/70 font-mono">[server]/plugins/{title}.jar</p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-white/50 font-semibold mb-3">
                Chọn phiên bản — <span className="text-green-400">{server.gameVersion}</span>
              </p>
              {loading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-white/30">
                  <svg className="animate-spin w-4 h-4 text-green-400/50" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <span className="text-sm">Đang tải phiên bản...</span>
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-white/35 text-sm">Không có phiên bản nào cho {server.gameVersion}</p>
                  <p className="text-white/20 text-xs mt-1">Thử tìm phiên bản khác trên Modrinth</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {versions.map(v => {
                    const file = v.files?.[0]
                    const isSelected = selected?.id === v.id
                    return (
                      <button key={v.id} onClick={() => setSelected(v)}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${
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
                            <span className={`text-sm font-semibold ${isSelected ? 'text-green-400' : 'text-white/80'}`}>
                              {v.name || v.version_number}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                              v.version_type === 'release' ? 'bg-green-500/15 text-green-400' :
                              v.version_type === 'beta'    ? 'bg-yellow-500/15 text-yellow-400' :
                                                             'bg-white/8 text-white/30'
                            }`}>{v.version_type}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-white/30">{v.game_versions?.join(', ')}</span>
                            {file && <span className="text-xs text-white/20">{fmtBytes(file.size)}</span>}
                          </div>
                        </div>
                        {isSelected && (
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-green-400 flex-shrink-0">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/5 flex flex-col gap-2">
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/50 hover:text-white border border-white/8 hover:bg-white/5 transition-all">
              {isSpigot ? 'Đóng' : 'Huỷ'}
            </button>
            {isSpigot ? (
              <button
                onClick={() => {
                  const id = project.id || project.resource_id
                  const url = `https://www.spigotmc.org/resources/${id}/`
                  if (isElectron) window.electronAPI.openExternal(url)
                  else window.open(url, '_blank')
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', boxShadow: '0 4px 16px rgba(249,115,22,0.2)' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                </svg>
                Mở SpigotMC
              </button>
            ) : (
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
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Project card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, source, onClick }) {
  // Normalize Spigot vs Modrinth fields
  const title    = project.title || project.name || 'Unknown'
  const desc     = project.description || project.tag || ''
  const iconUrl  = project.icon_url || project.icon || null
  const downloads = project.downloads || project.external?.downloads || 0
  const follows  = project.follows || 0
  const categories = project.categories || []

  return (
    <div onClick={() => onClick(project)}
      className="flex items-start gap-3 p-3.5 rounded-xl cursor-pointer transition-all group"
      style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(74,222,128,0.25)'; e.currentTarget.style.background = 'rgba(74,222,128,0.04)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}>

      {/* Icon */}
      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-white/5 border border-white/8">
        {iconUrl
          ? <img src={iconUrl} alt={title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white/15">
                <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/>
              </svg>
            </div>
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-white/90 truncate group-hover:text-white transition-colors">{title}</p>
          <div className="flex items-center gap-1 flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white/25">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            <span className="text-xs text-white/35 font-mono">{fmtDownloads(downloads)}</span>
          </div>
        </div>
        <p className="text-xs text-white/45 mt-0.5 line-clamp-2 leading-relaxed">{desc}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {categories.slice(0, 3).map(c => (
            <span key={c} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/6 text-white/35 font-medium">{c}</span>
          ))}
          {follows > 0 && (
            <span className="text-[10px] text-white/20 flex items-center gap-0.5 ml-auto">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              {fmtDownloads(follows)}
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
  // For plugins: sub-source = 'modrinth' | 'spigot'
  const [source, setSource]       = useState('modrinth')
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [page, setPage]           = useState(0)
  const [hasMore, setHasMore]     = useState(true)
  const [selected, setSelected]   = useState(null)
  const searchRef                 = useRef(null)
  const debounceRef               = useRef(null)

  const LIMIT = 20

  const doSearch = useCallback(async (q, p = 0, src = source) => {
    if (!isElectron) return
    setLoading(true)
    try {
      if (projectType === 'plugin' && src === 'spigot') {
        // Spigot: use spiget API
        const offset = p * LIMIT
        const r = await window.electronAPI.spigotSearch({
          query:  q || '',
          size:   LIMIT,
          page:   p + 1,
        })
        const hits = r?.results || r?.data || []
        if (p === 0) setResults(hits)
        else setResults(prev => [...prev, ...hits])
        setHasMore(hits.length === LIMIT)
        return
      }

      // Modrinth search
      // Plugin: project_type:plugin + server-side categories (bukkit/spigot/paper/purpur/folia/sponge/bungeecord/waterfall/velocity)
      // Mod: project_type:mod
      let facets
      if (projectType === 'plugin') {
        facets = [
          ['project_type:plugin'],
          [`versions:${server.gameVersion}`],
        ]
      } else {
        facets = [
          ['project_type:mod'],
          [`versions:${server.gameVersion}`],
        ]
      }

      const r = await window.electronAPI.modrinthSearch({
        query:  q || '',
        facets: JSON.stringify(facets),
        limit:  LIMIT,
        offset: p * LIMIT,
        index:  'downloads',
      })
      const hits = r?.hits || []
      if (p === 0) setResults(hits)
      else setResults(prev => [...prev, ...hits])
      setHasMore(hits.length === LIMIT)
    } catch {}
    finally { setLoading(false) }
  }, [server.gameVersion, projectType, source])

  // Reset + reload when source or projectType changes
  useEffect(() => {
    setPage(0)
    setResults([])
    setQuery('')
    doSearch('', 0, source)
  }, [projectType, server.gameVersion, source])

  // Debounced search on query change
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(0)
      doSearch(query, 0, source)
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  function loadMore() {
    const next = page + 1
    setPage(next)
    doSearch(query, next, source)
  }

  const isPlugin = projectType === 'plugin'
  const label = isPlugin ? 'Plugin' : 'Mod'
  const placeholder = source === 'spigot'
    ? 'Tìm plugin trên Spigot (EssentialsX, WorldEdit...)'
    : isPlugin
      ? 'Tìm plugin trên Modrinth (EssentialsX, LuckPerms...)'
      : 'Tìm mod trên Modrinth (JEI, Sodium, Iris...)'

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Sub-tabs — only for plugins */}
      {isPlugin && (
        <div className="flex-shrink-0 flex items-center gap-2 px-3 pt-2.5 pb-0 border-b border-white/5">
          {[
            { id: 'modrinth', label: 'Modrinth', icon: modrinthIcon },
            { id: 'spigot',   label: 'Spigot',   icon: spigotIcon   },
          ].map(s => (
            <button key={s.id} onClick={() => setSource(s.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-t-lg text-sm font-semibold transition-all border-b-2 ${
                source === s.id
                  ? 'text-white border-green-400 bg-white/5'
                  : 'text-white/40 border-transparent hover:text-white/70 hover:bg-white/3'
              }`}>
              <img src={s.icon} alt={s.label} className="w-4 h-4 rounded object-contain" />
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Search bar */}
      <div className="flex-shrink-0 px-3 py-2.5 border-b border-white/5 bg-black/10">
        <div className="relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none">
            <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-white/5 border border-white/8 rounded-xl pl-9 pr-9 py-2 text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-green-500/40 transition-all"
          />
          {query && (
            <button onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          )}
        </div>
        <p className="text-xs text-white/30 mt-1.5">
          {label} cho <span className="text-green-400/80 font-semibold">{server.gameVersion}</span>
          {' · '}
          <span className="text-white/40">Nguồn: {source === 'spigot' ? 'SpigotMC' : 'Modrinth'}</span>
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
            <p className="text-white/30 text-sm">
              {query ? `Không tìm thấy "${query}"` : `Không có ${label.toLowerCase()} nào`}
            </p>
          </div>
        )}

        {results.map(p => (
          <ProjectCard key={p.project_id || p.id || p.resource_id} project={p} source={source} onClick={setSelected} />
        ))}

        {/* Load more */}
        {hasMore && results.length > 0 && (
          <button onClick={loadMore} disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm text-white/40 hover:text-white/70 border border-white/6 hover:border-white/12 bg-white/2 hover:bg-white/5 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
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
            <span className="text-sm">Đang tải {label.toLowerCase()}...</span>
          </div>
        )}
      </div>

      {/* Version modal */}
      {selected && (
        <VersionModal
          project={selected}
          server={server}
          projectType={projectType}
          source={source}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
