import { useState, useEffect, useRef } from 'react'
import adoptiumIcon from '../../assets/java-icon/adoptium.png'
import azulIcon     from '../../assets/java-icon/azul.png'
import vanillaIcon  from '../../assets/server-icon/vanilla-server.png'
import paperIcon    from '../../assets/server-icon/paper-server.png'
import purpurIcon   from '../../assets/server-icon/purpur-server.png'
import foliaIcon    from '../../assets/server-icon/Folia-server.png'
import fabricIcon   from '../../assets/server-icon/fabric-server.png'
import forgeIcon    from '../../assets/server-icon/forge-server.png'
import neoforgeIcon from '../../assets/server-icon/neoforge-server.png'
import mohistIcon   from '../../assets/server-icon/mohist-server.png'
import spongeIcon   from '../../assets/server-icon/sponge-server.png'
import arclightIcon from '../../assets/server-icon/Arclight.jpeg'
import magmaIcon    from '../../assets/server-icon/Magma.png'
import arclightIcon from '../../assets/server-icon/Arclight.png'
import magmaIcon    from '../../assets/server-icon/Magma.png'

const isElectron = typeof window !== 'undefined' && window.electronAPI

const SERVER_TYPES = [
  { id: 'vanilla',  label: 'Vanilla',   icon: vanillaIcon,  desc: 'Official Mojang server' },
  { id: 'paper',    label: 'Paper',     icon: paperIcon,    desc: 'High performance fork' },
  { id: 'purpur',   label: 'Purpur',    icon: purpurIcon,   desc: 'Paper fork with extras' },
  { id: 'folia',    label: 'Folia',     icon: foliaIcon,    desc: 'Regionized multithreading' },
  { id: 'fabric',   label: 'Fabric',    icon: fabricIcon,   desc: 'Lightweight mod loader' },
  { id: 'forge',    label: 'Forge',     icon: forgeIcon,    desc: 'Classic mod loader' },
  { id: 'neoforge', label: 'NeoForge',  icon: neoforgeIcon, desc: 'Modern Forge fork' },
  { id: 'mohist',   label: 'Mohist',    icon: mohistIcon,   desc: 'Forge + Bukkit hybrid' },
  { id: 'arclight', label: 'Arclight',  icon: arclightIcon, desc: 'Forge + Paper hybrid' },
  { id: 'magma',    label: 'Magma',     icon: magmaIcon,    desc: 'Forge + Bukkit/Spigot' },
  { id: 'sponge',   label: 'Sponge',    icon: spongeIcon,   desc: 'Plugin API platform' },

]

// ─── Java inline dropdown ─────────────────────────────────────────────────────
const JAVA_DISTROS = {
  adoptium: { id: 'adoptium', name: 'Temurin', icon: adoptiumIcon, color: '#f97316' },
  azul:     { id: 'azul',     name: 'Zulu',    icon: azulIcon,     color: '#3b82f6' },
  graalvm:  { id: 'graalvm',  name: 'GraalVM', icon: null,         color: '#a855f7' },
}
const MC_JAVA_MAP = { 8: 'MC ≤ 1.16', 11: 'MC 1.17 (mod)', 17: 'MC 1.17–1.20', 21: 'MC 1.21+', 25: 'Tương lai' }

