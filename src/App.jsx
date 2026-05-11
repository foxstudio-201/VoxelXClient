import { useState, useEffect, useRef, useCallback } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import HomePage from './components/HomePage'
import AccountPage from './components/account/AccountPage'
import SettingsPage from './components/settings/SettingsPage'
import PlayPage from './components/play/PlayPage'
import Toast from './components/Toast'
import NoAccountHint from './components/NoAccountHint'
import UpdateWindow from './components/UpdateWindow'
import SplashScreen from './components/SplashScreen'
import AppBackground from './components/AppBackground'
import { ToastContext, useToastState } from './hooks/useToast'
import { AccountsProvider, useAccounts } from './hooks/useAccounts'

import ModsPage from './components/mods/ModsPage'
import ServerPage from './components/server/ServerPage'

const isElectron = typeof window !== 'undefined' && window.electronAPI

function PlaceholderPage({ title }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4 opacity-10"></div>
        <h2 className="text-xl font-bold text-white/30">{title}</h2>
        <p className="text-sm text-white/20 mt-1">Coming soon</p>
      </div>
    </div>
  )
}

function AppInner() {
  const [activePage, setActivePage] = useState('home')
  const { selectedAccount, accounts, loading } = useAccounts()

  // ── Multi-instance launch state ──
  // instances: Map<key, { key, profileId, accountId, profileName, accountName, state, progress, logs }>
  const [instances, setInstances] = useState(new Map())
  // Single-profile launch state (for the currently selected profile's progress in hero)
  const [launchState, setLaunchState] = useState('idle')
  const [progress, setProgress]       = useState(null)
  const [launchError, setLaunchError] = useState(null)
  const [activeKey, setActiveKey]     = useState(null)
  // Server Java download progress — persists across page navigation
  const [serverJavaProgress, setServerJavaProgress] = useState({}) // key of profile being launched
  const cleanupRef = useRef([])

  const updateInstance = useCallback((key, patch) => {
    setInstances(prev => {
      const next = new Map(prev)
      const cur  = next.get(key) || {}
      next.set(key, { ...cur, ...patch })
      return next
    })
  }, [])

  // Subscribe IPC listeners once at App level
  useEffect(() => {
    if (!isElectron) return

    // Cleanup any previous listeners before registering new ones
    cleanupRef.current.forEach(fn => fn?.())
    cleanupRef.current = []

    const unsubProgress = window.electronAPI.onLaunchProgress((data) => {
      setProgress(data)
      if (data.phase === 'running') {
        setLaunchState('running')
      }
      if (data.phase === 'error') {
        setLaunchState('error')
        setLaunchError(data.error || data.log)
      }
      // Update progress in instance — use functional update to always get latest activeKey
      setActiveKey(currentKey => {
        if (currentKey) {
          setInstances(prev => {
            const next = new Map(prev)
            const cur  = next.get(currentKey)
            if (cur) {
              const newState = data.phase === 'error'   ? 'error'       :
                               data.phase === 'running'  ? 'running'     : 'downloading'
              // Also append error/warning log lines from progress events
              const extraLog = (data.phase === 'error' && (data.error || data.log))
                ? [`[ERR] ${data.error || data.log}`]
                : []
              next.set(currentKey, {
                ...cur,
                progress: data,
                state: newState,
                logs: extraLog.length > 0
                  ? [...(cur.logs || []).slice(-499), ...extraLog]
                  : cur.logs,
              })
            }
            return next
          })
        }
        return currentKey
      })
    })

    const unsubLog = window.electronAPI.onLaunchLog((data) => {
      setActiveKey(currentKey => {
        if (currentKey) {
          setInstances(prev => {
            const next = new Map(prev)
            const cur  = next.get(currentKey)
            if (cur) {
              next.set(currentKey, { ...cur, logs: [...(cur.logs || []).slice(-1999), data.line] })
            }
            return next
          })
        }
        return currentKey
      })
    })

    const unsubLogUpdate = window.electronAPI.onLaunchLogUpdate?.((data) => {
      setActiveKey(currentKey => {
        if (currentKey) {
          setInstances(prev => {
            const next = new Map(prev)
            const cur  = next.get(currentKey)
            if (cur) {
              const logs = cur.logs || []
              // Replace the last line if it exists, otherwise append
              const updated = logs.length > 0
                ? [...logs.slice(0, -1), data.line]
                : [data.line]
              next.set(currentKey, { ...cur, logs: updated })
            }
            return next
          })
        }
        return currentKey
      })
    })

    const unsubStop = window.electronAPI.onGameStopped((data) => {
      // The real key from main process: profileId::accountId
      const realKey = data?.profileId && data?.accountId
        ? `${data.profileId}::${data.accountId}`
        : null

      setInstances(prev => {
        const next = new Map(prev)

        // Try real key first
        if (realKey && next.has(realKey)) {
          next.set(realKey, { ...next.get(realKey), state: 'stopped' })
          setTimeout(() => setInstances(p => { const n = new Map(p); n.delete(realKey); return n }), 3000)
          return next
        }

        // Fallback: find by profileId (handles pending key case)
        if (data?.profileId) {
          for (const [k, inst] of next) {
            if (inst.profileId === data.profileId) {
              next.set(k, { ...inst, state: 'stopped' })
              setTimeout(() => setInstances(p => { const n = new Map(p); n.delete(k); return n }), 3000)
              break
            }
          }
        }
        return next
      })

      // Reset hero state
      setLaunchState('idle')
      setProgress(null)
      setLaunchError(null)
      setActiveKey(null)
    })

    cleanupRef.current = [unsubProgress, unsubLog, unsubLogUpdate, unsubStop]
    return () => { cleanupRef.current.forEach(fn => fn?.()) }
  }, []) // no deps — uses functional setState to always get latest values

  const handleLaunch = useCallback(async (profileId, ramMb, profileName, accountName) => {
    if (!isElectron) return
    setLaunchState('downloading')
    setLaunchError(null)
    setProgress({ phase: 'starting', log: 'Preparing...', percent: 0 })

    // We don't know accountId yet — will be set when progress comes back
    // Use a temp key based on profileId
    const tempKey = `${profileId}::pending`
    setActiveKey(tempKey)
    setInstances(prev => {
      const next = new Map(prev)
      next.set(tempKey, {
        key: tempKey, profileId, accountId: null,
        profileName: profileName || profileId,
        accountName: accountName || '',
        state: 'downloading', progress: null, logs: [],
      })
      return next
    })

    const result = await window.electronAPI.launchGame({ profileId, ramMb })
    if (result?.error) {
      setLaunchError(result.error)
      setLaunchState('error')
      setProgress({ phase: 'error', log: result.error, percent: 0 })
      updateInstance(tempKey, {
        state: 'error',
        logs: [`[ERR] ${result.error}`],
      })
    }
  }, [updateInstance])

  const handleLaunchReset = useCallback(() => {
    setLaunchState('idle')
    setLaunchError(null)
    setProgress(null)
    if (activeKey) {
      setInstances(prev => { const next = new Map(prev); next.delete(activeKey); return next })
      setActiveKey(null)
    }
  }, [activeKey])

  const handleKillInstance = useCallback((key) => {
    if (!isElectron) return
    const inst = instances.get(key)
    if (!inst) return
    window.electronAPI.stopGame({ profileId: inst.profileId, accountId: inst.accountId })
  }, [instances])

  const showHint = !loading && accounts.length === 0 && activePage === 'home'
  const instanceList = Array.from(instances.values())

  // AccountPage chứa WebGL Canvas — giữ mount thường trực, chỉ ẩn/hiện bằng CSS
  // để tránh "Context Lost" khi unmount Canvas đột ngột
  function renderPage() {
    return (
      <>
        {/* Pages không có WebGL — mount/unmount bình thường */}
        {activePage === 'home' && (
          <HomePage
            onNavigate={setActivePage}
            launchState={launchState}
            progress={progress}
            launchError={launchError}
            onLaunch={handleLaunch}
            onLaunchReset={handleLaunchReset}
            instances={instanceList}
            onKillInstance={handleKillInstance}
          />
        )}
        {activePage === 'play'     && <PlayPage />}
        {activePage === 'mods'     && <ModsPage />}
        {activePage === 'worlds'   && <ServerPage serverJavaProgress={serverJavaProgress} onServerJavaProgress={setServerJavaProgress} />}
        {activePage === 'settings' && <SettingsPage />}

        {/* AccountPage — luôn mount, ẩn bằng CSS khi không active */}
        <div
          style={{ display: activePage === 'account' ? 'flex' : 'none' }}
          className="flex-1 h-full overflow-hidden"
        >
          <AccountPage />
        </div>
      </>
    )
  }

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden relative z-10" style={{ background: 'transparent' }}>
      <TitleBar instances={instanceList} onKillInstance={handleKillInstance} />
      <div className="flex flex-1 overflow-hidden mt-9 relative">
        <Sidebar
          activePage={activePage}
          onNavigate={setActivePage}
          selectedAccount={selectedAccount}
        />
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {renderPage()}
        </main>
        {showHint && (
          <NoAccountHint onGoToAccount={() => setActivePage('account')} />
        )}
      </div>
    </div>
  )
}

