/**
 * VoxelXClient — Crash Analyzer Modal
 * Tự động phân tích log crash, tìm mod bị thiếu trên Modrinth và cài đặt.
 */

import { useState, useEffect, useRef } from 'react'
import { useLang } from '../../i18n/LangProvider'

const isElectron = typeof window !== 'undefined' && window.electronAPI

// ─── Log parser ───────────────────────────────────────────────────────────────

/**
 * Parse Fabric crash log để tìm các mod bị thiếu / không tương thích.
 * Hỗ trợ các pattern:
 *   - "Mod 'X' (modid) A.B.C requires version D.E.F+ of Y, which is missing!"
 *   - "Install fabric-language-kotlin, version X.Y.Z or later."
 *   - "net.fabricmc.loader.impl.FormattedException: Incompatible mod set!"
 */
export function parseFabricCrashLogs(logs) {
  const missing = new Map() // modId → { modId, displayName, requiredVersion, requiredBy[] }

  for (const line of logs) {
    // Pattern: "- Mod 'DisplayName' (modid) X.Y.Z requires version A.B.C or later of target-mod, which is missing!"
    const reqMissing = line.match(
      /Mod ['"]?([^'"(]+)['"]?\s*\(([^)]+)\)[^r]*requires\s+version\s+([\w.+\-]+(?:\s*or\s+later)?)\s+of\s+([\w\-]+),\s+which\s+is\s+missing/i
    )
    if (reqMissing) {
      const [, requiredByDisplay, , requiredVersion, targetModId] = reqMissing
      const key = targetModId.trim()
      if (!missing.has(key)) {
        missing.set(key, {
          modId: key,
          displayName: key,
          requiredVersion: requiredVersion.trim(),
          requiredBy: [],
        })
      }
      missing.get(key).requiredBy.push(requiredByDisplay.trim())
      continue
    }

    // Pattern: "Install fabric-language-kotlin, version X.Y.Z or later."
    const installSuggestion = line.match(
      /Install\s+([\w\-]+),\s+version\s+([\w.+\-]+(?:\s*or\s+later)?)/i
    )
    if (installSuggestion) {
      const [, modId, version] = installSuggestion
      const key = modId.trim()
      if (!missing.has(key)) {
        missing.set(key, {
          modId: key,
          displayName: key,
          requiredVersion: version.trim(),
          requiredBy: [],
        })
      }
      continue
    }

    // Pattern: "requires version X.Y.Z+kotlinY.Z.W or later of fabric-language-kotlin"
    const reqOf = line.match(
      /requires\s+version\s+([\w.+\-]+)\s+or\s+later\s+of\s+([\w\-]+)/i
    )
    if (reqOf) {
      const [, version, modId] = reqOf
      const key = modId.trim()
      if (!missing.has(key)) {
        missing.set(key, {
          modId: key,
          displayName: key,
          requiredVersion: version.trim(),
          requiredBy: [],
        })
      }
    }
  }

  return Array.from(missing.values())
}

export function isFabricIncompatibleCrash(logs) {
  return logs.some(l =>
    /Incompatible mod(s)? found/i.test(l) ||
    /FormattedException.*Incompatible/i.test(l) ||
    /net\.fabricmc\.loader.*FormattedException/i.test(l)
  )
}

// ─── Modrinth search ──────────────────────────────────────────────────────────

async function searchModrinthForMod(modId, gameVersion) {
  if (!isElectron) return null
  try {
    const facets = [['project_type:mod']]
    if (gameVersion) facets.push([`versions:${gameVersion}`])

    const result = await window.electronAPI.modrinthSearch({
      query: modId,
      limit: 5,
      facets: JSON.stringify(facets),
    })
    if (!result?.hits?.length) return null

    // Ưu tiên exact slug/id match
    const exact = result.hits.find(
      h => h.slug === modId || h.project_id === modId ||
           h.slug?.replace(/-/g, '') === modId.replace(/-/g, '')
    )
    return exact || result.hits[0]
  } catch {
    return null
  }
}

async function getModrinthVersions(projectId, gameVersion, loader) {
  if (!isElectron) return []
  try {
    const filters = {}
    if (gameVersion) filters.game_versions = [gameVersion]
    if (loader && loader !== 'vanilla') filters.loaders = [loader]
    const versions = await window.electronAPI.modrinthGetVersions(projectId, filters)
    return versions || []
  } catch {
    return []
  }
}

