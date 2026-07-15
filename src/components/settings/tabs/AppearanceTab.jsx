import { useState } from 'react'
import { BG_THEMES } from '../../AppBackground'
import { useLang } from '../../../i18n/LangProvider'
import { Section } from '../SettingsUI.jsx'

const isElectron = typeof window !== 'undefined' && window.electronAPI

function applyBackground(bgId, customBgPath) {
  window.dispatchEvent(new CustomEvent('vxc-bg-change', { detail: bgId, customBgPath }))
}

function customBgUrl(filePath) {
  return `vxc-bg://local?path=${encodeURIComponent(filePath.replace(/\\/g, '/'))}`
}

function applyBorder(radius, color) {
  document.documentElement.style.setProperty('--app-radius', `${radius}px`)
  document.documentElement.style.setProperty('--app-border-color', color)
}

export default function AppearanceTab({ settings, onChange }) {
  const { t } = useLang()
  const [picking, setPicking] = useState(false)
  const radius      = settings.borderRadius ?? 12
  const borderColor = settings.borderColor  ?? 'rgba(255,255,255,0.08)'
  const accent = settings.colorAccent ?? '#fb923c'
  const hover  = settings.colorHover  ?? '#86efac'
  const active = settings.colorActive ?? '#f97316'
  const selected = settings.background ?? 'dark'
  const customBg = settings.customBgPath || ''

  const BORDER_PRESETS = [
    { labelKey: 'default', value: 'rgba(255,255,255,0.08)' },
    { labelKey: 'green',   value: 'rgba(251,146,60,0.25)'  },
    { labelKey: 'blue',    value: 'rgba(96,165,250,0.25)'  },
    { labelKey: 'purple',  value: 'rgba(167,139,250,0.25)' },
    { labelKey: 'red',     value: 'rgba(248,113,113,0.25)' },
    { labelKey: 'yellow',  value: 'rgba(251,191,36,0.25)'  },
    { labelKey: 'white',   value: 'rgba(255,255,255,0.20)' },
    { labelKey: 'hidden',  value: 'transparent'            },
  ]

  const swatches = [
    { key: 'colorAccent', labelKey: 'colorAccent', value: accent },
    { key: 'colorHover',  labelKey: 'colorHover',  value: hover  },
    { key: 'colorActive', labelKey: 'colorActive', value: active },
  ]

  function handleRadius(v) {
    onChange({ borderRadius: v })
    applyBorder(v, borderColor)
  }

  function handleColor(v) {
    onChange({ borderColor: v })
    applyBorder(radius, v)
  }

  function handleBgSelect(id) {
    onChange({ background: id })
    applyBackground(id)
  }

  function handleCustomSelect() {
    onChange({ background: 'custom', customBgPath: customBg })
    applyBackground('custom', customBg)
  }

  async function handlePickFile() {
    if (!isElectron) return
    setPicking(true)
    try {
      const result = await window.electronAPI.pickBgFile()
      if (result?.ok) {
        onChange({ background: 'custom', customBgPath: result.path })
        applyBackground('custom', result.path)
      }
    } catch {}
    setPicking(false)
  }

  function handleRemoveCustom() {
    onChange({ background: 'dark', customBgPath: '' })
    applyBackground('dark', '')
  }

  return (
    <div className="px-6 py-5 space-y-6">

      <Section title="Colors">
        <div className="py-3 space-y-4">
          {swatches.map(({ key, labelKey, value }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg border border-white/10 flex-shrink-0 shadow-lg" style={{ background: value }} />
                <div>
                  <p className="text-sm text-white/70">{t(`settings.launcher.${labelKey}`)}</p>
                  <p className="text-[10px] font-mono text-white/30">{value}</p>
                </div>
              </div>
              <input type="color" value={value}
                onChange={e => onChange({ [key]: e.target.value })}
                className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent p-0 flex-shrink-0"
                style={{ colorScheme: 'dark' }} />
            </div>
          ))}
          <div className="rounded-xl border border-white/5 bg-white/3 p-3">
            <p className="text-[10px] text-white/30 mb-2 uppercase tracking-widest">{t('settings.launcher.fontPreview')}</p>
            <div className="flex gap-2">
              <div className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: accent }}>Accent</div>
              <div className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: hover }}>Hover</div>
              <div className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: active }}>Active</div>
            </div>
          </div>
        </div>
      </Section>

      <Section title={t('settings.launcher.borderRadius')}>
        <div className="py-3 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-white/40 uppercase tracking-widest">{t('settings.launcher.borderRadius')}</p>
              <span className="text-xs font-mono text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-md">
                {radius}px
              </span>
            </div>
            <input type="range" min={0} max={24} step={2} value={radius}
              onChange={e => handleRadius(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/10
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-orange-400 [&::-webkit-slider-thumb]:cursor-pointer" />
          </div>
          <div>
            <p className="text-xs text-white/40 uppercase tracking-widest mb-2">{t('settings.launcher.borderColor')}</p>
            <div className="grid grid-cols-4 gap-2">
              {BORDER_PRESETS.map(p => (
                <button key={p.labelKey}
                  onClick={() => handleColor(p.value)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all duration-150
                    ${borderColor === p.value ? 'border-orange-500/40 bg-orange-500/8' : 'border-white/5 bg-white/3 hover:bg-white/6 hover:border-white/12'}`}>
                  <div className="w-8 h-8 rounded-lg border-2"
                    style={{ borderColor: p.value === 'transparent' ? 'rgba(255,255,255,0.05)' : p.value, background: 'rgba(255,255,255,0.03)', borderStyle: p.value === 'transparent' ? 'dashed' : 'solid' }} />
                  <span className={`text-[9px] font-medium ${borderColor === p.value ? 'text-orange-400' : 'text-white/35'}`}>{t(`settings.launcher.borderPresets.${p.labelKey}`)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title={t('settings.launcher.background')}>
        <div className="py-3 space-y-4">
          <p className="text-[10px] uppercase tracking-widest text-white/25">Mặc định</p>
          <div className="grid grid-cols-2 gap-3">
            {BG_THEMES.filter(o => o.id !== 'custom').map(opt => (
              <button key={opt.id}
                onClick={() => handleBgSelect(opt.id)}
                className={`relative rounded-xl border overflow-hidden h-24 flex items-end p-3 transition-all duration-150 active:scale-95
                  ${selected === opt.id ? 'border-orange-500/60 ring-1 ring-orange-500/30' : 'border-white/8 hover:border-white/20'}`}
                style={opt.style}>
                {selected === opt.id && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  </div>
                )}
                <span className={`text-sm font-semibold ${selected === opt.id ? 'text-orange-300' : 'text-white/60'}`}>{opt.label}</span>
              </button>
            ))}
          </div>

          <p className="text-[10px] uppercase tracking-widest text-white/25 pt-2">Tùy chỉnh</p>
          <div className="flex flex-col gap-3">
            {customBg ? (
              <div role="button" tabIndex={0}
                onClick={selected !== 'custom' ? handleCustomSelect : undefined}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (selected !== 'custom') handleCustomSelect() } }}
                className={`relative rounded-xl border overflow-hidden h-28 flex items-end p-3 cursor-pointer transition-all duration-150 ${selected !== 'custom' ? 'hover:border-white/20 active:scale-[0.98]' : ''}`}
                style={selected === 'custom' ? { borderColor: 'rgba(251,146,60,0.6)', boxShadow: '0 0 0 1px rgba(251,146,60,0.3)' } : { borderColor: 'rgba(255,255,255,0.08)' }}>
                {/\.(mp4|webm|mov|avi)$/i.test(customBg) ? (
                  <video className="absolute inset-0 w-full h-full object-cover" src={customBgUrl(customBg)} autoPlay loop muted playsInline />
                ) : (
                  <img className="absolute inset-0 w-full h-full object-cover" src={customBgUrl(customBg)} draggable={false} />
                )}
                <div className="absolute inset-0 bg-black/20" />
                <div className="relative flex items-center justify-between w-full">
                  <span className="text-sm font-semibold text-white">Nền hiện tại</span>
                  <div className="flex gap-2">
                    <button onClick={handlePickFile} disabled={picking}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-white/10 text-white/80 hover:bg-white/15 transition-all">
                      {picking ? '...' : 'Đổi'}
                    </button>
                    <button onClick={handleRemoveCustom}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all">
                      Xoá
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={handlePickFile} disabled={picking}
                className="h-20 rounded-xl border border-dashed border-white/10 bg-white/3 flex items-center justify-center gap-2 text-white/30 hover:text-white/60 hover:border-white/20 transition-all text-xs font-medium">
                {picking ? 'Đang chọn...' : '+ Thêm ảnh / GIF / Video'}
              </button>
            )}
          </div>
        </div>
      </Section>

    </div>
  )
}
