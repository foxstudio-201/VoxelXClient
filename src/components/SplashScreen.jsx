import { useEffect, useState, useRef } from 'react'

const isElectron = typeof window !== 'undefined' && window.electronAPI

export default function SplashScreen({ onDone }) {
  const [pct, setPct]         = useState(0)
  const [log, setLog]         = useState('Khởi tạo...')
  const [fadeOut, setFadeOut] = useState(false)
  const [version, setVersion] = useState('1.0.0')
  const doneRef               = useRef(false)
  const pctRef                = useRef(0)

  function setProgress(p, label) {
    pctRef.current = p
    setPct(p)
    if (label) setLog(label)
  }

  useEffect(() => {
    let cancelled = false

    async function run() {
      // ── Bước 1: Lấy version ──────────────────────────────────────────
      setProgress(5, 'Khởi tạo ứng dụng...')
      if (isElectron) {
        try {
          const v = await window.electronAPI.getVersion()
          if (v && !cancelled) setVersion(v)
        } catch {}
      }
      await delay(120)

      if (cancelled) return

      // ── Bước 2: Load settings (thật) ─────────────────────────────────
      setProgress(20, 'Tải cài đặt người dùng...')
      if (isElectron) {
        try {
          const s = await window.electronAPI.getSettings()
          if (s?.background && !cancelled) {
            window.dispatchEvent(new CustomEvent('vxc-bg-change', { detail: s.background }))
          }
        } catch {}
      }
      await delay(100)

      if (cancelled) return

      // ── Bước 3: Load accounts + auto-refresh MS tokens ──────────────
      setProgress(45, 'Tải dữ liệu tài khoản...')
      if (isElectron) {
        try {
          const accountData = await window.electronAPI.getAccounts()
          const selected = (accountData?.accounts || []).find(a => a.id === accountData?.selectedId)

          // Chỉ hiện log sync nếu tài khoản đang chọn là Microsoft
          if (selected?.type === 'microsoft') {
            setProgress(50, `Đồng bộ tài khoản Microsoft (${selected.username})...`)
            try {
              await window.electronAPI.msRefreshToken(selected.id)
            } catch {}
          }

          // Refresh ngầm các tài khoản MS còn lại (không hiện log)
          const otherMs = (accountData?.accounts || []).filter(
            a => a.type === 'microsoft' && a.id !== selected?.id
          )
          for (const acc of otherMs) {
            try { await window.electronAPI.msRefreshToken(acc.id) } catch {}
          }
        } catch {}
      }
      await delay(100)

      if (cancelled) return

      // ── Bước 4: Load profiles (thật) ─────────────────────────────────
      setProgress(65, 'Tải danh sách profile...')
      if (isElectron) {
        try { await window.electronAPI.getProfiles() } catch {}
      }
      await delay(100)

      if (cancelled) return

      // ── Bước 5: Kiểm tra phiên bản Minecraft ─────────────────────────
      setProgress(80, 'Tải danh sách phiên bản game...')
      if (isElectron) {
        try { await window.electronAPI.minecraftListVersions() } catch {}
      }
      await delay(100)

      if (cancelled) return

      // ── Bước 6: Hoàn tất ─────────────────────────────────────────────
      setProgress(95, 'Hoàn tất khởi động...')
      await delay(200)

      if (cancelled) return

      setProgress(100, 'Sẵn sàng!')
      await delay(350)

      if (cancelled) return

      setFadeOut(true)
      await delay(550)

      if (!doneRef.current && !cancelled) {
        doneRef.current = true
        onDone()
      }
    }

    run()
    return () => { cancelled = true }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-[#080808]"
      style={{ opacity: fadeOut ? 0 : 1, transition: 'opacity 550ms ease-in-out', pointerEvents: fadeOut ? 'none' : 'auto' }}
    >
      {/* Grid bg */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: `linear-gradient(rgba(74,222,128,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(74,222,128,0.8) 1px,transparent 1px)`,
        backgroundSize: '48px 48px',
      }} />

      {/* Ambient glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-96 h-96 bg-green-500/5 rounded-full blur-3xl" />
      </div>

      {/* ── Center ── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-7 relative z-10">

        {/* Logo */}
        <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-32 h-32 bg-green-500/20 rounded-full blur-3xl" style={{ animation: 'splash-glow 4s ease-in-out infinite' }} />
          </div>
          <div className="absolute rounded-xl" style={{ width: 36, height: 36, background: '#4ade80', boxShadow: '0 0 18px #4ade8099', animation: 'splash-tl 4s ease-in-out 0s infinite' }} />
          <div className="absolute rounded-xl" style={{ width: 36, height: 36, background: '#22c55e', boxShadow: '0 0 18px #22c55e99', animation: 'splash-tr 4s ease-in-out 0.06s infinite' }} />
          <div className="absolute rounded-xl" style={{ width: 36, height: 36, background: '#16a34a', boxShadow: '0 0 18px #16a34a99', animation: 'splash-bl 4s ease-in-out 0.12s infinite' }} />
          <div className="absolute rounded-xl" style={{ width: 36, height: 36, background: '#4ade80', boxShadow: '0 0 18px #4ade8099', animation: 'splash-br 4s ease-in-out 0.18s infinite' }} />
        </div>

        <style>{`
          @keyframes splash-tl {
            0%   { transform:translate(-18px,-18px) rotate(0deg)   scale(1);   opacity:.9; }
            15%  { transform:translate(-42px,-42px) rotate(0deg)   scale(1.1); opacity:1;  }
            50%  { transform:translate(-42px,-42px) rotate(360deg) scale(1.1); opacity:1;  }
            65%  { transform:translate(-18px,-18px) rotate(360deg) scale(1);   opacity:.9; }
            100% { transform:translate(-18px,-18px) rotate(360deg) scale(1);   opacity:.9; }
          }
          @keyframes splash-tr {
            0%   { transform:translate( 18px,-18px) rotate(0deg)   scale(1);   opacity:.9; }
            15%  { transform:translate( 42px,-42px) rotate(0deg)   scale(1.1); opacity:1;  }
            50%  { transform:translate( 42px,-42px) rotate(360deg) scale(1.1); opacity:1;  }
            65%  { transform:translate( 18px,-18px) rotate(360deg) scale(1);   opacity:.9; }
            100% { transform:translate( 18px,-18px) rotate(360deg) scale(1);   opacity:.9; }
          }
          @keyframes splash-bl {
            0%   { transform:translate(-18px, 18px) rotate(0deg)   scale(1);   opacity:.9; }
            15%  { transform:translate(-42px, 42px) rotate(0deg)   scale(1.1); opacity:1;  }
            50%  { transform:translate(-42px, 42px) rotate(360deg) scale(1.1); opacity:1;  }
            65%  { transform:translate(-18px, 18px) rotate(360deg) scale(1);   opacity:.9; }
            100% { transform:translate(-18px, 18px) rotate(360deg) scale(1);   opacity:.9; }
          }
          @keyframes splash-br {
            0%   { transform:translate( 18px, 18px) rotate(0deg)   scale(1);   opacity:.9; }
            15%  { transform:translate( 42px, 42px) rotate(0deg)   scale(1.1); opacity:1;  }
            50%  { transform:translate( 42px, 42px) rotate(360deg) scale(1.1); opacity:1;  }
            65%  { transform:translate( 18px, 18px) rotate(360deg) scale(1);   opacity:.9; }
            100% { transform:translate( 18px, 18px) rotate(360deg) scale(1);   opacity:.9; }
          }
          @keyframes splash-glow {
            0%   { opacity:0.3; transform:scale(1);   }
            15%  { opacity:0.9; transform:scale(1.8); }
            50%  { opacity:0.9; transform:scale(1.8); }
            65%  { opacity:0.3; transform:scale(1);   }
            100% { opacity:0.3; transform:scale(1);   }
          }
        `}</style>

        {/* App name */}
        <div className="text-center">
          <h1 className="text-3xl font-black text-white tracking-tight">
            VoxelX<span className="text-green-400">Client</span>
          </h1>
          <p className="text-xs text-white/25 mt-1 font-mono tracking-widest">v{version}</p>
        </div>

        {/* Progress */}
        <div className="w-72 flex flex-col gap-2">
          {/* Log label — căn giữa */}
          <p className="text-[11px] text-white/40 font-mono text-center truncate">{log}</p>

          {/* Bar + % */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg,#16a34a,#4ade80)',
                  boxShadow: '0 0 8px rgba(74,222,128,0.6)',
                  transition: 'width 300ms ease-out',
                }}
              />
            </div>
            <span className="text-[11px] text-green-400 font-mono font-bold w-8 text-right flex-shrink-0">{pct}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}
