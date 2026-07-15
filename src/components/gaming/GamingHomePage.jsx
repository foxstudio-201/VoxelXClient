import { useState, useRef, useEffect } from 'react'
import { useAccounts } from '../../hooks/useAccounts'
import { useLang } from '../../i18n/LangProvider'
import { Gear, PlayCircle } from '@phosphor-icons/react'
import ProfileSettingsPanel from '../home/ProfileSettingsPanel'
import GamingModalWrapper from '../ui/GamingModalWrapper'
import ModsTab from '../home/tab/ModsTab'
import WorldsTab from '../home/tab/WorldsTab'
import ShadersTab from '../home/tab/ShadersTab'
import ResourcePacksTab from '../home/tab/ResourcePacksTab'
import ServerBookmarksTab from '../home/tab/ServerBookmarksTab'
import defaultBg from '../../assets/minecraft-versions/default.png'
import vanillaIcon from '../../assets/loader/vanilla.png'
import fabricIcon from '../../assets/loader/fabric.png'
import forgeIcon from '../../assets/loader/forge.png'
import neoforgeIcon from '../../assets/loader/neoforge.png'
import v112 from '../../assets/minecraft-versions/1.12.png'
import v115 from '../../assets/minecraft-versions/1.15.png'
import v116 from '../../assets/minecraft-versions/1.16.png'
import v117 from '../../assets/minecraft-versions/1.17.png'
import v118 from '../../assets/minecraft-versions/1.18.png'
import v119 from '../../assets/minecraft-versions/1.19.png'
import v120 from '../../assets/minecraft-versions/1.20.png'
import v121 from '../../assets/minecraft-versions/1.21.png'

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

