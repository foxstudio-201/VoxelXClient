import { useEffect, useRef, useMemo } from 'react'

const PHASE_ORDER = ['resolve', 'java', 'assets']

const LOADER_PHASES = {
  fabric:    ['fabric', 'fabric_mods'],
  forge:     ['forge'],
  neoforge:  ['neoforge'],
}

const PHASE_DEFS = {
  resolve:      { label: 'Version info' },
  java:         { label: 'Java runtime' },
  assets:       { label: 'Game assets' },
  fabric:       { label: 'Fabric loader' },
  forge:        { label: 'Forge loader' },
  neoforge:     { label: 'NeoForge loader' },
  fabric_mods:  { label: 'Fabric mods' },
  launching:    { label: 'Launching' },
}

function getTaskPhases(loader) {
  const loaderExtra = LOADER_PHASES[loader] || []
  return [...PHASE_ORDER, ...loaderExtra, 'launching']
}

const TERMINAL_PHASES = ['running', 'error']

export default function GamingLogPanel({ visible, logs = [], onClose, progress, loader }) {
  const logEndRef = useRef(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const tasks = useMemo(() => {
    const phases = getTaskPhases(loader)
    const currentPhase = progress?.phase || ''
    const currentPercent = progress?.percent ?? 0
    const error = currentPhase === 'error'
    const isFinished = TERMINAL_PHASES.includes(currentPhase)

    return phases.map((phase, idx) => {
      const thisIdx = idx
      const curPhaseIdx = isFinished ? phases.length : phases.indexOf(currentPhase)

      const isDone = !error && (thisIdx < curPhaseIdx)
      const isActive = !error && !isFinished && thisIdx === curPhaseIdx
      const isFailed = error && thisIdx <= curPhaseIdx

      let status = 'pending'
      let statusBadge = null
      if (isFailed) {
        status = 'error'
        statusBadge = { text: '✗', cls: 'bg-red-500 text-white' }
      } else if (isDone || isFinished) {
        status = 'done'
        statusBadge = { text: '✓', cls: 'bg-green-500 text-black' }
      } else if (isActive) {
        status = 'active'
        if (phase === 'assets' && progress?.totalFiles) {
          const d = progress.doneFiles || 0
          const t = progress.totalFiles
          statusBadge = d >= t
            ? { text: '✓', cls: 'bg-green-500 text-black' }
            : { text: `${d}/${t}`, cls: 'bg-orange-500/20 text-orange-300 border border-orange-500/40' }
        } else if (currentPercent > 0 && phase !== 'launching') {
          statusBadge = { text: `${Math.round(currentPercent)}%`, cls: 'bg-orange-500/20 text-orange-300 border border-orange-500/40' }
        } else {
          statusBadge = { text: '↻', cls: 'bg-orange-500/20 text-orange-300 border border-orange-500/40' }
        }
      }

      const border = status === 'active' ? 'border border-dashed border-orange-500/60 bg-orange-500/[0.04]'
        : status === 'done'  ? 'border border-solid border-green-500/40 bg-green-500/[0.04]'
        : status === 'error' ? 'border border-solid border-red-500/40 bg-red-500/[0.04]'
        : 'border border-solid border-white/[0.06]'

      const numCls = status === 'active' ? 'bg-orange-500 text-black'
        : status === 'done'  ? 'bg-green-500 text-black'
        : status === 'error' ? 'bg-red-500 text-white'
        : 'bg-white/[0.08] text-white/35'

      const labelCls = status === 'active' ? 'text-orange-200'
        : status === 'done'  ? 'text-green-200'
        : status === 'error' ? 'text-red-300'
        : 'text-white/40'

      return { phase, ...PHASE_DEFS[phase], idx: idx + 1, status, statusBadge, numCls, labelCls, border }
    })
  }, [progress, loader])

  return (
    <div
      className="fixed z-40"
      style={{
        top: '48px',
        bottom: '12px',
        left: '8px',
        width: '33.333%',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
    <div
      className={`w-full h-full flex flex-col transition-all duration-500 ease-out ${
        visible ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
      }`}
      style={{
        pointerEvents: visible ? 'auto' : 'none',
        background: 'rgba(8,8,10,0.96)',
        borderRight: visible ? '1px solid rgba(255,255,255,0.06)' : 'none',
        borderRadius: '14px',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex w-2 h-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs font-semibold text-white/60">Console</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => navigator.clipboard.writeText(logs.join('\n'))}
            className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/30 hover:text-white/60 transition-all"
            title="Copy logs"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/30 hover:text-white/60 transition-all"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Tasks */}
      <div className="flex-shrink-0 overflow-y-auto px-4 py-3 border-b border-white/5 space-y-2 max-h-[40%]">
        {tasks.map((task) => (
          <div
            key={task.phase}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${task.border}`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${task.numCls}`}>
              {task.idx}
            </span>
            <span className={`truncate ${task.labelCls}`}>
              {task.label}
            </span>
            {task.statusBadge && (
              <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${task.statusBadge.cls}`}>
                {task.statusBadge.text}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Logs */}
      <div
        className="flex-1 min-h-0 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed"
        style={{ scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}
      >
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-white/20 text-[11px]">Waiting for logs...</span>
          </div>
        ) : (
          logs.map((line, i) => {
            const isLauncher = line.startsWith('[Launcher]')
            const isError = line.startsWith('[ERR]')
            const isWarn = line.startsWith('[WARN]')
            if (isLauncher) {
              const bracket = line.match(/^(\[Launcher\])\s*/)
              if (bracket) {
                const prefix = bracket[0]
                const rest = line.slice(prefix.length)
                return (
                  <div key={i} className="py-[1px] whitespace-pre-wrap break-all">
                    <span className="text-green-400">{prefix}</span>
                    <span className="text-white/60">{rest}</span>
                  </div>
                )
              }
            }
            return (
              <div key={i} className="py-[1px] whitespace-pre-wrap break-all">
                <span className={`${isError ? 'text-red-400' : isWarn ? 'text-yellow-400' : 'text-white/60'}`}>
                  {line}
                </span>
              </div>
            )
          })
        )}
        <div ref={logEndRef} />
      </div>
    </div>
    </div>
  )
}
