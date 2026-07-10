import { useState, useEffect, useCallback, useRef } from 'react'
import { useLang } from '../../../i18n/LangProvider'
import { isElectron } from './shared'

function pingColor(ms) {
  if (ms === null) return 'text-white/20'
  if (ms < 50)  return 'text-orange-400'
  if (ms < 120) return 'text-yellow-400'
  return 'text-red-400'
}

function PingBars({ ms }) {
  const bars = [1, 2, 3, 4]
  const active = ms === null ? 0 : ms < 50 ? 4 : ms < 100 ? 3 : ms < 200 ? 2 : 1
  const col = ms === null ? 'bg-white/15' : ms < 50 ? 'bg-orange-400' : ms < 120 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <div className="flex items-end gap-[2px]">
      {bars.map((b, i) => (
        <div key={b} className={`w-[3px] rounded-sm transition-all ${i < active ? col : 'bg-white/15'}`}
          style={{ height: `${5 + i * 3}px` }} />
      ))}
    </div>
  )
}

function motdToHtml(motd) {
  if (!motd) return ''
  return motd
    .replace(/\u00a7([0-9a-fklmnor])/gi, (_, code) => {
      const colors = {
        '0': 'color:#000', '1': 'color:#00a', '2': 'color:#0a0', '3': 'color:#0aa',
        '4': 'color:#a00', '5': 'color:#a0a', '6': 'color:#fa0', '7': 'color:#aaa',
        '8': 'color:#555', '9': 'color:#55f', 'a': 'color:#0f0', 'b': 'color:#0ff',
        'c': 'color:#f55', 'd': 'color:#f5f', 'e': 'color:#ff0', 'f': 'color:#fff',
        'k': '', 'l': 'font-weight:bold', 'm': 'text-decoration:line-through',
        'n': 'text-decoration:underline', 'o': 'font-style:italic', 'r': '',
      }
      return `<span style="${colors[code] || ''}">`
    })
    .replace(/§[0-9a-fklmnor]/gi, '')
}

