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

 /**
 * VoxelXClient — Minecraft Launcher
 * Created by FoxStudio. AI-assisted development.
 *
 * Source code : https://github.com/foxstudio-201/VoxelXClient
 * Website     : https://voxxelxclient.vercel.app
 *
 * NOTICE:
 *   - Dành cho mấy cháu cứ thích phỉ báng.
 *   - Launcher sử dụng ai đi kèm trong việc tạo, bản thân người tạo không tự nhận là code toàn bộ do có sự hỗ trợ của ai, vậy nên đừng có mà nói này nói nọ.
 *   - Giỏi giang thì tự code bằng năng lực của mình đi, còn không làm được đừng có kích đểu ảnh hưởng đến người sử dụng.
 *   - Bạn chẳng phải là anh hùng mặc áo choàng đỏ mặc quần xịt như thằng trẻ trâu rồi lên mạng ra vẻ ta đây là người tốt, là anh hùng, là người bảo vệ công lý gì đâu :).
 *   - Vậy nên bớt ảo tưởng đi.
 *   - Nếu có sử dụng hoặc tham khảo code này, hãy ghi công cho FoxStudio.
 *   - Minecraft là một thương hiệu của Mojang Studios / Microsoft. Dự án này không liên kết với Mojang.
 */

import { useState, useEffect, useRef, useCallback } from 'react'

const isElectron = typeof window !== 'undefined' && window.electronAPI

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}
      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${copied ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10'}`}>
      {copied
        ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        : <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
      }
      {copied ? 'Đã copy' : 'Copy'}
    </button>
  )
}

function InfoCard({ label, value, sub, accent = false }) {
  return (
    <div className={`rounded-xl p-3 border ${accent ? 'border-green-500/20 bg-green-500/5' : 'border-white/8 bg-white/3'}`}>
      <p className="text-xs text-white/45 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-base font-bold font-mono truncate ${accent ? 'text-green-400' : 'text-white/80'}`}>{value || '—'}</p>
        {value && <CopyBtn text={value} />}
      </div>
      {sub && <p className="text-xs text-white/35 mt-1">{sub}</p>}
    </div>
  )
}

