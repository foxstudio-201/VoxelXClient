import { useState, useRef, useEffect, useTransition } from 'react'
import { useAccounts } from '../hooks/useAccounts'
import { useLang } from '../i18n/LangProvider'
import { Gear, PlayCircle, Plus, FileArrowDown, SpinnerGap } from '@phosphor-icons/react'
import ProfileSettingsPanel from './home/ProfileSettingsPanel'
import GamingModalWrapper from './ui/GamingModalWrapper'
import ModsTab from './home/tab/ModsTab'
import WorldsTab from './home/tab/WorldsTab'
import ShadersTab from './home/tab/ShadersTab'
import ResourcePacksTab from './home/tab/ResourcePacksTab'
import ServerBookmarksTab from './home/tab/ServerBookmarksTab'
import AnalyticsPanel from './gaming/AnalyticsPanel'
import GamingLogPanel from './gaming/GamingLogPanel'
import CreateProfileModal from './play/CreateProfileModal'
import { ContentBrowser } from './gaming/ContentBrowser'
import modrinthIcon from '../assets/loader/modrinth.png'
import curseforgeIcon from '../assets/loader/curseforge.png'
import ImportProfileModal from './play/ImportProfileModal'
import { useToast } from '../hooks/useToast'
import defaultBg from '../assets/minecraft-versions/default.png'
import selectSound from '../assets/sound/selected.mp3'
import clickSound from '../assets/sound/click.mp3'
import vanillaIcon from '../assets/loader/vanilla.png'
import fabricIcon from '../assets/loader/fabric.png'
import forgeIcon from '../assets/loader/forge.png'
import neoforgeIcon from '../assets/loader/neoforge.png'
import v112 from '../assets/minecraft-versions/1.12.png'
import v115 from '../assets/minecraft-versions/1.15.png'
import v116 from '../assets/minecraft-versions/1.16.png'
import v117 from '../assets/minecraft-versions/1.17.png'
import v118 from '../assets/minecraft-versions/1.18.png'
import v119 from '../assets/minecraft-versions/1.19.png'
import v120 from '../assets/minecraft-versions/1.20.png'
import v121 from '../assets/minecraft-versions/1.21.png'

const CARD_W = 280
const CARD_H = 380
const VISIBLE = 50

const VERSION_IMAGES = { '1.12': v112, '1.15': v115, '1.16': v116, '1.17': v117, '1.18': v118, '1.19': v119, '1.20': v120, '1.21': v121 }

const LOADER_ICONS = {
  vanilla: vanillaIcon,
  fabric: fabricIcon,
  forge: forgeIcon,
  neoforge: neoforgeIcon,
}

function getMajorVersion(v) {
  if (!v) return ''
  const parts = v.split('.')
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : v
}

function getVersionImage(v) {
  return VERSION_IMAGES[getMajorVersion(v)] || defaultBg
}

const LOADER_COLORS = {
  vanilla:  { primary: '#fb923c', secondary: '#ea580c' },
  fabric:   { primary: '#a78bfa', secondary: '#7c3aed' },
  forge:    { primary: '#fb923c', secondary: '#ea580c' },
  neoforge: { primary: '#fb7185', secondary: '#e11d48' },
}

const VERSION_COLORS = {
  '1.21':'#3b82f6','1.20':'#10b981','1.19':'#f59e0b',
  '1.18':'#ef4444','1.17':'#8b5cf6','1.16':'#ec4899',
}

function getVersionColor(v) { return VERSION_COLORS[v] || '#1e1e24' }

function getLoaderTag(p) {
  if (!p) return ''
  if (p.loader === 'vanilla') return 'Vanilla'
  const l = p.loader.charAt(0).toUpperCase() + p.loader.slice(1)
  return p.loaderVersion ? `${l} ${p.loaderVersion}` : l
}

const ALL_TABS = [
  { id: 'mods',          label: 'Mods',          component: ModsTab },
  { id: 'worlds',        label: 'Worlds',        component: WorldsTab },
  { id: 'shaders',       label: 'Shaders',       component: ShadersTab },
  { id: 'resourcepacks', label: 'Resource Packs', component: ResourcePacksTab },
  { id: 'servers',       label: 'Servers',        component: ServerBookmarksTab },
]