export default function GamingHomePage({ onNavigate, launchState, progress, launchError, onLaunch, onLaunchReset, profiles, selectedProfileId, accountId, activePage, onOpenSettings, onProfileUpdated, instances, onKillInstance }) {
  const { t } = useLang()
  const { selectedAccount } = useAccounts()
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [detailTab, setDetailTab] = useState('mods')
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false)
  const carouselRef = useRef(null)
  const containerRef = useRef(null)

  const profileList = profiles || []
  const currentProfile = profileList[selectedIdx] || null
  const colors = LOADER_COLORS[currentProfile?.loader] || LOADER_COLORS.vanilla
  const profileIcon = currentProfile?.importIconUrl || LOADER_ICONS[currentProfile?.loader] || vanillaIcon

  // Tìm instance đang chạy của một profile cụ thể
  function getProfileInstance(profileId) {
    if (!instances || !profileId) return null
    return instances.find(inst => inst.profileId === profileId && inst.state !== 'stopped') || null
  }

  function getProfileState(profileId) {
    const inst = getProfileInstance(profileId)
    if (!inst) return 'idle'
    return inst.state // 'downloading' | 'running' | 'error' | 'stopped'
  }

  function goNext() {
    if (selectedIdx < profileList.length - 1) setSelectedIdx(selectedIdx + 1)
  }
  function goPrev() {
    if (selectedIdx > 0) setSelectedIdx(selectedIdx - 1)
  }
  function goToCard(idx) {
    setSelectedIdx(idx)
  }
  function openDetails() {
    if (currentProfile) setExpanded(true)
  }
  function closeExpanded() { setExpanded(false) }

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
    onLaunch(pid, ramMb || (p.ramGb || 4) * 1024, profileName || p.name, accountName || selectedAccount?.username || '', serverAddress)
  }

  function handleKill(profileId) {
    const inst = getProfileInstance(profileId)
    if (!inst || !onKillInstance) return
    onKillInstance(inst.key)
  }

  const currentInst = getProfileInstance(currentProfile?.id)
  const playing = getProfileState(currentProfile?.id) === 'running'
  const downloading = getProfileState(currentProfile?.id) === 'downloading'
  const currentProgress = currentInst?.progress

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden select-none">

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
                <p className="text-xs">Tạo profile mới để bắt đầu</p>
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
                className="absolute rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl cursor-pointer focus:outline-none text-left group"
                style={{
                  width: CARD_W,
                  height: CARD_H,
                  transform: `translateX(${x}px) scale(${scale})`,
                  zIndex: z,
                  opacity,
                  transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                }}>
                <div className="absolute inset-0" style={{ background: vc }} />
                <img src={p.importBgUrl || getVersionImage(p.gameVersion)}
                  className="absolute inset-0 w-full h-full object-cover"
                  alt=""
                  draggable={false}
                  onError={e => { e.currentTarget.style.display = 'none' }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                {i === selectedIdx && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setProfileSettingsOpen(true) }}
                      className="absolute top-3 left-3 z-10 w-8 h-8 rounded-lg bg-black/45 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/65 transition-all"
                      title={t('homepage.profile.settings')}
                      aria-label={t('homepage.profile.settings')}
                    >
                      <Gear size={16} weight="duotone" />
                    </button>
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
                    const pInst = getProfileInstance(p.id)
                    const pPlaying = getProfileState(p.id) === 'running'
                    const pDownloading = getProfileState(p.id) === 'downloading'
                    const pActive = pPlaying || pDownloading
                    return (
                      <div className="flex gap-2 mb-3">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); if (!pActive) handleLaunch() }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all hover:brightness-110 active:scale-95 shadow-xl"
                          style={{ background: lc.primary, color: '#000', opacity: pActive ? 0.75 : 1 }}
                        >
                          <PlayCircle size={20} weight="fill" />
                          {pPlaying ? t('gaming.playing') : pDownloading ? `${pInst?.progress?.percent || 0}%` : t('gaming.play')}
                        </button>
                        {pActive && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleKill(p.id) }}
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

                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: lc.primary }} />
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
          <button onClick={openDetails}
            className="flex items-center gap-2 px-7 py-2.5 rounded-full text-sm font-bold transition-all hover:scale-105 active:scale-95 shadow-lg"
            style={{ background: colors.primary, color: '#000' }}>
            <PlayCircle size={18} weight="duotone" />
            {t('gaming.select')}
          </button>
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
              <div>
                <h2 className="text-white font-bold text-lg">{currentProfile?.name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${colors.primary}22`, color: colors.primary }}>
                    {currentProfile?.gameVersion}
                  </span>
                  <span className="text-[10px] text-white/40">{getLoaderTag(currentProfile)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { if (!playing && !downloading) handleLaunch() }}
                className="px-5 py-2 rounded-xl font-semibold text-sm transition-all active:scale-95"
                style={{ background: colors.primary, color: '#000', opacity: (playing || downloading) ? 0.75 : 1 }}>
                {playing ? t('gaming.playing') : downloading ? `${currentProgress?.percent || 0}%` : t('gaming.play')}
              </button>
              {(playing || downloading) && (
                <button
                  onClick={() => handleKill(currentProfile?.id)}
                  className="px-3 py-2 rounded-xl font-semibold text-sm transition-all active:scale-95 bg-red-500/80 hover:bg-red-500 text-white flex items-center gap-1.5"
                  title={t('homepage.launch.kill')}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                  {t('homepage.launch.kill')}
                </button>
              )}
              <button onClick={closeExpanded}
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            </div>
          </div>

          <div className="flex-shrink-0 flex gap-1 px-6 pt-2 pb-0 border-b border-white/5">
            {ALL_TABS.filter(t => !(t.id === 'shaders' && currentProfile?.loader === 'vanilla')).map(tab => (
              <button key={tab.id} onClick={() => setDetailTab(tab.id)}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
                  detailTab === tab.id
                    ? 'border-orange-500 text-orange-400'
                    : 'border-transparent text-white/35 hover:text-white/60'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {ALL_TABS.filter(t => !(t.id === 'shaders' && currentProfile?.loader === 'vanilla')).map(tab => {
              const TabComp = tab.component
              return (
                <div key={tab.id} className={detailTab === tab.id ? 'block' : 'hidden'}>
                  <TabComp profile={currentProfile} accountId={accountId} onLaunch={handleLaunch} />
                </div>
              )
            })}
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
              onProfileUpdated={onProfileUpdated}
            />
          </GamingModalWrapper>
        </div>
      )}
    </div>
  )
}
