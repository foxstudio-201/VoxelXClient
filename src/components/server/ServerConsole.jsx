import { useState, useEffect, useRef, useCallback } from 'react'
import { parseColors, getLineLevel, getLineColor } from './serverColorUtils.jsx'
import ServerFileManager from './ServerFileManager'
import ServerNetworkTab from './ServerNetworkTab'
import ServerPluginModTab from './ServerPluginModTab'

const isElectron = typeof window !== 'undefined' && window.electronAPI

export default function ServerConsole({ server, onBack }) {
  const [activeTab, setActiveTab]     = useState('console')
  const [logs, setLogs]               = useState([])
  const [logFilter, setLogFilter]     = useState('ALL')
  const [command, setCommand]         = useState('')
  const [status, setStatus]           = useState('offline')
  const [autoScroll, setAutoScroll]   = useState(true)
  const [dlProgress, setDlProgress]   = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [copied, setCopied]           = useState(false)
  const [folderPath, setFolderPath]   = useState('')

  // Tunnel state — lifted here so it persists across tab switches
  const [tunnelStatus, setTunnelStatus] = useState('idle')
  const [tunnelAddr, setTunnelAddr]     = useState(null)
  const [tunnelLog, setTunnelLog]       = useState([])

  const logEndRef = useRef(null)
  const unsubsRef = useRef([])

  const filteredLogs = logFilter === 'ALL' ? logs : logs.filter(line => {
    const level = getLineLevel(line)
    if (logFilter === 'ERROR') return level === 'error'
    if (logFilter === 'WARN')  return level === 'warn' || level === 'error'
    if (logFilter === 'INFO')  return level === 'info' || level === 'done'
    return true
  })

  useEffect(() => {
    if (!isElectron || !server) return
    window.electronAPI.serverGetStatus(server.id).then(r => { if (r?.ok) setStatus(r.status) })
    window.electronAPI.serverGetLogs(server.id).then(r => { if (r?.ok) setLogs(r.logs || []) })
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
    // Subscribe tunnel events here so state persists across tab switches
    const unsubTunnel = window.electronAPI.onServerTunnelLog?.((data) => {
      if (data.serverId !== server.id) return
      if (data.status) setTunnelStatus(data.status)
      if (data.addr)   setTunnelAddr(data.addr)
      if (data.line)   setTunnelLog(prev => [...prev.slice(-199), data.line])
    })
    unsubsRef.current = [unsubLog, unsubStatus, unsubDl, unsubTunnel].filter(Boolean)
    return () => unsubsRef.current.forEach(fn => fn?.())
  }, [server?.id])

  useEffect(() => {
    if (autoScroll && logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [logs, autoScroll])

  useEffect(() => {
    if (activeTab === 'files') {} // ServerFileManager handles its own loading
  }, [activeTab])

  const loadFolders = useCallback(async (_sub = '') => {}, []) // kept for openFolder button compat

  async function handleStart() {
    if (!isElectron) return
    if (!server.jarFile) {
      setDownloading(true)
      setDlProgress({ percent: 0 })
      const r = await window.electronAPI.serverDownloadJar(server.id)
      setDownloading(false)
      setDlProgress(null)
      if (r?.error) { setLogs(prev => [...prev, `[ERR] ${r.error}`]); return }
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
  const statusColor = { online: 'text-green-400', starting: 'text-yellow-400', offline: 'text-white/30' }[status] || 'text-white/30'
  const statusDot   = { online: 'bg-green-400 animate-pulse', starting: 'bg-yellow-400 animate-pulse', offline: 'bg-white/20' }[status] || 'bg-white/20'

  return (
    <div className="flex h-full overflow-hidden">
      {/* LEFT */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden border-r border-white/5">
        {/* Toolbar */}
        <div className="flex-shrink-0 flex items-center gap-1 px-3 py-2 border-b border-white/5 bg-black/20">
          <button onClick={onBack} className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          </button>
          <div className="w-px h-5 bg-white/10 mx-1" />
          {[
            { id: 'console', label: 'Console', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> },
            { id: 'files',   label: 'Files',   icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg> },
            { id: 'network', label: 'Network', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg> },
            { id: 'plugins', label: 'Plugins', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/></svg> },
            { id: 'mods',    label: 'Mods',    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg> },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === tab.id ? 'bg-white/10 text-white' : 'text-white/35 hover:text-white/60 hover:bg-white/5'}`}>
              {tab.icon}{tab.label}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={() => isElectron && window.electronAPI.serverOpenFolder(server.id, activeTab === 'folders' ? folderPath : '')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/35 hover:text-white/60 hover:bg-white/5 transition-all">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
            Mở
          </button>
          {activeTab === 'console' && (
            <>
              <div className="flex items-center gap-0.5">
                {['ALL','INFO','WARN','ERROR'].map(f => (
                  <button key={f} onClick={() => setLogFilter(f)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${logFilter === f ? f === 'ERROR' ? 'bg-red-500/20 text-red-400' : f === 'WARN' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/15 text-white' : 'text-white/25 hover:text-white/50'}`}>
                    {f}
                  </button>
                ))}
              </div>
              <button onClick={() => { navigator.clipboard.writeText(logs.join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${copied ? 'bg-green-500/15 text-green-400' : 'text-white/35 hover:text-white/60 hover:bg-white/5'}`}>
                {copied ? <><svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>Đã copy</> : <><svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>Copy</>}
              </button>
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* Console tab */}
          {activeTab === 'console' && (
            <div className="flex flex-col h-full">
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
              <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed bg-[#080808]"
                style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
                onScroll={e => { const el = e.currentTarget; setAutoScroll(el.scrollTop + el.clientHeight >= el.scrollHeight - 40) }}>
                {filteredLogs.length === 0 ? (
                  <p className="text-white/20 text-center py-8">{isRunning ? 'Đang khởi động...' : 'Chưa có log. Nhấn Start để khởi động server.'}</p>
                ) : (
                  filteredLogs.map((line, i) => {
                    const { parts, hasColor } = parseColors(line)
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
              <form onSubmit={handleSendCommand} className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-t border-white/5 bg-black/30">
                <span className="text-green-400/60 font-mono text-xs flex-shrink-0">&gt;</span>
                <input value={command} onChange={e => setCommand(e.target.value)}
                  placeholder={isRunning ? 'Nhập lệnh...' : 'Server chưa chạy'} disabled={!isRunning}
                  className="flex-1 bg-transparent text-white/80 text-xs font-mono focus:outline-none placeholder-white/20 disabled:opacity-40" />
                <button type="submit" disabled={!isRunning || !command.trim()}
                  className="px-3 py-1 rounded-lg bg-green-500/15 text-green-400 text-xs font-semibold hover:bg-green-500/25 transition-all disabled:opacity-30">Gửi</button>
                <button type="button" onClick={() => setAutoScroll(v => !v)}
                  className={`px-2 py-1 rounded-lg text-xs transition-all ${autoScroll ? 'bg-green-500/15 text-green-400' : 'text-white/25 hover:text-white/50'}`}>↓</button>
              </form>
            </div>
          )}

          {/* Files tab */}
          {activeTab === 'files' && <ServerFileManager server={server} />}

          {/* Network tab */}
          {activeTab === 'network' && (
            <ServerNetworkTab
              server={server}
              tunnelStatus={tunnelStatus}
              setTunnelStatus={setTunnelStatus}
              tunnelAddr={tunnelAddr}
              setTunnelAddr={setTunnelAddr}
              tunnelLog={tunnelLog}
              setTunnelLog={setTunnelLog}
            />
          )}

          {/* Plugins tab */}
          {activeTab === 'plugins' && <ServerPluginModTab server={server} projectType="plugin" />}

          {/* Mods tab */}
          {activeTab === 'mods' && <ServerPluginModTab server={server} projectType="mod" />}
        </div>
      </div>

      {/* RIGHT: Server info panel */}
      <div className="w-64 flex-shrink-0 flex flex-col overflow-hidden bg-black/15">
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
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot}`} />
            <span className={`text-xs font-semibold capitalize ${statusColor}`}>
              {status === 'online' ? 'Online' : status === 'starting' ? 'Đang khởi động...' : 'Offline'}
            </span>
          </div>
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
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-white/40 uppercase tracking-wider">RAM</span>
              <span className="text-[10px] text-white/50 font-mono">{server.ramGb} GB max</span>
            </div>
            <div className="w-full h-2 bg-white/8 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400/60 rounded-full transition-all" style={{ width: isRunning ? '45%' : '0%' }} />
            </div>
            <p className="text-[10px] text-white/25 mt-1">{isRunning ? `~${Math.round(server.ramGb * 0.45 * 1024)} MB / ${server.ramGb * 1024} MB` : 'Không hoạt động'}</p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-white/40 uppercase tracking-wider">CPU</span>
              <span className="text-[10px] text-white/50 font-mono">{server.cores} cores</span>
            </div>
            <div className="w-full h-2 bg-white/8 rounded-full overflow-hidden">
              <div className="h-full bg-green-400/60 rounded-full transition-all" style={{ width: isRunning ? '25%' : '0%' }} />
            </div>
            <p className="text-[10px] text-white/25 mt-1">{isRunning ? '~25%' : 'Không hoạt động'}</p>
          </div>
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
