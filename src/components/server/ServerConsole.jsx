
import { useState, useEffect, useRef, useCallback } from 'react'

const isElectron = typeof window !== 'undefined' && window.electronAPI

// Convert ANSI 256-color index to CSS color
function ansi256ToHex(n) {
  if (n < 16) {
    const std = [
      '#000000','#800000','#008000','#808000','#000080','#800080','#008080','#c0c0c0',
      '#808080','#ff0000','#00ff00','#ffff00','#0000ff','#ff00ff','#00ffff','#ffffff',
    ]
    return std[n] || '#ffffff'
  }
  if (n >= 232) {
    const v = 8 + (n - 232) * 10
    return `rgb(${v},${v},${v})`
  }
  let idx = n - 16
  const b = idx % 6; idx = Math.floor(idx / 6)
  const g = idx % 6; idx = Math.floor(idx / 6)
  const r = idx % 6
  const toV = x => x === 0 ? 0 : 55 + x * 40
  return `rgb(${toV(r)},${toV(g)},${toV(b)})`
}

// Standard ANSI 16-color palette (Minecraft-style bright)
const ANSI_COLORS = {
  '30': '#4C4C4C', '31': '#FF5555', '32': '#55FF55', '33': '#FFFF55',
  '34': '#5555FF', '35': '#FF55FF', '36': '#55FFFF', '37': '#BBBBBB',
  '90': '#555555', '91': '#FF5555', '92': '#55FF55', '93': '#FFFF55',
  '94': '#5555FF', '95': '#FF55FF', '96': '#55FFFF', '97': '#FFFFFF',
}

// Minecraft § color codes
const MC_COLORS = {
  '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
  '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
  '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
  'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF',
}

