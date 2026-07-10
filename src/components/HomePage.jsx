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

import { useState, useEffect, useRef, useMemo } from 'react'
import { useAccounts } from '../hooks/useAccounts'
import PlayerHead from './ui/PlayerHead'
import ProfileSettingsPanel from './home/ProfileSettingsPanel'
import vanillaIcon from '../assets/loader/vanilla.png'
import fabricIcon from '../assets/loader/fabric.png'
import forgeIcon from '../assets/loader/forge.png'
import neoforgeIcon from '../assets/loader/neoforge.png'
import curseforgeIcon from '../assets/loader/curseforge.png'
import modrinthIcon from '../assets/loader/modrinth.png'
import defaultBg from '../assets/minecraft-versions/default.png'
import v112 from '../assets/minecraft-versions/1.12.png'
import v115 from '../assets/minecraft-versions/1.15.png'
import v116 from '../assets/minecraft-versions/1.16.png'
import v117 from '../assets/minecraft-versions/1.17.png'
import v118 from '../assets/minecraft-versions/1.18.png'
import v119 from '../assets/minecraft-versions/1.19.png'
import v120 from '../assets/minecraft-versions/1.20.png'
import v121 from '../assets/minecraft-versions/1.21.png'
import { useLang } from '../i18n/LangProvider'
import FriendsPanel from './friends/FriendsPanel'
import ModsTab from './home/tab/ModsTab'
import WorldsTab from './home/tab/WorldsTab'
import ShadersTab from './home/tab/ShadersTab'
import ResourcePacksTab from './home/tab/ResourcePacksTab'
import ServerBookmarksTab from './home/tab/ServerBookmarksTab'
import {
  Plus,
  CaretDown,
  Play,
  WarningCircle,
  ImageSquare,
  Check,
  SpinnerGap,
  Gear,
  List,
} from '@phosphor-icons/react'
import { Icons } from './home/tab/shared'

