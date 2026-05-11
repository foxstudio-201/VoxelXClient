import { useState } from 'react'

const isElectron = typeof window !== 'undefined' && window.electronAPI

// ─── Instance Manager Modal ───────────────────────────────────────────────────
function InstanceModal({ instances, onKill, onClose }) {
  const runningInstances = instances.filter(i => i.state === 'running' || i.state === 'downloading')

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-12"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-[420px] bg-[#141414] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <h3 className="text-sm font-bold text-white">Running Instances</h3>
            <span className="text-xs text-white/30 bg-white/8 px-1.5 py-0.5 rounded-md font-mono">
              {runningInstances.length}
            </span>
          </div>
          <button onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-md text-white/30 hover:text-white/70 hover:bg-white/8 transition-all">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="px-3 py-3 flex flex-col gap-2 max-h-80 overflow-y-auto">
          {instances.length === 0 ? (
            <p className="text-xs text-white/25 text-center py-6">No instances running</p>
          ) : (
            instances.map(inst => {
              const isRunning = inst.state === 'running'
              const isLoading = inst.state === 'downloading'
              const isStopped = inst.state === 'stopped'
              const isError   = inst.state === 'error'

              return (
                <div key={inst.key}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/4 border border-white/5">
                  {/* Status indicator */}
                  <div className="flex-shrink-0">
                    {isRunning && <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse block" />}
                    {isLoading && (
                      <svg className="animate-spin w-2.5 h-2.5 text-yellow-400" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    )}
                    {isStopped && <span className="w-2.5 h-2.5 rounded-full bg-white/20 block" />}
                    {isError   && <span className="w-2.5 h-2.5 rounded-full bg-red-400 block" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{inst.profileName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-white/35">@{inst.accountName}</span>
                      <span className="text-[10px] text-white/20">·</span>
                      <span className={`text-[10px] font-semibold ${
                        isRunning ? 'text-green-400' :
                        isLoading ? 'text-yellow-400' :
                        isStopped ? 'text-white/30' : 'text-red-400'
                      }`}>
                        {isRunning ? 'Running' : isLoading ? 'Loading...' : isStopped ? 'Stopped' : 'Error'}
                      </span>
                      {isLoading && inst.progress?.percent > 0 && (
                        <span className="text-[10px] text-white/25 font-mono">{inst.progress.percent}%</span>
                      )}
                    </div>
                  </div>

                  {/* Kill button */}
                  {(isRunning || isLoading) && (
                    <button
                      onClick={() => onKill(inst.key)}
                      className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-all active:scale-95"
                      title="Kill instance"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                      </svg>
                      Kill
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ─── TitleBar ─────────────────────────────────────────────────────────────────
export default function TitleBar({ instances = [], onKillInstance }) {
  const [showModal, setShowModal] = useState(false)

  const handleMinimize = () => isElectron && window.electronAPI.minimizeWindow()
  const handleMaximize = () => isElectron && window.electronAPI.maximizeWindow()
  const handleClose    = () => isElectron && window.electronAPI.closeWindow()

  const runningCount = instances.filter(i => i.state === 'running' || i.state === 'downloading').length

  return (
    <>
      <div className="drag-region flex items-center justify-between h-9 px-4 bg-black/40 backdrop-blur-sm border-b border-white/5 absolute top-0 left-0 right-0 z-50">
        {/* Logo / App name */}
        <div className="flex items-center gap-2 no-drag">
          <div className="w-5 h-5">
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
              <rect x="2"  y="2"  width="9" height="9" fill="#4ade80" rx="1"/>
              <rect x="13" y="2"  width="9" height="9" fill="#22c55e" rx="1"/>
              <rect x="2"  y="13" width="9" height="9" fill="#16a34a" rx="1"/>
              <rect x="13" y="13" width="9" height="9" fill="#4ade80" rx="1"/>
            </svg>
          </div>
          <span className="text-ms font-black text-white tracking-tight">
            VoxelX<span className="text-green-400">Client</span>
          </span>
        </div>

        {/* Center — instance status badge */}
        <div className="absolute left-1/2 -translate-x-1/2 no-drag">
          {runningCount > 0 ? (
            <button
              onClick={() => setShowModal(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/15 border border-green-500/25 text-green-400 text-xs font-semibold hover:bg-green-500/22 transition-all active:scale-95"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              {runningCount} instance{runningCount > 1 ? 's' : ''} running
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-green-400/60">
                <path d="M7 10l5 5 5-5z"/>
              </svg>
            </button>
          ) : instances.length > 0 ? (
            <button
              onClick={() => setShowModal(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/30 text-xs hover:bg-white/8 transition-all"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
              {instances.length} instance{instances.length > 1 ? 's' : ''}
            </button>
          ) : null}
        </div>

        {/* Window controls */}
        <div className="no-drag flex items-center gap-1">
          <button onClick={handleMinimize}
            className="w-8 h-7 flex items-center justify-center rounded hover:bg-white/10 transition-colors text-white/50 hover:text-white/90"
            title="Minimize">
            <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor"><rect width="10" height="1"/></svg>
          </button>
          <button onClick={handleMaximize}
            className="w-8 h-7 flex items-center justify-center rounded hover:bg-white/10 transition-colors text-white/50 hover:text-white/90"
            title="Maximize">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0.5" y="0.5" width="9" height="9"/>
            </svg>
          </button>
          <button onClick={handleClose}
            className="w-8 h-7 flex items-center justify-center rounded hover:bg-red-500/80 transition-colors text-white/50 hover:text-white"
            title="Close">
            <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.5">
              <line x1="0" y1="0" x2="10" y2="10"/>
              <line x1="10" y1="0" x2="0" y2="10"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Instance modal */}
      {showModal && (
        <InstanceModal
          instances={instances}
          onKill={(key) => { onKillInstance?.(key) }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