export default function App() {
  const toastState = useToastState()
  const [splashDone, setSplashDone] = useState(false)
  const [bgId, setBgId] = useState('dark')

  // Load bgId từ settings khi mount
  useEffect(() => {
    const isElectron = typeof window !== 'undefined' && window.electronAPI
    if (isElectron) {
      window.electronAPI.getSettings().then(s => {
        if (s?.background) setBgId(s.background)
      }).catch(() => {})
    } else {
      try {
        const raw = localStorage.getItem('vxc_settings')
        if (raw) { const s = JSON.parse(raw); if (s.background) setBgId(s.background) }
      } catch {}
    }
    // Lắng nghe thay đổi từ SettingsPage qua custom event
    const handler = (e) => setBgId(e.detail)
    window.addEventListener('vxc-bg-change', handler)
    return () => window.removeEventListener('vxc-bg-change', handler)
  }, [])

  const params = new URLSearchParams(window.location.search)
  const isUpdateWindow = params.get('window') === 'update'
  if (isUpdateWindow) {
    return <UpdateWindow />
  }

  return (
    <AccountsProvider>
      <ToastContext.Provider value={toastState}>
        <AppBackground bgId={bgId} />
        {!splashDone && (
          <SplashScreen onDone={() => setSplashDone(true)} />
        )}
        <AppInner />
        <Toast
          toast={toastState.toast}
          visible={toastState.visible}
          onDismiss={toastState.dismiss}
        />
      </ToastContext.Provider>
    </AccountsProvider>
  )
}
