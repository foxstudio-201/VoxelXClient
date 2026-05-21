/**
 * VoxelXLauncher — Minecraft Launcher
 * Created by FoxStudio. AI-assisted development.
 *
 * Source code : https://github.com/foxstudio-201/VoxelXLauncher
 * Website     : https://voxxelxclient.vercel.app
 *
 * NOTICE:
 *   - This software is provided as-is without warranty of any kind.
 *   - Do not redistribute or resell without explicit permission from FoxStudio.
 *   - If you use or reference this code, please credit FoxStudio.
 *   - Minecraft is a trademark of Mojang Studios / Microsoft. This project is not affiliated with Mojang.
 */

 /**
 * VoxelXLauncher — Minecraft Launcher
 * Created by FoxStudio. AI-assisted development.
 *
 * Source code : https://github.com/foxstudio-201/VoxelXLauncher
 * Website     : https://voxxelxclient.vercel.app
 *
 * NOTICE:
 *   - Dành cho mấy cháu cứ thích phỉ báng.
 *   - Launcher sử dụng ai đi kèm trong việc tạo, bản thân người tạo không tự nhận là code toàn bộ do có sự hỗ trợ của ai.
 *   - Giỏi giang thì tự code bằng năng lực của mình đang video làm toàn bộ từ đầu đến cuối, còn không làm được đừng có kích đểu ảnh hưởng đến người sử dụng.
 *   - Bạn chẳng phải là anh hùng mặc áo choàng đỏ mặc quần xịt như thằng trẻ trâu rồi lên mạng ra vẻ ta đây là người tốt, là anh hùng, là người bảo vệ công lý gì đâu :).
 *   - Vậy nên bớt ảo tưởng đi.
 *   - Nếu có sử dụng hoặc tham khảo code này, hãy ghi công cho FoxStudio.
 *   - Minecraft là một thương hiệu của Mojang Studios / Microsoft. Dự án này không liên kết với Mojang.
 */

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
import { loadAppSettings, applyAppSettings } from './utils/appSettings'
import { LangProvider } from './i18n/LangProvider'
import { ModpackInstallProvider } from './components/mods/shared/ModpackInstallContext'
import CrashAnalyzerModal, { isFabricIncompatibleCrash } from './components/crash/CrashAnalyzerModal'