export default function ServerNetworkTab({ server, tunnelStatus, setTunnelStatus, tunnelAddr, setTunnelAddr, tunnelLog, setTunnelLog }) {
  const [localIp, setLocalIp]   = useState(null)
  const [port, setPort]         = useState('25565')
  const [publicIp, setPublicIp] = useState(null)
  const [loadingIp, setLoadingIp] = useState(true)
  const [tunnelBusy, setTunnelBusy] = useState(false)
  const logEndRef = useRef(null)

  useEffect(() => {
    if (!isElectron || !server) return
    setLoadingIp(true)
    window.electronAPI.serverGetNetworkInfo(server.id).then(r => {
      if (r?.ok) { setLocalIp(r.localIp); setPublicIp(r.publicIp); setPort(r.port || '25565') }
      setLoadingIp(false)
    }).catch(() => setLoadingIp(false))

  }, [server?.id])

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [tunnelLog])

  const startTunnel = useCallback(async () => {
    if (!isElectron) return
    setTunnelBusy(true)
    setTunnelLog([])
    setTunnelAddr(null)
    try {
      const r = await window.electronAPI.serverStartTunnel(server.id, port)
      if (r?.error) { setTunnelStatus('error'); setTunnelLog([`Lỗi: ${r.error}`]) }
    } finally { setTunnelBusy(false) }
  }, [server?.id, port])

  const stopTunnel = useCallback(async () => {
    if (!isElectron) return
    setTunnelBusy(true)
    try {
      await window.electronAPI.serverStopTunnel(server.id)
      setTunnelStatus('stopped')
      setTunnelAddr(null)
    } finally { setTunnelBusy(false) }
  }, [server?.id])

  const isRunning     = tunnelStatus === 'running'
  const isDownloading = tunnelStatus === 'downloading' || tunnelStatus === 'starting'

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4" style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>

      {}
      <div>
        <p className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2">Mạng nội bộ (LAN)</p>
        <div className="grid grid-cols-2 gap-2">
          <InfoCard label="IP nội bộ" value={loadingIp ? 'Đang tải...' : localIp} sub="Người cùng mạng WiFi" />
          <InfoCard label="Port" value={port} sub="Mặc định Minecraft: 25565" />
        </div>
        {localIp && port && (
          <div className="mt-2 rounded-xl p-3 border border-white/8 bg-white/3">
            <p className="text-xs text-white/45 uppercase tracking-wider mb-1">Địa chỉ kết nối (LAN)</p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-base font-bold font-mono text-white/85">{localIp}:{port}</p>
              <CopyBtn text={`${localIp}:${port}`} />
            </div>
            <p className="text-xs text-white/35 mt-1">Chia sẻ cho người cùng mạng</p>
          </div>
        )}
      </div>

      {}
      <div>
        <p className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2">IP công cộng</p>
        <InfoCard label="IP công cộng" value={loadingIp ? 'Đang tải...' : publicIp} sub="Cần mở port trên router để dùng" />
        <div className="mt-2 rounded-xl p-3 border border-yellow-500/15 bg-yellow-500/5">
          <div className="flex items-start gap-2">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-yellow-400/70 flex-shrink-0 mt-0.5">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <p className="text-xs text-white/45 leading-relaxed">
              Để dùng IP công cộng cần cấu hình Port Forwarding trên router. Hoặc dùng <span className="text-green-400">bore tunnel</span> bên dưới — không cần cấu hình gì.
            </p>
          </div>
        </div>
      </div>

      {}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wider font-semibold">Tunnel công cộng (bore)</p>
            <p className="text-xs text-white/35 mt-0.5">Không cần tài khoản — miễn phí, không cần cấu hình router</p>
          </div>
          <a href="https://github.com/ekzhang/bore" target="_blank" rel="noopener noreferrer"
            className="text-[10px] text-green-400/60 hover:text-green-400 transition-colors">bore →</a>
        </div>

        {}
        {tunnelAddr && (
          <div className="mb-3">
            <InfoCard label="Địa chỉ tunnel — chia sẻ cho bạn bè" value={tunnelAddr}
              sub="Bạn bè dùng địa chỉ này để kết nối từ bất kỳ đâu" accent />
          </div>
        )}

        {}
        <div className="rounded-xl border border-white/8 bg-white/3 p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                isRunning ? 'bg-green-400 animate-pulse' :
                isDownloading ? 'bg-yellow-400 animate-pulse' :
                tunnelStatus === 'error' ? 'bg-red-400' : 'bg-white/20'
              }`} />
              <span className="text-xs text-white/60">
                {isRunning ? 'Tunnel đang chạy' :
                 isDownloading ? 'Đang khởi động...' :
                 tunnelStatus === 'error' ? 'Lỗi tunnel' :
                 tunnelStatus === 'stopped' ? 'Đã dừng' : 'Chưa khởi động'}
              </span>
            </div>
            <div className="flex gap-2">
              {!isRunning && !isDownloading && (
                <button onClick={startTunnel} disabled={tunnelBusy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500 hover:bg-green-400 text-white transition-all disabled:opacity-50">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M8 5v14l11-7z"/></svg>
                  Bật tunnel
                </button>
              )}
              {(isRunning || isDownloading) && (
                <button onClick={stopTunnel} disabled={tunnelBusy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/25 transition-all disabled:opacity-50">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M6 6h12v12H6z"/></svg>
                  Dừng
                </button>
              )}
            </div>
          </div>

          {}
          {tunnelLog.length > 0 && (
            <div className="relative">
              <button onClick={() => navigator.clipboard.writeText(tunnelLog.join('\n'))}
                className="absolute top-1.5 right-1.5 z-10 px-2 py-0.5 rounded text-[10px] bg-white/8 text-white/30 hover:text-white/60 hover:bg-white/12 transition-all">
                Copy
              </button>
              <div className="bg-black/40 rounded-lg p-2 max-h-32 overflow-y-auto font-mono text-xs text-white/50"
                style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                {tunnelLog.map((line, i) => {
                  const clean = line
                    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
                    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
                    .replace(/\x1b[^[\]()#;?0-9A-Za-z]/g, '')
                    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
                    .replace(/\r/g, '').trim()
                  if (!clean) return null
                  const isAddr = clean.toLowerCase().includes('bore.pub')
                  return <div key={i} className={isAddr ? 'text-green-400/80' : ''}>{clean}</div>
                })}
                <div ref={logEndRef} />
              </div>
            </div>
          )}
        </div>

          {}
          {tunnelStatus === 'error' && tunnelLog.some(l => l.includes('Defender') || l.includes('exclusion') || l.includes('UNKNOWN')) && (
            <div className="mt-2 rounded-xl p-3 border border-red-500/20 bg-red-500/5">
              <p className="text-xs text-red-400 font-semibold mb-1">⚠️ Windows Defender chặn bore.exe</p>
              <p className="text-xs text-white/50 leading-relaxed mb-2">
                Windows Defender xóa file tunnel vì không có chữ ký số. Cần thêm exclusion:
              </p>
              <div className="text-xs text-white/45 space-y-0.5">
                <p>1. Mở <span className="text-white/60">Windows Security</span></p>
                <p>2. Virus & threat protection → Manage settings</p>
                <p>3. Add or remove exclusions → Add a folder</p>
                <p>4. Chọn thư mục: <span className="text-green-400/70 font-mono text-[10px]">%APPDATA%\.VoxelXClient\bore</span></p>
                <p>5. Bật tunnel lại</p>
              </div>
            </div>
          )}
        <div className="mt-2 rounded-xl p-3 border border-white/5 bg-white/2">
          <p className="text-xs text-white/45 font-semibold mb-1.5">Cách hoạt động</p>
          <div className="space-y-1">
            {[
              'Launcher tải bore binary về máy (lần đầu, ~6MB)',
              'bore tạo TCP tunnel từ server của bạn đến bore.pub',
              'Địa chỉ tunnel dạng bore.pub:XXXXX hiện ở trên',
              'Bạn bè dùng địa chỉ đó để kết nối — không cần tài khoản',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[10px] w-4 h-4 rounded-full bg-white/8 text-white/30 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">{i + 1}</span>
                <p className="text-xs text-white/45">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

