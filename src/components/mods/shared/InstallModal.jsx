import { useState, useEffect } from 'react'
import { useModrinthInstall } from '../modrinth/useModrinth'

const isElectron = typeof window !== 'undefined' && window.electronAPI

export default function InstallModal({ project, versions, projectType, onClose }) {
  const [profiles, setProfiles]         = useState([])
  const [selectedProfile, setProfile]   = useState(null)
  const [selectedVersion, setVersion]   = useState(null)
  const { install, installing, progress, error, done, reset } = useModrinthInstall()

  // Load profiles
  useEffect(() => {
    if (!isElectron) return
    window.electronAPI.getProfiles().then(data => {
      const list = data?.profiles || []
      setProfiles(list)
      setProfile(list.find(p => p.id === data?.selectedProfileId) || list[0] || null)
    })
  }, [])

  // Default to first version
  useEffect(() => {
    if (versions?.length > 0 && !selectedVersion) setVersion(versions[0])
  }, [versions])

  async function handleInstall() {
    if (!selectedVersion || !selectedProfile) return
    reset()
    await install({
      versionId:   selectedVersion.id,
      projectType,
      instancePath: selectedProfile.instancePath,
      accountId:   null, // install to shared mods folder
    })
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'rgba(14,14,14,0.98)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            {project?.icon_url && (
              <img src={project.icon_url} alt="" className="w-9 h-9 rounded-lg object-cover" />
            )}
            <div>
              <h3 className="text-white font-bold text-sm">{project?.title}</h3>
              <p className="text-white/30 text-xs capitalize">{projectType}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Version selector */}
          <div>
            <label className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-1.5 block">
              Version
            </label>
            <select
              value={selectedVersion?.id || ''}
              onChange={e => setVersion(versions.find(v => v.id === e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500/50"
            >
              {versions?.map(v => (
                <option key={v.id} value={v.id} style={{ background: '#1a1a1a' }}>
                  {v.version_number} — {v.game_versions?.join(', ')}
                </option>
              ))}
            </select>
          </div>

          {/* Profile selector */}
          <div>
            <label className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-1.5 block">
              Install to Profile
            </label>
            <select
              value={selectedProfile?.id || ''}
              onChange={e => setProfile(profiles.find(p => p.id === e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500/50"
            >
              {profiles.map(p => (
                <option key={p.id} value={p.id} style={{ background: '#1a1a1a' }}>
                  {p.name} ({p.gameVersion} · {p.loader})
                </option>
              ))}
            </select>
          </div>

          {/* Progress */}
          {installing && progress && (
            <div className="rounded-xl p-3 bg-white/3 border border-white/8">
              <p className="text-xs text-white/50 mb-1.5">{progress.log}</p>
              {progress.total > 0 && (
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-green-400 rounded-full transition-all duration-300"
                    style={{ width: `${progress.percent}%` }} />
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Done */}
          {done && (
            <div className="rounded-xl p-3 bg-green-500/10 border border-green-500/20 flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              <p className="text-xs text-green-400 font-semibold">Installed successfully!</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/50 hover:text-white transition-all border border-white/8 hover:bg-white/5">
              {done ? 'Close' : 'Cancel'}
            </button>
            {!done && (
              <button
                onClick={handleInstall}
                disabled={installing || !selectedVersion || !selectedProfile}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}
              >
                {installing ? 'Installing...' : 'Install'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
