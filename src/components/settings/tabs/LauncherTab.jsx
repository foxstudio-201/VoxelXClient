import { useState } from 'react'
import { BG_THEMES } from '../../AppBackground'

const isElectron = typeof window !== 'undefined' && window.electronAPI

// ── Toggle Switch ──────────────────────────────────────────────────────────────
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

// ── Setting Row ────────────────────────────────────────────────────────────────
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

// ── Section ────────────────────────────────────────────────────────────────────
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

// ── Background options — dùng từ AppBackground ────────────────────────────────
const BG_OPTIONS = BG_THEMES

function applyBackground(bgId) {
  window.dispatchEvent(new CustomEvent('vxc-bg-change', { detail: bgId }))
}

// ── UI Sub-tabs ────────────────────────────────────────────────────────────────
const UI_TABS = ['Kiểu chữ', 'Màu sắc', 'Đường viền', 'Nền']

// ── Font list ──────────────────────────────────────────────────────────────────
const FONTS = [
  { id: 'system',       label: 'System Default',  stack: 'system-ui, -apple-system, sans-serif',        google: null },
  { id: 'inter',        label: 'Inter',            stack: "'Inter', sans-serif",                          google: 'Inter:wght@300;400;500;600;700' },
  { id: 'geist',        label: 'Geist',            stack: "'Geist', sans-serif",                          google: null }, // bundled
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
  const WEIGHTS    = [100, 200, 300, 400, 500, 600, 700, 800, 900]
  const activeFont = FONTS.find(f => f.id === fontId) ?? FONTS[0]

  function handleFontSelect(id) {
    onChange({ fontId: id })
    applyFont(id)
  }

  return (
    <div className="py-4 space-y-5">
      {/* Font list */}
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

      {/* Weight slider */}
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

      {/* Preview */}
      <div className="rounded-xl border border-white/5 bg-white/3 p-4">
        <p className="text-[10px] text-white/30 mb-2 uppercase tracking-widest">Preview</p>
        <p style={{ fontFamily: activeFont.stack, fontWeight: weight }} className="text-white text-base">
          VoxelXClient Launcher
        </p>
        <p style={{ fontFamily: activeFont.stack, fontWeight: weight }} className="text-white/50 text-sm mt-1">
          The quick brown fox jumps over the lazy dog
        </p>
        <p style={{ fontFamily: activeFont.stack, fontWeight: weight }} className="text-white/30 text-xs mt-1 font-mono">
          0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ
        </p>
      </div>
    </div>
  )
}

// ── Border Tab ─────────────────────────────────────────────────────────────────
function BorderTab({ settings, onChange }) {
  const radius      = settings.borderRadius ?? 12
  const borderColor = settings.borderColor  ?? 'rgba(255,255,255,0.08)'

  // Preset border colors
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
      {/* Radius slider */}
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

      {/* Border color presets */}
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

      {/* Preview */}
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
            {/* Swatch preview */}
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

      {/* Preview bar */}
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

  // Group theo category
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

// ── Update check inline ────────────────────────────────────────────────────────
function UpdateChecker() {
  const [status, setStatus] = useState('idle') // idle | checking | done
  const [result, setResult] = useState(null)

  async function handleCheck() {
    setStatus('checking')
    setResult(null)
    try {
      const res = isElectron
        ? await window.electronAPI.checkUpdate()
        : await new Promise(r => setTimeout(() => r({
            hasUpdate: false,
            currentVersion: '1.0.0',
            latestVersion: '1.0.0',
            message: 'Bạn đang dùng phiên bản mới nhất.',
          }), 1500))
      setResult(res)
    } catch {
      setResult({ error: true, message: 'Không thể kiểm tra cập nhật. Vui lòng thử lại.' })
    }
    setStatus('done')
  }

  return (
    <div className="py-3 space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={handleCheck}
          disabled={status === 'checking'}
          className="
            flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold
            bg-green-500 hover:bg-green-400 text-white
            transition-all duration-150 active:scale-95
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          {status === 'checking' ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Đang kiểm tra...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
              </svg>
              Kiểm tra cập nhật ngay
            </>
          )}
        </button>

        {status === 'done' && result && !result.error && !result.hasUpdate && (
          <span className="text-xs text-white/40 flex items-center gap-1">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-green-400">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            Đang dùng phiên bản mới nhất
          </span>
        )}
      </div>

      {status === 'done' && result && (result.error || result.hasUpdate) && (
        <div className={`
          rounded-xl border p-3 text-sm
          ${result.error
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : 'bg-green-500/10 border-green-500/20 text-green-400'
          }
        `}>
          {result.error ? (
            result.message
          ) : (
            <span>
              Có phiên bản mới: <span className="font-mono font-bold">{result.latestVersion}</span>
              {result.currentVersion && (
                <span className="text-white/30 ml-1">(hiện tại: {result.currentVersion})</span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main LauncherTab ───────────────────────────────────────────────────────────
export default function LauncherTab({ settings, onChange }) {
  const [uiTab, setUiTab] = useState(0)

  return (
    <div className="h-full overflow-y-auto px-6 py-5">

      {/* Section: Cập nhật */}
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

      {/* Section: Trò chơi */}
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

      {/* Section: Giao diện */}
      <Section title="Giao diện">
        <div className="py-3">
          {/* Sub-tabs */}
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

          {/* Sub-tab content */}
          {uiTab === 0 && <FontTab settings={settings} onChange={onChange} />}
          {uiTab === 1 && <ColorTab settings={settings} onChange={onChange} />}
          {uiTab === 2 && <BorderTab settings={settings} onChange={onChange} />}
          {uiTab === 3 && <BgTab settings={settings} onChange={onChange} />}
        </div>
      </Section>
    </div>
  )
}