// Parse ANSI + Minecraft § color codes from a log line.
// Returns { parts: ReactNode[], hasColor: boolean }
function parseColors(text) {
  if (!text) return { parts: '', hasColor: false }

  // Strip non-SGR escape sequences (OSC, cursor movement, etc.) to avoid garbage chars
  let cleaned = text
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')   // OSC sequences
    .replace(/\x1b[^[\x1b]*[A-Za-z]/g, m => m.startsWith('\x1b[') ? m : '') // non-CSI

  const parts = []
  let key = 0
  let hasColor = false

  // Match: ANSI CSI SGR  \x1b[...m  OR  Minecraft § (also \u00a7) color code
  const regex = /\x1b\[([0-9;]*)m|[\u00a7§]([0-9a-fk-orA-FK-OR])/g
  let lastIndex = 0
  let fg = null
  let bold = false, italic = false, underline = false, strike = false
  let m

  const flush = (str) => {
    if (!str) return
    const style = {}
    if (fg) style.color = fg
    if (bold) style.fontWeight = 'bold'
    if (italic) style.fontStyle = 'italic'
    const deco = [underline && 'underline', strike && 'line-through'].filter(Boolean).join(' ')
    if (deco) style.textDecoration = deco
    parts.push(<span key={key++} style={Object.keys(style).length ? style : undefined}>{str}</span>)
  }

  while ((m = regex.exec(cleaned)) !== null) {
    if (m.index > lastIndex) flush(cleaned.slice(lastIndex, m.index))

    if (m[1] !== undefined) {
      // ── ANSI SGR ──
      const seq = m[1]
      if (seq === '' || seq === '0') {
        fg = null; bold = false; italic = false; underline = false; strike = false
      } else {
        const codes = seq.split(';')
        let i = 0
        while (i < codes.length) {
          const c = codes[i]
          if      (c === '0')  { fg = null; bold = false; italic = false; underline = false; strike = false }
          else if (c === '1')  bold = true
          else if (c === '2')  bold = false
          else if (c === '3')  italic = true
          else if (c === '4')  underline = true
          else if (c === '9')  strike = true
          else if (c === '22') bold = false
          else if (c === '23') italic = false
          else if (c === '24') underline = false
          else if (c === '29') strike = false
          else if (c === '39') fg = null
          else if (ANSI_COLORS[c]) { fg = ANSI_COLORS[c]; hasColor = true }
          else if (c === '38') {
            if (codes[i + 1] === '5' && codes[i + 2] !== undefined) {
              fg = ansi256ToHex(parseInt(codes[i + 2], 10)); hasColor = true; i += 2
            } else if (codes[i + 1] === '2' && codes[i + 4] !== undefined) {
              fg = `rgb(${codes[i+2]},${codes[i+3]},${codes[i+4]})`; hasColor = true; i += 4
            }
          }
          i++
        }
      }
    } else {
      // ── Minecraft § code ──
      const code = m[2].toLowerCase()
      if      (code === 'r') { fg = null; bold = false; italic = false; underline = false; strike = false }
      else if (code === 'l') bold = true
      else if (code === 'o') italic = true
      else if (code === 'n') underline = true
      else if (code === 'm') strike = true
      else if (code === 'k') { /* obfuscated — skip */ }
      else if (MC_COLORS[code]) { fg = MC_COLORS[code]; hasColor = true }
    }

    lastIndex = m.index + m[0].length
  }

  if (lastIndex < cleaned.length) flush(cleaned.slice(lastIndex))

  return { parts: parts.length > 0 ? parts : cleaned, hasColor }
}

// Detect log level from Minecraft/Paper server log format
function getLineLevel(line) {
  const upper = line.toUpperCase()
  if (upper.includes('/ERROR]') || upper.includes('[ERROR]') || upper.includes('[ERR]') || upper.includes('EXCEPTION') || upper.includes('FATAL')) return 'error'
  if (upper.includes('/WARN]')  || upper.includes('[WARN]')  || upper.includes('[WARNING]')) return 'warn'
  if (upper.includes('/INFO]')  || upper.includes('[INFO]'))  return 'info'
  if (upper.includes('/DEBUG]') || upper.includes('[DEBUG]') || upper.includes('[LAUNCHER]')) return 'debug'
  if (/Done \([\d.]+s\)/.test(line)) return 'done'
  return 'other'
}

function getLineColor(line) {
  const level = getLineLevel(line)
  switch (level) {
    case 'error':    return '#f87171'   // red-400
    case 'warn':     return '#facc15'   // yellow-400
    case 'info':     return '#e5e7eb'   // gray-200 (Almost white)
    case 'debug':    return '#93c5fd'   // blue-300
    case 'launcher': return '#22d3ee'   // cyan-400
    case 'done':     return '#4ade80'   // green-400
    default:         return '#9ca3af'   // gray-400
  }
}

// Tab IDs
const TABS = ['console', 'folders', 'files']

export default function ServerConsole({ server, onBack }) {
  const [activeTab, setActiveTab]   = useState('console')
  const [logs, setLogs]             = useState([])
  const [logFilter, setLogFilter]   = useState('ALL') // ALL | INFO | WARN | ERROR
  const [command, setCommand]       = useState('')
  const [status, setStatus]         = useState('offline')
  const [autoScroll, setAutoScroll] = useState(true)
  const [dlProgress, setDlProgress] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Filtered logs
  const filteredLogs = logFilter === 'ALL' ? logs : logs.filter(line => {
    const level = getLineLevel(line)
    if (logFilter === 'ERROR') return level === 'error'
    if (logFilter === 'WARN')  return level === 'warn' || level === 'error'
    if (logFilter === 'INFO')  return level === 'info' || level === 'done'
    return true
  })

  // Folder browser state
  const [folderPath, setFolderPath] = useState('')
  const [folders, setFolders]       = useState([])
  const [files, setFiles]           = useState([])

  const logEndRef  = useRef(null)
  const unsubsRef  = useRef([])

  // Load initial logs + status
  useEffect(() => {
    if (!isElectron || !server) return

    window.electronAPI.serverGetStatus(server.id).then(r => {
      if (r?.ok) setStatus(r.status)
    })
    window.electronAPI.serverGetLogs(server.id).then(r => {
      if (r?.ok) setLogs(r.logs || [])
    })

    // Subscribe to live events
    const unsubLog = window.electronAPI.onServerLog(data => {
      if (data.serverId !== server.id) return
      setLogs(prev => [...prev.slice(-4999), data.line])
    })
    const unsubStatus = window.electronAPI.onServerStatus(data => {
      if (data.serverId !== server.id) return
      setStatus(data.status)
    })
    const unsubDl = window.electronAPI.onServerDownloadProgress(data => {
      if (data.serverId !== server.id) return
      setDlProgress(data)
    })

    unsubsRef.current = [unsubLog, unsubStatus, unsubDl]
    return () => unsubsRef.current.forEach(fn => fn?.())
  }, [server?.id])

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  // Load folders when tab changes
  useEffect(() => {
    if (activeTab === 'folders') loadFolders(folderPath)
    if (activeTab === 'files')   loadFiles()
  }, [activeTab])

  const loadFolders = useCallback(async (sub = '') => {
    if (!isElectron) return
    const r = await window.electronAPI.serverListDir(server.id, sub)
    if (r?.ok) { setFolders(r.entries); setFolderPath(sub) }
  }, [server?.id])

  const loadFiles = useCallback(async () => {
    if (!isElectron) return
    const r = await window.electronAPI.serverListFiles(server.id)
    if (r?.ok) setFiles(r.entries)
  }, [server?.id])

  async function handleStart() {
    if (!isElectron) return
    // Check if jar exists, if not download first
    if (!server.jarFile) {
      setDownloading(true)
      setDlProgress({ percent: 0 })
      const r = await window.electronAPI.serverDownloadJar(server.id)
      setDownloading(false)
      setDlProgress(null)
      if (r?.error) { setLogs(prev => [...prev, `[ERR] ${r.error}`]); return }
      // Refresh server data
      server.jarFile = r.jarPath?.split(/[\\/]/).pop()
    }
    window.electronAPI.serverStart(server.id)
  }

  async function handleStop() {
    if (!isElectron) return
    window.electronAPI.serverStop(server.id)
  }

  async function handleRestart() {
    if (!isElectron) return
    window.electronAPI.serverRestart(server.id)
  }

  async function handleSendCommand(e) {
    e.preventDefault()
    if (!command.trim() || !isElectron) return
    await window.electronAPI.serverSendCommand(server.id, command.trim())
    setLogs(prev => [...prev, `> ${command.trim()}`])
    setCommand('')
  }

  function formatBytes(b) {
    if (!b) return '0 B'
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
    return `${(b / 1024 / 1024).toFixed(1)} MB`
  }

  const isRunning = status === 'online' || status === 'starting'

  const statusColor = {
    online:   'text-green-400',
    starting: 'text-yellow-400',
    offline:  'text-white/30',
  }[status] || 'text-white/30'

  const statusDot = {
    online:   'bg-green-400 animate-pulse',
    starting: 'bg-yellow-400 animate-pulse',
    offline:  'bg-white/20',
  }[status] || 'bg-white/20'

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── LEFT: Console / Folders / Files ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden border-r border-white/5">

        {/* Header toolbar */}
        <div className="flex-shrink-0 flex items-center gap-1 px-3 py-2 border-b border-white/5 bg-black/20">
          {/* Back */}
          <button onClick={onBack}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
          </button>

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Tab buttons */}
          {[
            { id: 'console', label: 'Console', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> },
            { id: 'folders', label: 'Folder',  icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg> },
            { id: 'files',   label: 'Files',   icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.id ? 'bg-white/10 text-white' : 'text-white/35 hover:text-white/60 hover:bg-white/5'
              }`}>
              {tab.icon}{tab.label}
            </button>
          ))}

          <div className="flex-1" />

          {/* Open folder button */}
          <button onClick={() => isElectron && window.electronAPI.serverOpenFolder(server.id, activeTab === 'folders' ? folderPath : '')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/35 hover:text-white/60 hover:bg-white/5 transition-all">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
            Mở
          </button>

          {/* Copy logs button — only on console tab */}
          {activeTab === 'console' && (
            <>
              {/* Log level filter */}
              <div className="flex items-center gap-0.5">
                {['ALL','INFO','WARN','ERROR'].map(f => (
                  <button key={f} onClick={() => setLogFilter(f)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      logFilter === f
                        ? f === 'ERROR' ? 'bg-red-500/20 text-red-400'
                          : f === 'WARN' ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-white/15 text-white'
                        : 'text-white/25 hover:text-white/50'
                    }`}>
                    {f}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(logs.join('\n')).then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  })
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                  copied ? 'bg-green-500/15 text-green-400' : 'text-white/35 hover:text-white/60 hover:bg-white/5'
                }`}
                title="Copy toàn bộ log"
              >
                {copied ? (
                  <><svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>Đã copy</>
                ) : (
                  <><svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>Copy</>
                )}
              </button>
            </>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {/* Console */}
          {activeTab === 'console' && (
            <div className="flex flex-col h-full">
              {/* Download progress */}
              {(downloading || dlProgress) && (
                <div className="flex-shrink-0 px-3 py-2 border-b border-white/5 bg-black/20">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-white/50">Đang tải server jar...</span>
                    <span className="font-mono text-white/40">{dlProgress?.percent ?? 0}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/8 rounded-full overflow-hidden">
                    <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${dlProgress?.percent ?? 0}%` }} />
                  </div>
                </div>
              )}

              {/* Log area */}
              <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed bg-[#080808]"
                style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
                onScroll={e => {
                  const el = e.currentTarget
                  setAutoScroll(el.scrollTop + el.clientHeight >= el.scrollHeight - 40)
                }}>
                {filteredLogs.length === 0 ? (
                  <p className="text-white/20 text-center py-8">
                    {isRunning ? 'Đang khởi động...' : 'Chưa có log. Nhấn Start để khởi động server.'}
                  </p>
                ) : (
                  filteredLogs.map((line, i) => {
                    const { parts, hasColor } = parseColors(line)
                    // Only apply fallback level color when the line has no inline ANSI/§ colors
                    const fallbackColor = hasColor ? undefined : getLineColor(line)
                    return (
                      <div key={i} className="break-all py-0.5 leading-relaxed" style={fallbackColor ? { color: fallbackColor } : undefined}>
                        {parts}
                      </div>
                    )
                  })
                )}
                <div ref={logEndRef} />
              </div>

              {/* Command input */}
              <form onSubmit={handleSendCommand}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-t border-white/5 bg-black/30">
                <span className="text-green-400/60 font-mono text-xs flex-shrink-0">&gt;</span>
                <input
                  value={command}
                  onChange={e => setCommand(e.target.value)}
                  placeholder={isRunning ? 'Nhập lệnh...' : 'Server chưa chạy'}
                  disabled={!isRunning}
                  className="flex-1 bg-transparent text-white/80 text-xs font-mono focus:outline-none placeholder-white/20 disabled:opacity-40"
                />
                <button type="submit" disabled={!isRunning || !command.trim()}
                  className="px-3 py-1 rounded-lg bg-green-500/15 text-green-400 text-xs font-semibold hover:bg-green-500/25 transition-all disabled:opacity-30">
                  Gửi
                </button>
                <button type="button" onClick={() => setAutoScroll(v => !v)}
                  className={`px-2 py-1 rounded-lg text-xs transition-all ${autoScroll ? 'bg-green-500/15 text-green-400' : 'text-white/25 hover:text-white/50'}`}>
                  ↓
                </button>
              </form>
            </div>
          )}

          {/* Folders */}
          {activeTab === 'folders' && (
            <div className="h-full overflow-y-auto" style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
              {/* Breadcrumb */}
              {folderPath && (
                <div className="flex items-center gap-1 px-3 py-2 border-b border-white/5 text-xs">
                  <button onClick={() => loadFolders('')} className="text-white/40 hover:text-white/70 transition-colors">root</button>
                  {folderPath.split(/[\\/]/).filter(Boolean).map((part, i, arr) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="text-white/20">/</span>
                      <button
                        onClick={() => loadFolders(arr.slice(0, i + 1).join('/'))}
                        className={i === arr.length - 1 ? 'text-white/70' : 'text-white/40 hover:text-white/70 transition-colors'}>
                        {part}
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="p-3 flex flex-col gap-1">
                {folderPath && (
                  <button onClick={() => loadFolders(folderPath.split(/[\\/]/).slice(0, -1).join('/'))}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-all text-sm">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white/25">
                      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                    </svg>
                    ..
                  </button>
                )}
                {folders.length === 0 && <p className="text-white/20 text-xs text-center py-8">Không có thư mục con</p>}
                {folders.map(f => (
                  <button key={f.name} onClick={() => loadFolders(f.path)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left hover:bg-white/5 transition-all group">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-yellow-400/60 flex-shrink-0">
                      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                    </svg>
                    <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">{f.name}</span>
                    <button onClick={e => { e.stopPropagation(); isElectron && window.electronAPI.serverOpenFolder(server.id, f.path) }}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-white/25 hover:text-white/60 transition-all">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                      </svg>
                    </button>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {activeTab === 'files' && (
            <div className="h-full overflow-y-auto" style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
              <div className="p-3 flex flex-col gap-1">
                {files.length === 0 && <p className="text-white/20 text-xs text-center py-8">Không có file</p>}
                {files.map(f => (
                  <div key={f.name} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all group">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-white/30 flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <span className="text-sm text-white/65 flex-1 truncate">{f.name}</span>
                    <span className="text-[10px] text-white/25 flex-shrink-0">{formatBytes(f.size)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Server info panel ── */}
      <div className="w-64 flex-shrink-0 flex flex-col overflow-hidden bg-black/15">
        {/* Server name + icon */}
        <div className="flex-shrink-0 p-4 border-b border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-white/5">
              <ServerTypeIcon type={server.type} size={40} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white/90 truncate">{server.name}</p>
              <p className="text-[10px] text-white/35 capitalize">{server.type} {server.gameVersion}</p>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot}`} />
            <span className={`text-xs font-semibold capitalize ${statusColor}`}>
              {status === 'online' ? 'Online' : status === 'starting' ? 'Đang khởi động...' : 'Offline'}
            </span>
          </div>

          {/* Control buttons */}
          <div className="flex gap-2">
            {!isRunning ? (
              <button onClick={handleStart} disabled={downloading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500 hover:bg-green-400 text-white text-xs font-bold transition-all active:scale-95 disabled:opacity-50">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M8 5v14l11-7z"/></svg>
                Start
              </button>
            ) : (
              <>
                <button onClick={handleStop}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold border border-red-500/25 transition-all">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M6 6h12v12H6z"/></svg>
                  Stop
                </button>
                <button onClick={handleRestart}
                  className="w-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 border border-white/8 transition-all">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          {/* RAM usage bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-white/40 uppercase tracking-wider">RAM</span>
              <span className="text-[10px] text-white/50 font-mono">{server.ramGb} GB max</span>
            </div>
            <div className="w-full h-2 bg-white/8 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400/60 rounded-full transition-all"
                style={{ width: isRunning ? '45%' : '0%' }} />
            </div>
            <p className="text-[10px] text-white/25 mt-1">{isRunning ? `~${Math.round(server.ramGb * 0.45 * 1024)} MB / ${server.ramGb * 1024} MB` : 'Không hoạt động'}</p>
          </div>

          {/* CPU */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-white/40 uppercase tracking-wider">CPU</span>
              <span className="text-[10px] text-white/50 font-mono">{server.cores} cores</span>
            </div>
            <div className="w-full h-2 bg-white/8 rounded-full overflow-hidden">
              <div className="h-full bg-green-400/60 rounded-full transition-all"
                style={{ width: isRunning ? '25%' : '0%' }} />
            </div>
            <p className="text-[10px] text-white/25 mt-1">{isRunning ? '~25%' : 'Không hoạt động'}</p>
          </div>

          {/* Server info */}
          <div className="rounded-xl border border-white/8 bg-white/3 p-3 space-y-2">
            <InfoRow label="Loại" value={server.type} />
            <InfoRow label="Phiên bản" value={server.gameVersion} />
            <InfoRow label="RAM" value={`${server.ramGb} GB`} />
            <InfoRow label="Cores" value={String(server.cores)} />
            {server.jarFile && <InfoRow label="Jar" value={server.jarFile} mono />}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-white/35">{label}</span>
      <span className={`text-[10px] text-white/60 truncate max-w-[120px] ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function ServerTypeIcon({ type, size = 32 }) {
  const icons = {
    vanilla:  () => import('../../assets/server-icon/vanilla-server.png'),
    paper:    () => import('../../assets/server-icon/paper-server.png'),
    purpur:   () => import('../../assets/server-icon/purpur-server.png'),
    folia:    () => import('../../assets/server-icon/Folia-server.png'),
    fabric:   () => import('../../assets/server-icon/fabric-server.png'),
    forge:    () => import('../../assets/server-icon/forge-server.png'),
    neoforge: () => import('../../assets/server-icon/neoforge-server.png'),
    mohist:   () => import('../../assets/server-icon/mohist-server.png'),
    sponge:   () => import('../../assets/server-icon/sponge-server.png'),
  }
  const [src, setSrc] = useState(null)
  useEffect(() => {
    const loader = icons[type]
    if (loader) loader().then(m => setSrc(m.default)).catch(() => {})
  }, [type])
  if (!src) return <div className="w-full h-full bg-white/5 rounded-xl" />
  return <img src={src} alt={type} style={{ width: size, height: size }} className="object-contain rounded-xl" />
}
