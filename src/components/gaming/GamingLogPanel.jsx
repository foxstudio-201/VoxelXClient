import { useEffect, useRef } from 'react'

export default function GamingLogPanel({ visible, logs = [], onClose }) {
  const logEndRef = useRef(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

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
      className={`w-full h-full transition-all duration-500 ease-out ${
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
      <div
        className="h-[calc(100%-41px)] overflow-y-auto p-3 font-mono text-[11px] leading-relaxed"
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
            return (
              <div key={i} className="py-[1px] whitespace-pre-wrap break-all">
                <span
                  className={`${
                    isLauncher ? 'text-cyan-400' : isError ? 'text-red-400' : isWarn ? 'text-yellow-400' : 'text-white/60'
                  }`}
                >
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
