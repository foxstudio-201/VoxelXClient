
import { useState, useEffect, useCallback } from 'react'
import CreateServerModal from './CreateServerModal'
import ServerConsole from './ServerConsole'

import vanillaIcon  from '../../assets/server-icon/vanilla-server.png'
import paperIcon    from '../../assets/server-icon/paper-server.png'
import purpurIcon   from '../../assets/server-icon/purpur-server.png'
import foliaIcon    from '../../assets/server-icon/Folia-server.png'
import fabricIcon   from '../../assets/server-icon/fabric-server.png'
import forgeIcon    from '../../assets/server-icon/forge-server.png'
import neoforgeIcon from '../../assets/server-icon/neoforge-server.png'
import mohistIcon   from '../../assets/server-icon/mohist-server.png'
import spongeIcon   from '../../assets/server-icon/sponge-server.png'

const isElectron = typeof window !== 'undefined' && window.electronAPI

const SERVER_ICONS = {
  vanilla: vanillaIcon, paper: paperIcon, purpur: purpurIcon,
  folia: foliaIcon, fabric: fabricIcon, forge: forgeIcon,
  neoforge: neoforgeIcon, mohist: mohistIcon, sponge: spongeIcon,
}

// Grid columns based on server count
function getGridCols(count) {
  if (count <= 2) return 'grid-cols-2'
  if (count <= 6) return 'grid-cols-3'
  return 'grid-cols-4'
}

function StatusBadge({ status }) {
  const cfg = {
    online:   { dot: 'bg-green-400 animate-pulse', text: 'text-green-400',  label: 'Online' },
    starting: { dot: 'bg-yellow-400 animate-pulse', text: 'text-yellow-400', label: 'Starting' },
    offline:  { dot: 'bg-white/20',                 text: 'text-white/30',   label: 'Offline' },
  }[status] || { dot: 'bg-white/20', text: 'text-white/30', label: 'Offline' }

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <span className={`text-[10px] font-semibold ${cfg.text}`}>{cfg.label}</span>
    </div>
  )
}

// Server card — grid view
function ServerCardGrid({ server, onClick, onDelete, javaProgress }) {
  const icon = SERVER_ICONS[server.type] || vanillaIcon
  const isDownloadingJava = !!javaProgress
  return (
    <div className="relative group">
      <div
        onClick={() => !isDownloadingJava && onClick?.(server)}
        className={`relative rounded-2xl overflow-hidden transition-all duration-200 ${isDownloadingJava ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
        onMouseEnter={e => { if (!isDownloadingJava) { e.currentTarget.style.borderColor = 'rgba(74,222,128,0.35)' } }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
      >
        {/* Background: blurred icon */}
        <div className="absolute inset-0">
          <img src={icon} alt="" className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'blur(16px)', opacity: 0.35, transform: 'scale(1.3)' }} />
          <div className="absolute inset-0 bg-[#0a0a0a]/70" />
        </div>

        {/* Content */}
        <div className="relative z-10 p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <img src={icon} alt={server.type} className="w-12 h-12 rounded-xl object-contain bg-black/30 ring-1 ring-white/10 p-1" />
            <StatusBadge status={server.status || 'offline'} />
          </div>
          <div>
            <p className="text-sm font-bold text-white/90 truncate">{server.name}</p>
            <p className="text-[10px] text-white/35 capitalize mt-0.5">{server.type} · {server.gameVersion}</p>
          </div>

          {/* Java download progress bar */}
          {isDownloadingJava ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-blue-400/80 flex items-center gap-1">
                  <svg className="animate-spin w-2.5 h-2.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {javaProgress.phase === 'extracting' ? 'Giải nén Java...' : 'Tải Java...'}
                </span>
                <span className="text-[10px] font-mono text-white/40">{javaProgress.percent ?? 0}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full transition-all duration-300"
                  style={{ width: `${javaProgress.percent ?? 0}%` }} />
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-white/25">{server.ramGb} GB RAM</p>
          )}
        </div>
      </div>

      {/* Delete button — outside overflow-hidden so it's not clipped */}
      {!isDownloadingJava && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(server) }}
          className="absolute bottom-2 right-2 w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 text-white/40 hover:text-red-400 hover:bg-red-500/20 transition-all z-20">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
        </button>
      )}
    </div>
  )
}

// Server row — list view
function ServerCardList({ server, onClick, onDelete, javaProgress }) {
  const icon = SERVER_ICONS[server.type] || vanillaIcon
  const isDownloadingJava = !!javaProgress
  return (
    <div
      onClick={() => !isDownloadingJava && onClick?.(server)}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isDownloadingJava ? 'cursor-not-allowed opacity-80' : 'cursor-pointer group'}`}
      style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
      onMouseEnter={e => { if (!isDownloadingJava) { e.currentTarget.style.borderColor = 'rgba(74,222,128,0.25)'; e.currentTarget.style.background = 'rgba(74,222,128,0.04)' } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
    >
      <img src={icon} alt={server.type} className="w-10 h-10 rounded-xl object-contain bg-black/30 ring-1 ring-white/10 p-1 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white/85 truncate">{server.name}</p>
        {isDownloadingJava ? (
          <div className="mt-1">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-blue-400/80">
                {javaProgress.phase === 'extracting' ? 'Giải nén Java...' : 'Tải Java...'}
              </span>
              <span className="text-[10px] font-mono text-white/40">{javaProgress.percent ?? 0}%</span>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full transition-all duration-300"
                style={{ width: `${javaProgress.percent ?? 0}%` }} />
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-white/35 capitalize">{server.type} · {server.gameVersion} · {server.ramGb} GB RAM</p>
        )}
      </div>
      {!isDownloadingJava && <StatusBadge status={server.status || 'offline'} />}
      {!isDownloadingJava && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(server) }}
          className="w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
        </button>
      )}
    </div>
  )
}

