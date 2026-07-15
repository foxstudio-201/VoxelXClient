import { useState, useEffect, useRef } from 'react'
import { useLang } from '../../i18n/LangProvider'

export function Toggle({ checked, onChange, id }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      id={id}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full
        border-2 border-transparent transition-colors duration-200
        focus:outline-none
        ${checked ? 'bg-orange-500' : 'bg-white/15'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow
          transform transition-transform duration-200
          ${checked ? 'translate-x-4' : 'translate-x-0'}
        `}
      />
    </button>
  )
}

export function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/80">{label}</p>
        {description && <p className="text-xs text-white/30 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

export function Section({ title, children }) {
  return (
    <div className="mb-6">
      <p className="text-xs uppercase tracking-widest text-white/40 mb-2 px-1">{title}</p>
      <div className="rounded-xl border border-white/5 bg-white/2 divide-y divide-white/5 px-4">
        {children}
      </div>
    </div>
  )
}

function formatBytes(b) {
  if (!b) return ''
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

const isElectron = typeof window !== 'undefined' && window.electronAPI

export function UpdateChecker() {
  const { t } = useLang()
  const [status, setStatus]         = useState('idle')
  const [result, setResult]         = useState(null)
  const [dlProgress, setDlProgress] = useState(null)
  const [errorMsg, setErrorMsg]     = useState('')
  const [reinstallStatus, setReinstallStatus] = useState('idle')
  const [reinstallProgress, setReinstallProgress] = useState(null)
  const [reinstallError, setReinstallError] = useState('')
  const unsubRef = useState(null)
  const unsubReinstallRef = useState(null)
  const checkedRef = useRef(false)

  useEffect(() => {
    if (checkedRef.current) return
    checkedRef.current = true
    handleCheck()
  }, [])

  useEffect(() => {
    if (!isElectron || !window.electronAPI.onReinstallProgress) return
    const unsub = window.electronAPI.onReinstallProgress(p => setReinstallProgress(p))
    unsubReinstallRef[0] = unsub
    return () => unsub?.()
  }, [])

  async function handleCheck() {
    setStatus('checking')
    setResult(null)
    setErrorMsg('')
    setDlProgress(null)
    try {
      const res = isElectron
        ? await window.electronAPI.checkUpdate()
        : { hasUpdate: false, currentVersion: '1.0.0', latestVersion: '1.0.0' }

      setResult(res)
      if (res.error) {
        setErrorMsg(res.message)
        setStatus('error')
      } else if (res.noRelease) {
        setStatus('noRelease')
      } else if (res.hasUpdate) {
        setStatus('updateAvailable')
        handleDownload(res)
      } else {
        setStatus('upToDate')
      }
    } catch (err) {
      setErrorMsg(t('settings.launcher.errorCheck'))
      setStatus('error')
    }
  }

  async function handleDownload(checkResult) {
    const r = checkResult || result
    if (!r?.installerAsset) {
      setErrorMsg(t('settings.launcher.errorNoInstaller'))
      setStatus('error')
      return
    }

    setStatus('downloading')
    setDlProgress({ percent: 0, downloaded: 0, total: r.installerAsset.size || 0, speed: 0 })

    const unsub = isElectron
      ? window.electronAPI.onDownloadProgress(p => setDlProgress(p))
      : null
    unsubRef[0] = unsub

    try {
      const res = isElectron
        ? await window.electronAPI.downloadUpdate({
            downloadUrl: r.installerAsset.downloadUrl,
            fileName:    r.installerAsset.name,
          })
        : { ok: true, filePath: '/tmp/fake.exe' }

      unsub?.()

      if (res?.error) {
        setErrorMsg(t('settings.launcher.errorDownload', { detail: res.error }))
        setStatus('error')
        return
      }

      setStatus('installing')
      await new Promise(r => setTimeout(r, 500))

      const installRes = isElectron
        ? await window.electronAPI.installUpdate({ filePath: res.filePath })
        : { ok: true }

      if (installRes?.error) {
        setErrorMsg(t('settings.launcher.errorInstall', { detail: installRes.error }))
        setStatus('error')
      }
    } catch (err) {
      unsub?.()
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  async function handleReinstall() {
    if (!isElectron) return
    setReinstallStatus('downloading')
    setReinstallProgress({ percent: 0 })
    setReinstallError('')
    try {
      const res = await window.electronAPI.reinstallCurrent()
      if (res?.error) {
        setReinstallError(res.error)
        setReinstallStatus('error')
        setReinstallProgress(null)
      } else {
        setReinstallStatus('installing')
      }
    } catch (err) {
      setReinstallError(err.message)
      setReinstallStatus('error')
      setReinstallProgress(null)
    }
  }

  return (
    <div className="py-3 space-y-3">
      {}
      {['idle', 'upToDate', 'noRelease', 'error'].includes(status) && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleCheck}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-400 text-white transition-all duration-150 active:scale-95"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            {t('settings.launcher.checkUpdate')}
          </button>

          {status === 'upToDate' && (
            <span className="text-xs text-white/40 flex items-center gap-1">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-orange-400">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              {t('settings.launcher.upToDate')}
            </span>
          )}
          {status === 'noRelease' && (
            <span className="text-xs text-yellow-400/60">{t('settings.launcher.noRelease')}</span>
          )}
          {status === 'error' && (
            <span className="text-xs text-red-400/80">{errorMsg}</span>
          )}
        </div>
      )}

      {}
      {status === 'checking' && (
        <div className="flex items-center gap-2 text-xs text-white/40">
          <svg className="animate-spin w-3.5 h-3.5 text-orange-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          {t('settings.launcher.checking')}
        </div>
      )}

      {}
      {status === 'updateAvailable' && result && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/8 px-3 py-2.5 flex items-center gap-2">
          <svg className="animate-spin w-3.5 h-3.5 text-orange-400 flex-shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span className="text-xs text-orange-400">
            {t('settings.launcher.updateAvailable', { version: result.latestVersion })}
          </span>
        </div>
      )}

      {}
      {status === 'downloading' && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/8 px-3 py-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-orange-400 font-semibold flex items-center gap-1.5">
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {t('settings.launcher.downloading')}
            </span>
            <span className="text-white/40 font-mono">{dlProgress?.percent ?? 0}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-orange-400 rounded-full transition-all duration-300"
              style={{ width: `${dlProgress?.percent ?? 0}%` }} />
          </div>
          <div className="flex items-center justify-between text-[10px] text-white/30">
            <span>
              {dlProgress?.downloaded ? formatBytes(dlProgress.downloaded) : '0 KB'}
              {dlProgress?.total ? ` / ${formatBytes(dlProgress.total)}` : ''}
            </span>
            {dlProgress?.speed > 0 && <span>{formatBytes(dlProgress.speed)}/s</span>}
          </div>
        </div>
      )}

      {}
      {status === 'installing' && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/8 px-3 py-2.5 flex items-center gap-2">
          <svg className="animate-spin w-3.5 h-3.5 text-orange-400 flex-shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span className="text-xs text-orange-400">{t('settings.launcher.installing')}</span>
        </div>
      )}

      {}
      <div className="pt-1 border-t border-white/5">
        <p className="text-[11px] text-white/30 mb-2">{t('settings.launcher.reinstallTitle')}</p>

        {['idle', 'error'].includes(reinstallStatus) && (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleReinstall}
              disabled={!isElectron}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white/8 hover:bg-white/12 text-white/60 hover:text-white transition-all duration-150 active:scale-95 border border-white/8 disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
              </svg>
              {t('settings.launcher.reinstall')}
            </button>
            {reinstallStatus === 'error' && (
              <span className="text-xs text-red-400/80">{reinstallError}</span>
            )}
          </div>
        )}

        {reinstallStatus === 'downloading' && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50 font-semibold flex items-center gap-1.5">
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                {t('settings.launcher.reinstallDownloading')}
              </span>
              <span className="text-white/40 font-mono">{reinstallProgress?.percent ?? 0}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-white/40 rounded-full transition-all duration-300"
                style={{ width: `${reinstallProgress?.percent ?? 0}%` }} />
            </div>
          </div>
        )}

        {reinstallStatus === 'installing' && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 flex items-center gap-2">
            <svg className="animate-spin w-3.5 h-3.5 text-white/50 flex-shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="text-xs text-white/50">{t('settings.launcher.reinstallInstalling')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
