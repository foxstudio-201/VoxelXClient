import { useState, useEffect } from 'react'

const isElectron = typeof window !== 'undefined' && window.electronAPI

export default function UpdateWindow() {
  const [status, setStatus]   = useState('idle')   // idle | checking | done
  const [result, setResult]   = useState(null)
  const [version, setVersion] = useState('')

  useEffect(() => {
    if (isElectron) {
      window.electronAPI.getVersion().then(setVersion)
    } else {
      setVersion('1.0.0')
    }
  }, [])

  async function handleCheck() {
    setStatus('checking')
    setResult(null)
    try {
      const res = isElectron
        ? await window.electronAPI.checkUpdate()
        : await new Promise(r => setTimeout(() => r({
            hasUpdate: false,
            currentVersion: '1.0.0',
            latestVersion: '1.0.0',
            message: 'Bạn đang dùng phiên bản mới nhất.',
          }), 1500))
      setResult(res)
    } catch {
      setResult({ error: true, message: 'Không thể kiểm tra cập nhật. Vui lòng thử lại.' })
    }
    setStatus('done')
  }

  function handleClose() {
    if (isElectron) window.electronAPI.closeWindow()
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-[#0f0f0f] overflow-hidden select-none">
      {/* Title bar */}
      <div className="drag-region flex items-center justify-between h-9 px-4 bg-black/40 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2 no-drag">
          <div className="w-4 h-4">
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
              <rect x="2"  y="2"  width="9" height="9" fill="#4ade80" rx="1"/>
              <rect x="13" y="2"  width="9" height="9" fill="#22c55e" rx="1"/>
              <rect x="2"  y="13" width="9" height="9" fill="#16a34a" rx="1"/>
              <rect x="13" y="13" width="9" height="9" fill="#4ade80" rx="1"/>
            </svg>
          </div>
          <span className="text-xs font-semibold text-white/50 tracking-widest uppercase">
            Kiểm tra cập nhật
          </span>
        </div>
        <button
          onClick={handleClose}
          className="no-drag w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/80 text-white/40 hover:text-white transition-all"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6"  y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
        {/* Logo */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400/20 to-emerald-600/20 border border-green-500/20 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
            <rect x="2"  y="2"  width="9" height="9" fill="#4ade80" rx="1.5"/>
            <rect x="13" y="2"  width="9" height="9" fill="#22c55e" rx="1.5"/>
            <rect x="2"  y="13" width="9" height="9" fill="#16a34a" rx="1.5"/>
            <rect x="13" y="13" width="9" height="9" fill="#4ade80" rx="1.5"/>
          </svg>
        </div>

        <div className="text-center">
          <h1 className="text-lg font-bold text-white">VoxelXClient</h1>
          <p className="text-xs text-white/30 mt-1">
            Phiên bản hiện tại: <span className="text-white/50 font-mono">{version || '...'}</span>
          </p>
        </div>

        {/* Status area */}
        <div className="w-full">
          {status === 'idle' && (
            <p className="text-center text-sm text-white/30">
              Nhấn nút bên dưới để kiểm tra phiên bản mới nhất.
            </p>
          )}

          {status === 'checking' && (
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin w-6 h-6 text-green-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <p className="text-sm text-white/40">Đang kiểm tra...</p>
            </div>
          )}

          {status === 'done' && result && (
            <div className={`
              rounded-xl border p-4 text-center
              ${result.error
                ? 'bg-red-500/10 border-red-500/20'
                : result.hasUpdate
                  ? 'bg-green-500/10 border-green-500/20'
                  : 'bg-white/5 border-white/10'
              }
            `}>
              {result.error ? (
                <>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-red-400 mx-auto mb-2">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                  <p className="text-sm text-red-400">{result.message}</p>
                </>
              ) : result.hasUpdate ? (
                <>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-green-400 mx-auto mb-2">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                  </svg>
                  <p className="text-sm font-semibold text-green-400">Có phiên bản mới!</p>
                  <p className="text-xs text-white/40 mt-1">
                    {result.currentVersion} → <span className="text-green-400">{result.latestVersion}</span>
                  </p>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white/40 mx-auto mb-2">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  <p className="text-sm text-white/60">{result.message}</p>
                  <p className="text-xs text-white/25 mt-1 font-mono">{result.currentVersion}</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Button */}
        <button
          onClick={handleCheck}
          disabled={status === 'checking'}
          className="
            px-8 py-2.5 rounded-xl text-sm font-bold
            bg-green-500 hover:bg-green-400 text-white
            transition-all duration-200 active:scale-95
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          {status === 'checking' ? 'Đang kiểm tra...' : 'Kiểm tra ngay'}
        </button>
      </div>
    </div>
  )
}