export default function ServerPage({ serverJavaProgress = {}, onServerJavaProgress }) {
  const [servers, setServers]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [view, setView]               = useState('grid')
  const [showCreate, setShowCreate]   = useState(false)
  const [activeServer, setActiveServer] = useState(null)
  const [confirmDel, setConfirmDel]   = useState(null)

  // Use prop-based progress (persists across navigation) with local fallback
  const javaProgress = serverJavaProgress
  const setJavaProgress = onServerJavaProgress || (() => {})

  const load = useCallback(async () => {
    if (!isElectron) { setLoading(false); return }
    setLoading(true)
    try {
      const r = await window.electronAPI.serverList()
      if (r?.ok) setServers(r.servers)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Subscribe to status updates
  useEffect(() => {
    if (!isElectron) return
    const unsubStatus = window.electronAPI.onServerStatus(data => {
      setServers(prev => prev.map(s =>
        s.id === data.serverId ? { ...s, status: data.status, running: data.status !== 'offline' } : s
      ))
    })
    // Subscribe to Java download progress
    const unsubJava = window.electronAPI.onServerJavaProgress(data => {
      const { serverId, phase, percent } = data
      if (phase === 'done' || phase === 'already_installed') {
        // Remove progress when done
        setJavaProgress(prev => { const n = { ...prev }; delete n[serverId]; return n })
        // Refresh server list to get updated javaPath
        load()
      } else {
        setJavaProgress(prev => ({ ...prev, [serverId]: { phase, percent: percent ?? 0 } }))
      }
    })
    return () => { unsubStatus?.(); unsubJava?.() }
  }, [load])

  function handleCreate(server, javaPkg) {
    setServers(prev => [...prev, { ...server, status: 'offline' }])

    if (javaPkg && isElectron && server?.id) {
      setJavaProgress(prev => ({ ...prev, [server.id]: { phase: 'starting', percent: 0 } }))
      // Fire and forget — errors handled gracefully
      window.electronAPI.serverInstallJava(javaPkg, server.id)
        .then(r => {
          if (r?.error) {
            setJavaProgress(prev => { const n = { ...prev }; delete n[server.id]; return n })
          }
        })
        .catch(() => {
          setJavaProgress(prev => { const n = { ...prev }; delete n[server.id]; return n })
        })
    }
  }

  async function handleDelete(server) {
    if (confirmDel !== server.id) {
      setConfirmDel(server.id)
      setTimeout(() => setConfirmDel(c => c === server.id ? null : c), 3000)
      return
    }
    if (!isElectron) return
    await window.electronAPI.serverDelete(server.id)
    setServers(prev => prev.filter(s => s.id !== server.id))
    setConfirmDel(null)
  }

  // If a server is selected, show console view
  if (activeServer) {
    const current = servers.find(s => s.id === activeServer.id) || activeServer
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <ServerConsole
          server={current}
          onBack={() => setActiveServer(null)}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 pt-6 pb-4">
        <div>
          <h1 className="text-lg font-bold text-white">Server</h1>
          <p className="text-xs text-white/30 mt-0.5">Quản lý Minecraft server</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5 border border-white/8">
            <button onClick={() => setView('list')}
              className={`w-7 h-7 flex items-center justify-center rounded-md transition-all ${view === 'list' ? 'bg-white/15 text-white' : 'text-white/30 hover:text-white/60'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <path strokeLinecap="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
              </svg>
            </button>
            <button onClick={() => setView('grid')}
              className={`w-7 h-7 flex items-center justify-center rounded-md transition-all ${view === 'grid' ? 'bg-white/15 text-white' : 'text-white/30 hover:text-white/60'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </button>
          </div>

          {/* Create button */}
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-green-500 hover:bg-green-400 text-white text-xs font-bold transition-all active:scale-95 shadow-lg shadow-green-500/20">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Tạo Server
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6" style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-white/30">
            <svg className="animate-spin w-5 h-5 text-green-400/50" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="text-sm">Đang tải...</span>
          </div>
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-8 h-8 text-white/15">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path strokeLinecap="round" d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white/40">Chưa có server nào</p>
              <p className="text-xs text-white/20 mt-1">Nhấn "Tạo Server" để bắt đầu</p>
            </div>
            <button onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-xl bg-green-500/15 text-green-400 text-xs font-semibold border border-green-500/20 hover:bg-green-500/25 transition-all">
              + Tạo server đầu tiên
            </button>
          </div>
        ) : view === 'grid' ? (
          <div className={`grid ${getGridCols(servers.length)} gap-3`}>
            {servers.map(s => {
              const jp = javaProgress[s.id]
              return (
                <div key={s.id} className="relative">
                  <ServerCardGrid
                    server={s}
                    onClick={jp ? null : setActiveServer}
                    onDelete={handleDelete}
                    javaProgress={jp}
                  />
                  {confirmDel === s.id && (
                    <div className="absolute inset-0 rounded-2xl bg-[#0a0a0a]/95 border border-red-500/25 flex items-center justify-center gap-2 z-10 px-3">
                      <span className="text-xs text-white/60 flex-1">Xóa server này?</span>
                      <button onClick={() => handleDelete(s)}
                        className="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-all">Xóa</button>
                      <button onClick={() => setConfirmDel(null)}
                        className="px-2.5 py-1 rounded-lg bg-white/8 text-white/50 text-xs transition-all">Hủy</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {servers.map(s => {
              const jp = javaProgress[s.id]
              return (
                <div key={s.id} className="relative">
                  <ServerCardList
                    server={s}
                    onClick={jp ? null : setActiveServer}
                    onDelete={handleDelete}
                    javaProgress={jp}
                  />
                  {confirmDel === s.id && (
                    <div className="absolute inset-0 rounded-xl bg-[#0a0a0a]/95 border border-red-500/25 flex items-center justify-center gap-2 z-10 px-3">
                      <span className="text-xs text-white/60 flex-1">Xóa server này?</span>
                      <button onClick={() => handleDelete(s)}
                        className="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-all">Xóa</button>
                      <button onClick={() => setConfirmDel(null)}
                        className="px-2.5 py-1 rounded-lg bg-white/8 text-white/50 text-xs transition-all">Hủy</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateServerModal
          onClose={() => setShowCreate(false)}
          onCreate={(server, javaPkg) => handleCreate(server, javaPkg)}
        />
      )}
    </div>
  )
}
