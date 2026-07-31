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
import Sidebar from './components/Sidebar'
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
import {
  House, PlayCircle, PuzzlePiece, HardDrives,
  Gear, UserCircle, CaretDown, Check,
  Plus, FileArrowDown,
} from '@phosphor-icons/react'
import PlayerHead from './components/ui/PlayerHead'

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

function AppInner({ gamingMode }) {
  const { t } = useLang()
  const toast = useToast()
  const [activePage, setActivePage] = useState('home')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const handleNavigate = useCallback((page) => {
    setActivePage(page)
  }, [])
  const { selectedAccount, accounts, loading, selectAccount, addAccount, updateAccount, removeAccount } = useAccounts()
  const [navHover, setNavHover] = useState(null)
  const [accDropdown, setAccDropdown] = useState(false)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showSkinModal, setShowSkinModal] = useState(false)
  const [removeConfirmId, setRemoveConfirmId] = useState(null)
  const [logPanelOpen, setLogPanelOpen] = useState(false)
  const dropdownRef = useRef(null)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showPlayDropdown, setShowPlayDropdown] = useState(false)

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') setShowPlayDropdown(false)
    }
    if (showPlayDropdown) window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showPlayDropdown])

  const NAV_ITEMS = [
    { id: 'home',   Icon: House },
    { id: 'play',   Icon: PlayCircle },
    { id: 'mods',   Icon: PuzzlePiece },
    { id: 'worlds', Icon: HardDrives },
  ]

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setAccDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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
            gamingMode={gamingMode}
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
            <ServerPage serverJavaProgress={serverJavaProgress} onServerJavaProgress={setServerJavaProgress} gamingMode={gamingMode} />
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
        {!gamingMode && (
          <Sidebar
            activePage={activePage}
            onNavigate={handleNavigate}
            selectedAccount={selectedAccount}
            settingsOpen={settingsOpen}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
        <main className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
          {gamingMode && (
            <div className={`absolute right-4 top-4 z-50 bg-black/40 backdrop-blur-xl border border-white/[0.06] rounded-2xl px-3 py-2 flex items-center gap-1 shadow-2xl transition-all duration-300 ${
              logPanelOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}>
              {NAV_ITEMS.map(({ id, Icon }) => {
                const isActive = activePage === id
                const isHovered = navHover === id
                if (id === 'play') {
                  const dropOpen = showPlayDropdown || isActive
                  const dropHover = showPlayDropdown || navHover === 'play'
                  return (
                    <div key={id} className="relative">
                      <button
                        onClick={() => setShowPlayDropdown(prev => !prev)}
                        onMouseEnter={() => setNavHover('play')}
                        onMouseLeave={() => setNavHover(null)}
                        className={`relative h-10 rounded-xl flex items-center gap-2 transition-all duration-300 ${
                          dropOpen
                            ? 'bg-orange-500/15 text-orange-400'
                            : 'text-white/40 hover:text-white/70 hover:bg-white/[0.06]'
                        }`}
                        style={{ width: dropHover || dropOpen ? '130px' : '40px' }}>
                        <Icon size={20} weight="duotone" className="flex-shrink-0 ml-[10px]" />
                        <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 text-xs font-semibold ${
                          dropHover || dropOpen ? 'max-w-[90px] opacity-100' : 'max-w-0 opacity-0'
                        }`}>
                          {t(`sidebar.${id}`)}
                        </span>
                      </button>
                      {showPlayDropdown && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowPlayDropdown(false)} />
                          <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] py-1.5 bg-[#16161a] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                            <button
                              onClick={() => { window.dispatchEvent(new CustomEvent('vxc:openCreateProfile')); setShowPlayDropdown(false) }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-all"
                            >
                              <Plus size={16} className="text-orange-400" />
                              Create Profile
                            </button>
                            <button
                              onClick={() => { window.dispatchEvent(new CustomEvent('vxc:openImportProfile')); setShowPlayDropdown(false) }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-all"
                            >
                              <FileArrowDown size={16} className="text-blue-400" />
                              Import Profile
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                }
                return (
                  <button key={id}
                    onClick={() => handleNavigate(id)}
                    onMouseEnter={() => setNavHover(id)}
                    onMouseLeave={() => setNavHover(null)}
                    className={`relative h-10 rounded-xl flex items-center gap-2 transition-all duration-300 ${
                      isActive
                        ? 'bg-orange-500/15 text-orange-400'
                        : 'text-white/40 hover:text-white/70 hover:bg-white/[0.06]'
                    }`}
                    style={{ width: isHovered || isActive ? '130px' : '40px' }}>
                    <Icon size={20} weight="duotone" className="flex-shrink-0 ml-[10px]" />
                    <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 text-xs font-semibold ${
                      isHovered || isActive ? 'max-w-[90px] opacity-100' : 'max-w-0 opacity-0'
                    }`}>
                      {t(`sidebar.${id}`)}
                    </span>
                  </button>
                )
              })}
              <div className="w-px h-6 bg-white/10 mx-1" />
              <div className="relative" ref={dropdownRef}>
                <button onClick={() => setAccDropdown(!accDropdown)}
                  className="h-10 rounded-xl flex items-center gap-1.5 px-2.5 text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-all">
                  {selectedAccount ? (
                    <div className="rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-white/10">
                      <PlayerHead uuid={selectedAccount.uuid} username={selectedAccount.username} size={26} />
                    </div>
                  ) : (
                    <UserCircle size={20} weight="duotone" />
                  )}
                  <span className="text-xs font-semibold text-white/70">{selectedAccount?.username || 'Account'}</span>
                  <CaretDown size={12} weight="bold" className={`transition-transform ${accDropdown ? 'rotate-180' : ''}`} />
                </button>
                {accDropdown && (
                  <div className="absolute right-0 top-full mt-1 min-w-[180px] bg-[#16161a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    <div className="py-1 max-h-[200px] overflow-y-auto">
                      {accounts.map(acc => {
                        const isSel = acc.id === selectedAccount?.id
                        const isConfirm = removeConfirmId === acc.id
                        return (
                          <div key={acc.id} className="relative group">
                            <button
                              onClick={() => { selectAccount(acc.id); setAccDropdown(false); setRemoveConfirmId(null) }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-all pr-8 ${
                                isSel ? 'text-orange-400 bg-orange-500/10' : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                              }`}>
                              <Check size={14} weight="bold" className={`flex-shrink-0 ${isSel ? 'opacity-100' : 'opacity-0'}`} />
                              <span className="font-semibold truncate">{acc.username}</span>
                              <span className="text-[9px] text-white/30 ml-auto">{acc.type === 'microsoft' ? 'MS' : 'Off'}</span>
                            </button>
                            {isConfirm ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeAccount(acc.id)
                                  setRemoveConfirmId(null)
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/80 hover:bg-red-500 text-white transition-all"
                                title="Xác nhận xóa"
                              >
                                Xóa?
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setRemoveConfirmId(acc.id)
                                  setTimeout(() => setRemoveConfirmId(p => p === acc.id ? null : p), 3000)
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                title="Xóa tài khoản"
                              >
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="h-px bg-white/10" />
                    <button onClick={() => { setShowAddAccount(true); setAccDropdown(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/40 hover:text-white hover:bg-white/[0.04] transition-all">
                      <UserCircle size={14} weight="duotone" />
                      {t('account.addModal.title')}
                    </button>
                    {selectedAccount && (
                      <button onClick={() => { setShowSkinModal(true); setAccDropdown(false) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/40 hover:text-white hover:bg-white/[0.04] transition-all">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 flex-shrink-0">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        {t('account.page.customize')}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => setSettingsOpen(true)}
                className="h-10 w-10 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-all">
                <Gear size={20} weight="duotone" />
              </button>
            </div>
          )}
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
  const [gamingMode, setGamingMode] = useState(false)
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
      if (s?.gamingMode !== undefined) setGamingMode(s.gamingMode)
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
    const gmHandler = (e) => setGamingMode(e.detail)
    window.addEventListener('vxc-gaming-mode', gmHandler)
    return () => {
      window.removeEventListener('vxc-bg-change', bgHandler)
      window.removeEventListener('vxc-gaming-mode', gmHandler)
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
            <AppInner gamingMode={gamingMode} />
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