function markdownToHtml(text) {
  if (!text) return ''
  let html = String(text)

  html = html.replace(/<img[^>]*shields\.io[^>]*>/gi, '')
  html = html.replace(/!\[[^\]]*\]\(https?:\/\/img\.shields\.io[^)]*\)/g, '')

  html = html.replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,
    '<img src="$2" alt="$1" style="max-width:72px;max-height:72px;border-radius:12px;margin:6px auto;display:block;" />')

  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<span class="md-link" data-href="$2">$1 â†—</span>')

  html = html.replace(/^#{4,6}\s+(.+)$/gm, '<h4 class="md-h4">$1</h4>')
  html = html.replace(/^###\s+(.+)$/gm, '<h3 class="md-h3">$1</h3>')
  html = html.replace(/^##\s+(.+)$/gm, '<h2 class="md-h2">$1</h2>')
  html = html.replace(/^#\s+(.+)$/gm, '<h1 class="md-h1">$1</h1>')

  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  html = html.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')

  html = html.replace(/^>\s+(.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>')

  html = html.replace(/^---+$/gm, '<hr class="md-hr" />')

  html = html.replace(/^[-*]\s+(.+)$/gm, '<li class="md-li">$1</li>')
  html = html.replace(/(<li class="md-li">[\s\S]*?<\/li>\n?)+/g, m => `<ul class="md-ul">${m}</ul>`)

  html = html.replace(/^(?!<[a-zA-Z/]|$)(.+)$/gm, '<p class="md-p">$1</p>')

  return html
}

function renderInlineMarkdown(text) {
  const parts = []
  const regex = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s]+)/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))

    const token = match[0]
    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      parts.push(
        <button
          key={`${match.index}-link`}
          onClick={() => window.electronAPI?.openExternal?.(link[2])}
          className="text-orange-400 hover:text-orange-300 underline underline-offset-2"
        >
          {link[1]}
        </button>
      )
    } else if (token.startsWith('http')) {
      parts.push(
        <button
          key={`${match.index}-url`}
          onClick={() => window.electronAPI?.openExternal?.(token)}
          className="text-orange-400 hover:text-orange-300 underline underline-offset-2 break-all"
        >
          {token}
        </button>
      )
    } else if (token.startsWith('**')) {
      parts.push(<strong key={`${match.index}-bold`} className="text-white/90 font-bold">{token.slice(2, -2)}</strong>)
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

function renderPatchNotesBody(body, t) {
  const html = markdownToHtml(body)
  if (!html.trim()) return <p className="text-white/40">{t('homepage.patchnote.nopatchnote')}</p>

  return (
    <>
      <style>{`
        .md-h1 { font-size:1.25rem; font-weight:800; color:rgba(255,255,255,0.95); margin:16px 0 8px; }
        .md-h2 { font-size:1.1rem; font-weight:700; color:rgba(255,255,255,0.9); margin:14px 0 6px; }
        .md-h3 { font-size:0.95rem; font-weight:700; color:rgba(255,255,255,0.85); margin:12px 0 5px; display:flex; align-items:center; gap:6px; }
        .md-h4 { font-size:0.875rem; font-weight:600; color:rgba(255,255,255,0.75); margin:10px 0 4px; }
        .md-p  { color:rgba(255,255,255,0.65); margin:4px 0; line-height:1.6; font-size:0.875rem; }
        .md-ul { list-style:none; padding:0; margin:4px 0 8px; }
        .md-li { color:rgba(255,255,255,0.65); font-size:0.875rem; line-height:1.6; padding:2px 0 2px 16px; position:relative; }
        .md-li::before { content:"â€¢"; color:#fb923c; position:absolute; left:0; }
        .md-code { background:rgba(255,255,255,0.08); color:#86efac; padding:1px 5px; border-radius:4px; font-family:monospace; font-size:0.8rem; }
        .md-blockquote { border-left:3px solid rgba(251,146,60,0.4); padding:4px 12px; margin:8px 0; color:rgba(255,255,255,0.5); font-style:italic; font-size:0.875rem; }
        .md-hr { border:none; border-top:1px solid rgba(255,255,255,0.08); margin:12px 0; }
        .md-link { color:#fb923c; cursor:pointer; text-decoration:underline; text-underline-offset:2px; font-size:0.875rem; }
        .md-link:hover { color:#86efac; }
        strong { color:rgba(255,255,255,0.9); font-weight:700; }
        em { color:rgba(255,255,255,0.7); font-style:italic; }
      `}</style>
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={e => {
          const el = e.target.closest('.md-link')
          if (el) {
            const href = el.getAttribute('data-href')
            if (href) window.electronAPI?.openExternal?.(href)
          }
        }}
      />
    </>
  )
}

function PatchNotesModal({ patchNotes, onClose }) {
  const {t} = useLang()
  if (!patchNotes) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-[#141414] border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex-shrink-0 flex items-start justify-between px-6 py-4 border-b border-white/5">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white mb-1">{patchNotes.title}</h2>
            <p className="text-xs text-white/40">
              {t('homepage.patchnote.version')} {patchNotes.version}
              {patchNotes.publishedAt && (
                <>
                  {' '} Â· {new Date(patchNotes.publishedAt).toLocaleDateString('vi-VN')}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="max-w-none text-sm break-words font-sans">
            {renderPatchNotesBody(patchNotes.body, t)}
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-t border-white/5 bg-black/20">
          {patchNotes.htmlUrl && (
            <button
              onClick={() => window.electronAPI?.openExternal?.(patchNotes.htmlUrl)}
              className="text-xs text-orange-400 hover:text-orange-300 transition-colors underline underline-offset-2"
            >
              {t('homepage.patchnote.viewongithub')}
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-lg bg-orange-500/15 border border-orange-500/25 text-orange-400 text-xs font-semibold hover:bg-orange-500/25 transition-all"
          >
            {t('homepage.patchnote.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

function getAccountTypeLabel(type) {
  if (type === 'microsoft') return 'Microsoft'
  if (type === 'discord') return 'Discord Linked'
  return 'Offline Mode'
}

function AccountDropdown({ accounts, selectedAccount, selectAccount, onNavigate }) {
  const {t} = useLang()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  if (!selectedAccount && accounts.length === 0) {
    return (
      <button
        onClick={() => onNavigate?.('account')}
        className="w-full flex items-center gap-2 bg-white/3 border border-dashed border-white/10 rounded-xl px-3 py-2.5 text-white/30 hover:text-white/60 hover:border-white/20 transition-all text-xs"
      >
        <Plus size={16} weight="duotone" className="flex-shrink-0" />
        {t('homepage.acccount.addacccount')}
      </button>
    )
  }

  return (
    <div className="relative pb-2" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(v => !v)}
        className="w-full flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2 cursor-pointer hover:bg-white/8 hover:border-white/20 transition-all"
      >
        {selectedAccount && (
          <>
            <div className="rounded-md overflow-hidden flex-shrink-0">
              <PlayerHead uuid={selectedAccount.uuid} username={selectedAccount.username} size={28} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-sm text-white/80 font-medium truncate">{selectedAccount.username}</div>
              <div className="text-[10px] text-white/30">{getAccountTypeLabel(selectedAccount.type)}</div>
            </div>
          </>
        )}
        <CaretDown size={16} weight="duotone" className={`text-white/40 flex-shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {dropdownOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 max-h-64 overflow-y-auto bg-[#141414] border border-white/10 rounded-xl shadow-2xl z-50">
          <div className="px-3 py-2 border-b border-white/5">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{t("homepage.acccount.selectedaccount")}</p>
          </div>
          {accounts.length === 0 ? (
            <div className="px-3 py-3 text-[11px] text-white/25 text-center">{t("homepage.acccount.noacccount")}</div>
          ) : (
            <>
              {accounts.map(account => (
                <button
                  key={account.id}
                  onClick={() => {
                    selectAccount(account.id)
                    setDropdownOpen(false)
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-all ${selectedAccount?.id === account.id ? 'bg-white/5' : ''}`}
                >
                  <div className="rounded-md overflow-hidden flex-shrink-0">
                    <PlayerHead uuid={account.uuid} username={account.username} size={24} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white/80 font-semibold truncate">{account.username}</p>
                    <p className="text-[10px] text-white/30">{getAccountTypeLabel(account.type)}</p>
                  </div>
                  {selectedAccount?.id === account.id && (
                    <Check size={12} weight="duotone" className="text-orange-400 flex-shrink-0" />
                  )}
                </button>
              ))}
              <div className="border-t border-white/5" />
              <button
                onClick={() => {
                  onNavigate?.('account')
                  setDropdownOpen(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-all text-white/30 hover:text-white/60 text-xs"
              >
                <Plus size={16} weight="duotone" className="flex-shrink-0" />
                <span>{t('homepage.acccount.addacccount')}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const VERSION_IMAGES = { '1.12': v112, '1.15': v115, '1.16': v116, '1.17': v117, '1.18': v118, '1.19': v119, '1.20': v120, '1.21': v121 }
const LOADER_ICONS = { vanilla: vanillaIcon, fabric: fabricIcon, forge: forgeIcon, neoforge: neoforgeIcon }
const LOADER_COLORS = { vanilla: 'text-orange-400', fabric: 'text-purple-400', forge: 'text-orange-400', neoforge: 'text-rose-400' }
const LOADER_BG = {
  vanilla: 'bg-orange-500/15 border-orange-500/25',
  fabric: 'bg-purple-500/15 border-purple-500/25',
  forge: 'bg-orange-500/15 border-orange-500/25',
  neoforge: 'bg-rose-500/15 border-rose-500/25',
}
const IMPORT_SOURCE = {
  curseforge: { label: 'CurseForge', icon: curseforgeIcon, color: '#f97316' },
  modrinth: { label: 'Modrinth', icon: modrinthIcon, color: '#f97316' },
}

function getMajorVersion(v) {
  if (!v) return null
  const parts = v.split('.')
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : v
}
function getVersionImage(v) {
  return VERSION_IMAGES[getMajorVersion(v)] || defaultBg
}

const isElectron = typeof window !== 'undefined' && window.electronAPI

function formatRelativeTime(isoString, t) {
  if (!isoString) return ''
  const diff = Date.now() - new Date(isoString).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return t('homepage.relativetime.daysago', { count: d })
  if (h > 0) return t('homepage.relativetime.hoursago', { count: h })
  if (m > 0) return t('homepage.relativetime.minutesago', { count: m })
  return t('homepage.relativetime.justnow')
}

function ProfileContentPanel({ profile, accountId, onLaunch }) {
  const { t } = useLang()
  const isVanilla = !profile?.loader || profile.loader === 'vanilla'

  const ALL_TABS = [
    { id: 'mods',          labelKey: 'profileSettings.tabs.mods',          icon: Icons.mod,          component: ModsTab          },
    { id: 'worlds',        labelKey: 'profileSettings.tabs.worlds',        icon: Icons.world,        component: WorldsTab        },
    { id: 'shaders',       labelKey: 'profileSettings.tabs.shaders',       icon: Icons.shader,       component: ShadersTab       },
    { id: 'resourcepacks', labelKey: 'profileSettings.tabs.resourcepacks', icon: Icons.resourcepack, component: ResourcePacksTab },
    { id: 'servers',       labelKey: 'profileSettings.tabs.servers',       icon: Icons.server,       component: ServerBookmarksTab },
  ]

  const tabs = ALL_TABS.filter(tab => {
    if (tab.id === 'shaders' && isVanilla) return false
    return true
  })

  const [activeTab, setActiveTab] = useState('mods')

  useEffect(() => { setActiveTab('mods') }, [profile?.id])

  const currentTab = tabs.find(tab => tab.id === activeTab) || tabs[0]
  const TabComponent = currentTab?.component

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
        <div className="w-16 h-16 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center text-white/15">
          <ImageSquare size={32} weight="duotone" />
        </div>
        <div className="text-center max-w-xs">
          <p className="text-sm text-white/40 font-medium">{t('homepage.profile.noprofile')}</p>
          <p className="text-xs text-white/20 mt-1.5 leading-relaxed">{t('homepage.profile.createprofilehint')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 flex items-center gap-0.5 px-4 py-2 border-b border-white/5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
              activeTab === tab.id ? 'bg-white/10 text-white/90' : 'text-white/35 hover:text-white/65 hover:bg-white/5'
            }`}>
            <span className={activeTab === tab.id ? 'text-orange-400' : 'text-white/30'}>{tab.icon}</span>
            {t(tab.labelKey)}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
        {TabComponent && <TabComponent profile={profile} accountId={accountId} onLaunch={onLaunch} />}
      </div>
    </div>
  )
}

export default function HomePage({ onNavigate, launchState, progress, launchError, onLaunch, onLaunchReset }) {
  const {t} = useLang()
  const [ram, setRam] = useState(4)
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false)
  const [patchNotesModal, setPatchNotesModal] = useState(null)
  const ramSaveTimer = useRef(null)
  const patchNotesShownRef = useRef(new Set())

  useEffect(() => () => clearTimeout(ramSaveTimer.current), [])

  useEffect(() => {
    const loadPatchNotes = async () => {
      if (!isElectron) return

      try {
        const result = await window.electronAPI.getCurrentPatchNotes()

        if (!result.ok) return

        const versionKey = `patchnotes_${result.currentVersion}`
        if (patchNotesShownRef.current.has(versionKey)) return

        const timer = setTimeout(() => {
          setPatchNotesModal(result)
          patchNotesShownRef.current.add(versionKey)

          try {
            const shown = JSON.parse(localStorage.getItem('vxc_patchnotes_shown') || '[]')
            if (!shown.includes(versionKey)) {
              shown.push(versionKey)
              localStorage.setItem('vxc_patchnotes_shown', JSON.stringify(shown))
            }
          } catch {}
        }, 3000)

        return () => clearTimeout(timer)
      } catch {}
    }

    try {
      const shown = JSON.parse(localStorage.getItem('vxc_patchnotes_shown') || '[]')
      shown.forEach(v => patchNotesShownRef.current.add(v))
    } catch {}

    loadPatchNotes()
  }, [])

  const particles = useMemo(() => Array.from({ length: 20 }).map((_, i) => ({
    size: Math.random() * 3 + 1.5,
    left: Math.random() * 100,
    durationY: Math.random() * 5 + 4,
    durationX: Math.random() * 2 + 2,
    delay: Math.random() * 5,
    swayClass: `sway-${i % 3}`,
  })), [])

  function handleRamChange(newRam) {
    setRam(newRam)

    if (ramSaveTimer.current) clearTimeout(ramSaveTimer.current)
    ramSaveTimer.current = setTimeout(() => {
      if (selectedProfile && isElectron) {
        window.electronAPI.updateProfileRam(selectedProfile.id, newRam).catch(() => { })
      }
    }, 500)
  }
  const { accounts, selectedAccount, selectAccount } = useAccounts()

  const [selectedProfile, setSelectedProfile] = useState(null)
  const [profileStats, setProfileStats] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [profileDropOpen, setProfileDropOpen] = useState(false)
  const profileDropRef = useRef(null)

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (profileDropRef.current && !profileDropRef.current.contains(e.target)) setProfileDropOpen(false)
    }
    if (profileDropOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [profileDropOpen])

  async function handleSelectProfile(id) {
    if (!isElectron) return
    await window.electronAPI.selectProfile(id)
    const data = await window.electronAPI.getProfiles()
    setProfiles(data.profiles || [])
    const profile = data.profiles?.find(p => p.id === data.selectedProfileId) ?? null
    setSelectedProfile(profile)
    setProfileDropOpen(false)
    if (profile) {
      setRam(profile.ramGb ?? 4)
      const stats = await window.electronAPI.getProfileStats({ profileId: profile.id })
      setProfileStats(stats)
    }
  }

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = isElectron
          ? await window.electronAPI.getProfiles()
          : JSON.parse(localStorage.getItem('vxc_profiles') || '{"profiles":[],"selectedProfileId":null}')
        setProfiles(data.profiles || [])
        const profile = data.profiles?.find(p => p.id === data.selectedProfileId) ?? null
        setSelectedProfile(profile)

        setRam(profile?.ramGb ?? 4)

        if (profile && isElectron) {
          const stats = await window.electronAPI.getProfileStats({ profileId: profile.id })
          setProfileStats(stats)
        }
      } catch {
        setSelectedProfile(null)
      }
    }
    loadProfile()
  }, [])

  useEffect(() => {
    if (launchState === 'idle' && selectedProfile && isElectron) {
      window.electronAPI.getProfileStats({ profileId: selectedProfile.id })
        .then(stats => setProfileStats(stats))
        .catch(() => { })
    }
  }, [launchState, selectedProfile])

  const username = selectedAccount?.username ?? null
  const accountType = getAccountTypeLabel(selectedAccount?.type)

  function handleLaunch() {
    if (!selectedProfile || !isElectron) return
    if (launchState === 'running' || launchState === 'downloading') return
    onLaunch?.(selectedProfile.id, ram * 1024, selectedProfile.name, username || '')
  }

  const loaderKey = selectedProfile?.loader ?? 'vanilla'
  const launchColor = {
    vanilla: 'bg-orange-500 hover:bg-orange-400 shadow-orange-500/20',
    fabric: 'bg-purple-500 hover:bg-purple-400 shadow-purple-500/20',
    forge: 'bg-orange-500 hover:bg-orange-400 shadow-orange-500/20',
    neoforge: 'bg-rose-500 hover:bg-rose-400 shadow-rose-500/20',
  }[loaderKey] ?? 'bg-orange-500 hover:bg-orange-400 shadow-orange-500/20'

  const isDownloading = launchState === 'downloading'
  const isRunning = launchState === 'running'
  const isError = launchState === 'error'

  const hoursPlayed = profileStats ? Math.floor((profileStats.playtimeSeconds || 0) / 3600) : 0
  const worldCount = profileStats?.worldCount ?? 0
  const modCount = profileStats?.modCount ?? 0

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      <PatchNotesModal patchNotes={patchNotesModal} onClose={() => setPatchNotesModal(null)} />

      {/* ── Launch Panel ── */}
      <div className="flex-shrink-0 border-b border-white/5 bg-black/20 p-4">
        <div className="flex gap-4 items-stretch">
          {/* Bên trái: Profile card + Play overlay */}
          <div className="flex-1 min-w-0">
            {selectedProfile ? (
              <div className="relative rounded-xl overflow-hidden border border-white/8 cursor-pointer group" onClick={isError ? () => onLaunchReset?.() : handleLaunch}>
                <div className="relative h-48 overflow-hidden">
                  <img src={selectedProfile.importBgUrl || getVersionImage(selectedProfile.gameVersion)} alt={selectedProfile.gameVersion} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" draggable={false} onError={e => { e.currentTarget.src = getVersionImage(selectedProfile.gameVersion) }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
                  {/* Play button overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <div className={`px-5 py-2.5 rounded-xl flex items-center gap-2.5 transition-all shadow-lg group-hover:scale-105 ${isDownloading ? 'bg-black/60 border border-white/10' : isRunning ? 'bg-orange-500/30 border border-orange-500/40' : isError ? 'bg-red-500/30 border border-red-500/40' : `${launchColor} shadow-orange-500/30`}`}>
                      {isDownloading ? (
                        <SpinnerGap size={16} weight="duotone" className="animate-spin text-white/60" />
                      ) : isRunning ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse"/>
                      ) : isError ? (
                        <WarningCircle size={16} weight="duotone" className="text-red-400" />
                      ) : (
                        <Play size={16} weight="duotone" className="text-white" />
                      )}
                      <span className="text-sm font-bold text-white">{isDownloading ? `${progress?.percent ?? 0}%` : isRunning ? t('homepage.launch.playing') : isError ? t('homepage.launch.retry') : selectedProfile?.name}</span>
                    </div>
                    {/* Progress bar dưới nút play */}
                    {(isDownloading || isError) && (
                      <div className="w-48 flex flex-col gap-1">
                        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden backdrop-blur-sm">
                          <div className={`h-full rounded-full transition-all duration-500 ${isError ? 'bg-red-500' : 'bg-orange-400'}`} style={{ width: `${isError ? 100 : (progress?.percent ?? 0)}%` }} />
                        </div>
                        <div className="flex items-center justify-between px-0.5">
                          <span className="text-[9px] text-white/40 font-medium">
                            {progress?.phase === 'java' ? t('homepage.progress.java') : progress?.phase === 'assets' ? t('homepage.progress.assets') : progress?.phase === 'launching' ? t('homepage.progress.launching') : progress?.phase === 'resolve' ? t('homepage.progress.resolve') : t('homepage.progress.preparing')}
                          </span>
                          <div className="flex items-center gap-2 text-[9px] text-white/30">
                            {progress?.speed > 0 && <span>{(progress.speed / 1024 / 1024).toFixed(1)} MB/s</span>}
                            {progress?.totalFiles > 0 && <span>{progress.doneFiles ?? 0}/{progress.totalFiles}</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Info bottom */}
                  <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                    <div>
                      <p className="text-sm font-bold text-white truncate">{selectedProfile.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-mono text-white/70 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded border border-white/10">{selectedProfile.gameVersion}</span>
                        <span className={`text-[10px] font-bold capitalize ${LOADER_COLORS[selectedProfile.loader] || 'text-orange-400'}`}>{selectedProfile.loader}</span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border backdrop-blur-sm ${LOADER_BG[selectedProfile.loader] || LOADER_BG.vanilla}`}>
                      <img src={selectedProfile.importIconUrl || LOADER_ICONS[selectedProfile.loader] || vanillaIcon} className="w-3 h-3 object-contain" draggable={false} onError={e => { e.currentTarget.src = vanillaIcon }} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={() => onNavigate?.('play')} className="w-full h-48 flex items-center bg-white/3 border border-dashed border-white/10 rounded-xl px-3 text-white/30 hover:text-white/60 hover:border-white/20 transition-all text-xs justify-center flex-col gap-1.5">
                <Plus size={20} weight="duotone" className="opacity-40" />
                <span>{t('homepage.profile.createprofile')}</span>
              </button>
            )}
          </div>

          {/* Bên phải: Account + Settings */}
          <div className="w-56 flex-shrink-0 flex flex-col gap-2.5">
            <AccountDropdown accounts={accounts} selectedAccount={selectedAccount} selectAccount={selectAccount} onNavigate={onNavigate} />
            {selectedProfile && (
              <button onClick={() => { setProfileSettingsOpen(v => !v) }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${profileSettingsOpen ? 'bg-orange-500/15 border-orange-500/25 text-orange-400' : 'bg-white/3 border-white/8 text-white/40 hover:text-white/70 hover:bg-white/6 hover:border-white/15'}`}>
                <Gear size={14} weight="duotone" className="flex-shrink-0" />
                {profileSettingsOpen ? t('homepage.profile.closesettings') : t('homepage.profile.settings')}
                <span className="ml-auto text-[10px] text-white/20">{selectedProfile.ramGb ?? 4} GB</span>
              </button>
            )}
            {/* Profile selector dropdown */}
            <div className="relative" ref={profileDropRef}>
              <button onClick={() => setProfileDropOpen(v => !v)} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/30 hover:text-white/60 bg-white/3 border border-white/6 hover:border-white/12 transition-all">
                <List size={14} weight="duotone" className="opacity-50" />
                <span className="flex-1 text-left truncate">{t('homepage.profile.label')}</span>
                <CaretDown size={12} weight="duotone" className={`transition-transform duration-200 ${profileDropOpen ? 'rotate-180' : ''}`} />
              </button>
              {profileDropOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 max-h-52 overflow-y-auto bg-[#141414] border border-white/10 rounded-xl shadow-2xl z-50" style={{ scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
                  {profiles.length === 0 ? (
                    <div className="px-3 py-3 text-[11px] text-white/25 text-center">Chưa có profile</div>
                  ) : profiles.map(p => (
                    <button key={p.id} onClick={() => handleSelectProfile(p.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/5 transition-all ${p.id === selectedProfile?.id ? 'bg-white/5' : ''}`}>
                      <img src={p.importIconUrl || LOADER_ICONS[p.loader] || vanillaIcon} className="w-5 h-5 object-contain rounded flex-shrink-0" onError={e => { e.currentTarget.src = vanillaIcon }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/80 font-semibold truncate">{p.name}</p>
                        <p className="text-[10px] text-white/30 truncate">{p.gameVersion} · {p.loader}</p>
                      </div>
                      {p.id === selectedProfile?.id && (
                        <Check size={14} weight="duotone" className="text-orange-400 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                  <div className="border-t border-white/5">
                    <button onClick={() => { setProfileDropOpen(false); onNavigate?.('play') }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5 transition-all text-white/30 hover:text-white/60">
                      <Plus size={14} weight="duotone" />
                      <span className="text-[11px]">Quản lý profile</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="flex flex-1 overflow-hidden gap-0">
        {}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden relative">
            <div className="absolute inset-0 overflow-y-auto" style={{ scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
              <ProfileContentPanel profile={selectedProfile} accountId={selectedAccount?.id} onLaunch={onLaunch} />
            </div>
            {profileSettingsOpen && selectedProfile && (
              <div className="absolute inset-0 z-10 bg-[#0f0f0f]">
                <ProfileSettingsPanel
                  profile={selectedProfile}
                  accountId={selectedAccount?.id}
                  onClose={() => setProfileSettingsOpen(false)}
                  onProfileUpdated={(p) => {
                    setProfiles(prev => prev.map(pr => pr.id === p.id ? p : pr))
                    setSelectedProfile(p)
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {}
        <div className="w-80 flex-shrink-0 border-l border-white/5 bg-black/20 flex flex-col overflow-hidden">
          <FriendsPanel />
        </div>
      </div>
    </div>
  )
}

