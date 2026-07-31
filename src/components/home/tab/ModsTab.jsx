import { useState, useCallback, useEffect, useRef } from 'react'
import { isElectron, Icons, formatBytes, LoadingState, EmptyState, ViewToggle, DropZoneWrapper, SearchBar } from './shared'
import { useLang } from '../../../i18n/LangProvider'

export default function ModsTab({ profile, accountId }) {
  const { t } = useLang()
  const [mods, setMods] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [metaCache, setMetaCache] = useState({})
  const [toggling, setToggling] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [installing, setInstalling] = useState([])
  const [query, setQuery] = useState('')
  const [tracked, setTracked] = useState({})
  const [updateMap, setUpdateMap] = useState({})
  const updateFetching = useRef(new Set())
  const updateMapRef = useRef({})
  useEffect(() => { updateMapRef.current = updateMap }, [updateMap])

  const q = query.trim().toLowerCase()
  const filteredMods = q
    ? mods.filter(m => (metaCache[m.fileName]?.name || m.displayName || m.fileName || '').toLowerCase().includes(q))
    : mods

  const loadTracked = useCallback(async () => {
    if (!isElectron || !profile?.id) return
    try {
      const r = await window.electronAPI.profileGetInstalledContent(profile.id)
      if (!r?.ok) return
      const map = {}
      for (const [pid, info] of Object.entries(r.installed || {})) {
        if (info.type !== 'mod') continue
        map[info.filename] = {
          projectId: pid,
          versionId: info.versionId,
          platform: typeof info.versionId === 'number' ? 'curseforge' : 'modrinth',
        }
      }
      setTracked(map)
      if (r.meta) {
        const metaAdd = {}
        for (const [key, m] of Object.entries(r.meta)) {
          if (!key.startsWith('mod:')) continue
          const f = key.slice(4)
          metaAdd[f] = m
        }
        setMetaCache(prev => ({ ...prev, ...metaAdd }))
      }
    } catch {}
    try {
      const r = await window.electronAPI.profileMatchInstalledContent(profile.id)
      if (r?.ok) {
        const matched = r.matchedFiles || {}
        const add = {}
        for (const [baseName, info] of Object.entries(matched)) {
          if (info.type !== 'mod') continue
          add[baseName] = {
            projectId: info.projectId,
            versionId: info.versionId,
            platform: info.platform || 'modrinth',
          }
        }
        setTracked(prev => ({ ...prev, ...add }))
        if (r.meta) {
          const metaAdd = {}
          for (const [key, m] of Object.entries(r.meta)) {
            if (!key.startsWith('mod:')) continue
            metaAdd[key.slice(4)] = m
          }
          setMetaCache(prev => ({ ...prev, ...metaAdd }))
        }
      }
    } catch {}
  }, [profile?.id])

  const load = useCallback(async () => {
    if (!isElectron || !profile?.id) { setLoading(false); return }
    setLoading(true)
    try {
      const r = await window.electronAPI.profileListMods(profile.id, accountId)
      if (r?.ok) setMods(r.mods || [])
    } catch {}
    setLoading(false)
  }, [profile?.id, accountId])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadTracked() }, [loadTracked])

  useEffect(() => {
    if (!isElectron || !profile?.id || mods.length === 0) return
    const jobs = []
    for (const mod of mods) {
      const base = mod.fileName.replace(/\.(off|disabled)$/i, '')
      const t = tracked[base]
      if (!t || updateMapRef.current[mod.fileName] !== undefined) continue
      if (updateFetching.current.has(mod.fileName)) continue
      jobs.push({ mod, base, t })
    }
    if (jobs.length === 0) return
    const filters = {
      gameVersions: [profile.gameVersion],
      loaders: profile.loader !== 'vanilla' ? [profile.loader] : [],
    }
    let idx = 0
    const runNext = () => {
      if (idx >= jobs.length) return
      const { mod, base, t } = jobs[idx++]
      updateFetching.current.add(mod.fileName)
      const getVersions = t.platform === 'curseforge'
        ? window.electronAPI.curseforgeGetVersions(t.projectId, filters)
        : window.electronAPI.modrinthGetVersions(t.projectId, filters)
      getVersions
        .then(data => {
          const vers = Array.isArray(data) ? data : []
          const latest = vers.find(v => v.version_type === 'release') || vers[0]
          let installedVersionId = t.versionId
          if (!installedVersionId) {
            const matchedVer = vers.find(v => (v.files || []).some(f => f.filename === base))
            installedVersionId = matchedVer ? matchedVer.id : null
          }
          const hasUpdate = !!latest && !!installedVersionId && String(latest.id) !== String(installedVersionId)
          setUpdateMap(prev => ({ ...prev, [mod.fileName]: hasUpdate ? { hasUpdate, latest, platform: t.platform } : { hasUpdate: false, latest: null, platform: t.platform } }))
        })
        .catch(() => setUpdateMap(prev => ({ ...prev, [mod.fileName]: { hasUpdate: false, latest: null, platform: t.platform } })))
        .finally(() => {
          updateFetching.current.delete(mod.fileName)
          runNext()
        })
    }
    for (let i = 0; i < Math.min(4, jobs.length); i++) runNext()
  }, [mods, tracked, profile?.id, profile?.gameVersion, profile?.loader])

  async function handleUpdate(mod) {
    if (!isElectron || !profile?.id) return
    const u = updateMap[mod.fileName]
    if (!u?.hasUpdate || !u.latest) return
    setUpdateMap(prev => ({ ...prev, [mod.fileName]: { ...prev[mod.fileName], installing: true } }))
    try {
      const latest = u.latest
      const opts = {
        versionId: latest.id,
        projectId: latest.project_id,
        downloadUrl: latest.files?.[0]?.url,
        filename: latest.files?.[0]?.filename,
        fileLength: latest.files?.[0]?.size,
        projectType: 'mod',
        instancePath: profile.instancePath,
      }
      if (u.platform === 'curseforge') {
        await window.electronAPI.curseforgeInstall({ ...opts, deleteOldVersions: true })
      } else {
        await window.electronAPI.modrinthInstall({ ...opts, deleteOldVersions: true })
      }
      updateFetching.current.delete(mod.fileName)
      setUpdateMap(prev => { const n = { ...prev }; delete n[mod.fileName]; return n })
      await load()
      await loadTracked()
    } catch {} finally {
      setUpdateMap(prev => prev[mod.fileName] ? { ...prev[mod.fileName], installing: false } : prev)
    }
  }

  async function handleToggle(mod) {
    if (!isElectron) return
    setToggling(mod.fileName)
    try {
      const r = await window.electronAPI.profileToggleMod(profile.id, mod.fileName, accountId)
      if (r?.ok) {
        const newFileName = r.newFileName || mod.fileName
        setMods(prev => prev.map(m =>
          m.fileName === mod.fileName
            ? { ...m, fileName: newFileName, enabled: r.enabled }
            : m
        ))
        if (newFileName !== mod.fileName) {
          setMetaCache(prev => {
            const next = { ...prev }
            next[newFileName] = next[mod.fileName]
            delete next[mod.fileName]
            return next
          })
        }
      }
    } catch {}
    setToggling(null)
  }

  async function handleDelete(fileName) {
    if (!isElectron) return
    setDeleting(fileName)
    try {
      await window.electronAPI.profileDeleteMod(profile.id, fileName, accountId)
      setMods(prev => prev.filter(m => m.fileName !== fileName))
      setMetaCache(prev => { const n = { ...prev }; delete n[fileName]; return n })
    } catch {}
    setDeleting(null)
    setConfirmDelete(null)
  }

  async function handleDropFiles(files) {
    if (!isElectron || !profile?.id) return
    const valid = files.filter(f => f.name.toLowerCase().endsWith('.jar'))
    if (!valid.length) return
    setInstalling(valid.map(f => f.name))
    for (const file of valid) {
      try {
        const srcPath = window.electronAPI.getFilePath(file)
        if (!srcPath) continue
        await window.electronAPI.profileInstallFile(profile.id, 'mod', srcPath, accountId)
      } catch {}
    }
    setInstalling([])
    load()
  }

  if (loading) return <LoadingState text={t('profileSettings.mods.loading')} />

  if (mods.length === 0) return (
    <DropZoneWrapper onDrop={handleDropFiles} accept={['.jar']} color="green">
      <EmptyState
        icon={Icons.mod}
        title={t('profileSettings.mods.emptyTitle')}
        desc={t('profileSettings.mods.emptyDesc')}
      />
    </DropZoneWrapper>
  )

  return (
    <DropZoneWrapper onDrop={handleDropFiles} accept={['.jar']} color="green">
      <div className="flex flex-col h-full">
        {installing.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border-b border-orange-500/20 text-xs text-orange-400">
            {Icons.spin}
            <span>{t('profileSettings.mods.installing', { count: installing.length })}</span>
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
          <SearchBar value={query} onChange={setQuery} placeholder={t('profileSettings.mods.search')} />
          <span className="text-xs text-white/30 whitespace-nowrap">{q ? `${filteredMods.length}/${mods.length}` : mods.length} mod</span>
          <ViewToggle view={view} onChange={setView} />
        </div>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
          {filteredMods.length === 0 ? (
            <EmptyState icon={Icons.search} title={t('profileSettings.mods.noResults')} />
          ) : view === 'list' ? (
            <div className="flex flex-col gap-1 p-2.5">
              {filteredMods.map(mod => {
                const meta = metaCache[mod.fileName]
                const iconUrl = meta?.iconUrl || null
                return (
                  <div
                    key={mod.fileName}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all group ${mod.enabled ? 'bg-white/3 border-white/5 hover:bg-white/5 hover:border-white/8' : 'bg-white/1 border-white/3 opacity-50 hover:opacity-70'}`}
                  >
                    <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 border border-white/8 flex items-center justify-center">
                      {iconUrl ? <img src={iconUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-white/20 scale-90">{Icons.mod}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/80 truncate">{meta?.name || mod.displayName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-white/25">{formatBytes(mod.size)}</span>
                        {!mod.enabled && <span className="text-[10px] text-orange-400/60">{t('profileSettings.mods.disabled')}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {confirmDelete === mod.fileName ? (
                        <>
                          <span className="text-[10px] text-red-400/70">{t('profileSettings.mods.deleteConfirm')}</span>
                          <button onClick={() => handleDelete(mod.fileName)} disabled={deleting === mod.fileName} className="px-2 py-1 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-[10px] font-bold hover:bg-red-500/25 transition-all disabled:opacity-50">
                            {deleting === mod.fileName ? '...' : t('profileSettings.mods.delete')}
                          </button>
                          <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 rounded-lg bg-white/5 border border-white/8 text-white/40 text-[10px] hover:bg-white/10 transition-all">{t('profileSettings.mods.cancel')}</button>
                        </>
                      ) : (
                        <>
                          {(() => {
                            const u = updateMap[mod.fileName]
                            if (!u) return null
                            if (u.installing) return <span className="text-[9px] px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/25 text-yellow-300 font-bold flex items-center gap-1">{Icons.spin}</span>
                            if (u.hasUpdate) return (
                              <button onClick={() => handleUpdate(mod)}
                                className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white flex items-center gap-1 transition-all hover:scale-105"
                                style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)' }}
                                title="Update to latest version">
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M11 5v11.17l-4.88-4.88-1.42 1.41L12 19.71l7.3-7.01-1.42-1.41L13 16.17V5h-2zM5 21h14v-2H5v2z"/></svg>
                                Update
                              </button>
                            )
                            return (
                              <span className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-green-300 bg-green-500/15 border border-green-500/25 flex items-center gap-1" title="Ready to use">
                                {Icons.check}
                                Ready to use
                              </span>
                            )
                          })()}
                          <button
                            onClick={() => handleToggle(mod)}
                            disabled={toggling === mod.fileName}
                            className={`relative w-9 h-5 rounded-full transition-all flex-shrink-0 ${mod.enabled ? 'bg-orange-500' : 'bg-white/10'} disabled:opacity-50`}
                            title={mod.enabled ? t('profileSettings.mods.disableMod') : t('profileSettings.mods.enableMod')}
                          >
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${mod.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                          </button>
                          <button onClick={() => setConfirmDelete(mod.fileName)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all" title={t('profileSettings.mods.deleteMod')}>
                            {Icons.trash}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 p-2.5">
              {filteredMods.map(mod => {
                const meta = metaCache[mod.fileName]
                const iconUrl = meta?.iconUrl || null
                return (
                  <div key={mod.fileName} className={`relative rounded-xl border overflow-hidden transition-all group ${mod.enabled ? 'bg-white/3 border-white/8 hover:border-white/15' : 'bg-white/1 border-white/4 opacity-50 hover:opacity-70'}`}>
                    <div className="relative w-full overflow-hidden" style={{ paddingBottom: '55%' }}>
                      {iconUrl && <img src={iconUrl} alt="" className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-30" />}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/8 border border-white/10 flex items-center justify-center shadow-lg">
                          {iconUrl ? <img src={iconUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-white/30">{Icons.mod}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggle(mod)}
                        disabled={toggling === mod.fileName}
                        className={`absolute top-1.5 right-1.5 w-6 h-3.5 rounded-full transition-all ${mod.enabled ? 'bg-orange-500' : 'bg-white/15'} disabled:opacity-50`}
                        title={mod.enabled ? t('profileSettings.mods.disable') : t('profileSettings.mods.enable')}
                      >
                        <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-all ${mod.enabled ? 'left-[10px]' : 'left-0.5'}`} />
                      </button>
                    </div>
                    <div className="px-2 py-1.5">
                      <p className="text-[10px] font-medium text-white/70 truncate leading-tight">{meta?.name || mod.displayName}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[9px] text-white/25">{formatBytes(mod.size)}</span>
                        {(() => {
                          const u = updateMap[mod.fileName]
                          if (u?.hasUpdate && !u.installing) {
                            return (
                              <button onClick={() => handleUpdate(mod)}
                                className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 text-[9px] font-bold hover:bg-yellow-500/30 transition-all">
                                Update
                              </button>
                            )
                          }
                          if (u?.installing) return <span className="text-yellow-300/60">{Icons.spin}</span>
                          if (u) return <span className="text-green-300/60" title="Ready to use">{Icons.check}</span>
                          return null
                        })()}
                        {confirmDelete === mod.fileName ? (
                          <div className="flex gap-1">
                            <button onClick={() => handleDelete(mod.fileName)} disabled={deleting === mod.fileName} className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50">
                              {deleting === mod.fileName ? '...' : t('profileSettings.mods.delete')}
                            </button>
                            <button onClick={() => setConfirmDelete(null)} className="text-[9px] px-1.5 py-0.5 rounded bg-white/8 text-white/40 hover:bg-white/12 transition-all">{t('profileSettings.mods.cancel')}</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(mod.fileName)} className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all">
                            {Icons.trash}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </DropZoneWrapper>
  )
}
