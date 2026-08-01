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

import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import TitleBar from './components/TitleBar'
import CloseModal from './components/CloseModal'
import NavBar from './components/NavBar'
import HomePage from './components/HomePage'
import Toast from './components/Toast'
import NoAccountHint from './components/NoAccountHint'
import UpdateWindow from './components/UpdateWindow'
import SplashScreen from './components/SplashScreen'
import InitialSetup from './components/InitialSetup'
import AppBackground from './components/AppBackground'
import { ToastContext, useToastState, useToast } from './hooks/useToast'
import { AccountsProvider, useAccounts } from './hooks/useAccounts'
import { loadAppSettings, applyAppSettings, isInitialSetupRequired } from './utils/appSettings'
import { LangProvider, useLang } from './i18n/LangProvider'
import { ModpackInstallProvider } from './components/mods/shared/ModpackInstallContext'

import LanShareWindow from './components/LanShareWindow'
import { useBgMusic } from './hooks/useBgMusic'

const AccountPage = lazy(() => import('./components/account/AccountPage'))
const SettingsPage = lazy(() => import('./components/settings/SettingsPage'))
const ModsPage = lazy(() => import('./components/mods/ModsPage'))
const ServerPage = lazy(() => import('./components/server/ServerPage'))
const CrashAnalyzerModal = lazy(() => import('./components/crash/CrashAnalyzerModal'))
const AddAccountModal = lazy(() => import('./components/account/AddAccountModal'))
const SkinCustomizeModal = lazy(() => import('./components/account/SkinCustomizeModal'))

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

function PageLoading() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
    </div>
  )
}

