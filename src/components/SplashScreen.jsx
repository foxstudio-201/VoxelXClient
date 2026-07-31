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

import { useEffect, useState, useRef } from 'react'
import { loadAppSettings } from '../utils/appSettings'
import { useLang } from '../i18n/LangProvider'
import martianLogo from '../assets/martian-logo.png'

const isElectron = typeof window !== 'undefined' && window.electronAPI

export default function SplashScreen({ onDone }) {
  const { t } = useLang()
  const tRef = useRef(t)
  tRef.current = t
  const [pct, setPct]         = useState(0)
  const [log, setLog]         = useState('')
  const [fadeOut, setFadeOut] = useState(false)
  const [version, setVersion] = useState('')
  const doneRef               = useRef(false)
  const pctRef                = useRef(0)

  function setProgress(p, label) {
    pctRef.current = p
    setPct(p)
    if (label) setLog(label)
  }

  useEffect(() => {
    let cancelled = false
    const MIN_SPLASH_MS = 1800 

    async function run() {
      const startTime = Date.now()

      setProgress(10, (tRef.current('splash.init')))
      if (isElectron) {
        try {
          const v = await window.electronAPI.getVersion()
          if (v && !cancelled) setVersion(v)
        } catch {}
      }

      if (cancelled) return

      setProgress(25, (tRef.current('splash.loadSettings')))
      let autoCheckUpdate = true
      try {
        const s = await loadAppSettings()
        if (s?.background && !cancelled) {
          window.dispatchEvent(new CustomEvent('vxc-bg-change', {
            detail: { bgId: s.background, customBgPath: s.customBgPath ?? '' },
          }))
        }
        if (!cancelled && s?.gamingMode !== undefined) {
          window.dispatchEvent(new CustomEvent('vxc-gaming-mode', { detail: s.gamingMode }))
        }
        if (typeof s?.autoCheckUpdate === 'boolean') {
          autoCheckUpdate = s.autoCheckUpdate
        }
      } catch {}

      if (cancelled) return

      if (autoCheckUpdate && isElectron) {
        setProgress(40, (tRef.current('splash.checkUpdate')))
        try {
          const updateResult = await window.electronAPI.checkUpdate()
          if (!cancelled && updateResult?.hasUpdate) {
            window.electronAPI.openUpdateWindow(updateResult)
            return
          }
        } catch {}
      }

      setProgress(55, (tRef.current('splash.loadAccounts')))
      if (isElectron) {
        try {
          const accountData = await window.electronAPI.getAccounts()
          const selected = (accountData?.accounts || []).find(a => a.id === accountData?.selectedId)

          if (selected?.type === 'microsoft') {
            setProgress(65, (tRef.current('splash.syncMs', { username: selected.username || '' })))
            try {
              await window.electronAPI.msRefreshToken(selected.id)
            } catch {}
          }
        } catch {}
      }

      if (cancelled) return

      setProgress(80, (tRef.current('splash.loadProfiles')))
      if (isElectron) {
        try { await window.electronAPI.getProfiles() } catch {}
      }

      if (cancelled) return

      setProgress(95, (tRef.current('splash.finishing')))

      const elapsed = Date.now() - startTime
      const remaining = MIN_SPLASH_MS - elapsed
      if (remaining > 0) {
        await new Promise(r => setTimeout(r, remaining))
      }

      if (cancelled) return

      setFadeOut(true)
      await new Promise(r => setTimeout(r, 550))

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
      {}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: `linear-gradient(rgba(251,146,60,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(251,146,60,0.8) 1px,transparent 1px)`,
        backgroundSize: '48px 48px',
      }} />

      {}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
      </div>

      {}
      <div className="flex-1 flex flex-col items-center justify-center gap-7 relative z-10">

        {}
        <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-36 h-36 bg-orange-500/20 rounded-full blur-3xl" style={{ animation: 'splash-pulse 3s ease-in-out infinite' }} />
          </div>
          <img src={martianLogo} alt="Martian" className="w-28 h-28 object-contain drop-shadow-[0_0_24px_rgba(251,146,60,0.5)]" style={{ animation: 'splash-float 4s ease-in-out infinite' }} />
        </div>

        <style>{`
          @keyframes splash-float {
            0%,100% { transform: translateY(0px) scale(1); }
            25%     { transform: translateY(-6px) scale(1.02); }
            75%     { transform: translateY(6px) scale(0.98); }
          }
          @keyframes splash-pulse {
            0%,100% { opacity:0.3; transform:scale(1); }
            50%     { opacity:0.8; transform:scale(1.3); }
          }
        `}</style>

        {}
        <div className="text-center">
          <h1 className="text-3xl font-black text-white tracking-tight">
            <span className="text-orange-400">Martian</span> Launcher
          </h1>
          <p className="text-xs text-white/25 mt-1 font-mono tracking-widest">{version ? `v${version}` : ''}</p>
        </div>

        {}
        <div className="w-72 flex flex-col gap-2">
          {}
          <p className="text-[11px] text-white/40 font-mono text-center truncate">{log}</p>

          {}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg,#ea580c,#fb923c)',
                  boxShadow: '0 0 8px rgba(251,146,60,0.6)',
                  transition: 'width 300ms ease-out',
                }}
              />
            </div>
            <span className="text-[11px] text-orange-400 font-mono font-bold w-8 text-right flex-shrink-0">{pct}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}