// ─── ModFixItem component ─────────────────────────────────────────────────────

function ModFixItem({ missingMod, gameVersion, loader, profileId, accountId, instancePath, onFixed }) {
  const { t } = useLang()
  const [searchState, setSearchState] = useState('idle') // idle | searching | found | notfound | downloading | done | error
  const [project, setProject] = useState(null)
  const [versions, setVersions] = useState([])
  const [selectedVersionId, setSelectedVersionId] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [progress, setProgress] = useState(null)
  const unsubRef = useRef(null)

  useEffect(() => {
    doSearch()
    return () => unsubRef.current?.()
  }, [])

  async function doSearch() {
    setSearchState('searching')
    const hit = await searchModrinthForMod(missingMod.modId, gameVersion)
    if (!hit) {
      setSearchState('notfound')
      return
    }
    setProject(hit)

    const vers = await getModrinthVersions(hit.project_id, gameVersion, loader)
    if (!vers.length) {
      setSearchState('notfound')
      return
    }
    setVersions(vers)
    setSelectedVersionId(vers[0].id)
    setSearchState('found')
  }

  async function handleInstall() {
    if (!selectedVersionId || !project) return
    setSearchState('downloading')
    setProgress({ percent: 0 })

    if (isElectron) {
      unsubRef.current = window.electronAPI.onModrinthInstallProgress(p => {
        setProgress(p)
      })
    }

    try {
      const result = await window.electronAPI.modrinthInstall({
        versionId: selectedVersionId,
        projectType: 'mod',
        instancePath,
        accountId,
      })

      unsubRef.current?.()
      if (result?.error) {
        setErrorMsg(result.error)
        setSearchState('error')
        return
      }
      setSearchState('done')
      onFixed?.(missingMod.modId, result.filename || result.path)
    } catch (err) {
      unsubRef.current?.()
      setErrorMsg(err.message)
      setSearchState('error')
    }
  }

  const selectedVersion = versions.find(v => v.id === selectedVersionId)

  return (
    <div className={`rounded-xl border p-4 transition-all ${
      searchState === 'done'
        ? 'border-green-500/30 bg-green-500/8'
        : searchState === 'error' || searchState === 'notfound'
        ? 'border-red-500/20 bg-red-500/5'
        : 'border-white/8 bg-white/3'
    }`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center">
          {project?.icon_url ? (
            <img src={project.icon_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white/20">
              <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/>
            </svg>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white/90">
              {project?.title || missingMod.displayName || missingMod.modId}
            </span>
            <span className="text-[10px] font-mono text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
              {missingMod.modId}
            </span>
          </div>

          {missingMod.requiredVersion && (
            <p className="text-xs text-yellow-400/70 mt-0.5">
              Yêu cầu: <span className="font-mono">{missingMod.requiredVersion}</span>
            </p>
          )}

          {missingMod.requiredBy?.length > 0 && (
            <p className="text-[10px] text-white/30 mt-0.5">
              Cần bởi: {missingMod.requiredBy.join(', ')}
            </p>
          )}

          {/* Version selector */}
          {searchState === 'found' && versions.length > 0 && (
            <div className="mt-2">
              <select
                value={selectedVersionId || ''}
                onChange={e => setSelectedVersionId(e.target.value)}
                className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/70 focus:outline-none focus:border-green-500/40 max-w-full"
              >
                {versions.slice(0, 10).map(v => (
                  <option key={v.id} value={v.id} className="bg-[#141414]">
                    {v.name || v.version_number} — {v.game_versions?.join(', ')}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Progress bar */}
          {searchState === 'downloading' && (
            <div className="mt-2">
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-400 rounded-full transition-all duration-300"
                  style={{ width: `${progress?.percent ?? 0}%` }}
                />
              </div>
              <p className="text-[10px] text-white/30 mt-1">{progress?.log || 'Đang tải...'}</p>
            </div>
          )}

          {searchState === 'error' && (
            <p className="text-xs text-red-400 mt-1">{errorMsg}</p>
          )}
        </div>

        {/* Action button */}
        <div className="flex-shrink-0">
          {searchState === 'idle' || searchState === 'searching' ? (
            <div className="flex items-center gap-1.5 text-xs text-white/30">
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Đang tìm...
            </div>
          ) : searchState === 'found' ? (
            <button
              onClick={handleInstall}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/25 text-green-400 text-xs font-semibold hover:bg-green-500/25 transition-all active:scale-95"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
              Tải xuống
            </button>
          ) : searchState === 'downloading' ? (
            <div className="text-xs text-green-400/60 flex items-center gap-1">
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {progress?.percent ?? 0}%
            </div>
          ) : searchState === 'done' ? (
            <div className="flex items-center gap-1 text-xs text-green-400 font-semibold">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              Đã cài
            </div>
          ) : searchState === 'notfound' ? (
            <span className="text-xs text-white/25">Không tìm thấy</span>
          ) : searchState === 'error' ? (
            <button
              onClick={doSearch}
              className="text-xs text-red-400/70 hover:text-red-400 transition-colors"
            >
              Thử lại
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function CrashAnalyzerModal({ crashData, onClose }) {
  const { t } = useLang()
  const [fixedMods, setFixedMods] = useState(new Set())

  if (!crashData) return null

  const { logs, profileId, accountId, instancePath, gameVersion, loader, profileName } = crashData
  const missingMods = parseFabricCrashLogs(logs)
  const isFabricCrash = isFabricIncompatibleCrash(logs)

  // Lấy các dòng lỗi chính để hiển thị
  const errorLines = logs.filter(l =>
    /ERROR|FATAL|FormattedException|Incompatible|missing/i.test(l)
  ).slice(0, 8)

  const allFixed = missingMods.length > 0 && fixedMods.size >= missingMods.length

  function handleFixed(modId) {
    setFixedMods(prev => new Set([...prev, modId]))
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex-shrink-0 flex items-start gap-4 px-6 py-5 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-red-400">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white">Game bị crash</h2>
            <p className="text-xs text-white/40 mt-0.5">
              {profileName && <span className="text-white/60">{profileName}</span>}
              {gameVersion && <span className="text-white/30"> · MC {gameVersion}</span>}
              {loader && loader !== 'vanilla' && (
                <span className="text-white/30"> · {loader.charAt(0).toUpperCase() + loader.slice(1)}</span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/8 text-white/30 hover:text-white/70 transition-all"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Crash summary */}
          {isFabricCrash && missingMods.length > 0 ? (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-yellow-400 flex-shrink-0">
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                </svg>
                <p className="text-sm font-bold text-yellow-400">Mod không tương thích</p>
              </div>
              <p className="text-xs text-white/50">
                Fabric phát hiện <span className="text-yellow-400 font-semibold">{missingMods.length} mod bị thiếu</span> hoặc không đúng phiên bản.
                Tải xuống và cài đặt bên dưới để sửa lỗi.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
              <p className="text-sm font-bold text-red-400 mb-1">Crash không xác định</p>
              <p className="text-xs text-white/40">Không phát hiện được nguyên nhân cụ thể. Xem log bên dưới để biết thêm chi tiết.</p>
            </div>
          )}

          {/* Missing mods list */}
          {missingMods.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">
                Mod cần cài đặt ({missingMods.length})
              </h3>
              <div className="flex flex-col gap-2">
                {missingMods.map(mod => (
                  <ModFixItem
                    key={mod.modId}
                    missingMod={mod}
                    gameVersion={gameVersion}
                    loader={loader}
                    profileId={profileId}
                    accountId={accountId}
                    instancePath={instancePath}
                    onFixed={handleFixed}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Error log preview */}
          {errorLines.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">
                Chi tiết lỗi
              </h3>
              <div className="rounded-xl bg-black/40 border border-white/5 p-3 font-mono text-[11px] leading-relaxed max-h-40 overflow-y-auto">
                {errorLines.map((line, i) => (
                  <div key={i} className={`${
                    /ERROR|FATAL/.test(line) ? 'text-red-400/80' :
                    /WARN/.test(line) ? 'text-yellow-400/70' :
                    'text-white/40'
                  }`}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-white/5 bg-black/20">
          {allFixed ? (
            <p className="text-xs text-green-400 flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              Đã cài xong — khởi động lại game để áp dụng
            </p>
          ) : (
            <p className="text-xs text-white/25">
              {fixedMods.size > 0
                ? `Đã cài ${fixedMods.size}/${missingMods.length} mod`
                : 'Cài đặt mod để sửa lỗi crash'}
            </p>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/8 border border-white/10 text-white/60 hover:bg-white/12 hover:text-white/80 transition-all"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