function AppInner() {
  const { t } = useLang()
  const toast = useToast()
  const [activePage, setActivePage] = useState('home')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const handleNavigate = useCallback((page) => {
    setActivePage(page)
  }, [])
  const { selectedAccount, accounts, loading, selectAccount, addAccount, updateAccount, removeAccount } = useAccounts()
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showSkinModal, setShowSkinModal] = useState(false)
  const [logPanelOpen, setLogPanelOpen] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)

  const [instances, setInstances] = useState(new Map())
  // Ref để track logs realtime, tránh race condition khi onGameStopped đến trước React re-render
  const instancesRef = useRef(new Map())

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
      const updated = { ...cur, ...patch }
      next.set(key, updated)
      instancesRef.current = next
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
        // Bắt đầu scan LAN khi game đã chạy
        window.electronAPI.lanStartScan?.().catch?.(() => {})
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
            instancesRef.current = next
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
              const newLog = data.line
              const newLogs = [...(cur.logs || []).slice(-1999), newLog]
              const newLauncherLogs = newLog.startsWith('[Launcher]')
                ? [...(cur.launcherLogs || []).slice(-1999), newLog]
                : (cur.launcherLogs || [])
              next.set(currentKey, { ...cur, logs: newLogs, launcherLogs: newLauncherLogs })
            }
            instancesRef.current = next
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
            instancesRef.current = next
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

      // Dừng LAN scan khi game thoát
      window.electronAPI.lanStopScan?.().catch?.(() => {})

      // Crash detection: exit code !== 0 → phân tích log
      // Đọc từ ref để tránh race condition (state có thể chưa update kịp)
      const exitCode = data?.code ?? 0
      if (exitCode !== 0 && isElectron) {
        const currentInstances = instancesRef.current

        // Tìm instance: thử realKey trước, rồi pending key, rồi theo profileId
        let inst = realKey ? currentInstances.get(realKey) : null
        if (!inst && data?.profileId) {
          inst = currentInstances.get(`${data.profileId}::`)
        }
        if (!inst && data?.profileId) {
          // Tìm theo profileId bất kỳ key nào
          inst = [...currentInstances.values()].find(i => i.profileId === data.profileId)
        }

        const logs = inst?.logs || []

        // Luôn hiện modal khi crash (exitCode !== 0), kể cả khi logs rỗng
        window.electronAPI.getProfiles().then(profilesData => {
          const profile = profilesData?.profiles?.find(p => p.id === data.profileId)
          setCrashData({
            logs,
            profileId: data.profileId,
            accountId: data.accountId || null,
            instancePath: profile?.instancePath || null,
            gameVersion: profile?.gameVersion || null,
            loader: profile?.loader || null,
            profileName: inst?.profileName || profile?.name || '',
            exitCode,
          })
        }).catch(() => {
          setCrashData({
            logs,
            profileId: data.profileId,
            accountId: data.accountId || null,
            instancePath: null,
            gameVersion: null,
            loader: null,
            profileName: inst?.profileName || '',
            exitCode,
          })
        })
      }

      setInstances(prev => {
        const next = new Map(prev)

        if (realKey && next.has(realKey)) {
          next.set(realKey, { ...next.get(realKey), state: 'stopped' })
          setTimeout(() => setInstances(p => { const n = new Map(p); n.delete(realKey); instancesRef.current = n; return n }), 3000)
          instancesRef.current = next
          return next
        }

        if (data?.profileId) {
          for (const [k, inst] of next) {
            if (inst.profileId === data.profileId) {
              next.set(k, { ...inst, state: 'stopped' })
              setTimeout(() => setInstances(p => { const n = new Map(p); n.delete(k); instancesRef.current = n; return n }), 3000)
              break
            }
          }
        }
        instancesRef.current = next
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

  const handleLaunch = useCallback(async (profileId, ramMb, profileName, accountName, serverAddress, accountId) => {
    if (!isElectron) return
    setLaunchState('downloading')
    setLaunchError(null)
    setProgress({ phase: 'starting', log: 'Preparing...', percent: 0 })

    const aid = accountId || ''
    const tempKey = `${profileId}::${aid}`
    setActiveKey(tempKey)
    setInstances(prev => {
      const next = new Map(prev)
      next.set(tempKey, {
        key: tempKey, profileId, accountId: aid,
        profileName: profileName || profileId,
        accountName: accountName || '',
        state: 'downloading', progress: null, logs: [],
      })
      instancesRef.current = next
      return next
    })

    const result = await window.electronAPI.launchGame({ profileId, ramMb, serverAddress, accountId: aid })
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

  const handleCloseRequest = useCallback(async () => {
    if (!isElectron) return
    const settings = await window.electronAPI.getSettings()
    if (settings.closeBehavior === 'quit') { window.electronAPI.quitApp(); return }
    if (settings.closeBehavior === 'tray') { window.electronAPI.closeWindow(); return }
    setShowCloseModal(true)
  }, [])

  const showHint = !loading && accounts.length === 0 && activePage === 'home'
  const instanceList = Array.from(instances.values())

  function renderPage() {
    return (
      <>
        {activePage === 'home' && (
          <HomePage
            key="home"
            onNavigate={handleNavigate}
            launchState={launchState}
            progress={progress}
            launchError={launchError}
            onLaunch={handleLaunch}
            onLaunchReset={handleLaunchReset}
            instances={instanceList}
            onKillInstance={handleKillInstance}
            activePage={activePage}
            onOpenSettings={() => setSettingsOpen(true)}
            onLogPanelOpen={setLogPanelOpen}
          />
        )}
        {activePage === 'mods' && (
          <Suspense fallback={<PageLoading />}>
            <ModsPage />
          </Suspense>
        )}
        {activePage === 'worlds' && (
          <Suspense fallback={<PageLoading />}>
            <ServerPage serverJavaProgress={serverJavaProgress} onServerJavaProgress={setServerJavaProgress} />
          </Suspense>
        )}
        <div
          style={{ display: activePage === 'account' ? 'flex' : 'none' }}
          className="flex-1 min-h-0 overflow-hidden"
        >
          <Suspense fallback={<PageLoading />}>
            <AccountPage />
          </Suspense>
        </div>
      </>
    )
  }

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden relative z-10" style={{ background: 'transparent' }}>
      <TitleBar instances={instanceList} onKillInstance={handleKillInstance} onCloseRequest={handleCloseRequest} />
      <div className="flex flex-1 overflow-hidden mt-9 relative">
        <main className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
          <NavBar
            activePage={activePage}
            onNavigate={handleNavigate}
            onOpenSettings={() => setSettingsOpen(true)}
            onAddAccount={() => setShowAddAccount(true)}
            onSkinCustomize={() => setShowSkinModal(true)}
            hidden={logPanelOpen}
          />
          {renderPage()}
        </main>
        {showHint && (
          <NoAccountHint onGoToAccount={() => handleNavigate('account')} />
        )}
      </div>
      {crashData && (
        <Suspense fallback={null}>
          <CrashAnalyzerModal
            crashData={crashData}
            onClose={() => setCrashData(null)}
          />
        </Suspense>
      )}

      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsPage onClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}

      {showAddAccount && (
        <Suspense fallback={null}>
          <AddAccountModal
            onClose={() => setShowAddAccount(false)}
            onAdd={async (account) => {
              await addAccount(account)
            }}
            onLinkDiscord={async (accountId, discordProfile) => {
              await updateAccount(accountId, {
                discordId:            discordProfile.discordId,
                discordUsername:      discordProfile.discordUsername,
                discordGlobalName:    discordProfile.discordGlobalName,
                discordDiscriminator: discordProfile.discordDiscriminator,
                discordAvatarUrl:     discordProfile.discordAvatarUrl,
                linkedAt:             new Date().toISOString(),
              })
            }}
            existingAccounts={accounts}
          />
        </Suspense>
      )}

      {showSkinModal && selectedAccount && (
        <Suspense fallback={null}>
          <SkinCustomizeModal
            account={selectedAccount}
            onClose={() => setShowSkinModal(false)}
            onApply={async ({ type, url, skinType }) => {
              const prefs = {
                uuid:      selectedAccount.uuid,
                skinUrl:   type === 'skin'   ? url : undefined,
                capeUrl:   type === 'cape'   ? url : undefined,
                elytraUrl: type === 'elytra' ? url : undefined,
                skinType:  skinType,
              }
              try {
                if (typeof window !== 'undefined' && window.electronAPI) {
                  await window.electronAPI.saveSkinPrefs(prefs)
                } else {
                  localStorage.setItem(`vxc_skin_prefs_${selectedAccount.uuid}`, JSON.stringify(prefs))
                }
              } catch {}
              setShowSkinModal(false)
            }}
          />
        </Suspense>
      )}
      {showCloseModal && (
        <CloseModal onClose={() => setShowCloseModal(false)} />
      )}
    </div>
  )
}

export default function App() {
  const toastState = useToastState()
  const [splashDone, setSplashDone] = useState(false)
  const [bgId, setBgId] = useState('dark')
  const [customBgPath, setCustomBgPath] = useState('')
  const [initialSettings, setInitialSettings] = useState(null)
  const [initialSetupOpen, setInitialSetupOpen] = useState(false)
  const [initialSetupChecked, setInitialSetupChecked] = useState(false)

  useBgMusic(splashDone && initialSetupChecked && !initialSetupOpen)

  useEffect(() => {
    loadAppSettings().then(s => {
      setInitialSettings(s)
      applyAppSettings(s)
      if (s?.background) setBgId(s.background)
      if (s?.customBgPath) setCustomBgPath(s.customBgPath)
      window.dispatchEvent(new CustomEvent('vxc-music-init', {
        detail: {
          enabled: s?.musicEnabled !== false,
          volume:  s?.musicVolume  ?? 35,
        }
      }))
    }).catch(() => {})

    const bgHandler = (e) => {
      const { bgId: nextBgId, customBgPath: nextPath } = e.detail ?? {}
      if (!nextBgId) return
      setBgId(nextBgId)
      setCustomBgPath(nextBgId === 'custom' ? (nextPath ?? '') : '')
    }
    window.addEventListener('vxc-bg-change', bgHandler)
    return () => {
      window.removeEventListener('vxc-bg-change', bgHandler)
    }
  }, [])

  useEffect(() => {
    if (!splashDone) return
    isInitialSetupRequired().then(required => {
      setInitialSetupOpen(required)
      setInitialSetupChecked(true)
    }).catch(() => setInitialSetupChecked(true))
  }, [splashDone])

  const params = new URLSearchParams(window.location.search)
  const isUpdateWindow = params.get('window') === 'update'
  if (isUpdateWindow) {
    return (
      <LangProvider>
        <UpdateWindow />
      </LangProvider>
    )
  }

  const isLanWindow = params.get('window') === 'lan'
  if (isLanWindow) {
    return <LanShareWindow />
  }

  return (
    <LangProvider>
      <AccountsProvider>
        <ModpackInstallProvider>
          <ToastContext.Provider value={toastState}>
            <AppBackground bgId={bgId} customBgPath={customBgPath} />
            {!splashDone && (
              <SplashScreen onDone={() => setSplashDone(true)} />
            )}
            <AppInner />
            {splashDone && initialSetupChecked && initialSetupOpen && (
              <InitialSetup
                initialSettings={initialSettings || {}}
                onComplete={(settings) => {
                  setInitialSettings(settings)
                  setInitialSetupOpen(false)
                }}
              />
            )}
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

