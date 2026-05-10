import { useState, useEffect } from 'react'

const isElectron = typeof window !== 'undefined' && window.electronAPI

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'downloads', label: 'Downloads' },
  { value: 'follows',   label: 'Follows' },
  { value: 'newest',    label: 'Newest' },
  { value: 'updated',   label: 'Updated' },
]

const LOADER_OPTIONS = [
  { value: 'fabric',   label: 'Fabric',   color: 'text-purple-400' },
  { value: 'forge',    label: 'Forge',    color: 'text-orange-400' },
  { value: 'neoforge', label: 'NeoForge', color: 'text-rose-400' },
  { value: 'quilt',    label: 'Quilt',    color: 'text-blue-400' },
  { value: 'vanilla',  label: 'Vanilla',  color: 'text-green-400' },
]

// Category groups from Modrinth
const CATEGORY_GROUPS = {
  'Gameplay': ['adventure','cursed','decoration','economy','equipment','food','game-mechanics','magic','management','minigame','mobs','optimization','social','storage','technology','transportation','utility','worldgen'],
  'Performance': ['optimization'],
  'Visual': ['decoration','shader'],
}

function CheckItem({ label, checked, onChange, color }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group py-0.5">
      <div
        onClick={onChange}
        className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 transition-all ${checked ? 'bg-green-500' : 'bg-white/8 border border-white/15 group-hover:border-white/30'}`}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        )}
      </div>
      <span className={`text-xs transition-colors ${checked ? (color || 'text-white/80') : 'text-white/40 group-hover:text-white/60'}`}>
        {label}
      </span>
    </label>
  )
}

export default function ModrinthFilters({ filters, onChange }) {
  const [gameVersions, setGameVersions] = useState([])
  const [expanded, setExpanded]         = useState({ loaders: true, versions: true, sort: true })

  useEffect(() => {
    if (!isElectron) return
    window.electronAPI.modrinthGetGameVersions()
      .then(v => setGameVersions((v || []).slice(0, 30)))
      .catch(() => {})
  }, [])

  function toggleLoader(loader) {
    const cur = filters.loaders || []
    onChange({ loaders: cur.includes(loader) ? cur.filter(l => l !== loader) : [...cur, loader] })
  }

  function toggleVersion(v) {
    const cur = filters.gameVersions || []
    onChange({ gameVersions: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] })
  }

  function toggleSection(key) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div
      className="flex flex-col gap-0 overflow-y-auto h-full"
      style={{ scrollbarColor: 'rgba(255,255,255,0.10) transparent' }}
    >

      {/* Sort */}
      <div className="border-b border-white/5">
        <button
          onClick={() => toggleSection('sort')}
          className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-white/50 hover:text-white/70 transition-colors"
        >
          Sort by
          <svg className={`w-3 h-3 transition-transform ${expanded.sort ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        {expanded.sort && (
          <div className="px-3 pb-3 flex flex-col gap-0.5">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => onChange({ sortBy: opt.value })}
                className={`text-left text-xs px-2 py-1.5 rounded-lg transition-all ${filters.sortBy === opt.value ? 'bg-green-500/15 text-green-400' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loaders */}
      <div className="border-b border-white/5">
        <button
          onClick={() => toggleSection('loaders')}
          className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-white/50 hover:text-white/70 transition-colors"
        >
          Loaders
          <svg className={`w-3 h-3 transition-transform ${expanded.loaders ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        {expanded.loaders && (
          <div className="px-3 pb-3 flex flex-col gap-0.5">
            {LOADER_OPTIONS.map(opt => (
              <CheckItem
                key={opt.value}
                label={opt.label}
                color={opt.color}
                checked={(filters.loaders || []).includes(opt.value)}
                onChange={() => toggleLoader(opt.value)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Game versions */}
      <div className="border-b border-white/5">
        <button
          onClick={() => toggleSection('versions')}
          className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-white/50 hover:text-white/70 transition-colors"
        >
          Game Version
          <svg className={`w-3 h-3 transition-transform ${expanded.versions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        {expanded.versions && (
          <div className="px-3 pb-3 flex flex-col gap-0.5 max-h-48 overflow-y-auto">
            {gameVersions.length === 0 && (
              <p className="text-white/20 text-xs py-2">Loading...</p>
            )}
            {gameVersions.map(v => (
              <CheckItem
                key={v}
                label={v}
                checked={(filters.gameVersions || []).includes(v)}
                onChange={() => toggleVersion(v)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Clear filters */}
      {((filters.loaders?.length || 0) + (filters.gameVersions?.length || 0)) > 0 && (
        <div className="px-3 py-2">
          <button
            onClick={() => onChange({ loaders: [], gameVersions: [] })}
            className="w-full text-xs text-red-400/70 hover:text-red-400 transition-colors py-1.5 rounded-lg hover:bg-red-500/8"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  )
}