export default function HomePage({ onNavigate, launchState, progress, launchError, onLaunch, onLaunchReset, activePage, onOpenSettings, instances, onKillInstance, onLogPanelOpen }) {
  const { t } = useLang()
  const { selectedAccount } = useAccounts()
  const accountId = selectedAccount?.id
  const [profiles, setProfiles] = useState([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [detailTab, setDetailTab] = useState('mods')
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false)
  const [logPanelVisible, setLogPanelVisible] = useState(false)
  const [logManuallyClosed, setLogManuallyClosed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [browsing, setBrowsing] = useState(null)
  const [persistedLauncherLogs, setPersistedLauncherLogs] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [accountMenuProfile, setAccountMenuProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [predownload, setPredownload] = useState(null)
  const newLaunchRef = useRef(false)
  const toast = useToast()
  const isElectron = typeof window !== 'undefined' && window.electronAPI
  const initLoaded = useRef(false)

  useEffect(() => {
    if (!isElectron || !window.electronAPI.onPreDownloadProgress) return
    return window.electronAPI.onPreDownloadProgress(data => {
      setPredownload(prev => prev ? { ...prev, log: data.log, percent: data.percent } : null)
    })
  }, [])

  useEffect(() => {
    if (!isElectron) return
    window.electronAPI.getProfiles().then(data => {
      if (!initLoaded.current) {
        setProfiles(data.profiles || [])
        initLoaded.current = true
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    function onOpenCreate() { setShowCreate(true) }
    function onOpenImport() { setShowImport(true) }
    window.addEventListener('vxc:openCreateProfile', onOpenCreate)
    window.addEventListener('vxc:openImportProfile', onOpenImport)
    return () => {
      window.removeEventListener('vxc:openCreateProfile', onOpenCreate)
      window.removeEventListener('vxc:openImportProfile', onOpenImport)
    }
  }, [])

  useEffect(() => {
    if (selectedIdx >= profileList.length) {
      setSelectedIdx(Math.max(0, profileList.length - 1))
    }
  }, [profiles])

  useEffect(() => {
    if (!profileList[selectedIdx]) return
    setProfileLoading(true)
    const timer = setTimeout(() => setProfileLoading(false), 1200)
    return () => clearTimeout(timer)
  }, [selectedIdx])

  useEffect(() => {
    onLogPanelOpen?.(expanded)
  }, [expanded, onLogPanelOpen])

  useEffect(() => {
    if (!accountMenuProfile) return
    function onMouseDown(e) {
      if (!e.target.closest('.account-menu-container')) setAccountMenuProfile(null)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [accountMenuProfile])

  async function handleCreate(profileData) {
    const result = isElectron ? await window.electronAPI.createProfile(profileData) : { error: 'Not available' }
    if (result?.error) {
      toast?.({ type: 'error', title: 'Error', message: result.error })
      return result
    }
    const data = isElectron ? await window.electronAPI.getProfiles() : { profiles: [] }
    setProfiles(data.profiles || [])
    initLoaded.current = true
    setShowCreate(false)
    toast?.({ type: 'success', title: 'Profile created', message: result.profile?.name })
    if (isElectron && result.profile?.id) {
      setPredownload({ profileId: result.profile.id, log: 'Đang chuẩn bị tài nguyên game...', percent: 0 })
      window.electronAPI.preDownload({ profileId: result.profile.id }).then(r => {
        if (r?.ok) {
          setPredownload(prev => prev ? { ...prev, log: 'Tài nguyên game đã sẵn sàng', percent: 100 } : null)
          setTimeout(() => setPredownload(null), 2500)
        } else {
          setPredownload(null)
        }
      })
    }
    return result
  }

  async function handleCreateForImport(profileData) {
    const result = isElectron ? await window.electronAPI.createProfile(profileData) : { error: 'Not available' }
    if (result?.error) {
      toast?.({ type: 'error', title: 'Error', message: result.error })
      return result
    }
    const data = isElectron ? await window.electronAPI.getProfiles() : { profiles: [] }
    setProfiles(data.profiles || [])
    initLoaded.current = true
    toast?.({ type: 'success', title: 'Profile imported', message: result.profile?.name })
    return result
  }

  async function handleImportClose() {
    setShowImport(false)
    if (isElectron) {
      window.electronAPI.getProfiles().then(data => {
        setProfiles(data.profiles || [])
      }).catch(() => {})
    }
  }

  async function handleDelete(id) {
    try {
      const result = isElectron ? await window.electronAPI.deleteProfile(id) : null
      if (result?.error) {
        toast?.({ type: 'error', title: 'Error', message: result.error })
        return
      }
    } catch {}
    setProfiles(prev => prev.filter(p => p.id !== id))
    initLoaded.current = true
    setDeleteTarget(null)
  }

  async function handleProfileUpdated(updatedProfile) {
    initLoaded.current = true
    if (updatedProfile?.id) {
      setProfiles(prev => {
        const idx = prev.findIndex(p => p.id === updatedProfile.id)
        if (idx !== -1) {
          const arr = [...prev]; arr[idx] = updatedProfile; return arr
        }
        return prev
      })
    } else if (isElectron) {
      try {
        const data = await window.electronAPI.getProfiles()
        setProfiles(data.profiles || [])
      } catch {}
    }
  }
  const carouselRef = useRef(null)
  const containerRef = useRef(null)

  function onCardMove(e) {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    const x = e.clientX - r.left, y = e.clientY - r.top
    const ex = Math.min(x, r.width - x) / (r.width / 2)
    const ey = Math.min(y, r.height - y) / (r.height / 2)
    const ep = Math.round((1 - Math.min(ex, ey)) * 100)
    const cx = r.width / 2, cy = r.height / 2
    const ca = Math.round(Math.atan2(y - cy, x - cx) * (180 / Math.PI)) + 90
    el.style.setProperty('--ep', String(ep))
    el.style.setProperty('--ca', ca + 'deg')
  }
  function onCardLeave(e) {
    e.currentTarget.style.setProperty('--ep', '0')
  }

  const profileList = profiles || []
  const currentProfile = profileList[selectedIdx] || null
  const colors = LOADER_COLORS[currentProfile?.loader] || LOADER_COLORS.vanilla
  const profileIcon = currentProfile?.importIconUrl || LOADER_ICONS[currentProfile?.loader] || vanillaIcon

  // Tìm instance đang chạy của một profile cụ thể
  function getProfileInstance(profileId, accountId) {
    if (!instances || !profileId) return null
    return instances.find(inst =>
      inst.profileId === profileId &&
      inst.state !== 'stopped' &&
      (!accountId || inst.accountId === accountId)
    ) || null
  }

  function getProfileState(profileId, accountId) {
    const inst = getProfileInstance(profileId, accountId)
    if (!inst) return 'idle'
    return inst.state // 'downloading' | 'running' | 'error' | 'stopped'
  }

  function getProfileInstances(profileId) {
    if (!instances || !profileId) return []
    return instances.filter(inst => inst.profileId === profileId && inst.state !== 'stopped')
  }

  const selectAudioRef = useRef(null)
  const clickAudioRef = useRef(null)

  function playSelectSound() {
    if (!selectAudioRef.current) {
      selectAudioRef.current = new Audio(selectSound)
    }
    selectAudioRef.current.currentTime = 0
    selectAudioRef.current.play().catch(() => {})
  }

  function playClickSound() {
    if (!clickAudioRef.current) {
      clickAudioRef.current = new Audio(clickSound)
    }
    clickAudioRef.current.currentTime = 0
    clickAudioRef.current.play().catch(() => {})
  }

  function goNext() {
    if (selectedIdx < profileList.length - 1) startTransition(() => { setSelectedIdx(selectedIdx + 1); playSelectSound() })
  }
  function goPrev() {
    if (selectedIdx > 0) startTransition(() => { setSelectedIdx(selectedIdx - 1); playSelectSound() })
  }
  function goToCard(idx) {
    if (idx !== selectedIdx) startTransition(() => { setSelectedIdx(idx); playSelectSound() })
  }
  function openDetails() {
    if (currentProfile) { setExpanded(true); playClickSound() }
  }
  function closeExpanded() { setExpanded(false); playClickSound() }

  useEffect(() => {
    const el = carouselRef.current
    if (!el) return
    function onWheel(e) {
      if (expanded) return
      const threshold = 30
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        if (e.deltaY > threshold) { e.preventDefault(); goNext() }
        else if (e.deltaY < -threshold) { e.preventDefault(); goPrev() }
      } else {
        if (e.deltaX > threshold) { e.preventDefault(); goNext() }
        else if (e.deltaX < -threshold) { e.preventDefault(); goPrev() }
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [expanded, selectedIdx, profileList.length])

  function handleLaunch(profileId, ramMb, profileName, accountName, serverAddress) {
    const pid = profileId || currentProfile?.id
    const p = profileList.find(x => x.id === pid) || currentProfile
    if (!p) return
    onLaunch(pid, ramMb || (p.ramGb || 4) * 1024, profileName || p.name, accountName || selectedAccount?.username || '', serverAddress, selectedAccount?.id)
  }

  function handleKill(profileId, accountId) {
    const inst = accountId ? getProfileInstance(profileId, accountId) : getProfileInstance(profileId)
    if (!inst || !onKillInstance) return
    onKillInstance(inst.key)
  }

  const currentInst = getProfileInstance(currentProfile?.id, selectedAccount?.id)
  const playing = getProfileState(currentProfile?.id, selectedAccount?.id) === 'running'
  const downloading = getProfileState(currentProfile?.id, selectedAccount?.id) === 'downloading'
  const currentProgress = currentInst?.progress
  const otherRunning = currentProfile ? getProfileInstances(currentProfile.id).filter(i => i.accountId !== selectedAccount?.id) : []

  // Auto-show log panel on new launch, don't auto-hide
  useEffect(() => {
    if (launchState === 'downloading') {
      setLogPanelVisible(true)
      setLogManuallyClosed(false)
      setPersistedLauncherLogs([])
      newLaunchRef.current = true
    } else if (launchState === 'running') {
      newLaunchRef.current = false
    }
  }, [launchState])

  // Persist launcherLogs so they survive instance deletion (after game stops)
  useEffect(() => {
    const ll = currentInst?.launcherLogs
    if (ll?.length > 0) {
      setPersistedLauncherLogs(ll)
    }
  }, [currentInst?.launcherLogs])

  // Display live launcherLogs when available, otherwise persisted (from last session)
  const displayLogs = currentInst?.launcherLogs || persistedLauncherLogs

  function handleCloseLogPanel() {
    setLogPanelVisible(false)
    setLogManuallyClosed(true)
  }

  function handleReopenLog() {
    setLogPanelVisible(true)
    setLogManuallyClosed(false)
  }

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden select-none">
      <style dangerouslySetInnerHTML={{__html:[
        '.glow-card{isolation:isolate;overflow:visible}',
        '.glow-card .glow-inner{position:relative;z-index:1;isolation:isolate}',
        '.glow-card>.glow-edge{position:absolute;inset:-25px;border-radius:inherit;z-index:0;pointer-events:none;opacity:calc((var(--ep,0) - 30)/70);transition:opacity .12s ease-out;-webkit-mask-image:conic-gradient(from var(--ca,0deg) at center,#000 5%,transparent 15%,transparent 85%,#000 95%);mask-image:conic-gradient(from var(--ca,0deg) at center,#000 5%,transparent 15%,transparent 85%,#000 95%);mix-blend-mode:plus-lighter}',
        '.glow-card>.glow-edge::before{content:"";position:absolute;inset:25px;border-radius:inherit;box-shadow:0 0 0 1.5px var(--gc),0 0 12px 3px color-mix(in srgb,var(--gc) 45%,transparent),inset 0 0 0 1.5px var(--gc),inset 0 0 10px 0 color-mix(in srgb,var(--gc) 35%,transparent)}',
      ].join('')}} />

      {/* Log Panel */}
      <GamingLogPanel
        visible={logPanelVisible}
        logs={displayLogs}
        onClose={handleCloseLogPanel}
        progress={currentProgress}
        loader={currentProfile?.loader}
      />

      {/* Carousel */}
      <div ref={carouselRef}
        className={`relative flex-1 flex items-center justify-center transition-all duration-500 ${
          expanded ? '-translate-y-20 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        }`}>

        <div className="relative" style={{ width: CARD_W, height: CARD_H }}>

          {profileList.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-white/30">
              <div className="text-center">
                <p className="text-lg font-semibold mb-1">Chưa có profile</p>
                <p className="text-xs mb-5">Tạo profile mới để bắt đầu</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 bg-orange-500/80 hover:bg-orange-500 text-white"
                  >
                    <Plus size={16} />
                    Create Profile
                  </button>
                  <button
                    onClick={() => setShowImport(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white"
                  >
                    <FileArrowDown size={16} />
                    Import Profile
                  </button>
                </div>
              </div>
            </div>
          )}

          {profileList.map((p, i) => {
            const diff = i - selectedIdx
            const x = diff * (CARD_W - VISIBLE)
            const scale = Math.max(0.7, 1 - Math.abs(diff) * 0.1)
            const z = 100 - Math.abs(diff)
            const opacity = Math.abs(diff) > 2 ? 0 : Math.max(0.35, 1 - Math.abs(diff) * 0.25)
            const lc = LOADER_COLORS[p.loader] || LOADER_COLORS.vanilla
            const vc = getVersionColor(p.gameVersion)

            return (
              <div key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => goToCard(i)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') goToCard(i) }}
                onMouseMove={onCardMove}
                onMouseLeave={onCardLeave}
                className="absolute rounded-2xl shadow-2xl cursor-pointer focus:outline-none text-left group glow-card"
                style={{
                  '--ep': 0,
                  '--ca': '0deg',
                  '--gc': lc.primary,
                  width: CARD_W,
                  height: CARD_H,
                  transform: `translateX(${x}px) scale(${scale})`,
                  zIndex: z,
                  opacity,
                  transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                }}>
                <span className="glow-edge" />
                <div className="glow-inner rounded-2xl overflow-hidden w-full h-full">
                <div className="absolute inset-0" style={{ background: vc }} />
                <img src={p.importBgUrl || getVersionImage(p.gameVersion)}
                  className="absolute inset-0 w-full h-full object-cover"
                  alt=""
                  draggable={false}
                  onError={e => { e.currentTarget.style.display = 'none' }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                {i === selectedIdx && (
                  <>
                    <div className="absolute top-3 left-3 z-10 flex gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setProfileSettingsOpen(true); playClickSound() }}
                        className="w-8 h-8 rounded-lg bg-black/45 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/65 transition-all"
                        title={t('homepage.profile.settings')}
                        aria-label={t('homepage.profile.settings')}
                      >
                        <Gear size={16} weight="duotone" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); playClickSound() }}
                        className="w-8 h-8 rounded-lg bg-black/45 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white/70 hover:text-red-400 hover:bg-red-500/15 hover:border-red-500/25 transition-all"
                        title={t('homepage.profile.delete')}
                        aria-label={t('homepage.profile.delete')}
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                      </button>
                      {(() => {
                        const pAllInst = getProfileInstances(p.id)
                        const runningCount = pAllInst.length
                        return runningCount > 0 ? (
                          <div className="relative account-menu-container">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setAccountMenuProfile(accountMenuProfile === p.id ? null : p.id); playClickSound() }}
                              className="w-8 h-8 rounded-lg bg-black/45 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white/70 hover:text-green-400 hover:bg-green-500/15 hover:border-green-500/25 transition-all relative"
                              title={t('homepage.profile.accounts')}
                              aria-label={t('homepage.profile.accounts')}
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                              </svg>
                              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border border-black/50" />
                            </button>
                            {accountMenuProfile === p.id && (
                              <div
                                className="absolute top-full left-0 mt-1.5 w-52 rounded-xl border border-white/10 shadow-2xl z-50 overflow-hidden"
                                style={{ background: 'rgba(14,14,14,0.98)' }}
                                onClick={e => e.stopPropagation()}
                              >
                                <div className="px-3 py-2 text-[10px] text-white/40 font-semibold uppercase tracking-wider border-b border-white/5">
                                  {t('homepage.profile.runningAccounts')}
                                </div>
                                {pAllInst.map(inst => (
                                  <div key={inst.key} className="flex items-center gap-2 px-3 py-2 border-b border-white/5 last:border-0">
                                    <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                                    <span className="flex-1 text-xs text-white truncate">{inst.accountName || inst.accountId}</span>
                                    <button
                                      onClick={() => { handleKill(p.id, inst.accountId); setAccountMenuProfile(null) }}
                                      className="w-6 h-6 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                      title={t('homepage.launch.kill')}
                                    >
                                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                      </svg>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : null
                      })()}
                      {(() => {
                        const pActive = getProfileState(p.id, selectedAccount?.id) === 'running' || getProfileState(p.id, selectedAccount?.id) === 'downloading'
                        return pActive && !logPanelVisible ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleReopenLog(); playClickSound() }}
                            className="w-8 h-8 rounded-lg bg-black/45 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/65 transition-all"
                            title="Logs"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
                              <path d="M7 9h10v2H7zm0 3h7v2H7zm0-6h10v2H7z"/>
                            </svg>
                          </button>
                        ) : null
                      })()}
                    </div>
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
                      style={{ background: lc.primary }}>
                      <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    </div>
                  </>
                )}

                <div className="absolute inset-x-0 bottom-0 p-4">
                  {i === selectedIdx && (() => {
                    const pInst = getProfileInstance(p.id, selectedAccount?.id)
                    const pPlaying = getProfileState(p.id, selectedAccount?.id) === 'running'
                    const pDownloading = getProfileState(p.id, selectedAccount?.id) === 'downloading'
                    const pActive = pPlaying || pDownloading
                    const pAllInstances = getProfileInstances(p.id)
                    const otherActive = pAllInstances.filter(x => x.accountId !== selectedAccount?.id)
                    return (
                      <div className="flex gap-2 mb-3">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); playClickSound(); if (!pActive && !pDownloading) handleLaunch() }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all hover:brightness-110 active:scale-95 shadow-xl"
                          style={{ background: lc.primary, color: '#000', opacity: (pActive || pDownloading) ? 0.75 : 1 }}
                        >
                          <PlayCircle size={20} weight="fill" />
                          {pPlaying ? t('gaming.playing') : pDownloading ? `${pInst?.progress?.percent || 0}%` : t('gaming.play')}
                        </button>
                        {pActive && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleKill(p.id, selectedAccount?.id); playClickSound() }}
                            className="w-11 flex items-center justify-center rounded-xl font-bold text-sm transition-all hover:brightness-110 active:scale-95 shadow-xl bg-red-500/80 hover:bg-red-500"
                            title={t('homepage.launch.kill')}
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white">
                              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    )
                  })()}
                  <div className="flex gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate drop-shadow-lg">{p.name}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: `${lc.primary}22`, color: lc.primary }}>
                          {p.gameVersion}
                        </span>
                        {p.loader !== 'vanilla' && (
                          <span className="text-[10px] text-white/40">{getLoaderTag(p)}</span>
                        )}
                      </div>
                    </div>
                    {isElectron && (
                      <button
                        onClick={(e) => { e.stopPropagation(); window.electronAPI.openProfileFolder(p.id) }}
                        className="w-10 h-[68px] flex items-center justify-center rounded-xl text-white/25 hover:text-blue-400 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/15 transition-all flex-shrink-0 self-center"
                        title="Open profile folder"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                          <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                {predownload?.profileId === p.id && (
                  <div className="absolute inset-x-0 bottom-2 z-20 px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-black/50 border border-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                          style={{ width: `${predownload.percent || 0}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-cyan-300 drop-shadow-lg flex-shrink-0">
                        {Math.round(predownload.percent || 0)}%
                      </span>
                    </div>
                  </div>
                )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Nav arrows */}
        {selectedIdx > 0 && (
          <button onClick={goPrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-black/70 transition-all z-50">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </button>
        )}
        {selectedIdx < profileList.length - 1 && (
          <button onClick={goNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-black/70 transition-all z-50">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </button>
        )}
      </div>

      {/* Bottom dots + Select button */}
      {profileList.length > 0 && !expanded && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-16 flex flex-col items-center gap-2 z-50">
          {profileList.length > 1 && (
            <div className="flex gap-2">
              {profileList.map((_, i) => (
                <button key={i} onClick={() => goToCard(i)}
                  className={`rounded-full transition-all duration-300 ${
                    i === selectedIdx ? 'w-7 h-2' : 'w-2 h-2'
                  }`}
                  style={{ background: i === selectedIdx ? colors.primary : 'rgba(255,255,255,0.15)' }} />
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button onClick={openDetails}
              className="flex items-center gap-2 px-7 py-2.5 rounded-full text-sm font-bold transition-all hover:scale-105 active:scale-95 shadow-lg"
              style={{ background: colors.primary, color: '#000' }}>
              {profileLoading || isPending ? <SpinnerGap size={16} className="animate-spin" /> : null}
              {t('gaming.select')}
            </button>
          </div>
        </div>
      )}

      {/* Details panel */}
      <div className={`absolute inset-x-3 bottom-3 transition-all duration-500 ease-out ${
        expanded ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
      }`} style={{ height: 'calc(100% - 4rem)' }}>
        <div className="w-full h-full rounded-2xl border border-white/5 overflow-hidden flex flex-col"
          style={{ background: 'rgba(10,10,12,0.97)' }}>

          <div className="flex-shrink-0 flex items-center justify-between px-6 pt-4 pb-2 border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 flex-shrink-0 flex items-center justify-center bg-white/5">
                <img src={profileIcon} className="w-9 h-9 object-contain" alt=""
                  draggable={false}
                  onError={e => { e.currentTarget.src = LOADER_ICONS[currentProfile?.loader] || vanillaIcon }} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-white font-bold text-lg truncate">{currentProfile?.name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: `${colors.primary}22`, color: colors.primary }}>
                    {currentProfile?.gameVersion}
                  </span>
                  <span className="text-[10px] text-white/40 truncate">{getLoaderTag(currentProfile)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {otherRunning.length > 0 && !playing && !downloading && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/15 text-[10px] text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  +{otherRunning.length} {t('homepage.profile.otherRunning')}
                </div>
              )}
              <button onClick={() => { playClickSound(); if (!playing && !downloading) handleLaunch() }}
                className="px-5 py-2 rounded-xl font-semibold text-sm transition-all active:scale-95"
                style={{ background: colors.primary, color: '#000', opacity: (playing || downloading) ? 0.75 : 1 }}>
                {playing ? t('gaming.playing') : downloading ? `${currentProgress?.percent || 0}%` : t('gaming.play')}
              </button>
              {(playing || downloading) && (
                <>
                {!logPanelVisible && (
                  <button
                    onClick={() => { handleReopenLog(); playClickSound() }}
                    className="px-3 py-2 rounded-xl font-semibold text-sm transition-all active:scale-95 bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5"
                    title="Logs"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
                      <path d="M7 9h10v2H7zm0 3h7v2H7zm0-6h10v2H7z"/>
                    </svg>
                    Logs
                  </button>
                )}
                <button
                  onClick={() => { handleKill(currentProfile?.id, selectedAccount?.id); playClickSound() }}
                  className="px-3 py-2 rounded-xl font-semibold text-sm transition-all active:scale-95 bg-red-500/80 hover:bg-red-500 text-white flex items-center gap-1.5"
                  title={t('homepage.launch.kill')}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                  {t('homepage.launch.kill')}
                </button>
                </>
              )}

              <button onClick={closeExpanded}
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            </div>
          </div>

          <div className="flex-shrink-0 flex gap-1 px-6 pt-2 pb-0 border-b border-white/5">
            {ALL_TABS.filter(t => !(t.id === 'shaders' && currentProfile?.loader === 'vanilla')).map(tab => (
              <button key={tab.id} onClick={() => { setDetailTab(tab.id); playClickSound() }}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
                  detailTab === tab.id
                    ? 'border-orange-500 text-orange-400'
                    : 'border-transparent text-white/35 hover:text-white/60'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {browsing ? (
            <div className="flex items-center justify-between px-6 py-2 border-b border-white/5">
              <button onClick={() => { playClickSound(); setBrowsing(null) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white transition-all">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                Back to {detailTab}
              </button>
              <p className="text-[10px] text-white/30 capitalize">{browsing.platform} · {browsing.contentType}</p>
            </div>
          ) : detailTab !== 'servers' && (
            <div className="flex items-center justify-between px-6 py-2 border-b border-white/5">
              <button onClick={() => { playClickSound(); setBrowsing({ step: 'platform', contentType:
                detailTab === 'mods' ? 'mod' :
                detailTab === 'shaders' ? 'shader' :
                detailTab === 'resourcepacks' ? 'resourcepack' :
                detailTab === 'worlds' ? 'world' : 'mod'
              }) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/15 text-xs font-semibold hover:bg-cyan-500/20 transition-all active:scale-95">
                <Plus weight="bold" className="w-3.5 h-3.5" />
                Add {detailTab === 'resourcepacks' ? 'Resource Pack' : detailTab === 'shaders' ? 'Shader' : detailTab === 'mods' ? 'Mod' : 'World'}
              </button>
              <button onClick={() => { playClickSound(); setReloadKey(k => k + 1) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-white/40 hover:text-cyan-400 text-xs font-semibold transition-all active:scale-95">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                Reload
              </button>
            </div>
          )}
          <div className="flex-1 min-h-0 flex">
            {browsing ? (
              <div className="flex-1 min-w-0 overflow-y-auto p-4 flex flex-col">
                {browsing.step === 'platform' ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4">
                    <p className="text-xs text-white/40 font-medium">Choose a platform to browse {browsing.contentType}s</p>
                    <div className="flex gap-4">
                      <button onClick={() => setBrowsing({ ...browsing, step: 'browse', platform: 'modrinth' })}
                        className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl transition-all hover:scale-105 cursor-pointer"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        <img src={modrinthIcon} alt="Modrinth" className="w-12 h-12 object-contain" />
                        <span className="text-sm font-bold text-white">Modrinth</span>
                        <span className="text-[10px] text-white/30 text-center">Open-source mod platform</span>
                      </button>
                      <button onClick={() => setBrowsing({ ...browsing, step: 'browse', platform: 'curseforge' })}
                        className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl transition-all hover:scale-105 cursor-pointer"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        <img src={curseforgeIcon} alt="CurseForge" className="w-12 h-12 object-contain" />
                        <span className="text-sm font-bold text-white">CurseForge</span>
                        <span className="text-[10px] text-white/30 text-center">Largest modding community</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <ContentBrowser
                    profile={currentProfile}
                    contentType={browsing.contentType}
                    platform={browsing.platform}
                    onBack={() => setBrowsing({ ...browsing, step: 'platform', platform: null })}
                  />
                )}
              </div>
            ) : (
              <>
              <div className="flex-[2] min-w-0 overflow-y-auto p-4">
                {ALL_TABS.filter(t => !(t.id === 'shaders' && currentProfile?.loader === 'vanilla')).map(tab => {
                  if (tab.id !== detailTab) return null
                  const TabComp = tab.component
                  return (
                    <div key={`${tab.id}-${reloadKey}`} className="h-full">
                      <TabComp profile={currentProfile} accountId={accountId} onLaunch={handleLaunch} />
                    </div>
                  )
                })}
              </div>
              <div className="flex-1 min-w-0 border-l border-white/5">
                <AnalyticsPanel profileId={currentProfile?.id} t={t} />
              </div>
              </>
            )}
          </div>
        </div>
      </div>

      {profileSettingsOpen && currentProfile && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[150] p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setProfileSettingsOpen(false) }}
        >
          <GamingModalWrapper
            onClose={() => setProfileSettingsOpen(false)}
            className="border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]"
            style={{ background: 'rgba(14,14,14,0.98)' }}
          >
            <ProfileSettingsPanel
              profile={currentProfile}
              accountId={accountId}
              onClose={() => setProfileSettingsOpen(false)}
              onProfileUpdated={handleProfileUpdated}
            />
          </GamingModalWrapper>
        </div>
      )}
      {deleteTarget && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[150] p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null) }}
        >
          <GamingModalWrapper
            onClose={() => setDeleteTarget(null)}
            className="border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            style={{ background: 'rgba(14,14,14,0.98)' }}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-red-400">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">{t('homepage.profile.deleteTitle')}</h3>
                  <p className="text-sm text-white/50 mt-0.5">{t('homepage.profile.deleteDescription', { name: deleteTarget.name })}</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-6">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/8 hover:bg-white/12 text-white/60 hover:text-white transition-all"
                >
                  {t('homepage.profile.cancel')}
                </button>
                <button
                  onClick={() => handleDelete(deleteTarget.id)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-400 text-white transition-all"
                >
                  {t('homepage.profile.delete')}
                </button>
              </div>
            </div>
          </GamingModalWrapper>
        </div>
      )}
      {showCreate && (
        <CreateProfileModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
      {showImport && (
        <ImportProfileModal
          onClose={handleImportClose}
          onCreate={handleCreateForImport}
        />
      )}
    </div>
  )
}
