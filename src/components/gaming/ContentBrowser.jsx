import { useState, useEffect, useRef } from 'react'
import { renderMarkdown } from '../../utils/renderMarkdown'

const isElectron = typeof window !== 'undefined' && window.electronAPI
const LIMIT = 30

export const LOADER_COLORS = {
  fabric: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
  forge: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  neoforge: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
  quilt: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  vanilla: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
}

const VERSION_TYPE_STYLE = {
  release: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  beta: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  alpha: 'bg-red-500/15 text-red-400 border-red-500/25',
}

const DETAIL_SUB_TABS = [
  { id: 'description', label: 'Description' },
  { id: 'versions', label: 'Versions' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'comments', label: 'Comments' },
]

function formatNum(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function ContentBrowser({ profile, contentType, platform, onBack }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState(null)
  const [versions, setVersions] = useState({})
  const offsetRef = useRef(0)
  const [hasMore, setHasMore] = useState(false)
  const searchTimer = useRef(null)
  const [detailTab, setDetailTab] = useState('description')
  const [installing, setInstalling] = useState(false)
  const [installProgress, setInstallProgress] = useState(null)
  const [installError, setInstallError] = useState(null)
  const [installDone, setInstallDone] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(-1)
  const [detailLoading, setDetailLoading] = useState(false)
  const [installed, setInstalled] = useState({})
  const [installedFiles, setInstalledFiles] = useState({})
  const versionsLoadingRef = useRef(new Set())

  const typeLabel = contentType === 'resourcepack' ? 'resourcepack' : contentType

  const selectedItem = selected ? (results.find(r => r.project_id === selected.project_id) || selected) : null
  const selectedVers = selectedItem ? (versions[selectedItem.project_id] || []) : []

  const galleryItems = (selectedItem?.gallery || []).map(g =>
    typeof g === 'string' ? { url: g, title: '' } : g
  )

  const isMod = contentType === 'mod'

  const filteredVersions = isMod
    ? selectedVers.filter(v => {
        const matchLoader = (v.loaders || []).includes(profile.loader)
        const matchGameVer = (v.game_versions || []).includes(profile.gameVersion)
        return matchLoader && matchGameVer
      })
    : selectedVers

  function versionFilters() {
    if (!isMod) return {}
    return {
      gameVersions: [profile.gameVersion],
      loaders: profile.loader !== 'vanilla' ? [profile.loader] : [],
    }
  }

  function slugFromFileName(fileName) {
    return fileName
      .replace(/\.(jar|zip)$/i, '')
      .replace(/\.(off|disabled)$/i, '')
      .replace(/[-_+](v?\d[\d._\-+]*).*$/i, '')
      .replace(/[-_+][rv]\d.*$/i, '')
      .replace(/[-_]/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/ /g, '-')
  }

  function installedInfo(item) {
    const direct = installed[item.project_id]
    if (direct) return direct
    if (!item.slug) return null
    const list = installedFiles[contentType] || []
    const slug = item.slug.toLowerCase()
    for (const f of list) {
      if (slugFromFileName(f) === slug) {
        return { type: contentType, filename: f, versionId: null, slugMatched: true }
      }
    }
    return null
  }

  function latestOf(pid) {
    const vers = versions[pid] || []
    return vers.find(v => v.version_type === 'release') || vers[0] || null
  }

  function hasUpdate(item) {
    const inst = installedInfo(item)
    if (!inst) return false
    const latest = latestOf(item.project_id)
    if (!latest) return false
    let instVersionId = inst.versionId
    if (!instVersionId) {
      const matchedVer = (versions[item.project_id] || []).find(v => (v.files || []).some(f => f.filename === inst.filename))
      instVersionId = matchedVer ? matchedVer.id : null
    }
    if (!instVersionId) return false
    return String(latest.id) !== String(instVersionId)
  }

  async function refreshInstalled() {
    if (!isElectron) return
    try {
      const res = await window.electronAPI.profileGetInstalledContent(profile.id)
      if (res?.ok) {
        setInstalled(res.installed || {})
        setInstalledFiles(res.files || {})
      }
    } catch {}
    try {
      const res = await window.electronAPI.profileMatchInstalledContent(profile.id)
      if (res?.ok) {
        const matched = res.matchedFiles || {}
        const merged = {}
        for (const [baseName, info] of Object.entries(matched)) {
          if (!merged[info.projectId]) {
            merged[info.projectId] = { ...info, filename: baseName }
          }
        }
        setInstalled(prev => ({ ...prev, ...merged }))
      }
    } catch {}
  }

  async function ensureVersions(item) {
    if (!isElectron) return
    const pid = item.project_id
    if (versions[pid] || versionsLoadingRef.current.has(pid)) return
    versionsLoadingRef.current.add(pid)
    try {
      const data = platform === 'curseforge'
        ? await window.electronAPI.curseforgeGetVersions(pid, versionFilters())
        : await window.electronAPI.modrinthGetVersions(pid, versionFilters())
      setVersions(prev => ({ ...prev, [pid]: Array.isArray(data) ? data : [] }))
    } catch {} finally {
      versionsLoadingRef.current.delete(pid)
    }
  }

  useEffect(() => { refreshInstalled() }, [profile.id])

  async function search(pageOffset = 0, append = false) {
    if (!isElectron) return
    setLoading(true)
    try {
      const filters = {
        query: query,
        projectType: typeLabel,
        gameVersions: isMod ? [profile.gameVersion] : [],
        loaders: isMod && profile.loader !== 'vanilla' ? [profile.loader] : [],
        sortBy: 'downloads',
        limit: LIMIT,
        offset: pageOffset,
      }

      let data
      if (platform === 'curseforge') {
        data = await window.electronAPI.curseforgeSearch(filters)
      } else {
        data = await window.electronAPI.modrinthSearch(filters)
      }

      if (data?.error) return

      const hits = data.hits || []
      if (append) {
        const existing = new Set(results.map(r => r.project_id))
        const newHits = hits.filter(h => !existing.has(h.project_id))
        setResults(prev => [...prev, ...newHits])
      } else {
        setResults(hits)
      }
      setTotal(data.total_hits || 0)
      offsetRef.current = pageOffset + hits.length
      setHasMore(offsetRef.current < (data.total_hits || 0))
    } catch {} finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      offsetRef.current = 0
      setResults([])
      setSelected(null)
      search(0, false)
    }, 300)
    return () => clearTimeout(searchTimer.current)
  }, [query, profile.gameVersion, profile.loader, platform, contentType])

  async function loadMore() {
    await search(offsetRef.current, true)
  }

  async function handleSelect(item) {
    setDetailTab('description')
    setDetailLoading(true)
    try {
      let full = null
      if (isElectron) {
        full = platform === 'curseforge'
          ? await window.electronAPI.curseforgeGetProject(item.project_id).catch(() => null)
          : await window.electronAPI.modrinthGetProject(item.project_id).catch(() => null)
      }
      if (full && !full?.error) {
        const merged = { ...item, ...full, project_id: item.project_id }
        setResults(prev => prev.map(r => r.project_id === merged.project_id ? merged : r))
        setSelected(merged)
      } else {
        setSelected(item)
      }
    } catch {
      setSelected(item)
    } finally {
      setDetailLoading(false)
    }
    if (versions[item.project_id]) return
    try {
      let data
      const filters = versionFilters()
      if (platform === 'curseforge') {
        data = await window.electronAPI.curseforgeGetVersions(item.project_id, filters)
      } else {
        data = await window.electronAPI.modrinthGetVersions(item.project_id, filters)
      }
      setVersions(prev => ({ ...prev, [item.project_id]: Array.isArray(data) ? data : [] }))
    } catch {}
  }

  async function handleDownloadLatest(item) {
    if (!isElectron) return
    let vers
    if (versions[item.project_id]) {
      vers = versions[item.project_id]
    } else {
      try {
        const filters = versionFilters()
        if (platform === 'curseforge') {
          vers = await window.electronAPI.curseforgeGetVersions(item.project_id, filters)
        } else {
          vers = await window.electronAPI.modrinthGetVersions(item.project_id, filters)
        }
        vers = Array.isArray(vers) ? vers : []
        setVersions(prev => ({ ...prev, [item.project_id]: vers }))
      } catch { return }
    }

    const latest = vers.find(v => v.version_type === 'release') || vers[0]
    if (!latest) return

    try {
      if (platform === 'curseforge') {
        await window.electronAPI.curseforgeInstall({
          versionId: latest.id,
          projectId: latest.project_id,
          downloadUrl: latest.files?.[0]?.url,
          filename: latest.files?.[0]?.filename,
          fileLength: latest.files?.[0]?.size,
          projectType: contentType,
          instancePath: profile.instancePath,
          deleteOldVersions: true,
        })
      } else {
        await window.electronAPI.modrinthInstall({
          versionId: latest.id,
          projectId: latest.project_id,
          downloadUrl: latest.files?.[0]?.url,
          filename: latest.files?.[0]?.filename,
          fileLength: latest.files?.[0]?.size,
          projectType: contentType,
          instancePath: profile.instancePath,
          deleteOldVersions: true,
        })
      }
      refreshInstalled()
    } catch {}
  }

  async function handleDownload(version) {
    if (!isElectron || !version) return
    setInstalling(true)
    setInstallProgress(null)
    setInstallError(null)
    setInstallDone(false)

    try {
      let result
      if (platform === 'curseforge') {
        result = await window.electronAPI.curseforgeInstall({
          versionId: version.id,
          projectId: version.project_id,
          downloadUrl: version.files?.[0]?.url,
          filename: version.files?.[0]?.filename,
          fileLength: version.files?.[0]?.size,
          projectType: contentType,
          instancePath: profile.instancePath,
          deleteOldVersions: true,
        })
      } else {
        result = await window.electronAPI.modrinthInstall({
          versionId: version.id,
          projectId: version.project_id,
          downloadUrl: version.files?.[0]?.url,
          filename: version.files?.[0]?.filename,
          fileLength: version.files?.[0]?.size,
          projectType: contentType,
          instancePath: profile.instancePath,
          deleteOldVersions: true,
        })
      }
      if (result?.error) {
        setInstallError(result.error)
      } else {
        setInstallDone(true)
        refreshInstalled()
      }
    } catch (err) {
      setInstallError(err.message)
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="flex flex-1 gap-4 min-h-0 overflow-hidden">
      <div className="flex-[1_1_0%] flex flex-col min-h-0 overflow-hidden" style={{ minWidth: 0 }}>
        <div className="flex-shrink-0 mb-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
            </svg>
            <input type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder={`Search ${contentType}s...`}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-orange-500/50 transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-1" style={{ scrollbarColor: 'rgba(255,255,255,0.10) transparent' }}>
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-8 h-8 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white/15"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              </div>
              <p className="text-xs text-white/30">No results found</p>
            </div>
          ) : (
            <>
              {results.map(item => {
                const inst = installedInfo(item)
                const update = hasUpdate(item)
                if (inst && !versions[item.project_id]) ensureVersions(item)
                return (
                <div key={item.project_id}
                  onClick={() => handleSelect(item)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-all hover:bg-white/5 border border-transparent">
                  <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 flex items-center justify-center">
                    {item.icon_url
                      ? <img src={item.icon_url} alt="" className="w-full h-full object-cover" />
                      : <svg className="w-4 h-4 text-white/20" fill="currentColor" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/80 font-medium truncate">{item.title}</p>
                    <p className="text-[9px] text-white/35 truncate">{item.description}</p>
                    <p className="text-[9px] text-white/25 mt-0.5">{formatNum(item.downloads)} downloads</p>
                  </div>
                  {!inst ? (
                    <button onClick={e => { e.stopPropagation(); handleDownloadLatest(item) }}
                      className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white transition-all hover:scale-105"
                      style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}
                      title="Download latest version">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                    </button>
                  ) : update ? (
                    <button onClick={e => { e.stopPropagation(); handleDownloadLatest(item) }}
                      className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white transition-all hover:scale-105 flex items-center gap-1"
                      style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)' }}
                      title="Update to latest version">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M11 5v11.17l-4.88-4.88-1.42 1.41L12 19.71l7.3-7.01-1.42-1.41L13 16.17V5h-2zM5 21h14v-2H5v2z"/></svg>
                      Update
                    </button>
                  ) : (
                    <span className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-green-300 bg-green-500/15 border border-green-500/25 flex items-center gap-1"
                      title="Installed - ready to use">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                      Ready to use
                    </span>
                  )}
                </div>
                )
              })}
              {hasMore && (
                <button onClick={loadMore} disabled={loading}
                  className="w-full py-2 text-[10px] text-white/30 hover:text-white/60 transition-colors font-semibold">
                  {loading ? 'Loading...' : 'Load more'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex-[1_1_0%] flex flex-col min-h-0 border-l pl-4" style={{ minWidth: 0, borderColor: 'rgba(255,255,255,0.08)' }}>
        {selectedItem ? (
          <div className="flex flex-col h-full overflow-hidden">
            {detailLoading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
              </div>
            )}
            {!detailLoading && (
            <div className="flex flex-col h-full overflow-hidden min-h-0">
            <div className="flex-shrink-0">
              <button onClick={() => setSelected(null)}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors mb-3">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                Back to results
              </button>

              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-white/5 flex items-center justify-center">
                  {selectedItem.icon_url
                    ? <img src={selectedItem.icon_url} alt="" className="w-full h-full object-cover" />
                    : <svg className="w-6 h-6 text-white/20" fill="currentColor" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-sm leading-tight truncate">{selectedItem.title}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-white/40 text-[10px]">by <span className="text-white/60">{selectedItem.author || selectedItem.team}</span></p>
                    {(() => {
                      const inst = installedInfo(selectedItem)
                      const update = hasUpdate(selectedItem)
                      if (!inst) return null
                      return update
                        ? <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold border bg-yellow-500/15 text-yellow-300 border-yellow-500/25">Update available</span>
                        : <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold border bg-green-500/15 text-green-300 border-green-500/25">Ready to use</span>
                    })()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-2 text-[10px]">
                <span className="flex items-center gap-1 text-orange-400/80">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                  <span className="font-semibold">{formatNum(selectedItem.downloads)}</span>
                  <span className="text-white/30">downloads</span>
                </span>
                <span className="flex items-center gap-1 text-pink-400/70">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                  <span className="font-semibold">{formatNum(selectedItem.follows || selectedItem.followers)}</span>
                  <span className="text-white/30">follows</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {(selectedItem.loaders || []).map(l => (
                  <span key={l} className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold capitalize border ${LOADER_COLORS[l] || 'bg-white/8 text-white/50 border-white/10'}`}>{l}</span>
                ))}
                {(selectedItem.game_versions || []).slice(0, 3).map(v => (
                  <span key={v} className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/8 text-orange-400/60 border border-orange-500/15">{v}</span>
                ))}
              </div>

              <div className="flex gap-0 border-b border-white/5">
                {DETAIL_SUB_TABS.map(tab => (
                  <button key={tab.id} onClick={() => setDetailTab(tab.id)}
                    className={`px-2.5 py-1.5 text-[9px] font-semibold border-b-2 transition-all -mb-px ${
                      detailTab === tab.id
                        ? 'border-orange-500 text-orange-400'
                        : 'border-transparent text-white/30 hover:text-white/60'
                    }`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-2 space-y-2 text-xs min-h-0" style={{ scrollbarColor: 'rgba(255,255,255,0.10) transparent' }}>
              {detailTab === 'description' && (
                <div className="md-content text-white/70" dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedItem.body || selectedItem.description || '') }} />
              )}

              {detailTab === 'versions' && (
                <div className="flex flex-col gap-2">
                  {filteredVersions.length === 0 && (
                    <p className="text-white/25 text-xs py-4 text-center">
                      {isMod ? `No versions match profile's loader (${profile.loader}) and game version (${profile.gameVersion})` : 'No versions found'}
                    </p>
                  )}
                  {filteredVersions.map(v => {
                    const inst = installedInfo(selectedItem)
                    const isInstalledVer = inst && (
                      inst.versionId
                        ? String(v.id) === String(inst.versionId)
                        : (v.files || []).some(f => f.filename === inst.filename)
                    )
                    const latest = latestOf(selectedItem.project_id)
                    const isLatestVer = latest && String(v.id) === String(latest.id)
                    const showUpdate = !isInstalledVer && isLatestVer && hasUpdate(selectedItem)
                    return (
                    <div key={v.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-white text-xs font-semibold">{v.version_number}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border ${VERSION_TYPE_STYLE[v.version_type] || ''}`}>{v.version_type}</span>
                          {isInstalledVer && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold border bg-green-500/15 text-green-300 border-green-500/25">Installed</span>
                          )}
                          {showUpdate && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold border bg-yellow-500/15 text-yellow-300 border-yellow-500/25">Update</span>
                          )}
                          {(v.loaders || []).map(l => (
                            <span key={l} className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold capitalize border ${LOADER_COLORS[l] || 'bg-white/8 text-white/40 border-white/10'}`}>{l}</span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 text-[9px] text-white/30 mt-0.5">
                          <span>{v.game_versions?.slice(0, 3).join(', ')}</span>
                          <span>·</span>
                          <span>{formatDate(v.date_published)}</span>
                        </div>
                      </div>
                      {isInstalledVer ? (
                        <span className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold text-green-300 bg-green-500/15 border border-green-500/25 flex items-center gap-1" title="Ready to use">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                          Ready to use
                        </span>
                      ) : (
                        <button onClick={() => handleDownload(v)} disabled={installing}
                          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white transition-all disabled:opacity-50 flex items-center gap-1"
                          style={{ background: showUpdate ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : 'linear-gradient(135deg,#f97316,#ea580c)' }}>
                          {installing ? '...' : showUpdate ? (
                            <>
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M11 5v11.17l-4.88-4.88-1.42 1.41L12 19.71l7.3-7.01-1.42-1.41L13 16.17V5h-2zM5 21h14v-2H5v2z"/></svg>
                              Update
                            </>
                          ) : 'Download'}
                        </button>
                      )}
                    </div>
                    )
                  })}
                </div>
              )}

              {detailTab === 'gallery' && (
                <div>
                  {galleryItems.length === 0 ? (
                    <p className="text-white/25 text-xs text-center py-8">No gallery images</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        {galleryItems.map((img, i) => (
                          <div key={i} onClick={() => setLightboxIdx(i)}
                            className="rounded-xl overflow-hidden aspect-video bg-white/5 cursor-pointer hover:ring-2 hover:ring-orange-500/40 transition-all">
                            <img src={img.url} alt={img.title || ''} className="w-full h-full object-cover" loading="lazy"
                              onError={e => { e.currentTarget.src = ''; e.currentTarget.className = 'w-full h-full flex items-center justify-center text-white/20 text-[10px]' }} />
                          </div>
                        ))}
                      </div>

                      {lightboxIdx >= 0 && (
                        <div className="fixed inset-0 z-[400] bg-black/85 backdrop-blur-sm flex items-center justify-center"
                          onClick={() => setLightboxIdx(-1)}>
                          <div className="relative max-w-4xl max-h-[85vh] w-full mx-4 flex flex-col items-center gap-3"
                            onClick={e => e.stopPropagation()}>
                            <div className="relative w-full aspect-video max-h-[70vh] flex items-center justify-center">
                              <button onClick={() => setLightboxIdx(i => i > 0 ? i - 1 : galleryItems.length - 1)}
                                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-all">
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                              </button>
                              <img src={galleryItems[lightboxIdx]?.url}
                                alt={galleryItems[lightboxIdx]?.title || ''}
                                className="max-w-full max-h-full rounded-xl object-contain"
                                onError={e => { e.currentTarget.src = ''; e.currentTarget.alt = 'Failed to load' }} />
                              <button onClick={() => setLightboxIdx(i => i < galleryItems.length - 1 ? i + 1 : 0)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-all">
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
                              </button>
                              <button onClick={() => setLightboxIdx(-1)}
                                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-all">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                              </button>
                            </div>
                            <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full" style={{ scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}>
                              {galleryItems.map((img, i) => (
                                <div key={i} onClick={() => setLightboxIdx(i)}
                                  className={`flex-shrink-0 w-14 h-10 rounded-lg overflow-hidden cursor-pointer transition-all ${i === lightboxIdx ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-black/85' : 'opacity-50 hover:opacity-80'}`}>
                                  <img src={img.url} alt={img.title || ''} className="w-full h-full object-cover"
                                    onError={e => { e.currentTarget.style.display = 'none' }} />
                                </div>
                              ))}
                            </div>
                            <p className="text-[10px] text-white/40">{lightboxIdx + 1} / {galleryItems.length}{galleryItems[lightboxIdx]?.title ? ` · ${galleryItems[lightboxIdx].title}` : ''}</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {detailTab === 'comments' && (
                <p className="text-white/25 text-xs text-center py-8">Comments are not available in the browser</p>
              )}

              {installProgress && (
                <div className="rounded-xl p-3 bg-white/3 border border-white/8">
                  <p className="text-[10px] text-white/50">{installProgress.log}</p>
                </div>
              )}
              {installError && (
                <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/20">
                  <p className="text-[10px] text-red-400">{installError}</p>
                </div>
              )}
              {installDone && (
                <div className="rounded-xl p-3 bg-orange-500/10 border border-orange-500/20 flex items-center gap-2">
                  <svg className="w-3 h-3 text-orange-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                  <p className="text-[10px] text-orange-400 font-semibold">Installed successfully!</p>
                </div>
              )}
            </div>
            </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white/15"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <p className="text-xs text-white/25">Select an item to view details</p>
          </div>
        )}
      </div>
    </div>
  )
}
