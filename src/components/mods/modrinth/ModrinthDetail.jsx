import { useState } from 'react'
import { useModrinthProject, useModrinthVersions } from './useModrinth'
import InstallModal from '../shared/InstallModal'
import VersionSelect from '../shared/VersionSelect'

const isElectron = typeof window !== 'undefined' && window.electronAPI

const DETAIL_TABS = [
  { id: 'description', label: 'Description' },
  { id: 'versions',    label: 'Versions' },
  { id: 'gallery',     label: 'Gallery' },
]

function StatBadge({ icon, value, label }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <span className="text-white/30 text-xs">{icon}</span>
      <span className="text-white text-sm font-bold">{value}</span>
      <span className="text-white/30 text-[10px]">{label}</span>
    </div>
  )
}

function formatNum(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ModrinthDetail({ projectId, projectType, onBack }) {
  const { project, loading, error } = useModrinthProject(projectId)
  const { versions, loading: vLoading } = useModrinthVersions(projectId)
  const [activeTab, setActiveTab]   = useState('description')
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [showInstall, setShowInstall] = useState(false)

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3">
        <svg className="animate-spin w-6 h-6 text-green-400/50" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <p className="text-white/30 text-sm">Loading...</p>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3">
        <p className="text-red-400/70 text-sm">{error || 'Project not found'}</p>
        <button onClick={onBack} className="text-xs text-white/40 hover:text-white transition-colors">← Back</button>
      </div>
    )
  }

  const loaders = (project.loaders || []).slice(0, 4)
  const gameVersions = (project.game_versions || []).slice(0, 5)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Back button */}
      <div className="flex-shrink-0 px-4 pt-3 pb-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors mb-3"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Back to results
        </button>

        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-white/5 flex items-center justify-center">
            {project.icon_url
              ? <img src={project.icon_url} alt="" className="w-full h-full object-cover" />
              : <svg className="w-8 h-8 text-white/20" fill="currentColor" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
            }
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-base leading-tight mb-1">{project.title}</h2>
            <p className="text-white/40 text-xs mb-2">by <span className="text-white/60">{project.team}</span></p>
            <p className="text-white/40 text-xs leading-relaxed line-clamp-2">{project.description}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-2 mb-4">
          <StatBadge icon="⬇" value={formatNum(project.downloads)} label="Downloads" />
          <StatBadge icon="♥" value={formatNum(project.followers)} label="Follows" />
          <StatBadge icon="📅" value={formatDate(project.updated)} label="Updated" />
        </div>

        {/* Loader + version badges */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {loaders.map(l => (
            <span key={l} className="text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize bg-white/8 text-white/50">{l}</span>
          ))}
          {gameVersions.map(v => (
            <span key={v} className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400/70">{v}</span>
          ))}
          {(project.game_versions?.length || 0) > 5 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/30">+{project.game_versions.length - 5} more</span>
          )}
        </div>

        {/* Version selector + Install button */}
        <div className="flex items-center gap-2 mb-4">
          <VersionSelect
            versions={versions}
            value={selectedVersion?.id || ''}
            onChange={v => setSelectedVersion(v)}
            loading={vLoading}
          />
          <button
            onClick={() => setShowInstall(true)}
            disabled={!selectedVersion}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Install
          </button>
          {isElectron && project.source_url && (
            <button
              onClick={() => window.electronAPI.openExternal(project.source_url)}
              className="p-2 rounded-lg text-white/30 hover:text-white transition-all hover:bg-white/5 flex-shrink-0"
              title="Open on Modrinth"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
            </button>
          )}
        </div>

        {/* Sub tabs */}
        <div className="flex gap-0 border-b border-white/5">
          {DETAIL_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-white/30 hover:text-white/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 custom-scroll"
        style={{ scrollbarColor: 'rgba(255,255,255,0.10) transparent' }}>
        {activeTab === 'description' && (
          <div className="prose prose-invert prose-sm max-w-none">
            <div
              className="text-white/60 text-xs leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: project.body?.replace(/\n/g, '<br/>') || project.description }}
            />
          </div>
        )}

        {activeTab === 'versions' && (
          <div className="flex flex-col gap-2">
            {vLoading && <p className="text-white/30 text-xs">Loading versions...</p>}
            {versions.map(v => (
              <div
                key={v.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                onClick={() => { setSelectedVersion(v); setShowInstall(true) }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-white text-xs font-semibold">{v.version_number}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                      v.version_type === 'release' ? 'bg-green-500/15 text-green-400' :
                      v.version_type === 'beta'    ? 'bg-yellow-500/15 text-yellow-400' :
                      'bg-white/10 text-white/40'
                    }`}>{v.version_type}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-white/30">
                    <span>{v.game_versions?.slice(0,3).join(', ')}</span>
                    <span>·</span>
                    <span>{formatDate(v.date_published)}</span>
                    <span>·</span>
                    <span>{formatNum(v.downloads)} downloads</span>
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setSelectedVersion(v); setShowInstall(true) }}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
                  style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.25)' }}
                >
                  Install
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'gallery' && (
          <div>
            {(!project.gallery || project.gallery.length === 0) ? (
              <p className="text-white/25 text-xs text-center py-8">No gallery images</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {project.gallery.map((img, i) => (
                  <div key={i} className="rounded-xl overflow-hidden aspect-video bg-white/5">
                    <img src={img.url} alt={img.title || ''} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Install modal */}
      {showInstall && (
        <InstallModal
          project={project}
          versions={selectedVersion ? [selectedVersion, ...versions.filter(v => v.id !== selectedVersion.id)] : versions}
          projectType={projectType}
          onClose={() => setShowInstall(false)}
        />
      )}
    </div>
  )
}