function JavaDropdown({ value, onChange }) {
  const [open, setOpen]       = useState(false)
  const [distros, setDistros] = useState({ adoptium: [], azul: [], graalvm: [] })
  const [loading, setLoading] = useState(false)
  const [step, setStep]       = useState('distro') // 'distro' | 'versions'
  const [selDistro, setSelDistro] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!open || Object.values(distros).every(a => a.length > 0)) return
    if (!isElectron) return
    setLoading(true)
    window.electronAPI.javaFetchDistros(null)
      .then(r => { if (r?.ok) setDistros(r.distros || {}) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    if (!open) return
    function h(e) { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setStep('distro'); setSelDistro(null) } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const currentVersions = selDistro ? (distros[selDistro] || []) : []

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <div role="button" tabIndex={0}
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setOpen(v => !v) }}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm flex items-center gap-2.5 cursor-pointer hover:border-white/20 transition-all text-left select-none">
        {value ? (
          <>
            <div className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-xs font-black"
              style={{ background: `${JAVA_DISTROS[value.distro]?.color || '#888'}20`, color: JAVA_DISTROS[value.distro]?.color || '#888' }}>
              {value.javaVersion}
            </div>
            <span className="text-white/80 flex-1">Java {value.javaVersion} — {JAVA_DISTROS[value.distro]?.name || value.distro}</span>
            <span className="text-[10px] text-white/30">Tải sau khi tạo</span>
            <div role="button" tabIndex={0}
              onClick={e => { e.stopPropagation(); onChange(null) }}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onChange(null) } }}
              className="text-white/25 hover:text-white/60 transition-colors flex-shrink-0 cursor-pointer">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </div>
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-white/25 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <span className="text-white/35 flex-1">Mặc định (tự động phát hiện)</span>
            <svg viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 text-white/25 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </>
        )}
      </div>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-[500] left-0 right-0 mt-1 rounded-xl border border-white/10 overflow-hidden"
          style={{ background: 'rgba(14,14,14,0.99)', boxShadow: '0 12px 40px rgba(0,0,0,0.7)', maxHeight: 300, overflowY: 'auto', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>

          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
            {step === 'versions' && (
              <button type="button" onClick={() => { setStep('distro'); setSelDistro(null) }}
                className="text-white/30 hover:text-white/70 transition-colors">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                </svg>
              </button>
            )}
            <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">
              {step === 'distro' ? 'Chọn Java Distribution' : `${JAVA_DISTROS[selDistro]?.name} — Chọn phiên bản`}
            </span>
            {loading && (
              <svg className="animate-spin w-3 h-3 text-green-400/50 ml-auto" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
          </div>

          {/* Default option */}
          <button type="button" onClick={() => { onChange(null); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/5 transition-all border-b border-white/5">
            <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5 text-white/30">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm text-white/60 font-semibold">Mặc định</p>
              <p className="text-[10px] text-white/30">Tự động phát hiện Java</p>
            </div>
          </button>

          {step === 'distro' ? (
            /* Distro list */
            Object.values(JAVA_DISTROS).map(d => (
              <button key={d.id} type="button"
                onClick={() => { setSelDistro(d.id); setStep('versions') }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-all group">
                <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
                  style={{ background: `${d.color}15`, border: `1px solid ${d.color}30` }}>
                  {d.icon
                    ? <img src={d.icon} alt={d.name} className="w-5 h-5 object-contain" />
                    : <svg width="16" height="16" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="6" fill="#7c3aed" fillOpacity="0.3"/><path d="M8 24L16 8l8 16H8z" fill="#a855f7" fillOpacity="0.8"/></svg>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white/80">{d.name}</p>
                  <p className="text-[10px] text-white/30">{(distros[d.id] || []).length} phiên bản</p>
                </div>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                </svg>
              </button>
            ))
          ) : (
            /* Version list */
            currentVersions.length === 0
              ? <div className="px-3 py-4 text-xs text-white/25 text-center">Không có phiên bản nào</div>
              : currentVersions.map(pkg => {
                  const d = JAVA_DISTROS[pkg.distro]
                  const mcNote = MC_JAVA_MAP[pkg.javaVersion] || ''
                  return (
                    <button key={`${pkg.distro}-${pkg.javaVersion}`} type="button"
                      onClick={() => { onChange(pkg); setOpen(false); setStep('distro'); setSelDistro(null) }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-green-500/8 transition-all group">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0"
                        style={{ background: `${d?.color || '#888'}20`, color: d?.color || '#888' }}>
                        {pkg.javaVersion}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white/80">Java {pkg.javaVersion}</p>
                        {mcNote && <p className="text-[10px] text-green-400/70">{mcNote}</p>}
                      </div>
                      <span className="text-[10px] text-white/20 group-hover:text-green-400/60 transition-colors">Chọn →</span>
                    </button>
                  )
                })
          )}
        </div>
      )}
    </div>
  )
}

// ─── JVM Preset Dropdown ──────────────────────────────────────────────────────
const JVM_PRESETS = [
  {
    id: 'default',
    label: 'Mặc định',
    desc: 'Cấu hình cơ bản, phù hợp mọi server',
    badge: null,
    args: (ram) => `-Xmx${ram}G -Xms${Math.min(1, ram)}G -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200`,
  },
  {
    id: 'aikar',
    label: 'Aikar Flags',
    desc: 'Tối ưu GC cho server đông người, giảm lag spike',
    badge: 'Recommended',
    badgeColor: 'bg-green-500/20 text-green-400',
    args: (ram) =>
      `-Xmx${ram}G -Xms${ram}G -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 ` +
      `-XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch ` +
      `-XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M ` +
      `-XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 ` +
      `-XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 ` +
      `-XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem ` +
      `-XX:MaxTenuringThreshold=1 -Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true`,
  },
  {
    id: 'graalvm',
    label: 'GraalVM Optimized',
    desc: 'Tối ưu cho GraalVM JIT, hiệu năng cao nhất',
    badge: 'Best Perf',
    badgeColor: 'bg-purple-500/20 text-purple-400',
    args: (ram) =>
      `-Xmx${ram}G -Xms${ram}G -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 ` +
      `-XX:+UnlockExperimentalVMOptions -XX:+UnlockDiagnosticVMOptions ` +
      `-XX:+AlwaysActAsServerClassMachine -XX:+AlwaysPreTouch ` +
      `-XX:+DisableExplicitGC -XX:NmethodSweepActivity=1 -XX:ReservedCodeCacheSize=400M ` +
      `-XX:NonNMethodCodeHeapSize=12M -XX:ProfiledCodeHeapSize=194M -XX:NonProfiledCodeHeapSize=194M ` +
      `-XX:+PerfDisableSharedMem -XX:G1NewSizePercent=40 -XX:G1MaxNewSizePercent=50 ` +
      `-XX:G1HeapRegionSize=16M -XX:G1ReservePercent=15 -XX:InitiatingHeapOccupancyPercent=20`,
  },
  {
    id: 'zgc',
    label: 'ZGC (Java 21+)',
    desc: 'Garbage collector thế hệ mới, pause cực thấp',
    badge: 'Low Latency',
    badgeColor: 'bg-blue-500/20 text-blue-400',
    args: (ram) =>
      `-Xmx${ram}G -Xms${Math.min(1, ram)}G -XX:+UseZGC -XX:+ZGenerational ` +
      `-XX:+AlwaysPreTouch -XX:+DisableExplicitGC -XX:+ParallelRefProcEnabled`,
  },
  {
    id: 'minimal',
    label: 'Minimal',
    desc: 'Nhẹ nhất, dành cho máy yếu hoặc server nhỏ',
    badge: 'Lightweight',
    badgeColor: 'bg-yellow-500/20 text-yellow-400',
    args: (ram) => `-Xmx${ram}G -Xms256M -XX:+UseSerialGC`,
  },
  {
    id: 'custom',
    label: 'Tuỳ chỉnh',
    desc: 'Nhập JVM flags thủ công',
    badge: null,
    args: () => '',
  },
]

function JvmPresetDropdown({ value, onChange, ramGb }) {
  const [open, setOpen]           = useState(false)
  const [selectedId, setSelectedId] = useState('default')
  const [customValue, setCustomValue] = useState('')
  const ref = useRef(null)

  // Init with default on mount
  useEffect(() => {
    const preset = JVM_PRESETS.find(p => p.id === 'default')
    if (preset && !value) {
      const generated = preset.args(ramGb || 2)
      onChange(generated)
    }
  }, [])

  // Regenerate when RAM changes (for non-custom presets)
  useEffect(() => {
    if (selectedId === 'custom') return
    const preset = JVM_PRESETS.find(p => p.id === selectedId)
    if (preset) onChange(preset.args(ramGb || 2))
  }, [ramGb, selectedId])

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function selectPreset(preset) {
    setSelectedId(preset.id)
    setOpen(false)
    if (preset.id === 'custom') {
      onChange(customValue)
    } else {
      onChange(preset.args(ramGb || 2))
    }
  }

  const selected = JVM_PRESETS.find(p => p.id === selectedId) || JVM_PRESETS[0]

  return (
    <div className="flex flex-col gap-2">
      {/* Preset selector */}
      <div ref={ref} className="relative">
        <button type="button" onClick={() => setOpen(v => !v)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none transition-all flex items-center justify-between gap-2 cursor-pointer hover:border-white/20">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-white/80 font-semibold text-sm">{selected.label}</span>
            {selected.badge && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${selected.badgeColor}`}>
                {selected.badge}
              </span>
            )}
            <span className="text-white/30 text-xs truncate hidden sm:block">— {selected.desc}</span>
          </div>
          <svg viewBox="0 0 24 24" fill="currentColor"
            className={`w-4 h-4 text-white/30 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </button>

        {open && (
          <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-white/10 overflow-hidden"
            style={{ background: 'rgba(18,18,18,0.98)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', maxHeight: 280, overflowY: 'auto', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            {JVM_PRESETS.map(p => (
              <button key={p.id} type="button" onClick={() => selectPreset(p)}
                className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-all ${
                  selectedId === p.id ? 'bg-green-500/10' : 'hover:bg-white/5'
                }`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${selectedId === p.id ? 'text-green-400' : 'text-white/80'}`}>
                      {p.label}
                    </span>
                    {p.badge && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${p.badgeColor}`}>{p.badge}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-white/35 mt-0.5">{p.desc}</p>
                </div>
                {selectedId === p.id && (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-1">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Args textarea — always visible, editable */}
      <textarea
        value={value}
        onChange={e => {
          onChange(e.target.value)
          if (selectedId !== 'custom') setSelectedId('custom')
          setCustomValue(e.target.value)
        }}
        rows={3}
        className="w-full bg-white/3 border border-white/8 rounded-lg px-3 py-2 text-[11px] text-white/55 font-mono focus:outline-none focus:border-white/20 transition-all resize-none"
        style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
        placeholder="JVM flags sẽ hiện ở đây..."
      />
      <p className="text-[10px] text-white/20">Chỉnh sửa trực tiếp để tuỳ chỉnh. RAM được tự động điền theo cấu hình.</p>
    </div>
  )
}

export default function CreateServerModal({ onClose, onCreate }) {
  const [step, setStep]           = useState(1) // 1=type, 2=config
  const [selectedType, setType]   = useState(null)
  const [versions, setVersions]   = useState([])
  const [versionOpen, setVersionOpen] = useState(false)
  const versionRef = useRef(null)
  const [showJavaModal, setShowJavaModal] = useState(false)
  const [selectedJavaPkg, setSelectedJavaPkg] = useState(null)
  const [form, setForm]           = useState({
    name:        '',
    gameVersion: '',
    ramGb:       2,
    jvmArgs:     '',
    cores:       2,
    javaPath:    '',
    serverPath:  '',
    acceptEula:  false,
    onlineMode:  true,
    maxPlayers:  20,
  })
  const [creating, setCreating]   = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    if (!isElectron) return
    window.electronAPI.serverGetVersions().then(r => {
      if (r?.ok) setVersions(r.versions)
    }).catch(() => {})
  }, [])

  // Close version dropdown on outside click
  useEffect(() => {
    if (!versionOpen) return
    function handler(e) {
      if (versionRef.current && !versionRef.current.contains(e.target)) setVersionOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [versionOpen])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleBrowse() {
    if (!isElectron) return
    const r = await window.electronAPI.serverBrowse()
    if (r?.ok) set('serverPath', r.path)
  }

  async function handleCreate() {
    if (!form.name.trim()) { setError('Vui lòng nhập tên server'); return }
    if (!form.gameVersion)  { setError('Vui lòng chọn phiên bản'); return }
    if (!form.acceptEula)   { setError('Bạn phải chấp nhận EULA của Minecraft'); return }

    setCreating(true)
    setError('')
    try {
      const r = isElectron
        ? await window.electronAPI.serverCreate({
            name:        form.name.trim(),
            type:        selectedType.id,
            gameVersion: form.gameVersion,
            ramGb:       form.ramGb,
            jvmArgs:     form.jvmArgs,
            cores:       form.cores,
            javaPath:    '',
            serverPath:  form.serverPath,
            acceptEula:  form.acceptEula,
            onlineMode:  form.onlineMode,
            maxPlayers:  form.maxPlayers,
          })
        : { ok: true, server: { id: 'demo', name: form.name, type: selectedType.id, gameVersion: form.gameVersion, ramGb: form.ramGb, status: 'offline' } }

      if (r?.error) { setError(r.error); return }

      // Close modal FIRST, then notify parent to trigger Java download
      onClose()
      onCreate?.(r.server, selectedJavaPkg || null)
    } finally {
      setCreating(false)
    }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-green-500/50 transition-all placeholder-white/20'
  const labelCls = 'text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1.5 block'

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ background: 'rgba(12,12,12,0.98)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 32px 80px rgba(0,0,0,0.8)', maxHeight: '88vh' }}>

        {/* Header */}
        <div className="flex-shrink-0 border-b border-white/5">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h3 className="text-white font-bold text-sm">Tạo Server Minecraft</h3>
              <p className="text-white/30 text-xs mt-0.5">
                {step === 1 ? 'Bước 1: Chọn loại server' : `Bước 2: Cấu hình — ${selectedType?.label}`}
              </p>
            </div>
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          {/* EULA warning banner — only show on step 2 when not accepted */}
          {step === 2 && !form.acceptEula && (
            <div className="mx-5 mb-3 flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <p className="text-xs text-yellow-300/80 leading-relaxed">
                Bạn phải <span className="font-bold text-yellow-300">chấp nhận Minecraft EULA</span> trước khi tạo server. Kéo xuống cuối để tích chọn.
              </p>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          {step === 1 ? (
            /* Step 1: Server type grid */
            <div className="p-5">
              <div className="grid grid-cols-3 gap-3">
                {SERVER_TYPES.map(t => (
                  <button key={t.id} onClick={() => { setType(t); setStep(2) }}
                    className="flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all text-left hover:-translate-y-0.5"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(74,222,128,0.35)'; e.currentTarget.style.background = 'rgba(74,222,128,0.05)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                  >
                    <img src={t.icon} alt={t.label} className="w-12 h-12 rounded-xl object-contain" />
                    <div className="text-center">
                      <p className="text-sm font-bold text-white/90">{t.label}</p>
                      <p className="text-[10px] text-white/35 mt-0.5">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Step 2: Config form */
            <div className="p-5 flex flex-col gap-4">
              {/* Selected type display */}
              <div className="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/3">
                <img src={selectedType.icon} alt={selectedType.label} className="w-10 h-10 rounded-lg object-contain" />
                <div>
                  <p className="text-sm font-bold text-white/90">{selectedType.label}</p>
                  <p className="text-xs text-white/35">{selectedType.desc}</p>
                </div>
                <button onClick={() => setStep(1)}
                  className="ml-auto text-xs text-white/30 hover:text-white/60 transition-colors">
                  Đổi
                </button>
              </div>

              {/* Name */}
              <div>
                <label className={labelCls}>Tên server</label>
                <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="My Minecraft Server" />
              </div>

              {/* Version */}
              <div>
                <label className={labelCls}>Phiên bản Minecraft</label>
                <div ref={versionRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setVersionOpen(v => !v)}
                    className={`${inputCls} flex items-center justify-between text-left cursor-pointer ${!form.gameVersion ? 'text-white/30' : ''}`}
                  >
                    <span>{form.gameVersion || 'Chọn phiên bản...'}</span>
                    <svg viewBox="0 0 24 24" fill="currentColor"
                      className={`w-4 h-4 text-white/30 flex-shrink-0 transition-transform duration-150 ${versionOpen ? 'rotate-180' : ''}`}>
                      <path d="M7 10l5 5 5-5z"/>
                    </svg>
                  </button>

                  {versionOpen && (
                    <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-white/10 overflow-hidden"
                      style={{ background: 'rgba(18,18,18,0.98)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', maxHeight: 220, overflowY: 'auto', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                      {versions.length === 0 ? (
                        <div className="px-3 py-3 text-xs text-white/30 text-center">Đang tải...</div>
                      ) : (
                        versions.map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => { set('gameVersion', v); setVersionOpen(false) }}
                            className={`w-full text-left px-3 py-2 text-sm transition-all ${
                              form.gameVersion === v
                                ? 'bg-green-500/15 text-green-400 font-semibold'
                                : 'text-white/70 hover:bg-white/6 hover:text-white'
                            }`}
                          >
                            {v}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* RAM + Cores */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>RAM: <span className="text-green-400 normal-case font-bold">{form.ramGb} GB</span></label>
                  <input type="range" min="1" max="32" step="1" value={form.ramGb}
                    onChange={e => set('ramGb', Number(e.target.value))}
                    className="w-full accent-green-500 cursor-pointer" />
                  <div className="flex justify-between text-[10px] text-white/20 mt-1"><span>1 GB</span><span>32 GB</span></div>
                </div>
                <div>
                  <label className={labelCls}>CPU Cores: <span className="text-green-400 normal-case font-bold">{form.cores}</span></label>
                  <input type="range" min="1" max="16" step="1" value={form.cores}
                    onChange={e => set('cores', Number(e.target.value))}
                    className="w-full accent-green-500 cursor-pointer" />
                  <div className="flex justify-between text-[10px] text-white/20 mt-1"><span>1</span><span>16</span></div>
                </div>
              </div>

              {/* Online Mode + Max Players */}
              <div className="grid grid-cols-2 gap-3">
                {/* Online Mode toggle */}
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Online Mode</label>
                  <button type="button"
                    onClick={() => set('onlineMode', !form.onlineMode)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                      form.onlineMode
                        ? 'border-green-500/30 bg-green-500/8'
                        : 'border-white/10 bg-white/3'
                    }`}>
                    <div className="flex items-center gap-2">
                      <svg viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 ${form.onlineMode ? 'text-green-400' : 'text-white/25'}`}>
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l5 2.18V11c0 3.5-2.33 6.79-5 7.93-2.67-1.14-5-4.43-5-7.93V7.18L12 5z"/>
                      </svg>
                      <span className={`text-xs font-semibold ${form.onlineMode ? 'text-green-400' : 'text-white/40'}`}>
                        {form.onlineMode ? 'Bật' : 'Tắt'}
                      </span>
                    </div>
                    {/* Toggle switch */}
                    <div className={`w-9 h-5 rounded-full transition-all relative flex-shrink-0 ${form.onlineMode ? 'bg-green-500' : 'bg-white/15'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.onlineMode ? 'left-4' : 'left-0.5'}`} />
                    </div>
                  </button>
                  <p className="text-[10px] text-white/25 leading-relaxed">
                    {form.onlineMode
                      ? 'Yêu cầu tài khoản Minecraft chính hãng'
                      : 'Cho phép tài khoản offline (cracked)'}
                  </p>
                </div>

                {/* Max Players */}
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Max Players</label>
                  <input
                    type="number" min="1" max="1000" step="1"
                    value={form.maxPlayers}
                    onChange={e => set('maxPlayers', Math.max(1, Math.min(1000, parseInt(e.target.value) || 20)))}
                    className={`${inputCls} font-mono`}
                    placeholder="20"
                  />
                  <p className="text-[10px] text-white/25">Số người chơi tối đa (1–1000)</p>
                </div>
              </div>

              {/* JVM Arguments */}
              <div>
                <label className={labelCls}>JVM Arguments</label>
                <JvmPresetDropdown
                  value={form.jvmArgs}
                  onChange={v => set('jvmArgs', v)}
                  ramGb={form.ramGb}
                />
              </div>

              {/* Java Runtime */}
              <div>
                <label className={labelCls}>Java Runtime</label>
                <JavaDropdown value={selectedJavaPkg} onChange={setSelectedJavaPkg} />
                <p className="text-[10px] text-white/20 mt-1">Java sẽ được tải vào thư mục server sau khi tạo xong.</p>
              </div>

              {/* Server path */}
              <div>
                <label className={labelCls}>Thư mục server (để trống = tự động)</label>
                <div className="flex gap-2">
                  <input className={`${inputCls} flex-1 font-mono text-xs`} value={form.serverPath}
                    onChange={e => set('serverPath', e.target.value)}
                    placeholder="Tự động tạo trong thư mục servers/" />
                  <button onClick={handleBrowse}
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/8 transition-all text-xs flex-shrink-0">
                    Chọn
                  </button>
                </div>
              </div>

              {/* EULA */}
              <div className="flex items-start gap-3 p-3 rounded-xl border border-white/8 bg-white/3">
                <button onClick={() => set('acceptEula', !form.acceptEula)}
                  className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                    form.acceptEula ? 'bg-green-500 border-green-500' : 'bg-white/5 border border-white/20'
                  }`}>
                  {form.acceptEula && (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  )}
                </button>
                <div>
                  <p className="text-xs font-semibold text-white/70">Chấp nhận Minecraft EULA</p>
                  <p className="text-[10px] text-white/30 mt-0.5">
                    Tôi đồng ý với{' '}
                    <span className="text-green-400/70">Minecraft End User License Agreement</span>.
                  </p>
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 2 && (
          <div className="flex gap-2 px-5 py-4 border-t border-white/5 flex-shrink-0">
            <button onClick={() => setStep(1)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/50 hover:text-white border border-white/8 hover:bg-white/5 transition-all">
              Quay lại
            </button>
            <button onClick={handleCreate} disabled={creating || !form.acceptEula}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 4px 16px rgba(34,197,94,0.25)' }}
              title={!form.acceptEula ? 'Vui lòng chấp nhận EULA trước' : ''}>
              {creating ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Đang tạo...
                </>
              ) : 'Tạo Server'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