import ModsPage from './components/mods/ModsPage'
import ServerPage from './components/server/ServerPage'
import { useBgMusic } from './hooks/useBgMusic'

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

  const [instances, setInstances] = useState(new Map())

  const [launchState, setLaunchState] = useState('idle')
  const [progress, setProgress]       = useState(null)
  const [launchError, setLaunchError] = useState(null)
  const [activeKey, setActiveKey]     = useState(null)
  const [crashData, setCrashData]     = useState(null)

  const [serverJavaProgress, setServerJavaProgress] = useState({})
  const cleanupRef = useRef([])

  const updateInstance = useCallback((key, patch) => {
    setInstances(prev => {
      const next = new Map(prev)
      const cur  = next.get(key) || {}
      next.set(key, { ...cur, ...patch })
      return next
    })
  }, [])

  useEffect(() => {
    if (!isElectron) return

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

      setActiveKey(currentKey => {
        if (currentKey) {
          setInstances(prev => {
            const next = new Map(prev)
            const cur  = next.get(currentKey)
            if (cur) {
              const newState = data.phase === 'error'   ? 'error'       :
                               data.phase === 'running'  ? 'running'     : 'downloading'

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

      const realKey = data?.profileId && data?.accountId
        ? `${data.profileId}::${data.accountId}`
        : null

      // Crash detection: exit code !== 0 → phân tích log
      const exitCode = data?.code ?? 0
      if (exitCode !== 0 && isElectron) {
        setInstances(prev => {
          // Lấy logs của instance bị crash
          const inst = realKey
            ? prev.get(realKey)
            : data?.profileId
              ? [...prev.values()].find(i => i.profileId === data.profileId)
              : null

          if (inst?.logs?.length) {
            const logs = inst.logs
            // Chỉ hiện crash modal nếu là Fabric incompatible crash hoặc exit code lạ
            const shouldShow = isFabricIncompatibleCrash(logs) || exitCode !== 0

            if (shouldShow) {
              // Lấy profile info để có instancePath, gameVersion, loader
              window.electronAPI.getProfiles().then(profilesData => {
                const profile = profilesData?.profiles?.find(p => p.id === data.profileId)
                if (!profile) return
                setCrashData({
                  logs,
                  profileId: data.profileId,
                  accountId: data.accountId || null,
                  instancePath: profile.instancePath,
                  gameVersion: profile.gameVersion,
                  loader: profile.loader,
                  profileName: inst.profileName || profile.name,
                  exitCode,
                })
              }).catch(() => {
                // Fallback: hiện modal không có profile info
                setCrashData({
                  logs,
                  profileId: data.profileId,
                  accountId: data.accountId || null,
                  instancePath: null,
                  gameVersion: null,
                  loader: null,
                  profileName: inst.profileName || '',
                  exitCode,
                })
              })
            }
          }
          return prev
        })
      }

      setInstances(prev => {
        const next = new Map(prev)

        if (realKey && next.has(realKey)) {
          next.set(realKey, { ...next.get(realKey), state: 'stopped' })
          setTimeout(() => setInstances(p => { const n = new Map(p); n.delete(realKey); return n }), 3000)
          return next
        }

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

      setLaunchState('idle')
      setProgress(null)
      setLaunchError(null)
      setActiveKey(null)
    })

    cleanupRef.current = [unsubProgress, unsubLog, unsubLogUpdate, unsubStop]
    return () => { cleanupRef.current.forEach(fn => fn?.()) }
  }, [])

  const handleLaunch = useCallback(async (profileId, ramMb, profileName, accountName) => {
    if (!isElectron) return
    setLaunchState('downloading')
    setLaunchError(null)
    setProgress({ phase: 'starting', log: 'Preparing...', percent: 0 })

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

  function renderPage() {
    return (
      <>
        {}
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

        {}
        <div
          style={{ display: activePage === 'account' ? 'flex' : 'none' }}
          className="flex-1 min-h-0 overflow-hidden"
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
        <main className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
          {renderPage()}
        </main>
        {showHint && (
          <NoAccountHint onGoToAccount={() => setActivePage('account')} />
        )}
      </div>
      <CrashAnalyzerModal
        crashData={crashData}
        onClose={() => setCrashData(null)}
      />
    </div>
  )
}

export default function App() {
  const toastState = useToastState()
  const [splashDone, setSplashDone] = useState(false)
  const [bgId, setBgId] = useState('dark')

  // Phát nhạc nền LIGHTS sau khi splash xong
  // musicSettings được load trực tiếp trong hook qua event, không cần state ở đây
  useBgMusic(splashDone)

  useEffect(() => {
    loadAppSettings().then(s => {
      applyAppSettings(s)
      if (s?.background) setBgId(s.background)
      // Thông báo cho hook nhạc biết settings ban đầu
      window.dispatchEvent(new CustomEvent('vxc-music-init', {
        detail: {
          enabled: s?.musicEnabled !== false,
          volume:  s?.musicVolume  ?? 35,
        }
      }))
    }).catch(() => {})

    const bgHandler = (e) => setBgId(e.detail)
    window.addEventListener('vxc-bg-change', bgHandler)
    return () => window.removeEventListener('vxc-bg-change', bgHandler)
  }, [])

  const params = new URLSearchParams(window.location.search)
  const isUpdateWindow = params.get('window') === 'update'
  if (isUpdateWindow) {
    return (
      <LangProvider>
        <UpdateWindow />
      </LangProvider>
    )
  }

  return (
    <LangProvider>
      <AccountsProvider>
        <ModpackInstallProvider>
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
        </ModpackInstallProvider>
      </AccountsProvider>
    </LangProvider>
  )
}

