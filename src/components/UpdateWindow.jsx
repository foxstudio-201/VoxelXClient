import { useState, useEffect, useRef } from 'react'

const isElectron = typeof window !== 'undefined' && window.electronAPI

function formatBytes(b) {
  if (!b) return ''
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

// status: idle | checking | upToDate | noRelease | updateAvailable | downloading | installing | error
export default function UpdateWindow() {
  const [status, setStatus]     = useState('idle')
  const [result, setResult]     = useState(null)   // check result
  const [version, setVersion]   = useState('')
  const [dlProgress, setDlProgress] = useState(null) // { percent, downloaded, total, speed }
  const [errorMsg, setErrorMsg] = useState('')
  const unsubRef = useRef(null)

  useEffect(() => {
    if (isElectron) window.electronAPI.getVersion().then(setVersion)
    else setVersion('1.0.0')

    // Subscribe to download progress
    if (isElectron) {
      unsubRef.current = window.electronAPI.onDownloadProgress(p => setDlProgress(p))
    }

    // Listen for pre-loaded check result from splash (auto-start download)
    let unsubPreload = null
    if (isElectron && window.electronAPI.onUpdaterPreloadResult) {
      unsubPreload = window.electronAPI.onUpdaterPreloadResult((res) => {
        setResult(res)
        if (res?.hasUpdate) {
          setStatus('updateAvailable')
          // Auto-start download immediately
          handleDownload(res)
        } else {
          setStatus('upToDate')
        }
      })
    }

    return () => {
      unsubRef.current?.()
      unsubPreload?.()
    }
  }, [])

  // Auto-check on open only if not opened from splash (no preload result)
  useEffect(() => {
    // Small delay to allow preload result to arrive first
    const t = setTimeout(() => {
      if (status === 'idle') handleCheck()
    }, 800)
    return () => clearTimeout(t)
  }, [])

  async function handleCheck() {
    setStatus('checking')
    setResult(null)
    setErrorMsg('')
    setDlProgress(null)
    try {
      const res = isElectron
        ? await window.electronAPI.checkUpdate()
        : { hasUpdate: false, currentVersion: '1.0.0', latestVersion: '1.0.0', message: 'Bạn đang dùng phiên bản mới nhất.' }

      setResult(res)
      if (res.error) {
        setErrorMsg(res.message)
        setStatus('error')
      } else if (res.noRelease) {
        setStatus('noRelease')
      } else if (res.hasUpdate) {
        setStatus('updateAvailable')
        // Do NOT auto-download — let user click the button
      } else {
        setStatus('upToDate')
      }
    } catch (err) {
      setErrorMsg('Không thể kiểm tra cập nhật. Vui lòng thử lại.')
      setStatus('error')
    }
  }

  async function handleDownload(checkResult) {
    const r = checkResult || result
    if (!r?.installerAsset) {
      setErrorMsg('Không tìm thấy file cài đặt cho hệ điều hành này.')
      setStatus('error')
      return
    }

    setStatus('downloading')
    setDlProgress({ percent: 0, downloaded: 0, total: r.installerAsset.size || 0, speed: 0 })

    try {
      const res = isElectron
        ? await window.electronAPI.downloadUpdate({
            downloadUrl: r.installerAsset.downloadUrl,
            fileName:    r.installerAsset.name,
          })
        : { ok: true, filePath: '/tmp/fake.exe' }

      if (res?.error) {
        setErrorMsg(`Tải thất bại: ${res.error}`)
        setStatus('error')
        return
      }

      // Download done — install immediately
      setStatus('installing')
      await new Promise(r => setTimeout(r, 600)) // brief pause for UI

      const installRes = isElectron
        ? await window.electronAPI.installUpdate({ filePath: res.filePath })
        : { ok: true }

      if (installRes?.error) {
        setErrorMsg(`Cài đặt thất bại: ${installRes.error}`)
        setStatus('error')
      }
      // App will quit and installer will run — no further UI needed
    } catch (err) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  function handleClose() {
    if (isElectron) window.electronAPI.closeWindow()
  }

  function openUrl(url) {
    if (isElectron) window.electronAPI.openExternal(url)
    else window.open(url, '_blank')
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
            Cập nhật VoxelXClient
          </span>
        </div>
        <button onClick={handleClose}
          className="no-drag w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/80 text-white/40 hover:text-white transition-all">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 overflow-y-auto py-8">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400/20 to-emerald-600/20 border border-green-500/20 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9">
            <rect x="2"  y="2"  width="9" height="9" fill="#4ade80" rx="1.5"/>
            <rect x="13" y="2"  width="9" height="9" fill="#22c55e" rx="1.5"/>
            <rect x="2"  y="13" width="9" height="9" fill="#16a34a" rx="1.5"/>
            <rect x="13" y="13" width="9" height="9" fill="#4ade80" rx="1.5"/>
          </svg>
        </div>

        <div className="text-center flex-shrink-0">
          <h1 className="text-lg font-bold text-white">VoxelXClient</h1>
          <p className="text-xs text-white/30 mt-1">
            Phiên bản hiện tại: <span className="text-white/50 font-mono">{version || '...'}</span>
          </p>
        </div>

        {/* Status card */}
        <div className="w-full max-w-sm">

          {/* Checking */}
          {status === 'checking' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <svg className="animate-spin w-7 h-7 text-green-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <p className="text-sm text-white/40">Đang kiểm tra cập nhật...</p>
            </div>
          )}

          {/* Up to date */}
          {status === 'upToDate' && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-center">
              <div className="w-10 h-10 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center mx-auto mb-3">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-green-400">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-white/70">Bạn đang dùng phiên bản mới nhất</p>
              <p className="text-xs text-white/30 mt-1 font-mono">{result?.currentVersion}</p>
            </div>
          )}

          {/* No release yet */}
          {status === 'noRelease' && (
            <div className="rounded-xl border border-yellow-500/15 bg-yellow-500/5 p-5 text-center">
              <p className="text-sm text-yellow-400/80 font-semibold">Chưa có bản phát hành nào</p>
              <p className="text-xs text-white/30 mt-1">Phiên bản hiện tại là bản mới nhất.</p>
            </div>
          )}

          {/* Update available — user clicks to download */}
          {status === 'updateAvailable' && result && (
            <div className="rounded-xl border border-green-500/20 bg-green-500/8 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-green-400">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-green-400">Có phiên bản mới!</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    <span className="font-mono">{result.currentVersion}</span>
                    <span className="mx-1.5 text-white/20">→</span>
                    <span className="text-green-400 font-mono font-bold">{result.latestVersion}</span>
                  </p>
                </div>
              </div>
              {result.installerAsset ? (
                <button onClick={() => handleDownload(result)}
                  className="w-full py-2.5 rounded-xl text-sm font-bold bg-green-500 hover:bg-green-400 text-white transition-all active:scale-95 flex items-center justify-center gap-2">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                  </svg>
                  Tải & Cài đặt v{result.latestVersion}
                </button>
              ) : (
                <button onClick={() => openUrl(result.releaseUrl)}
                  className="w-full py-2.5 rounded-xl text-sm font-bold bg-white/10 hover:bg-white/15 text-white transition-all active:scale-95 flex items-center justify-center gap-2">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                  </svg>
                  Mở trang tải xuống
                </button>
              )}
            </div>
          )}

          {/* Downloading */}
          {status === 'downloading' && (
            <div className="rounded-xl border border-green-500/20 bg-green-500/8 p-5">
              <div className="flex items-center gap-2 mb-4">
                <svg className="animate-spin w-4 h-4 text-green-400 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <p className="text-sm font-semibold text-white/80">Đang tải bản cập nhật...</p>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-green-400 rounded-full transition-all duration-300"
                  style={{ width: `${dlProgress?.percent ?? 0}%` }} />
              </div>

              <div className="flex items-center justify-between text-xs text-white/30">
                <span>
                  {dlProgress?.downloaded ? formatBytes(dlProgress.downloaded) : '0 KB'}
                  {dlProgress?.total ? ` / ${formatBytes(dlProgress.total)}` : ''}
                </span>
                <div className="flex items-center gap-3">
                  {dlProgress?.speed > 0 && (
                    <span>{formatBytes(dlProgress.speed)}/s</span>
                  )}
                  <span className="font-mono font-bold text-white/50">{dlProgress?.percent ?? 0}%</span>
                </div>
              </div>

              {result?.installerAsset && (
                <p className="text-[10px] text-white/20 mt-2 truncate">{result.installerAsset.name}</p>
              )}
            </div>
          )}

          {/* Installing */}
          {status === 'installing' && (
            <div className="rounded-xl border border-green-500/20 bg-green-500/8 p-5 text-center">
              <svg className="animate-spin w-7 h-7 text-green-400 mx-auto mb-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <p className="text-sm font-bold text-green-400">Đang khởi chạy trình cài đặt...</p>
              <p className="text-xs text-white/30 mt-1">Ứng dụng sẽ đóng và tự động cập nhật.</p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/8 p-5 text-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-red-400 mx-auto mb-2">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <p className="text-sm text-red-400">{errorMsg}</p>
              <button onClick={handleCheck}
                className="mt-3 text-xs text-white/40 hover:text-white/70 transition-colors">
                Thử lại
              </button>
            </div>
          )}
        </div>

        {/* Manual check button — only show when idle/error/upToDate/noRelease */}
        {['idle', 'upToDate', 'noRelease', 'error'].includes(status) && (
          <button onClick={handleCheck}
            className="px-8 py-2.5 rounded-xl text-sm font-bold bg-green-500 hover:bg-green-400 text-white transition-all duration-200 active:scale-95 flex-shrink-0">
            Kiểm tra lại
          </button>
        )}

        {/* Source link */}
        <button onClick={() => openUrl('https://github.com/foxstudio-201/VoxelXClient')}
          className="text-[10px] text-white/15 hover:text-white/35 transition-colors flex-shrink-0">
          foxstudio-201/VoxelXClient
        </button>
      </div>
    </div>
  )
}