export default function ServerBookmarksTab({ profile, accountId, onLaunch }) {
  const { t } = useLang()
  const [servers, setServers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [pingData, setPingData] = useState({})
  const timersRef = useRef({})

  const load = useCallback(async () => {
    if (!isElectron) { setLoading(false); return }
    setLoading(true)
    try {
      const r = await window.electronAPI.serverBookmarksGet()
      if (r?.servers) setServers(r.servers)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-ping all servers every 15s
  useEffect(() => {
    if (!isElectron || servers.length === 0) return

    function doPing(server) {
      window.electronAPI.serverBookmarksPing(server.address, server.port)
        .then(result => {
          if (result && !result.error) {
            setPingData(prev => ({ ...prev, [server.id]: result }))
          } else {
            setPingData(prev => ({ ...prev, [server.id]: { error: true } }))
          }
        })
        .catch(() => {
          setPingData(prev => ({ ...prev, [server.id]: { error: true } }))
        })
    }

    servers.forEach(doPing)
    const interval = setInterval(() => servers.forEach(doPing), 15000)
    return () => clearInterval(interval)
  }, [servers])

  async function handleAdd(data) {
    if (!isElectron) return
    const r = await window.electronAPI.serverBookmarksAdd(data)
    if (r?.ok) setServers(r.servers)
    setShowAdd(false)
  }

  async function handleUpdate(id, patch) {
    if (!isElectron) return
    const r = await window.electronAPI.serverBookmarksUpdate(id, patch)
    if (r?.ok) setServers(r.servers)
    setEditing(null)
  }

  async function handleDelete(id) {
    if (confirmDel !== id) {
      setConfirmDel(id)
      setTimeout(() => setConfirmDel(c => c === id ? null : c), 3000)
      return
    }
    if (!isElectron) return
    const r = await window.electronAPI.serverBookmarksDelete(id)
    if (r?.ok) setServers(r.servers)
    setConfirmDel(null)
  }

  function handlePlay(server) {
    if (!isElectron) return
    const serverAddress = `${server.address}:${server.port}`
    const ramMb = profile.ramGb ? profile.ramGb * 1024 : 2048
    if (onLaunch) {
      onLaunch(profile.id, ramMb, profile.name, '', serverAddress)
    } else {
      window.electronAPI.launchGame({ profileId: profile.id, ramMb, serverAddress })
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 pt-4 pb-3 flex-shrink-0">
        <p className="text-xs text-white/30">{t('profileSettings.serverBookmarks.subtitle')}</p>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold transition-all active:scale-95 shadow-lg shadow-orange-500/20">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          {t('profileSettings.serverBookmarks.addBtn')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-4" style={{ scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
        {loading ? (
          <div className="flex items-center justify-center h-24 gap-2 text-white/30">
            <svg className="animate-spin w-4 h-4 text-orange-400/50" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="text-xs">{t('profileSettings.serverBookmarks.loading')}</span>
          </div>
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-6 h-6 text-white/15">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path strokeLinecap="round" d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/40">{t('profileSettings.serverBookmarks.empty')}</p>
              <p className="text-[11px] text-white/20 mt-0.5">{t('profileSettings.serverBookmarks.emptyHint')}</p>
            </div>
            <button onClick={() => setShowAdd(true)}
              className="px-3 py-1.5 rounded-lg bg-orange-500/15 text-orange-400 text-xs font-semibold border border-orange-500/20 hover:bg-orange-500/25 transition-all">
              {t('profileSettings.serverBookmarks.emptyBtn')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {servers.map(server => {
              const ping = pingData[server.id]
              const ms = ping?.ping ?? null
              return (
                <div key={server.id} className="relative group">
                  <div
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
                    style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(251,146,60,0.25)'; e.currentTarget.style.background = 'rgba(251,146,60,0.04)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}>
                    {/* Server icon */}
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-black/40 ring-1 ring-white/10">
                      {ping?.icon ? (
                        <img src={ping.icon} alt="" className="w-full h-full object-contain"
                          onError={e => { e.currentTarget.style.display = 'none' }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-orange-400/40">
                            <rect x="2" y="5" width="20" height="14" rx="2"/><path strokeLinecap="round" d="M8 21h8M12 17v4"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    {/* Name + MOTD row */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white/90 truncate">{server.name}</p>
                        <span className="text-[10px] text-white/25 font-mono">{server.address}:{server.port}</span>
                      </div>
                      {ping?.motd ? (
                        <p className="text-[11px] text-white/50 mt-0.5 truncate"
                          dangerouslySetInnerHTML={{ __html: motdToHtml(ping.motd) }} />
                      ) : ping?.error ? (
                        <p className="text-[11px] text-red-400/50 mt-0.5">Offline</p>
                      ) : (
                        <p className="text-[11px] text-white/20 mt-0.5">Pinging...</p>
                      )}
                      {/* Player count */}
                      {ping && !ping.error && (
                        <p className="text-[10px] text-white/30 mt-0.5">
                          {ping.players}/{ping.maxPlayers} players
                          {ping.version ? ` · ${ping.version}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Ping bars + ms */}
                      <div className="flex flex-col items-end gap-0.5">
                        <PingBars ms={ms} />
                        <span className={`text-[9px] font-mono font-bold ${pingColor(ms)}`}>
                          {ms !== null ? `${ms}ms` : '—'}
                        </span>
                      </div>
                      <button onClick={() => handlePlay(server)}
                        className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-[11px] font-bold transition-all active:scale-95 shadow-lg shadow-orange-500/20">
                        {t('profileSettings.serverBookmarks.playBtn')}
                      </button>
                      <button onClick={() => setEditing(server.id)}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 transition-all">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                      </button>
                      <button onClick={() => handleDelete(server.id)}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  {confirmDel === server.id && (
                    <div className="absolute inset-0 rounded-xl bg-[#0a0a0a]/95 border border-red-500/25 flex items-center justify-center gap-2 z-10 px-3">
                      <span className="text-xs text-white/60 flex-1">{t('profileSettings.serverBookmarks.deleteConfirm')}</span>
                      <button onClick={() => handleDelete(server.id)}
                        className="px-2 py-1 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-all">{t('profileSettings.serverBookmarks.deleteBtn')}</button>
                      <button onClick={() => setConfirmDel(null)}
                        className="px-2 py-1 rounded-lg bg-white/8 text-white/50 text-xs transition-all">{t('profileSettings.serverBookmarks.cancelBtn')}</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <ServerFormModal
          title={t('profileSettings.serverBookmarks.addTitle')}
          initial={{ name: '', address: '', port: 25565 }}
          onSave={handleAdd}
          onClose={() => setShowAdd(false)}
          t={t}
        />
      )}

      {editing && (() => {
        const editServer = servers.find(s => s.id === editing)
        if (!editServer) return null
        return (
          <ServerFormModal
            title={t('profileSettings.serverBookmarks.editTitle')}
            initial={editServer}
            onSave={(data) => handleUpdate(editing, data)}
            onClose={() => setEditing(null)}
            t={t}
          />
        )
      })()}
    </div>
  )
}

function ServerFormModal({ title, initial, onSave, onClose, t }) {
  const [name, setName] = useState(initial.name || '')
  const [address, setAddress] = useState(initial.address || '')
  const [port, setPort] = useState(String(initial.port || 25565))
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !address.trim()) return
    onSave({
      name: name.trim(),
      address: address.trim(),
      port: parseInt(port, 10) || 25565,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl bg-[#111] border border-white/10 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="px-6 pt-5 pb-3">
            <h2 className="text-base font-bold text-white">{title}</h2>
          </div>
          <div className="px-6 pb-4 flex flex-col gap-3.5">
            <div>
              <label className="text-[11px] text-white/40 font-semibold uppercase tracking-wider block mb-1.5">{t('profileSettings.serverBookmarks.nameLabel')}</label>
              <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
                placeholder={t('profileSettings.serverBookmarks.namePlaceholder')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 outline-none focus:border-orange-400/40 focus:bg-white/[0.07] transition-all"/>
            </div>
            <div>
              <label className="text-[11px] text-white/40 font-semibold uppercase tracking-wider block mb-1.5">{t('profileSettings.serverBookmarks.addressLabel')}</label>
              <input value={address} onChange={e => setAddress(e.target.value)}
                placeholder={t('profileSettings.serverBookmarks.addressPlaceholder')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 outline-none focus:border-orange-400/40 focus:bg-white/[0.07] transition-all"/>
            </div>
            <div>
              <label className="text-[11px] text-white/40 font-semibold uppercase tracking-wider block mb-1.5">{t('profileSettings.serverBookmarks.portLabel')}</label>
              <input value={port} onChange={e => setPort(e.target.value)}
                placeholder={t('profileSettings.serverBookmarks.portPlaceholder')}
                type="number" min="1" max="65535"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 outline-none focus:border-orange-400/40 focus:bg-white/[0.07] transition-all"/>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 pb-5">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 text-white/50 text-xs font-semibold hover:bg-white/10 transition-all">{t('profileSettings.serverBookmarks.cancelBtn')}</button>
            <button type="submit" disabled={!name.trim() || !address.trim()}
              className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20">
              {t('profileSettings.serverBookmarks.saveBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
