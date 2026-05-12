/**
 * VoxelXClient — Minecraft Launcher
 * Created by FoxStudio. AI-assisted development.
 *
 * Source code : https://github.com/foxstudio-201/VoxelXClient
 * Website     : https://voxxelxclient.vercel.app
 *
 * NOTICE:
 *   - This software is provided as-is without warranty of any kind.
 *   - Do not redistribute or resell without explicit permission from FoxStudio.
 *   - If you use or reference this code, please credit FoxStudio.
 *   - Minecraft is a trademark of Mojang Studios / Microsoft. This project is not affiliated with Mojang.
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

// Convert markdown+HTML release body to clean HTML for rendering
function markdownToHtml(text) {
  if (!text) return ''
  let html = String(text)

  // Remove shields.io badge images (noise)
  html = html.replace(/<img[^>]*shields\.io[^>]*>/gi, '')
  html = html.replace(/!\[[^\]]*\]\(https?:\/\/img\.shields\.io[^)]*\)/g, '')

  // Convert markdown images to <img> (logo etc)
  html = html.replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,
    '<img src="$2" alt="$1" style="max-width:72px;max-height:72px;border-radius:12px;margin:6px auto;display:block;" />')

  // Convert markdown links
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<span class="md-link" data-href="$2">$1 ↗</span>')

  // Headings
  html = html.replace(/^#{4,6}\s+(.+)$/gm, '<h4 class="md-h4">$1</h4>')
  html = html.replace(/^###\s+(.+)$/gm, '<h3 class="md-h3">$1</h3>')
  html = html.replace(/^##\s+(.+)$/gm, '<h2 class="md-h2">$1</h2>')
  html = html.replace(/^#\s+(.+)$/gm, '<h1 class="md-h1">$1</h1>')

  // Bold/italic/code
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  html = html.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')

  // Blockquote
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>')

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr class="md-hr" />')

  // Bullet lists
  html = html.replace(/^[-*]\s+(.+)$/gm, '<li class="md-li">$1</li>')
  html = html.replace(/(<li class="md-li">[\s\S]*?<\/li>\n?)+/g, m => `<ul class="md-ul">${m}</ul>`)

  // Paragraphs
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
          className="text-green-400 hover:text-green-300 underline underline-offset-2"
        >
          {link[1]}
        </button>
      )
    } else if (token.startsWith('http')) {
      parts.push(
        <button
          key={`${match.index}-url`}
          onClick={() => window.electronAPI?.openExternal?.(token)}
          className="text-green-400 hover:text-green-300 underline underline-offset-2 break-all"
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

function renderPatchNotesBody(body) {
  const html = markdownToHtml(body)
  if (!html.trim()) return <p className="text-white/40">Không có nội dung patch note</p>

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
        .md-li::before { content:"•"; color:#4ade80; position:absolute; left:0; }
        .md-code { background:rgba(255,255,255,0.08); color:#86efac; padding:1px 5px; border-radius:4px; font-family:monospace; font-size:0.8rem; }
        .md-blockquote { border-left:3px solid rgba(74,222,128,0.4); padding:4px 12px; margin:8px 0; color:rgba(255,255,255,0.5); font-style:italic; font-size:0.875rem; }
        .md-hr { border:none; border-top:1px solid rgba(255,255,255,0.08); margin:12px 0; }
        .md-link { color:#4ade80; cursor:pointer; text-decoration:underline; text-underline-offset:2px; font-size:0.875rem; }
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

// ─── PatchNotesModal ──────────────────────────────────────────────────────────
function PatchNotesModal({ patchNotes, onClose }) {
  if (!patchNotes) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-[#141414] border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex-shrink-0 flex items-start justify-between px-6 py-4 border-b border-white/5">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white mb-1">{patchNotes.title}</h2>
            <p className="text-xs text-white/40">
              Phiên bản {patchNotes.version}
              {patchNotes.publishedAt && (
                <>
                  {' '} · {new Date(patchNotes.publishedAt).toLocaleDateString('vi-VN')}
                </>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-4 w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
            title="Đóng"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="max-w-none text-sm break-words font-sans">
            {renderPatchNotesBody(patchNotes.body)}
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-t border-white/5 bg-black/20">
          {patchNotes.htmlUrl && (
            <button
              onClick={() => window.electronAPI?.openExternal?.(patchNotes.htmlUrl)}
              className="text-xs text-green-400 hover:text-green-300 transition-colors underline underline-offset-2"
            >
              Xem trên GitHub →
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-lg bg-green-500/15 border border-green-500/25 text-green-400 text-xs font-semibold hover:bg-green-500/25 transition-all"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── AccountDropdown ──────────────────────────────────────────────────────────
function AccountDropdown({ accounts, selectedAccount, selectAccount, onNavigate }) {
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
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
        Thêm tài khoản
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
              <div className="text-[10px] text-white/30">{selectedAccount.type === 'microsoft' ? 'Microsoft' : 'Offline Mode'}</div>
            </div>
          </>
        )}
        <svg viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 text-white/40 flex-shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}>
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>

      {dropdownOpen && (
        <div className="absolute left-0 right-0 bottom-full mb-1 max-h-64 overflow-y-auto bg-[#141414] border border-white/10 rounded-xl shadow-2xl z-50">
          <div className="px-3 py-2 border-b border-white/5">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Select Account</p>
          </div>
          {accounts.length === 0 ? (
            <div className="px-3 py-3 text-[11px] text-white/25 text-center">Không có tài khoản nào</div>
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
                    <p className="text-[10px] text-white/30">{account.type === 'microsoft' ? 'Microsoft' : 'Offline Mode'}</p>
                  </div>
                  {selectedAccount?.id === account.id && (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-green-400 flex-shrink-0">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
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
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
                <span>Thêm tài khoản</span>
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
const LOADER_COLORS = { vanilla: 'text-green-400', fabric: 'text-purple-400', forge: 'text-orange-400', neoforge: 'text-rose-400' }
const LOADER_BG = {
  vanilla: 'bg-green-500/15 border-green-500/25',
  fabric: 'bg-purple-500/15 border-purple-500/25',
  forge: 'bg-orange-500/15 border-orange-500/25',
  neoforge: 'bg-rose-500/15 border-rose-500/25',
}
const IMPORT_SOURCE = {
  curseforge: { label: 'CurseForge', icon: curseforgeIcon, color: '#f97316' },
  modrinth: { label: 'Modrinth', icon: modrinthIcon, color: '#22c55e' },
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

function formatRelativeTime(isoString) {
  if (!isoString) return ''
  const diff = Date.now() - new Date(isoString).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d} ngày trước`
  if (h > 0) return `${h} giờ trước`
  if (m > 0) return `${m} phút trước`
  return 'vừa xong'
}

const NEWS = [
  {
    id: 1,
    tag: 'UPDATE',
    tagColor: 'bg-green-500/20 text-green-400',
    title: 'Minecraft 1.21.5 – Spring to Life',
    desc: 'Leaf litter, fireflies, and new biome updates arrive in the latest snapshot.',
    date: 'May 7, 2026',
    img: null,
    gradient: 'from-green-900/60 to-emerald-800/30',
  },
  {
    id: 2,
    tag: 'EVENT',
    tagColor: 'bg-blue-500/20 text-blue-400',
    title: 'Community Build Challenge',
    desc: 'Show off your best medieval builds and win exclusive in-game rewards.',
    date: 'May 3, 2026',
    img: null,
    gradient: 'from-blue-900/60 to-indigo-800/30',
  },
  {
    id: 3,
    tag: 'MODS',
    tagColor: 'bg-purple-500/20 text-purple-400',
    title: 'Top 10 Mods This Month',
    desc: 'From performance boosts to new dimensions — the best mods of April 2026.',
    date: 'Apr 30, 2026',
    img: null,
    gradient: 'from-purple-900/60 to-violet-800/30',
  },
]

// ─── NewsPanel ────────────────────────────────────────────────────────────────
function NewsPanel() {
  return (
    <div className="overflow-y-auto px-6 py-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest">Latest News</h2>
        <button className="text-xs text-green-400/60 hover:text-green-400 transition-colors">View all →</button>
      </div>
      <div className="flex flex-col gap-3">
        {NEWS.map((item) => (
          <article key={item.id}
            className={`relative rounded-xl overflow-hidden border border-white/5 bg-gradient-to-r ${item.gradient} hover:border-white/10 transition-all duration-200 cursor-pointer group`}>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.tagColor}`}>{item.tag}</span>
                    <span className="text-[10px] text-white/25">{item.date}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors leading-snug">{item.title}</h3>
                  <p className="text-xs text-white/40 mt-1 leading-relaxed line-clamp-2">{item.desc}</p>
                </div>
                <div className="w-16 h-14 rounded-lg bg-white/5 flex-shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white/10">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                  </svg>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

// ─── InstanceLogPanel ─────────────────────────────────────────────────────────
function InstanceLogPanel({ instance, onKill }) {
  const logEndRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [copiedLine, setCopiedLine] = useState(null)

  const logs = instance.logs || []
  const progress = instance.progress

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  function parseLevel(line) {
    if (/\/(INFO)\]/.test(line)) return 'INFO'
    if (/\/(WARN)\]/.test(line)) return 'WARN'
    if (/\/(ERROR)\]/.test(line)) return 'ERROR'
    if (/\/(DEBUG)\]/.test(line)) return 'DEBUG'
    if (/\/(FATAL)\]/.test(line)) return 'FATAL'
    if (line.startsWith('[ERR]')) return 'ERROR'
    if (line.startsWith('[Launcher]')) return 'DEBUG'
    return 'OTHER'
  }

  const levelColor = {
    INFO: 'text-green-400',
    WARN: 'text-yellow-400',
    ERROR: 'text-red-400',
    DEBUG: 'text-blue-400',
    FATAL: 'text-pink-400',
    OTHER: 'text-white/35',
  }

  const filteredLogs = filter === 'ALL' ? logs : logs.filter(l => parseLevel(l) === filter)

  const errorLines = logs.filter(l => { const lv = parseLevel(l); return lv === 'ERROR' || lv === 'FATAL' })

  const FILTERS = ['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG']

  const [copiedFilter, setCopiedFilter] = useState(false)

  function copyFilteredLogs() {
    if (filteredLogs.length === 0) return
    navigator.clipboard.writeText(filteredLogs.join('\n')).then(() => {
      setCopiedFilter(true)
      setTimeout(() => setCopiedFilter(false), 1500)
    })
  }

  function copyLine(line, idx) {
    navigator.clipboard.writeText(line).then(() => {
      setCopiedLine(idx)
      setTimeout(() => setCopiedLine(null), 1500)
    })
  }

  function copyAllErrors() {
    navigator.clipboard.writeText(errorLines.join('\n'))
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0a0a0a]/50">
      {}
      {(instance.state === 'downloading') && progress && (
        <div className="flex-shrink-0 px-4 py-2 border-b border-white/5 bg-black/20">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-white/50">
              {progress.phase === 'java' ? 'Installing Java...' :
                progress.phase === 'assets' ? 'Downloading assets...' :
                  progress.phase === 'launching' ? 'Launching...' : 'Preparing...'}
            </span>
            <div className="flex items-center gap-3 text-[10px] text-white/30">
              {progress.speed > 0 && <span>{(progress.speed / 1024 / 1024).toFixed(1)} MB/s</span>}
              {progress.totalFiles > 0 && <span>{progress.doneFiles ?? 0}/{progress.totalFiles}</span>}
              {progress.percent > 0 && <span className="font-mono font-bold text-white/50">{progress.percent}%</span>}
            </div>
          </div>
          <div className="w-full h-1 bg-white/8 rounded-full overflow-hidden">
            <div className="h-full bg-green-400 rounded-full transition-all duration-500"
              style={{ width: `${progress.percent ?? 0}%` }} />
          </div>
        </div>
      )}

      {}
      {errorLines.length > 0 && (
        <div className="flex-shrink-0 flex items-start gap-2 px-3 py-2 bg-red-500/8 border-b border-red-500/20">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-red-400">{errorLines.length} error{errorLines.length > 1 ? 's' : ''} detected</p>
            <p className="text-[10px] text-red-400/60 truncate mt-0.5">{errorLines[errorLines.length - 1]}</p>
          </div>
          <button
            onClick={copyAllErrors}
            className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded bg-red-500/15 border border-red-500/25 text-red-400 text-[10px] font-semibold hover:bg-red-500/25 transition-all"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
            </svg>
            Copy errors
          </button>
        </div>
      )}

      {}
      <div className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 border-b border-white/5 bg-black/10">
        {FILTERS.map(f => {
          const errCount = f === 'ERROR' ? errorLines.length : 0
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`relative px-2 py-0.5 rounded text-[10px] font-bold transition-all
                ${filter === f ? 'bg-white/10 text-white/70' : 'text-white/25 hover:text-white/50'}`}>
              {f}
              {errCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-bold">
                  {errCount > 9 ? '9+' : errCount}
                </span>
              )}
            </button>
          )
        })}
        <span className="ml-auto text-[10px] text-white/20">{filteredLogs.length} lines</span>
        <button
          onClick={copyFilteredLogs}
          title={`Copy ${filter === 'ALL' ? 'all' : filter} logs`}
          className={`ml-2 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-all
            ${copiedFilter ? 'bg-green-500/15 text-green-400' : 'text-white/25 hover:text-white/60 hover:bg-white/5'}`}
        >
          {copiedFilter ? (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
              Copied
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" /></svg>
              Copy
            </>
          )}
        </button>
        <button
          onClick={() => setAutoScroll(v => !v)}
          className={`ml-1 text-[10px] px-2 py-0.5 rounded transition-all
            ${autoScroll ? 'bg-green-500/15 text-green-400' : 'text-white/25 hover:text-white/50'}`}
        >↓</button>
      </div>

      {}
      <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed"
        onScroll={e => {
          const el = e.currentTarget
          setAutoScroll(el.scrollTop + el.clientHeight >= el.scrollHeight - 30)
        }}>
        {filteredLogs.length === 0 ? (
          <p className="text-white/20 text-center py-8">
            {instance.state === 'downloading'
              ? <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-3 h-3 text-green-400/50" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Đang khởi động...
              </span>
              : 'No logs yet'
            }
          </p>
        ) : (
          filteredLogs.map((line, i) => {
            const level = parseLevel(line)
            const isError = level === 'ERROR' || level === 'FATAL'
            return (
              <div
                key={i}
                className={`group flex gap-2 py-0.5 rounded px-1 cursor-pointer
                  ${isError ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-white/3'}
                `}
                onClick={() => copyLine(line, i)}
                title="Click to copy"
              >
                <span className={`flex-shrink-0 font-bold min-w-[36px] text-right ${levelColor[level] ?? 'text-white/30'}`}>
                  {level === 'OTHER' ? '' : level}
                </span>
                <span className={`flex-1 break-all ${isError ? 'text-red-300/90' :
                  level === 'WARN' ? 'text-yellow-200/70' :
                    level === 'DEBUG' ? 'text-blue-300/60' :
                      'text-white/55'
                  }`}>{line}</span>
                {}
                <span className={`flex-shrink-0 text-[9px] transition-all duration-150
                  ${copiedLine === i ? 'text-green-400 opacity-100' : 'text-white/20 opacity-0 group-hover:opacity-100'}`}>
                  {copiedLine === i ? '✓' : '⎘'}
                </span>
              </div>
            )
          })
        )}
        <div ref={logEndRef} />
      </div>

      {}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-1 border-t border-white/5 bg-black/20 text-[10px]">
        <span className={
          instance.state === 'running' ? 'text-green-400' :
            instance.state === 'stopped' ? 'text-white/30' :
              instance.state === 'error' ? 'text-red-400' :
                instance.state === 'downloading' ? 'text-yellow-400' : 'text-white/30'
        }>
          {instance.state === 'running' ? '● Running' :
            instance.state === 'stopped' ? '■ Stopped' :
              instance.state === 'error' ? '✕ Error' :
                instance.state === 'downloading' ? '⟳ Loading...' : ''}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-white/20">{instance.profileName} @ {instance.accountName}</span>
          {(instance.state === 'running' || instance.state === 'downloading') && (
            <button
              onClick={() => onKill?.(instance.key)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/15 border border-red-500/20 text-red-400 text-[10px] font-semibold hover:bg-red-500/25 transition-all"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
              Kill
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function HomePage({ onNavigate, launchState, progress, launchError, onLaunch, onLaunchReset, instances = [], onKillInstance }) {
  const [ram, setRam] = useState(4)
  const [activeLogTab, setActiveLogTab] = useState(null)
  const [logPanelOpen, setLogPanelOpen] = useState(false)
  const [logDropdownOpen, setLogDropdownOpen] = useState(false)
  const [savedLog, setSavedLog] = useState(null)
  const [savedLogLoading, setSavedLogLoading] = useState(false)
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false)
  const [patchNotesModal, setPatchNotesModal] = useState(null)
  const logDropdownRef = useRef(null)
  const ramSaveTimer = useRef(null)
  const patchNotesShownRef = useRef(new Set())

  useEffect(() => () => clearTimeout(ramSaveTimer.current), [])

  // Load patch notes on mount
  useEffect(() => {
    const loadPatchNotes = async () => {
      if (!isElectron) return

      try {
        const result = await window.electronAPI.getCurrentPatchNotes()

        if (!result.ok) return

        const versionKey = `patchnotes_${result.currentVersion}`
        if (patchNotesShownRef.current.has(versionKey)) return

        // Show modal after 3 seconds
        const timer = setTimeout(() => {
          setPatchNotesModal(result)
          patchNotesShownRef.current.add(versionKey)
          // Persist to localStorage to survive app restarts
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

    // Load previously shown versions from localStorage
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

  useEffect(() => {
    function handleClickOutside(e) {
      if (logDropdownRef.current && !logDropdownRef.current.contains(e.target)) {
        setLogDropdownOpen(false)
      }
    }
    if (logDropdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [logDropdownOpen])

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

  useEffect(() => {
    if (instances.length > 0 && !activeLogTab) {
      setActiveLogTab(instances[0].key)
      setLogPanelOpen(true)
    }

    if (activeLogTab && instances.length > 0 && !instances.find(i => i.key === activeLogTab)) {
      setActiveLogTab(instances[0]?.key ?? null)
    }
  }, [instances, activeLogTab])

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = isElectron
          ? await window.electronAPI.getProfiles()
          : JSON.parse(localStorage.getItem('vxc_profiles') || '{"profiles":[],"selectedProfileId":null}')
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
  const accountType = selectedAccount?.type === 'microsoft' ? 'Microsoft' : 'Offline Mode'

  function handleLaunch() {
    if (!selectedProfile || !isElectron) return
    if (launchState === 'running' || launchState === 'downloading') return
    onLaunch?.(selectedProfile.id, ram * 1024, selectedProfile.name, username || '')
  }

  const loaderKey = selectedProfile?.loader ?? 'vanilla'
  const launchColor = {
    vanilla: 'bg-green-500 hover:bg-green-400 shadow-green-500/20',
    fabric: 'bg-purple-500 hover:bg-purple-400 shadow-purple-500/20',
    forge: 'bg-orange-500 hover:bg-orange-400 shadow-orange-500/20',
    neoforge: 'bg-rose-500 hover:bg-rose-400 shadow-rose-500/20',
  }[loaderKey] ?? 'bg-green-500 hover:bg-green-400 shadow-green-500/20'

  const isDownloading = launchState === 'downloading'
  const isRunning = launchState === 'running'
  const isError = launchState === 'error'

  const hoursPlayed = profileStats ? Math.floor((profileStats.playtimeSeconds || 0) / 3600) : 0
  const worldCount = profileStats?.worldCount ?? 0
  const modCount = profileStats?.modCount ?? 0

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      <PatchNotesModal patchNotes={patchNotesModal} onClose={() => setPatchNotesModal(null)} />

      {}
      <div className="relative flex-shrink-0 h-56 overflow-hidden">
        {}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d2b1a] via-[#0a1a0f] to-[#050d07]">
          {}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(rgba(74,222,128,0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(74,222,128,0.3) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          />
          {}
          <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-green-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-1/4 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-400/8 rounded-full blur-3xl" />
        </div>

        {}
        <div className="absolute right-12 top-8 opacity-20">
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-sm"
                style={{
                  background: i % 3 === 0
                    ? '#4ade80'
                    : i % 3 === 1
                      ? '#22c55e'
                      : '#16a34a',
                  opacity: 0.6 + (i % 3) * 0.2,
                }}
              />
            ))}
          </div>
        </div>

        {}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {particles.map((p, i) => (
            <div
              key={`particle-${i}`}
              className="absolute -bottom-4"
              style={{
                left: `${p.left}%`,
                animation: `float-up ${p.durationY}s linear ${p.delay}s infinite`,
                opacity: 0,
              }}
            >
              <div
                className="rounded-full bg-white/70 shadow-[0_0_10px_rgba(74,222,128,0.9)]"
                style={{
                  width: p.size,
                  height: p.size,
                  animation: `${p.swayClass} ${p.durationX}s ease-in-out infinite alternate`,
                }}
              />
            </div>
          ))}
          <style>{`
            @keyframes float-up {
              0% { transform: translateY(0) scale(0.5); opacity: 0; }
              10% { opacity: 0.9; transform: translateY(-20px) scale(1); }
              85% { opacity: 0.9; transform: translateY(-200px) scale(1); }
              100% { transform: translateY(-250px) scale(0.5); opacity: 0; }
            }
            @keyframes sway-0 {
              0% { transform: translateX(-15px); }
              100% { transform: translateX(15px); }
            }
            @keyframes sway-1 {
              0% { transform: translateX(20px); }
              100% { transform: translateX(-20px); }
            }
            @keyframes sway-2 {
              0% { transform: translateX(-25px); }
              100% { transform: translateX(25px); }
            }
          `}</style>
        </div>

        {}
        <div className="relative flex flex-col justify-center h-full px-8 z-10">
          {}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold tracking-widest text-green-400/70 uppercase">
              Welcome back
            </span>
          </div>
          <h1 className="text-4xl font-black text-white text-shadow mb-1">
            {username ?? (
              <span className="text-white/30 text-2xl font-semibold">Chưa có tài khoản</span>
            )}
          </h1>

          {}
          <p className="text-white/40 text-sm">
            {(isDownloading || isRunning || isError) ? (
              isRunning ? (
                <span className="flex items-center gap-2 text-green-400/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Đang chơi: <span className="text-green-300 font-semibold">{selectedProfile?.name}</span>
                </span>
              ) : isError ? (
                <span className="text-red-400/80">{launchError}</span>
              ) : (
                <span className="flex items-center gap-2 text-white/40">
                  <svg className="animate-spin w-3 h-3 text-green-400/70 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {progress?.log ?? 'Đang chuẩn bị...'}
                </span>
              )
            ) : username ? (
              profileStats?.lastPlayed
                ? <>Last played: <span className="text-white/60">{selectedProfile?.name}</span> · {formatRelativeTime(profileStats.lastPlayed)}</>
                : <span className="text-white/30">Chưa chơi lần nào</span>
            ) : (
              <button onClick={() => onNavigate?.('account')} className="text-green-400/70 hover:text-green-400 transition-colors underline underline-offset-2">
                Tạo tài khoản để bắt đầu
              </button>
            )}
          </p>

          {}
          <div className="mt-4">
            {(isDownloading || isError) ? (

              <div className="flex flex-col gap-2 w-full max-w-lg">
                {}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/50 uppercase tracking-widest">
                    {progress?.phase === 'java' ? 'Cài đặt Java Runtime' :
                      progress?.phase === 'assets' ? 'Tải tài nguyên Minecraft' :
                        progress?.phase === 'launching' ? 'Khởi động game' :
                          progress?.phase === 'resolve' ? 'Tải thông tin version' : 'Chuẩn bị'}
                  </span>
                  <div className="flex items-center gap-3 text-xs text-white/30">
                    {progress?.speed > 0 && (
                      <span>{(progress.speed / 1024 / 1024).toFixed(1)} MB/s</span>
                    )}
                    {progress?.totalFiles > 0 && (
                      <span>{progress.doneFiles ?? 0}/{progress.totalFiles} files</span>
                    )}
                    {progress?.percent > 0 && (
                      <span className="text-white/50 font-mono font-bold">{progress.percent}%</span>
                    )}
                  </div>
                </div>
                {}
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${isError ? 'bg-red-500' : 'bg-green-400'}`}
                    style={{ width: `${isError ? 100 : (progress?.percent ?? 0)}%` }}
                  />
                </div>
              </div>
            ) : (

              <div className="flex gap-6">
                {[
                  { label: 'Hours Played', value: hoursPlayed > 0 ? hoursPlayed.toLocaleString() : '0' },
                  { label: 'Worlds', value: worldCount.toString() },
                  { label: 'Mods Active', value: modCount.toString() },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div className="text-lg font-bold text-green-400">{stat.value}</div>
                    <div className="text-xs text-white/30">{stat.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {}
      <div className="flex flex-1 overflow-hidden gap-0">
        {}
        <div className="flex-1 flex flex-col overflow-hidden">
          {(logPanelOpen && (instances.length > 0 || activeLogTab || savedLog || savedLogLoading)) ? (

            <div className="flex flex-col h-full overflow-hidden">
              {}
              <div className="flex-shrink-0 flex items-end border-b border-white/5">
                {}
                {instances.length > 1 && (
                  <button
                    onClick={() => {
                      const idx = instances.findIndex(i => i.key === activeLogTab)
                      const prev = instances[(idx - 1 + instances.length) % instances.length]
                      setActiveLogTab(prev.key)
                      setSavedLog(null)
                    }}
                    className="flex-shrink-0 w-7 h-8 flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/5 transition-all ml-2"
                    title="Previous instance"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                    </svg>
                  </button>
                )}

                {}
                <div className="flex items-center gap-1 px-2 pt-4 pb-0 overflow-x-auto overflow-y-hidden flex-1 min-w-0 scrollbar-none"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {}
                  {savedLog && (
                    <button
                      className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-t-lg text-xs font-semibold border-t border-l border-r transition-all duration-150 relative bg-[#141414] border-white/8 text-white -mb-px z-10"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white/40 flex-shrink-0">
                        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z" />
                      </svg>
                      <span className="truncate max-w-[120px]">{savedLog.profileName}</span>
                      <span className="text-[9px] text-white/30">saved</span>
                    </button>
                  )}

                  {}
                  {instances.map(inst => {
                    const isActive = activeLogTab === inst.key && !savedLog
                    return (
                      <button
                        key={inst.key}
                        onClick={() => { setActiveLogTab(inst.key); setSavedLog(null) }}
                        className={`
                          flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-t-lg text-xs font-semibold
                          border-t border-l border-r transition-all duration-150 relative
                          ${isActive
                            ? 'bg-[#141414] border-white/8 text-white -mb-px z-10'
                            : 'bg-white/3 border-transparent text-white/40 hover:text-white/60 hover:bg-white/5'
                          }
                        `}
                      >
                        {inst.state === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />}
                        {inst.state === 'downloading' && (
                          <svg className="animate-spin w-3 h-3 text-yellow-400 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        )}
                        {inst.state === 'stopped' && <span className="w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" />}
                        {inst.state === 'error' && <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />}
                        <span className="truncate max-w-[120px]">{inst.profileName || 'Profile'}</span>
                        {inst.accountName && (
                          <span className={`text-[9px] ${isActive ? 'text-white/40' : 'text-white/20'}`}>
                            @{inst.accountName}
                          </span>
                        )}
                        {}
                        {isActive && (inst.state === 'running' || inst.state === 'downloading') && (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={e => { e.stopPropagation(); onKillInstance?.(inst.key) }}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onKillInstance?.(inst.key) } }}
                            className="ml-1 w-4 h-4 flex items-center justify-center rounded text-red-400/60 hover:text-red-400 hover:bg-red-500/15 transition-all flex-shrink-0 cursor-pointer"
                            title="Kill instance"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                            </svg>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                {}
                {instances.length > 1 && (
                  <button
                    onClick={() => {
                      const idx = instances.findIndex(i => i.key === activeLogTab)
                      const next = instances[(idx + 1) % instances.length]
                      setActiveLogTab(next.key)
                      setSavedLog(null)
                    }}
                    className="flex-shrink-0 w-7 h-8 flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/5 transition-all mr-2"
                    title="Next instance"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                    </svg>
                  </button>
                )}
                {}
                <button
                  onClick={() => { setLogPanelOpen(false); setSavedLog(null) }}
                  className="flex-shrink-0 w-7 h-8 flex items-center justify-center text-white/20 hover:text-white/60 hover:bg-white/5 transition-all mr-1"
                  title="Đóng log"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              </div>

              {}
              <div className="flex-1 overflow-hidden">
                {(() => {

                  if (savedLog || savedLogLoading) {
                    if (savedLogLoading) return (
                      <div className="flex flex-col items-center justify-center h-full gap-2 text-white/20">
                        <svg className="animate-spin w-5 h-5 text-green-400/50" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <p className="text-xs">Đang tải log...</p>
                      </div>
                    )
                    if (!savedLog) return (
                      <div className="flex flex-col items-center justify-center h-full gap-2 text-white/20">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 opacity-30">
                          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                        </svg>
                        <p className="text-xs">Chưa có log nào cho profile này</p>
                      </div>
                    )

                    const fakeInstance = {
                      key: '__saved__',
                      state: 'stopped',
                      profileName: savedLog.profileName,
                      accountName: '',
                      logs: savedLog.lines,
                      progress: null,
                    }
                    return <InstanceLogPanel instance={fakeInstance} onKill={null} />
                  }

                  const inst = instances.find(i => i.key === activeLogTab)
                  if (!inst && instances.length === 0) return (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-white/20">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 opacity-30">
                        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                      </svg>
                      <p className="text-xs">Không có instance nào đang chạy</p>
                    </div>
                  )
                  if (!inst) return <InstanceLogPanel instance={instances[0]} onKill={onKillInstance} />
                  return <InstanceLogPanel instance={inst} onKill={onKillInstance} />
                })()}
              </div>
            </div>
          ) : (

            <div className="flex-1 overflow-hidden">
              {profileSettingsOpen && selectedProfile ? (
                <ProfileSettingsPanel
                  profile={selectedProfile}
                  onClose={() => setProfileSettingsOpen(false)}
                  onProfileUpdated={(updated) => {
                    setSelectedProfile(updated)
                    setRam(updated.ramGb ?? ram)
                  }}
                />
              ) : (
                <div className="overflow-y-auto h-full">
                  <NewsPanel />
                </div>
              )}
            </div>
          )}
        </div>

        {}
        <div className="w-80 flex-shrink-0 border-l border-white/5 bg-black/20 p-5 pb-8 flex flex-col gap-4">

          {}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">
                Profile
              </label>
              {}
              <div className="relative" ref={logDropdownRef}>
                <button
                  onClick={() => setLogDropdownOpen(v => !v)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all
                    ${logPanelOpen
                      ? 'bg-green-500/15 border border-green-500/25 text-green-400'
                      : 'bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/8'
                    }`}
                  title="Xem logs"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                  </svg>
                  Logs
                  {instances.length > 0 && (
                    <span className="w-3.5 h-3.5 rounded-full bg-green-500/30 text-green-400 text-[8px] flex items-center justify-center font-bold">
                      {instances.length}
                    </span>
                  )}
                </button>

                {}
                {logDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-[#141414] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-white/5">
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Instance Logs</p>
                    </div>
                    {instances.length === 0 && !selectedProfile ? (
                      <div className="px-3 py-3 text-[11px] text-white/25 text-center">Không có instance nào</div>
                    ) : (
                      <>
                        {}
                        {instances.map(inst => (
                          <button
                            key={inst.key}
                            onClick={() => {
                              setActiveLogTab(inst.key)
                              setSavedLog(null)
                              setLogPanelOpen(true)
                              setLogDropdownOpen(false)
                              setProfileSettingsOpen(false)
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-all
                              ${activeLogTab === inst.key && logPanelOpen && !savedLog ? 'bg-white/5' : ''}`}
                          >
                            {inst.state === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />}
                            {inst.state === 'downloading' && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />}
                            {inst.state === 'stopped' && <span className="w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" />}
                            {inst.state === 'error' && <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-white/80 font-semibold truncate">{inst.profileName || 'Profile'}</p>
                              <p className="text-[10px] text-white/30 truncate">Live · @{inst.accountName}</p>
                            </div>
                            {activeLogTab === inst.key && logPanelOpen && !savedLog && (
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-green-400 flex-shrink-0">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                              </svg>
                            )}
                          </button>
                        ))}

                        {}
                        {selectedProfile && (
                          <>
                            {instances.length > 0 && <div className="border-t border-white/5 my-1" />}
                            <button
                              onClick={async () => {
                                setLogDropdownOpen(false)
                                setLogPanelOpen(true)
                                setActiveLogTab(null)
                                setSavedLog(null)
                                setSavedLogLoading(true)
                                setProfileSettingsOpen(false)
                                try {
                                  const result = isElectron
                                    ? await window.electronAPI.getLatestLog({ profileId: selectedProfile.id })
                                    : null
                                  setSavedLog(result)
                                } catch {
                                  setSavedLog(null)
                                } finally {
                                  setSavedLogLoading(false)
                                }
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-all
                                ${logPanelOpen && savedLog ? 'bg-white/5' : ''}`}
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white/30 flex-shrink-0">
                                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                              </svg>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-white/80 font-semibold truncate">{selectedProfile.name}</p>
                                <p className="text-[10px] text-white/30">Log lần chơi gần nhất</p>
                              </div>
                              {logPanelOpen && savedLog && (
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-green-400 flex-shrink-0">
                                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                </svg>
                              )}
                            </button>
                          </>
                        )}
                      </>
                    )}
                    {}
                    {logPanelOpen && (
                      <>
                        <div className="border-t border-white/5" />
                        <button
                          onClick={() => { setLogPanelOpen(false); setSavedLog(null); setLogDropdownOpen(false) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-all text-white/30 hover:text-white/60"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                          </svg>
                          <span className="text-[11px]">Đóng log panel</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            {selectedProfile ? (
              <div
                className="relative rounded-xl overflow-hidden border border-white/8 cursor-pointer group"
                onClick={() => onNavigate?.('play')}
              >
                {}
                <div className="relative h-20 overflow-hidden">
                  <img
                    src={selectedProfile.importBgUrl || getVersionImage(selectedProfile.gameVersion)}
                    alt={selectedProfile.gameVersion}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    draggable={false}
                    onError={e => { e.currentTarget.src = getVersionImage(selectedProfile.gameVersion) }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {}
                  <div className="absolute bottom-2 left-2.5 flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] font-mono text-white/80 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded border border-white/10">
                      {selectedProfile.gameVersion}
                    </span>
                    {}
                    {selectedProfile.importSource && IMPORT_SOURCE[selectedProfile.importSource] && (() => {
                      const src = IMPORT_SOURCE[selectedProfile.importSource]
                      return (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold backdrop-blur-sm"
                          style={{ background: 'rgba(0,0,0,0.50)', border: `1px solid ${src.color}55`, color: src.color }}>
                          <img src={src.icon} alt={src.label} className="w-2.5 h-2.5 object-contain" />
                          {src.label}
                        </span>
                      )
                    })()}
                    {}
                    {selectedProfile.importSource && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold backdrop-blur-sm bg-black/50 border border-white/20 text-white/70">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5">
                          <path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.06 15.94 0 13.36 0c-1.46 0-2.75.67-3.6 1.72L9 3 8.24 1.72C7.39.67 6.1 0 4.64 0 2.06 0 0 2.06 0 4.64c0 .48.11.92.18 1.36H0v2h20V6zm-9.5-3.5c.55-.67 1.38-1.1 2.36-1.1 1.58 0 2.64 1.06 2.64 2.64 0 .48-.13.92-.32 1.36H11V3.5l-.5-1zm-5.86 0C5.19 2.5 6.06 2 7 2c.98 0 1.81.43 2.36 1.1L10 4.5H6.68c-.19-.44-.32-.88-.32-1.36 0-.24.04-.47.1-.68l-.82.04zM0 8v14h20V8H0zm9 11H2v-2h7v2zm0-4H2v-2h7v2zm0-4H2v-2h7v2zm9 8h-7v-2h7v2zm0-4h-7v-2h7v2zm0-4h-7v-2h7v2z" />
                        </svg>
                        Modpack
                      </span>
                    )}
                  </div>

                  {}
                  <div className={`absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md border backdrop-blur-sm ${LOADER_BG[selectedProfile.loader] || LOADER_BG.vanilla}`}>
                    <img
                      src={selectedProfile.importIconUrl || LOADER_ICONS[selectedProfile.loader] || vanillaIcon}
                      className="w-3 h-3 object-contain"
                      draggable={false}
                      onError={e => { e.currentTarget.src = LOADER_ICONS[selectedProfile.loader] || vanillaIcon }}
                    />
                    <span className={`text-[9px] font-bold capitalize ${LOADER_COLORS[selectedProfile.loader] || 'text-green-400'}`}>
                      {selectedProfile.loader}
                    </span>
                  </div>
                </div>

                {}
                <div className="px-3 py-2.5 bg-white/3">
                  <p className="text-sm font-bold text-white truncate">{selectedProfile.name}</p>
                  <p className={`text-[10px] mt-0.5 ${LOADER_COLORS[selectedProfile.loader] || 'text-green-400'}`}>
                    {selectedProfile.loader.charAt(0).toUpperCase() + selectedProfile.loader.slice(1)}
                    {selectedProfile.loaderVersion ? ` ${selectedProfile.loaderVersion}` : ''}
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => onNavigate?.('play')}
                className="w-full flex items-center gap-2 bg-white/3 border border-dashed border-white/10 rounded-xl px-3 py-4 text-white/30 hover:text-white/60 hover:border-white/20 transition-all text-xs justify-center flex-col gap-1.5"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 opacity-40">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
                <span>Tạo profile để chơi</span>
              </button>
            )}
          </div>

          {}
          <div>
            <label className="text-xs font-semibold text-white/40 uppercase tracking-widest block mb-2">
              Account
            </label>
            <AccountDropdown
              accounts={accounts}
              selectedAccount={selectedAccount}
              selectAccount={selectAccount}
              onNavigate={onNavigate}
            />
          </div>

          {}
          {selectedProfile && (
            <button
              onClick={() => {
                setProfileSettingsOpen(v => !v)
                if (logPanelOpen) setLogPanelOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${profileSettingsOpen
                ? 'bg-green-500/15 border-green-500/25 text-green-400'
                : 'bg-white/3 border-white/8 text-white/40 hover:text-white/70 hover:bg-white/6 hover:border-white/15'
                }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {profileSettingsOpen ? 'Đóng cài đặt' : 'Cài đặt profile'}
              <span className="ml-auto text-[10px] text-white/20">{selectedProfile.ramGb ?? 4} GB RAM</span>
            </button>
          )}

          <div className="flex-1" />

          {}
          <button
            onClick={isError ? () => onLaunchReset?.() : handleLaunch}
            disabled={isDownloading || isRunning || !selectedProfile}
            className={`
              w-full py-3.5 rounded-xl font-bold text-sm tracking-wide
              transition-all duration-200 relative overflow-hidden shadow-lg
              ${isDownloading
                ? 'bg-white/8 text-white/30 cursor-not-allowed'
                : isRunning
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-not-allowed'
                  : isError
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 cursor-pointer'
                    : !selectedProfile
                      ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/8'
                      : `${launchColor} text-white active:scale-95`
              }
            `}
          >
            {isDownloading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Đang tải...
              </span>
            ) : isRunning ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Đang chạy
              </span>
            ) : isError ? (
              <span className="flex items-center justify-center gap-2">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                Thử lại
              </span>
            ) : !selectedProfile ? (
              <span className="flex items-center justify-center gap-2">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M8 5v14l11-7z" /></svg>
                Chọn profile
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M8 5v14l11-7z" /></svg>
                PLAY
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

