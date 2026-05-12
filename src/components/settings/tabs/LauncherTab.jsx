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

import { useState } from 'react'
import { BG_THEMES } from '../../AppBackground'

const isElectron = typeof window !== 'undefined' && window.electronAPI

function Toggle({ checked, onChange, id }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      id={id}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full
        border-2 border-transparent transition-colors duration-200
        focus:outline-none
        ${checked ? 'bg-green-500' : 'bg-white/15'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow
          transform transition-transform duration-200
          ${checked ? 'translate-x-4' : 'translate-x-0'}
        `}
      />
    </button>
  )
}

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/80">{label}</p>
        {description && <p className="text-xs text-white/30 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <p className="text-xs uppercase tracking-widest text-white/40 mb-2 px-1">{title}</p>
      <div className="rounded-xl border border-white/5 bg-white/2 divide-y divide-white/5 px-4">
        {children}
      </div>
    </div>
  )
}

const BG_OPTIONS = BG_THEMES

function applyBackground(bgId) {
  window.dispatchEvent(new CustomEvent('vxc-bg-change', { detail: bgId }))
}

const UI_TABS = ['Kiểu chữ', 'Màu sắc', 'Đường viền', 'Nền']

const FONTS = [
  { id: 'system',       label: 'System Default',  stack: 'system-ui, -apple-system, sans-serif',        google: null },
  { id: 'inter',        label: 'Inter',            stack: "'Inter', sans-serif",                          google: 'Inter:wght@300;400;500;600;700' },
  { id: 'geist',        label: 'Geist',            stack: "'Geist', sans-serif",                          google: null },
  { id: 'outfit',       label: 'Outfit',           stack: "'Outfit', sans-serif",                         google: 'Outfit:wght@300;400;500;600;700' },
  { id: 'plus-jakarta', label: 'Plus Jakarta Sans', stack: "'Plus Jakarta Sans', sans-serif",             google: 'Plus+Jakarta+Sans:wght@300;400;500;600;700' },
  { id: 'dm-sans',      label: 'DM Sans',          stack: "'DM Sans', sans-serif",                        google: 'DM+Sans:wght@300;400;500;600;700' },
  { id: 'nunito',       label: 'Nunito',           stack: "'Nunito', sans-serif",                         google: 'Nunito:wght@300;400;500;600;700' },
  { id: 'poppins',      label: 'Poppins',          stack: "'Poppins', sans-serif",                        google: 'Poppins:wght@300;400;500;600;700' },
  { id: 'raleway',      label: 'Raleway',          stack: "'Raleway', sans-serif",                        google: 'Raleway:wght@300;400;500;600;700' },
  { id: 'space-grotesk',label: 'Space Grotesk',    stack: "'Space Grotesk', sans-serif",                  google: 'Space+Grotesk:wght@300;400;500;600;700' },
  { id: 'sora',         label: 'Sora',             stack: "'Sora', sans-serif",                           google: 'Sora:wght@300;400;500;600;700' },
  { id: 'jetbrains',    label: 'JetBrains Mono',   stack: "'JetBrains Mono', monospace",                  google: 'JetBrains+Mono:wght@300;400;500;600;700' },
  { id: 'fira-code',    label: 'Fira Code',        stack: "'Fira Code', monospace",                       google: 'Fira+Code:wght@300;400;500;600;700' },
]

const loadedFonts = new Set()

function loadGoogleFont(font) {
  if (!font.google || loadedFonts.has(font.id)) return
  loadedFonts.add(font.id)
  const link = document.createElement('link')
  link.rel  = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`
  document.head.appendChild(link)
}

function applyFont(fontId) {
  const font = FONTS.find(f => f.id === fontId) ?? FONTS[0]
  if (font.google) loadGoogleFont(font)
  document.documentElement.style.setProperty('--app-font', font.stack)
  document.body.style.fontFamily = font.stack
}

function applyBorder(radius, color) {
  document.documentElement.style.setProperty('--app-radius', `${radius}px`)
  document.documentElement.style.setProperty('--app-border-color', color)
}

function FontTab({ settings, onChange }) {
  const weight     = settings.fontWeight ?? 400
  const fontId     = settings.fontId     ?? 'system'
  const fontSize   = settings.fontSize   ?? 100
  const WEIGHTS    = [100, 200, 300, 400, 500, 600, 700, 800, 900]
  const activeFont = FONTS.find(f => f.id === fontId) ?? FONTS[0]

  function handleFontSelect(id) {
    onChange({ fontId: id })
    applyFont(id)
  }

  function handleFontSizeChange(size) {
    onChange({ fontSize: size })
    document.documentElement.style.setProperty('--app-font-size', `${size}%`)
  }

  return (
    <div className="py-4 space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-white/40 uppercase tracking-widest">Cỡ chữ</p>
          <span className="text-xs font-mono text-green-400 bg-green-500/10 px-2 py-0.5 rounded-md">{fontSize}%</span>
        </div>
        <input
          type="range" min={80} max={120} step={1} value={fontSize}
          onChange={e => handleFontSizeChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/10
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-green-400 [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <div className="flex justify-between mt-1">
          {[80, 90, 100, 110, 120].map(w => (
            <span key={w} className={`text-[9px] ${w === fontSize ? 'text-green-400' : 'text-white/20'}`}>{w}%</span>
          ))}
        </div>
      </div>

      {}
      <div>
        <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Font chữ</p>
        <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
          {FONTS.map(font => (
            <button
              key={font.id}
              onClick={() => handleFontSelect(font.id)}
              className={`
                flex items-center justify-between px-3 py-2 rounded-lg text-left
                transition-all duration-150 border
                ${fontId === font.id
                  ? 'bg-green-500/12 border-green-500/30 text-white'
                  : 'bg-white/3 border-white/5 text-white/50 hover:bg-white/6 hover:border-white/12 hover:text-white/80'
                }
              `}
            >
              <span className="text-xs font-medium truncate">{font.label}</span>
              {fontId === font.id && (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-green-400 flex-shrink-0 ml-1">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-white/40 uppercase tracking-widest">Độ dày</p>
          <span className="text-xs font-mono text-green-400 bg-green-500/10 px-2 py-0.5 rounded-md">{weight}</span>
        </div>
        <input
          type="range" min={100} max={900} step={100} value={weight}
          onChange={e => onChange({ fontWeight: Number(e.target.value) })}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/10
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-green-400 [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <div className="flex justify-between mt-1">
          {WEIGHTS.map(w => (
            <span key={w} className={`text-[9px] ${w === weight ? 'text-green-400' : 'text-white/20'}`}>{w}</span>
          ))}
        </div>
      </div>

      {}
      <div className="rounded-xl border border-white/5 bg-white/3 p-4">
        <p className="text-[10px] text-white/30 mb-2 uppercase tracking-widest">Preview</p>
        <div
          style={{
            fontFamily: activeFont.stack, fontWeight: weight,
            fontSize: `${fontSize}%`
          }}
          className="text-white text-base"
        >
          VoxelXClient Launcher
          <div className="text-white/50 text-sm mt-1">The quick brown fox jumps over the lazy dog</div>
          <div className="text-white/30 text-xs mt-1 font-mono">0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ</div>
        </div>
      </div>
    </div>
  )
}

function BorderTab({ settings, onChange }) {
  const radius      = settings.borderRadius ?? 12
  const borderColor = settings.borderColor  ?? 'rgba(255,255,255,0.08)'

  const BORDER_PRESETS = [
    { label: 'Mặc định',  value: 'rgba(255,255,255,0.08)' },
    { label: 'Xanh lá',   value: 'rgba(74,222,128,0.25)'  },
    { label: 'Xanh dương',value: 'rgba(96,165,250,0.25)'  },
    { label: 'Tím',       value: 'rgba(167,139,250,0.25)' },
    { label: 'Đỏ',        value: 'rgba(248,113,113,0.25)' },
    { label: 'Vàng',      value: 'rgba(251,191,36,0.25)'  },
    { label: 'Trắng',     value: 'rgba(255,255,255,0.20)' },
    { label: 'Ẩn',        value: 'transparent'            },
  ]

  function handleRadius(v) {
    onChange({ borderRadius: v })
    applyBorder(v, borderColor)
  }

  function handleColor(v) {
    onChange({ borderColor: v })
    applyBorder(radius, v)
  }

  const RADIUS_LABELS = { 0: 'Vuông', 4: 'Nhỏ', 8: 'Vừa', 12: 'Mặc định', 16: 'Lớn', 20: 'Tròn', 24: 'Pill' }

  return (
    <div className="py-4 space-y-5">
      {}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-white/40 uppercase tracking-widest">Độ cong góc</p>
          <span className="text-xs font-mono text-green-400 bg-green-500/10 px-2 py-0.5 rounded-md">
            {radius}px {RADIUS_LABELS[radius] ? `· ${RADIUS_LABELS[radius]}` : ''}
          </span>
        </div>
        <input
          type="range" min={0} max={24} step={2} value={radius}
          onChange={e => handleRadius(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/10
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-green-400 [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <div className="flex justify-between mt-1">
          {[0,4,8,12,16,20,24].map(v => (
            <span key={v} className={`text-[9px] ${v === radius ? 'text-green-400' : 'text-white/20'}`}>{v}</span>
          ))}
        </div>
      </div>

      {}
      <div>
        <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Màu viền</p>
        <div className="grid grid-cols-4 gap-2">
          {BORDER_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => handleColor(p.value)}
              className={`
                flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all duration-150
                ${borderColor === p.value
                  ? 'border-green-500/40 bg-green-500/8'
                  : 'border-white/5 bg-white/3 hover:bg-white/6 hover:border-white/12'
                }
              `}
            >
              <div
                className="w-8 h-8 rounded-lg border-2"
                style={{
                  borderColor: p.value === 'transparent' ? 'rgba(255,255,255,0.05)' : p.value,
                  background: 'rgba(255,255,255,0.03)',
                  borderStyle: p.value === 'transparent' ? 'dashed' : 'solid',
                }}
              />
              <span className={`text-[9px] font-medium ${borderColor === p.value ? 'text-green-400' : 'text-white/35'}`}>
                {p.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {}
      <div>
        <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Preview</p>
        <div className="flex gap-3">
          <div
            className="flex-1 p-3 bg-white/3 text-xs text-white/60"
            style={{ borderRadius: radius, border: `1px solid ${borderColor}` }}
          >
            Card component
          </div>
          <button
            className="px-4 py-2 bg-green-500/20 text-green-400 text-xs font-semibold"
            style={{ borderRadius: radius, border: `1px solid ${borderColor}` }}
          >
            Button
          </button>
          <div
            className="w-10 h-10 bg-white/5 flex items-center justify-center"
            style={{ borderRadius: radius, border: `1px solid ${borderColor}` }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white/30">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

function ColorTab({ settings, onChange }) {
  const accent = settings.colorAccent ?? '#4ade80'
  const hover  = settings.colorHover  ?? '#86efac'
  const active = settings.colorActive ?? '#22c55e'

  const swatches = [
    { key: 'colorAccent', label: 'Màu nhấn (Accent)', value: accent },
    { key: 'colorHover',  label: 'Màu hover',         value: hover  },
    { key: 'colorActive', label: 'Màu active / click', value: active },
  ]

  return (
    <div className="py-4 space-y-4">
      {swatches.map(({ key, label, value }) => (
        <div key={key} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {}
            <div
              className="w-8 h-8 rounded-lg border border-white/10 flex-shrink-0 shadow-lg"
              style={{ background: value }}
            />
            <div>
              <p className="text-sm text-white/70">{label}</p>
              <p className="text-[10px] font-mono text-white/30">{value}</p>
            </div>
          </div>
          <input
            type="color"
            value={value}
            onChange={e => onChange({ [key]: e.target.value })}
            className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent p-0 flex-shrink-0"
            style={{ colorScheme: 'dark' }}
          />
        </div>
      ))}

      {}
      <div className="rounded-xl border border-white/5 bg-white/3 p-3 mt-2">
        <p className="text-[10px] text-white/30 mb-2 uppercase tracking-widest">Preview</p>
        <div className="flex gap-2">
          <div className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: accent }}>
            Accent
          </div>
          <div className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: hover }}>
            Hover
          </div>
          <div className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: active }}>
            Active
          </div>
        </div>
      </div>
    </div>
  )
}

function BgTab({ settings, onChange }) {
  const selected = settings.background ?? 'dark'

  function handleSelect(id) {
    onChange({ background: id })
    applyBackground(id)
  }

  const categories = [...new Set(BG_OPTIONS.map(o => o.category))]

  return (
    <div className="py-4 space-y-4">
      {categories.map(cat => (
        <div key={cat}>
          <p className="text-[10px] uppercase tracking-widest text-white/25 mb-2">{cat}</p>
          <div className="grid grid-cols-3 gap-2">
            {BG_OPTIONS.filter(o => o.category === cat).map(opt => (
              <button
                key={opt.id}
                onClick={() => handleSelect(opt.id)}
                className={`
                  relative rounded-xl border overflow-hidden h-16 flex items-end p-2
                  transition-all duration-150 active:scale-95
                  ${selected === opt.id
                    ? 'border-green-500/60 ring-1 ring-green-500/30'
                    : 'border-white/8 hover:border-white/20'
                  }
                `}
                style={{ background: opt.preview }}
              >
                {opt.animated && (
                  <span className="absolute top-1.5 left-1.5 text-[8px] font-bold text-white/40 bg-black/30 px-1 rounded">
                    ✦
                  </span>
                )}
                {selected === opt.id && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5 text-white">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  </div>
                )}
                <span className={`text-[10px] font-semibold ${selected === opt.id ? 'text-green-300' : 'text-white/50'}`}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="text-[10px] text-white/20 pt-1">✦ = có hiệu ứng động</p>
    </div>
  )
}

function formatBytes(b) {
  if (!b) return ''
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function UpdateChecker() {
  const [status, setStatus]       = useState('idle')
  const [result, setResult]       = useState(null)
  const [dlProgress, setDlProgress] = useState(null)
  const [errorMsg, setErrorMsg]   = useState('')
  const unsubRef = useState(null)

  async function handleCheck() {
    setStatus('checking')
    setResult(null)
    setErrorMsg('')
    setDlProgress(null)
    try {
      const res = isElectron
        ? await window.electronAPI.checkUpdate()
        : { hasUpdate: false, currentVersion: '1.0.0', latestVersion: '1.0.0', message: 'Bạn đang dùng phiên bản mới nhất.' }

      setResult(res)
      if (res.error) {
        setErrorMsg(res.message)
        setStatus('error')
      } else if (res.noRelease) {
        setStatus('noRelease')
      } else if (res.hasUpdate) {
        setStatus('updateAvailable')
        handleDownload(res)
      } else {
        setStatus('upToDate')
      }
    } catch (err) {
      setErrorMsg('Không thể kiểm tra cập nhật.')
      setStatus('error')
    }
  }

  async function handleDownload(checkResult) {
    const r = checkResult || result
    if (!r?.installerAsset) {
      setErrorMsg('Không tìm thấy file cài đặt cho hệ điều hành này.')
      setStatus('error')
      return
    }

    setStatus('downloading')
    setDlProgress({ percent: 0, downloaded: 0, total: r.installerAsset.size || 0, speed: 0 })

    const unsub = isElectron
      ? window.electronAPI.onDownloadProgress(p => setDlProgress(p))
      : null
    unsubRef[0] = unsub

    try {
      const res = isElectron
        ? await window.electronAPI.downloadUpdate({
            downloadUrl: r.installerAsset.downloadUrl,
            fileName:    r.installerAsset.name,
          })
        : { ok: true, filePath: '/tmp/fake.exe' }

      unsub?.()

      if (res?.error) {
        setErrorMsg(`Tải thất bại: ${res.error}`)
        setStatus('error')
        return
      }

      setStatus('installing')
      await new Promise(r => setTimeout(r, 500))

      const installRes = isElectron
        ? await window.electronAPI.installUpdate({ filePath: res.filePath })
        : { ok: true }

      if (installRes?.error) {
        setErrorMsg(`Cài đặt thất bại: ${installRes.error}`)
        setStatus('error')
      }
    } catch (err) {
      unsub?.()
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  return (
    <div className="py-3 space-y-3">
      {}
      {['idle', 'upToDate', 'noRelease', 'error'].includes(status) && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleCheck}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-green-500 hover:bg-green-400 text-white transition-all duration-150 active:scale-95"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            Kiểm tra cập nhật
          </button>

          {status === 'upToDate' && (
            <span className="text-xs text-white/40 flex items-center gap-1">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-green-400">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              Đang dùng phiên bản mới nhất
            </span>
          )}
          {status === 'noRelease' && (
            <span className="text-xs text-yellow-400/60">Chưa có bản phát hành nào</span>
          )}
          {status === 'error' && (
            <span className="text-xs text-red-400/80">{errorMsg}</span>
          )}
        </div>
      )}

      {}
      {status === 'checking' && (
        <div className="flex items-center gap-2 text-xs text-white/40">
          <svg className="animate-spin w-3.5 h-3.5 text-green-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Đang kiểm tra GitHub Releases...
        </div>
      )}

      {}
      {status === 'updateAvailable' && result && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/8 px-3 py-2.5 flex items-center gap-2">
          <svg className="animate-spin w-3.5 h-3.5 text-green-400 flex-shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span className="text-xs text-green-400">
            Phiên bản mới <span className="font-mono font-bold">{result.latestVersion}</span> — đang chuẩn bị tải...
          </span>
        </div>
      )}

      {}
      {status === 'downloading' && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/8 px-3 py-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-green-400 font-semibold flex items-center gap-1.5">
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Đang tải bản cập nhật...
            </span>
            <span className="text-white/40 font-mono">{dlProgress?.percent ?? 0}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-green-400 rounded-full transition-all duration-300"
              style={{ width: `${dlProgress?.percent ?? 0}%` }} />
          </div>
          <div className="flex items-center justify-between text-[10px] text-white/30">
            <span>
              {dlProgress?.downloaded ? formatBytes(dlProgress.downloaded) : '0 KB'}
              {dlProgress?.total ? ` / ${formatBytes(dlProgress.total)}` : ''}
            </span>
            {dlProgress?.speed > 0 && <span>{formatBytes(dlProgress.speed)}/s</span>}
          </div>
        </div>
      )}

      {}
      {status === 'installing' && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/8 px-3 py-2.5 flex items-center gap-2">
          <svg className="animate-spin w-3.5 h-3.5 text-green-400 flex-shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span className="text-xs text-green-400">Đang khởi chạy trình cài đặt — ứng dụng sẽ đóng...</span>
        </div>
      )}
    </div>
  )
}

export default function LauncherTab({ settings, onChange }) {
  const [uiTab, setUiTab] = useState(0)

  return (
    <div className="h-full overflow-y-auto px-6 py-5">

      {}
      <Section title="Cập nhật">
        <SettingRow
          label="Tự động kiểm tra cập nhật khi khởi động"
          description="Launcher sẽ kiểm tra phiên bản mới mỗi khi mở"
        >
          <Toggle
            checked={settings.autoCheckUpdate ?? true}
            onChange={v => onChange({ autoCheckUpdate: v })}
          />
        </SettingRow>
        <div className="py-1">
          <UpdateChecker />
        </div>
      </Section>

      {}
      <Section title="Trò chơi">
        <SettingRow
          label="Tự động ẩn launcher khi khởi chạy game"
          description="Launcher sẽ thu nhỏ xuống taskbar khi game đang chạy, tự động hiện lại khi thoát"
        >
          <Toggle
            checked={settings.hideLauncherOnLaunch ?? true}
            onChange={v => onChange({ hideLauncherOnLaunch: v })}
          />
        </SettingRow>
        <SettingRow
          label="Hiển thị cửa sổ log khi game chạy"
          description="Mở cửa sổ log Minecraft riêng biệt khi khởi chạy game"
        >
          <Toggle
            checked={settings.showLogWindow ?? true}
            onChange={v => onChange({ showLogWindow: v })}
          />
        </SettingRow>
        <SettingRow
          label="Bật Discord Rich Presence"
          description="Hiển thị trạng thái chơi game trên Discord"
        >
          <Toggle
            checked={settings.discordRPC ?? false}
            onChange={v => onChange({ discordRPC: v })}
          />
        </SettingRow>
      </Section>

      {}
      <Section title="Giao diện">
        <div className="py-3">
          {}
          <div className="flex gap-1 p-1 rounded-xl bg-white/4 border border-white/5 mb-4">
            {UI_TABS.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setUiTab(i)}
                className={`
                  flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150
                  ${uiTab === i
                    ? 'bg-white/10 text-white shadow'
                    : 'text-white/35 hover:text-white/60'
                  }
                `}
              >
                {tab}
              </button>
            ))}
          </div>

          {}
          {uiTab === 0 && <FontTab settings={settings} onChange={onChange} />}
          {uiTab === 1 && <ColorTab settings={settings} onChange={onChange} />}
          {uiTab === 2 && <BorderTab settings={settings} onChange={onChange} />}
          {uiTab === 3 && <BgTab settings={settings} onChange={onChange} />}
        </div>
      </Section>
    </div>
  )
}

