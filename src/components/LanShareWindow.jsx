/**
 * VoxelXLauncher — Minecraft Launcher
 * Created by FoxStudio. AI-assisted development.
 *
 * LanShareWindow — cửa sổ riêng hiện địa chỉ tunnel LAN world
 */

import { useState, useEffect, useRef } from 'react'

const isElectron = typeof window !== 'undefined' && window.electronAPI

// ─── QR Code (dùng thư viện qrcode đã có trong project) ─────────────────────
function QRCode({ value, size = 160 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!value || !canvasRef.current) return
    // Dùng dynamic import để tránh lỗi SSR
    import('qrcode').then(QR => {
      QR.toCanvas(canvasRef.current, value, {
        width:  size,
        margin: 2,
        color:  { dark: '#ffffff', light: '#00000000' },
      }).catch(() => {})
    }).catch(() => {})
  }, [value, size])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded-xl"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyBtn({ text, label = 'Copy', className = '' }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
        copied
          ? 'bg-green-500/25 text-green-400 border border-green-500/40'
          : 'bg-white/8 text-white/60 hover:bg-white/14 hover:text-white border border-white/10'
      } ${className}`}
    >
      {copied ? (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
      )}
      {copied ? 'Đã copy!' : label}
    </button>
  )
}

// ─── Status dot ───────────────────────────────────────────────────────────────
function StatusDot({ status }) {
  const map = {
    running:     'bg-green-400 animate-pulse',
    starting:    'bg-yellow-400 animate-pulse',
    downloading: 'bg-blue-400 animate-pulse',
    error:       'bg-red-400',
    stopped:     'bg-white/20',
    idle:        'bg-white/20',
  }
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${map[status] || 'bg-white/20'}`} />
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LanShareWindow() {
  const [data, setData]               = useState(null)   // { motd, port, tunnelAddr }
  const [tunnelStatus, setTunnelStatus] = useState('starting')
  const [tunnelAddr, setTunnelAddr]   = useState(null)
  const [tunnelLog, setTunnelLog]     = useState([])
  const [showLog, setShowLog]         = useState(false)
  const logEndRef = useRef(null)

  // Nhận data từ main process
  useEffect(() => {
    if (!isElectron) return

    const unsubData = (() => {
      const handler = (_e, info) => {
        setData(info)
        if (info.tunnelAddr) {
          setTunnelAddr(info.tunnelAddr)
          setTunnelStatus('running')
        }
      }
      window.electronAPI.onLanWindowData(handler)
      return () => window.electronAPI.offLanWindowData(handler)
    })()

    const unsubStatus = (() => {
      const handler = (_e, d) => {
        setTunnelStatus(d.status)
        if (d.addr) setTunnelAddr(d.addr)
        if (d.log)  setTunnelLog(prev => [...prev.slice(-199), d.log])
      }
      window.electronAPI.onLanTunnelStatus(handler)
      return () => window.electronAPI.offLanTunnelStatus(handler)
    })()

    const unsubLog = (() => {
      const handler = (_e, d) => {
        if (d.line) setTunnelLog(prev => [...prev.slice(-199), d.line])
      }
      window.electronAPI.onLanTunnelLog(handler)
      return () => window.electronAPI.offLanTunnelLog(handler)
    })()

    return () => { unsubData(); unsubStatus(); unsubLog() }
  }, [])

  // Auto scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [tunnelLog])

  const handleClose = () => {
    if (isElectron) window.electronAPI.closeLanWindow()
  }

  const handleMinimize = () => {
    if (isElectron) window.electronAPI.minimizeWindow()
  }

  const statusLabel = {
    running:     '🟢 Tunnel đang chạy',
    starting:    '🟡 Đang khởi động...',
    downloading: '🔵 Đang tải bore...',
    error:       '🔴 Lỗi tunnel',
    stopped:     '⚫ Tunnel đã dừng',
    idle:        '⚫ Chờ...',
  }[tunnelStatus] || '...'

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-[#0f0f0f] text-white select-none">

      {/* ── Title bar ── */}
      <div
        className="flex items-center justify-between px-4 h-9 flex-shrink-0 bg-black/30 border-b border-white/5"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
          {/* Logo nhỏ */}
          <div className="w-4 h-4 rounded bg-green-500/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5 text-green-400">
              <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/>
            </svg>
          </div>
          <span className="text-xs font-semibold text-white/60">LAN World Share</span>
        </div>

        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={handleMinimize}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/8 text-white/40 hover:text-white/70 transition-all"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M19 13H5v-2h14v2z"/>
            </svg>
          </button>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>

        {/* World info */}
        {data && (
          <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-green-400">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{data.motd || 'LAN World'}</p>
                <p className="text-xs text-white/40 mt-0.5">Cổng nội bộ: <span className="font-mono text-white/60">{data.port}</span></p>
              </div>
            </div>
          </div>
        )}

        {/* Tunnel status */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
          <div className="flex items-center gap-2 mb-3">
            <StatusDot status={tunnelStatus} />
            <span className="text-xs font-semibold text-white/60">{statusLabel}</span>
          </div>

          {tunnelStatus === 'running' && tunnelAddr ? (
            <div className="space-y-3">
              {/* Địa chỉ tunnel lớn */}
              <div className="rounded-xl bg-green-500/8 border border-green-500/20 p-3">
                <p className="text-[10px] text-green-400/70 uppercase tracking-widest font-bold mb-1.5">
                  Địa chỉ tunnel — chia sẻ cho bạn bè
                </p>
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-lg font-black font-mono text-green-400 truncate">
                    {tunnelAddr}
                  </p>
                  <CopyBtn text={tunnelAddr} label="Copy" />
                </div>
              </div>

              {/* QR code */}
              <div className="flex flex-col items-center gap-2 py-2">
                <p className="text-[10px] text-white/35 uppercase tracking-widest">Quét QR để copy địa chỉ</p>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/8">
                  <QRCode value={tunnelAddr} size={140} />
                </div>
              </div>

              {/* Hướng dẫn */}
              <div className="rounded-xl border border-white/5 bg-white/2 p-3 space-y-1.5">
                <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-2">Cách tham gia</p>
                {[
                  'Mở Minecraft Java Edition',
                  'Vào Multiplayer → Direct Connection',
                  `Nhập địa chỉ: ${tunnelAddr}`,
                  'Nhấn Join Server',
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-white/8 text-white/30 text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-xs text-white/50">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6">
              {(tunnelStatus === 'downloading' || tunnelStatus === 'starting') && (
                <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin" />
              )}
              {tunnelStatus === 'error' && (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-red-400/60">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
              )}
              <p className="text-sm text-white/40 text-center">
                {tunnelStatus === 'downloading' && 'Đang tải bore tunnel lần đầu...'}
                {tunnelStatus === 'starting'    && 'Đang kết nối đến bore.pub...'}
                {tunnelStatus === 'error'       && 'Không thể khởi động tunnel'}
                {tunnelStatus === 'stopped'     && 'Tunnel đã dừng'}
                {tunnelStatus === 'idle'        && 'Đang chờ...'}
              </p>
            </div>
          )}
        </div>

        {/* Log toggle — hiện ngay khi có log để dễ debug */}
        {tunnelLog.length > 0 && (
          <div>
            <button
              onClick={() => setShowLog(v => !v)}
              className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-white/50 transition-colors mb-1.5"
            >
              <svg
                viewBox="0 0 24 24" fill="currentColor"
                className={`w-3 h-3 transition-transform ${showLog ? 'rotate-90' : ''}`}
              >
                <path d="M10 17l5-5-5-5v10z"/>
              </svg>
              {showLog ? 'Ẩn log' : `Xem log tunnel (${tunnelLog.length} dòng)`}
            </button>

            {showLog && (
              <div
                className="bg-black/50 rounded-xl p-2.5 max-h-28 overflow-y-auto font-mono text-[10px] text-white/40 border border-white/5"
                style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
              >
                {tunnelLog.map((line, i) => {
                  const clean = line
                    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
                    .replace(/\r/g, '').trim()
                  if (!clean) return null
                  const isAddr = clean.toLowerCase().includes('bore.pub')
                  return (
                    <div key={i} className={isAddr ? 'text-green-400/70' : ''}>
                      {clean}
                    </div>
                  )
                })}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        )}

        {/* Footer note */}
        <p className="text-[10px] text-white/20 text-center leading-relaxed pb-1">
          Tunnel miễn phí qua <span className="text-white/35">bore.pub</span> · Đóng cửa sổ này sẽ không dừng tunnel
        </p>
      </div>
    </div>
  )
}
