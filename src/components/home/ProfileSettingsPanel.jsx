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

import { useState, useEffect, useCallback, useRef } from 'react'
import JavaManagerModal from './JavaManagerModal'

const isElectron = typeof window !== 'undefined' && window.electronAPI

function formatBytes(b) {
  if (!b) return '0 B'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}
function formatDate(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icons = {
  settings: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96a7.02 7.02 0 00-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 00-.59.22L2.74 8.87a.47.47 0 00.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.47.47 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.37 1.04.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.47.47 0 00-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
    </svg>
  ),
  world: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
    </svg>
  ),
  mod: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/>
    </svg>
  ),
  shader: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zm-1-11v6l5 3-.75-1.3-4.25-2.45V8z"/>
    </svg>
  ),
  resourcepack: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.53 15.47 0 12.36 0c-1.73 0-3.24.87-4.19 2.19L12 6H20zm-7.45 0l-3.49-4.9C8.44 1.07 7.32.64 6.18.64 3.35.64 1 2.99 1 5.82c0 .48.07.94.18 1.36H2c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2H12.55z"/>
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  ),
  spin: (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  ),
  java: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M8.851 18.56s-.917.534.653.714c1.902.218 2.874.187 4.969-.211 0 0 .552.346 1.321.646-4.699 2.013-10.633-.118-6.943-1.149M8.276 15.933s-1.028.761.542.924c2.032.209 3.636.227 6.413-.308 0 0 .384.389.987.602-5.679 1.661-12.007.13-7.942-1.218M13.116 11.475c1.158 1.333-.304 2.533-.304 2.533s2.939-1.518 1.589-3.418c-1.261-1.772-2.228-2.652 3.007-5.688 0-.001-8.216 2.051-4.292 6.573M19.33 20.504s.679.559-.747.991c-2.712.822-11.288 1.069-13.669.033-.856-.373.75-.89 1.254-.998.527-.114.828-.093.828-.093-.953-.671-6.156 1.317-2.643 1.887 9.58 1.553 17.462-.7 14.977-1.82M9.292 13.21s-4.362 1.036-1.544 1.412c1.189.159 3.561.123 5.77-.062 1.806-.152 3.618-.477 3.618-.477s-.637.272-1.098.587c-4.429 1.165-12.986.623-10.522-.568 2.082-1.006 3.776-.892 3.776-.892M17.116 17.584c4.503-2.34 2.421-4.589.968-4.285-.355.074-.515.138-.515.138s.132-.207.385-.297c2.875-1.011 5.086 2.981-.928 4.562 0-.001.07-.062.09-.118M14.401 0s2.494 2.494-2.365 6.33c-3.896 3.077-.888 4.832-.001 6.836-2.274-2.053-3.943-3.858-2.824-5.539 1.644-2.469 6.197-3.665 5.19-7.627M9.734 23.924c4.322.277 10.959-.153 11.116-2.198 0 0-.302.775-3.572 1.391-3.688.694-8.239.613-10.937.168 0-.001.553.457 3.393.639"/>
    </svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/>
    </svg>
  ),
}

// ─── LoadingState ─────────────────────────────────────────────────────────────
function LoadingState({ text = 'Đang tải...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <svg className="animate-spin w-6 h-6 text-green-400/40" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      <p className="text-xs text-white/30">{text}</p>
    </div>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
function EmptyState({ icon, title, desc }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-12 h-12 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center text-white/20">
        {icon}
      </div>
      <div className="text-center">
        <p className="text-sm text-white/40 font-medium">{title}</p>
        {desc && <p className="text-xs text-white/20 mt-1">{desc}</p>}
      </div>
    </div>
  )
}

// ─── ViewToggle ───────────────────────────────────────────────────────────────
function ViewToggle({ view, onChange }) {
  return (
    <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5">
      <button
        onClick={() => onChange('list')}
        className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-white/10 text-white/80' : 'text-white/30 hover:text-white/60'}`}
        title="Danh sách"
      >
        {Icons.list}
      </button>
      <button
        onClick={() => onChange('grid')}
        className={`p-1.5 rounded-md transition-all ${view === 'grid' ? 'bg-white/10 text-white/80' : 'text-white/30 hover:text-white/60'}`}
        title="Lưới"
      >
        {Icons.grid}
      </button>
    </div>
  )
}

// ─── GeneralTab ───────────────────────────────────────────────────────────────
function GeneralTab({ profile, onProfileUpdated }) {
  const [name, setName] = useState(profile?.name || '')
  const [ram, setRam] = useState(profile?.ramGb || 2)
  const [winWidth, setWinWidth] = useState(profile?.windowWidth || 854)
  const [winHeight, setWinHeight] = useState(profile?.windowHeight || 480)
  const [jvmArgs, setJvmArgs] = useState(profile?.jvmArgs || '')
  const [javaRuntime, setJavaRuntime] = useState(profile?.javaRuntime || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showJavaModal, setShowJavaModal] = useState(false)
  const [javaList, setJavaList] = useState([])
  const saveTimerRef = useRef(null)

  useEffect(() => {
    setName(profile?.name || '')
    setRam(profile?.ramGb || 2)
    setWinWidth(profile?.windowWidth || 854)
    setWinHeight(profile?.windowHeight || 480)
    setJvmArgs(profile?.jvmArgs || '')
    setJavaRuntime(profile?.javaRuntime || '')
  }, [profile?.id])

  useEffect(() => {
    if (!isElectron) return
    window.electronAPI.profileListJavas?.()
      .then(r => { if (r?.ok) setJavaList(r.javas || []) })
      .catch(() => {})
  }, [])

  async function handleSave() {
    if (!isElectron || !profile?.id) return
    setSaving(true)
    try {
      const patch = {
        name: name.trim() || profile.name,
        ramGb: ram,
        windowWidth: Number(winWidth) || 854,
        windowHeight: Number(winHeight) || 480,
        jvmArgs: jvmArgs.trim(),
        javaRuntime: javaRuntime.trim(),
      }
      await window.electronAPI.profileUpdate(profile.id, patch)
      setSaved(true)

      onProfileUpdated?.({ ...profile, ...patch })
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  function handleJavaSelected(javaExe) {
    setJavaRuntime(javaExe)
    setShowJavaModal(false)
  }

  const ramMarks = [1, 2, 4, 6, 8, 12, 16, 24, 32]

  return (
    <div className="p-4 flex flex-col gap-4">
      {}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-white/50">Tên profile</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={profile?.name}
          className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white/85 placeholder-white/20 outline-none focus:border-white/20 focus:bg-white/8 transition-all"
        />
      </div>

      {}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-white/50">RAM tối đa</label>
          <span className="text-xs font-bold text-green-400">{ram} GB</span>
        </div>

        {}
        <div className="relative flex items-center gap-0 h-6">
          {ramMarks.map((m, i) => {
            const isActive = m <= ram
            const isCurrent = m === ram
            const isLast = i === ramMarks.length - 1
            return (
              <button
                key={m}
                onClick={() => setRam(m)}
                className="relative flex-1 flex flex-col items-center gap-1 group"
                title={`${m} GB`}
              >
                {}
                <div className={`w-full h-1.5 transition-all ${
                  isLast ? 'rounded-r-full' : i === 0 ? 'rounded-l-full' : ''
                } ${isActive ? 'bg-green-500' : 'bg-white/10 group-hover:bg-white/20'}`} />
                {}
                {isCurrent && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-green-400 shadow-lg shadow-green-500/40 ring-2 ring-green-400/30 z-10" />
                )}
              </button>
            )
          })}
        </div>

        {}
        <div className="flex">
          {ramMarks.map(m => (
            <button
              key={m}
              onClick={() => setRam(m)}
              className={`flex-1 text-center text-[9px] py-0.5 rounded transition-all ${
                m === ram ? 'text-green-400 font-bold' : 'text-white/20 hover:text-white/50'
              }`}
            >
              {m}G
            </button>
          ))}
        </div>
      </div>

      {}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-white/50">Kích thước cửa sổ</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={winWidth}
            onChange={e => setWinWidth(e.target.value)}
            placeholder="854"
            className="flex-1 bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white/85 placeholder-white/20 outline-none focus:border-white/20 transition-all text-center"
          />
          <span className="text-white/20 text-xs">×</span>
          <input
            type="number"
            value={winHeight}
            onChange={e => setWinHeight(e.target.value)}
            placeholder="480"
            className="flex-1 bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white/85 placeholder-white/20 outline-none focus:border-white/20 transition-all text-center"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[['854×480', 854, 480], ['1280×720', 1280, 720], ['1920×1080', 1920, 1080]].map(([label, w, h]) => (
            <button
              key={label}
              onClick={() => { setWinWidth(w); setWinHeight(h) }}
              className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${winWidth === w && winHeight === h ? 'border-green-500/40 bg-green-500/10 text-green-400' : 'border-white/8 bg-white/3 text-white/30 hover:text-white/60 hover:border-white/15'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-white/50">JVM Arguments</label>
        <textarea
          value={jvmArgs}
          onChange={e => setJvmArgs(e.target.value)}
          placeholder="-XX:+UseG1GC -XX:MaxGCPauseMillis=50"
          rows={3}
          className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-xs text-white/85 placeholder-white/20 outline-none focus:border-white/20 focus:bg-white/8 transition-all font-mono resize-none"
        />
      </div>

      {}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-white/50">Java Runtime</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-xs text-white/60 font-mono truncate min-w-0">
            {javaRuntime || <span className="text-white/20">Tự động (mặc định)</span>}
          </div>
          <button
            onClick={() => setShowJavaModal(true)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white/50 hover:text-white/80 hover:border-white/15 transition-all text-xs"
          >
            {Icons.java}
            <span>Chọn</span>
          </button>
          {javaRuntime && (
            <button
              onClick={() => setJavaRuntime('')}
              className="flex-shrink-0 p-2.5 rounded-xl bg-white/5 border border-white/8 text-white/30 hover:text-red-400 hover:border-red-500/20 transition-all"
              title="Xóa"
            >
              {Icons.trash}
            </button>
          )}
        </div>
        {javaList.length > 0 && (
          <div className="flex flex-col gap-1 mt-1">
            {javaList.map((j, i) => (
              <button
                key={i}
                onClick={() => setJavaRuntime(j.path)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${javaRuntime === j.path ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-white/3 border border-white/5 text-white/50 hover:bg-white/6 hover:text-white/70'}`}
              >
                <span className="text-[10px] font-mono truncate flex-1">{j.path}</span>
                {j.version && <span className="text-[9px] text-white/25 flex-shrink-0">Java {j.version}</span>}
                {javaRuntime === j.path && <span className="flex-shrink-0 text-green-400">{Icons.check}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${saved ? 'bg-green-500/20 border border-green-500/30 text-green-400' : 'bg-white/8 border border-white/10 text-white/70 hover:bg-white/12 hover:text-white/90'} disabled:opacity-50`}
      >
        {saving ? Icons.spin : saved ? Icons.check : null}
        {saving ? 'Đang lưu...' : saved ? 'Đã lưu!' : 'Lưu thay đổi'}
      </button>

      {showJavaModal && (
        <JavaManagerModal
          profile={profile}
          onClose={() => setShowJavaModal(false)}
          onJavaSelected={handleJavaSelected}
        />
      )}
    </div>
  )
}

// ─── WorldsTab ────────────────────────────────────────────────────────────────
function WorldsTab({ profile }) {
  const [worlds, setWorlds] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = useCallback(async () => {
    if (!isElectron || !profile?.id) { setLoading(false); return }
    setLoading(true)
    try {
      const r = await window.electronAPI.profileListWorlds(profile.id)
      if (r?.ok) setWorlds(r.worlds || [])
    } catch {}
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { load() }, [load])

  async function handleDelete(folder) {
    if (!isElectron) return
    setDeleting(folder)
    try {
      await window.electronAPI.profileDeleteWorld(profile.id, folder)
      setWorlds(prev => prev.filter(w => w.folder !== folder))
    } catch {}
    setDeleting(null)
    setConfirmDelete(null)
  }

  if (loading) return <LoadingState text="Đang tải thế giới..." />

  if (worlds.length === 0) return (
    <EmptyState
      icon={Icons.world}
      title="Chưa có thế giới nào"
      desc="Tạo thế giới mới trong game để xem ở đây"
    />
  )

  return (
    <div className="flex flex-col gap-1 p-2.5">
      {worlds.map(w => (
        <div
          key={w.folderName || w.folder || w.name}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 border border-white/5 hover:bg-white/5 hover:border-white/8 transition-all group"
        >
          {}
          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 border border-white/8 flex items-center justify-center">
            {w.iconBase64 ? (
              <img src={w.iconBase64} alt={w.name || w.folderName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white/20">{Icons.world}</span>
            )}
          </div>

          {}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/80 truncate">{w.displayName || w.name || w.folderName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {w.gameMode && (
                <span className="text-[10px] text-white/30">{w.gameMode}</span>
              )}
              {w.lastPlayed && (
                <span className="text-[10px] text-white/20">{formatDate(w.lastPlayed)}</span>
              )}
              {w.size > 0 && (
                <span className="text-[10px] text-white/20">{formatBytes(w.size)}</span>
              )}
            </div>
          </div>

          {}
          {confirmDelete === (w.folderName || w.folder) ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] text-red-400/70">Xóa?</span>
              <button
                onClick={() => handleDelete(w.folderName || w.folder)}
                disabled={deleting === (w.folderName || w.folder)}
                className="px-2 py-1 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-[10px] font-bold hover:bg-red-500/25 transition-all disabled:opacity-50"
              >
                {deleting === (w.folderName || w.folder) ? '...' : 'Xóa'}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-2 py-1 rounded-lg bg-white/5 border border-white/8 text-white/40 text-[10px] hover:bg-white/10 transition-all"
              >
                Hủy
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(w.folderName || w.folder)}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
              title="Xóa thế giới"
            >
              {Icons.trash}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── ModsTab ──────────────────────────────────────────────────────────────────
function ModsTab({ profile }) {
  const [mods, setMods] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [metaCache, setMetaCache] = useState({})
  const [toggling, setToggling] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const fetchingMeta = useRef(new Set())

  const load = useCallback(async () => {
    if (!isElectron || !profile?.id) { setLoading(false); return }
    setLoading(true)
    try {
      const r = await window.electronAPI.profileListMods(profile.id)
      if (r?.ok) setMods(r.mods || [])
    } catch {}
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!isElectron || mods.length === 0) return
    for (const mod of mods) {
      if (metaCache[mod.fileName] !== undefined) continue
      if (fetchingMeta.current.has(mod.fileName)) continue
      fetchingMeta.current.add(mod.fileName)
      window.electronAPI.profileGetModMeta(profile.id, mod.fileName)
        .then(r => {
          setMetaCache(prev => ({ ...prev, [mod.fileName]: r?.meta || null }))
        })
        .catch(() => {
          setMetaCache(prev => ({ ...prev, [mod.fileName]: null }))
        })
        .finally(() => fetchingMeta.current.delete(mod.fileName))
    }
  }, [mods, profile?.id])

  async function handleToggle(mod) {
    if (!isElectron) return
    setToggling(mod.fileName)
    try {
      const r = await window.electronAPI.profileToggleMod(profile.id, mod.fileName)
      if (r?.ok) {
        setMods(prev => prev.map(m =>
          m.fileName === mod.fileName
            ? { ...m, fileName: r.newFileName, enabled: r.enabled }
            : m
        ))

        if (r.newFileName !== mod.fileName) {
          setMetaCache(prev => {
            const next = { ...prev }
            next[r.newFileName] = next[mod.fileName]
            delete next[mod.fileName]
            return next
          })
        }
      }
    } catch {}
    setToggling(null)
  }

  async function handleDelete(fileName) {
    if (!isElectron) return
    setDeleting(fileName)
    try {
      await window.electronAPI.profileDeleteMod(profile.id, fileName)
      setMods(prev => prev.filter(m => m.fileName !== fileName))
      setMetaCache(prev => { const n = { ...prev }; delete n[fileName]; return n })
    } catch {}
    setDeleting(null)
    setConfirmDelete(null)
  }

  if (loading) return <LoadingState text="Đang tải mods..." />

  if (mods.length === 0) return (
    <EmptyState
      icon={Icons.mod}
      title="Chưa có mod nào"
      desc="Cài mod từ trình duyệt Modrinth hoặc CurseForge"
    />
  )

  return (
    <div className="flex flex-col h-full">
      {}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <span className="text-xs text-white/30">{mods.length} mod</span>
        <ViewToggle view={view} onChange={setView} />
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
        {view === 'list' ? (
          <div className="flex flex-col gap-1 p-2.5">
            {mods.map(mod => {
              const meta = metaCache[mod.fileName]
              const iconUrl = meta?.iconUrl || null
              return (
                <div
                  key={mod.fileName}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all group ${mod.enabled ? 'bg-white/3 border-white/5 hover:bg-white/5 hover:border-white/8' : 'bg-white/1 border-white/3 opacity-50 hover:opacity-70'}`}
                >
                  {}
                  <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 border border-white/8 flex items-center justify-center">
                    {iconUrl ? (
                      <img src={iconUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white/20 scale-90">{Icons.mod}</span>
                    )}
                  </div>

                  {}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/80 truncate">
                      {meta?.name || mod.displayName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-white/25">{formatBytes(mod.size)}</span>
                      {!mod.enabled && <span className="text-[10px] text-orange-400/60">Đã tắt</span>}
                    </div>
                  </div>

                  {}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {confirmDelete === mod.fileName ? (
                      <>
                        <span className="text-[10px] text-red-400/70">Xóa?</span>
                        <button
                          onClick={() => handleDelete(mod.fileName)}
                          disabled={deleting === mod.fileName}
                          className="px-2 py-1 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-[10px] font-bold hover:bg-red-500/25 transition-all disabled:opacity-50"
                        >
                          {deleting === mod.fileName ? '...' : 'Xóa'}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-2 py-1 rounded-lg bg-white/5 border border-white/8 text-white/40 text-[10px] hover:bg-white/10 transition-all"
                        >
                          Hủy
                        </button>
                      </>
                    ) : (
                      <>
                        {}
                        <button
                          onClick={() => handleToggle(mod)}
                          disabled={toggling === mod.fileName}
                          className={`relative w-9 h-5 rounded-full transition-all flex-shrink-0 ${mod.enabled ? 'bg-green-500' : 'bg-white/10'} disabled:opacity-50`}
                          title={mod.enabled ? 'Tắt mod' : 'Bật mod'}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${mod.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                        {}
                        <button
                          onClick={() => setConfirmDelete(mod.fileName)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Xóa mod"
                        >
                          {Icons.trash}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (

          <div className="grid grid-cols-3 gap-2 p-2.5">
            {mods.map(mod => {
              const meta = metaCache[mod.fileName]
              const iconUrl = meta?.iconUrl || null
              return (
                <div
                  key={mod.fileName}
                  className={`relative rounded-xl border overflow-hidden transition-all group ${mod.enabled ? 'bg-white/3 border-white/8 hover:border-white/15' : 'bg-white/1 border-white/4 opacity-50 hover:opacity-70'}`}
                >
                  {}
                  <div className="relative w-full overflow-hidden" style={{ paddingBottom: '55%' }}>
                    {iconUrl && (
                      <img
                        src={iconUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-30"
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/8 border border-white/10 flex items-center justify-center shadow-lg">
                        {iconUrl ? (
                          <img src={iconUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white/30">{Icons.mod}</span>
                        )}
                      </div>
                    </div>
                    {}
                    <button
                      onClick={() => handleToggle(mod)}
                      disabled={toggling === mod.fileName}
                      className={`absolute top-1.5 right-1.5 w-6 h-3.5 rounded-full transition-all ${mod.enabled ? 'bg-green-500' : 'bg-white/15'} disabled:opacity-50`}
                      title={mod.enabled ? 'Tắt' : 'Bật'}
                    >
                      <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-all ${mod.enabled ? 'left-[10px]' : 'left-0.5'}`} />
                    </button>
                  </div>

                  {}
                  <div className="px-2 py-1.5">
                    <p className="text-[10px] font-medium text-white/70 truncate leading-tight">
                      {meta?.name || mod.displayName}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] text-white/25">{formatBytes(mod.size)}</span>
                      {confirmDelete === mod.fileName ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDelete(mod.fileName)}
                            disabled={deleting === mod.fileName}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50"
                          >
                            {deleting === mod.fileName ? '...' : 'Xóa'}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-white/8 text-white/40 hover:bg-white/12 transition-all"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(mod.fileName)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          {Icons.trash}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ShadersTab ───────────────────────────────────────────────────────────────
function ShadersTab({ profile }) {
  const [shaders, setShaders] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [metaCache, setMetaCache] = useState({})
  const [deleting, setDeleting] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const fetchingMeta = useRef(new Set())

  const load = useCallback(async () => {
    if (!isElectron || !profile?.id) { setLoading(false); return }
    setLoading(true)
    try {
      const r = await window.electronAPI.profileListShaders(profile.id)
      if (r?.ok) setShaders(r.shaders || [])
    } catch {}
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!isElectron || shaders.length === 0) return
    for (const s of shaders) {
      if (metaCache[s.fileName] !== undefined) continue
      if (fetchingMeta.current.has(s.fileName)) continue
      fetchingMeta.current.add(s.fileName)
      window.electronAPI.profileGetShaderMeta(profile.id, s.fileName)
        .then(r => setMetaCache(prev => ({ ...prev, [s.fileName]: r?.meta || null })))
        .catch(() => setMetaCache(prev => ({ ...prev, [s.fileName]: null })))
        .finally(() => fetchingMeta.current.delete(s.fileName))
    }
  }, [shaders, profile?.id])

  async function handleDelete(shader) {
    if (!isElectron) return
    setDeleting(shader.fileName)
    try {
      await window.electronAPI.profileDeleteShader(profile.id, shader.fileName, shader.subDir)
      setShaders(prev => prev.filter(s => s.fileName !== shader.fileName))
      setMetaCache(prev => { const n = { ...prev }; delete n[shader.fileName]; return n })
    } catch {}
    setDeleting(null)
    setConfirmDelete(null)
  }

  if (loading) return <LoadingState text="Đang tải shaders..." />

  if (shaders.length === 0) return (
    <EmptyState
      icon={Icons.shader}
      title="Chưa có shader nào"
      desc="Cài shader pack vào thư mục shaderpacks của profile"
    />
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <span className="text-xs text-white/30">{shaders.length} shader</span>
        <ViewToggle view={view} onChange={setView} />
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
        {view === 'list' ? (
          <div className="flex flex-col gap-1 p-2.5">
            {shaders.map(shader => {
              const meta = metaCache[shader.fileName]
              const iconUrl = meta?.iconUrl || null
              return (
                <div
                  key={shader.fileName}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 border border-white/5 hover:bg-white/5 hover:border-white/8 transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-yellow-500/8 border border-yellow-500/15 flex items-center justify-center">
                    {iconUrl ? (
                      <img src={iconUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-yellow-500/40 scale-90">{Icons.shader}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/80 truncate">
                      {meta?.name || shader.displayName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-white/25">{formatBytes(shader.size)}</span>
                      {shader.subDir && <span className="text-[10px] text-white/20">{shader.subDir}/</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {confirmDelete === shader.fileName ? (
                      <>
                        <span className="text-[10px] text-red-400/70">Xóa?</span>
                        <button
                          onClick={() => handleDelete(shader)}
                          disabled={deleting === shader.fileName}
                          className="px-2 py-1 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-[10px] font-bold hover:bg-red-500/25 transition-all disabled:opacity-50"
                        >
                          {deleting === shader.fileName ? '...' : 'Xóa'}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-2 py-1 rounded-lg bg-white/5 border border-white/8 text-white/40 text-[10px] hover:bg-white/10 transition-all"
                        >
                          Hủy
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(shader.fileName)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Xóa shader"
                      >
                        {Icons.trash}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 p-2.5">
            {shaders.map(shader => {
              const meta = metaCache[shader.fileName]
              const iconUrl = meta?.iconUrl || null
              return (
                <div
                  key={shader.fileName}
                  className="relative rounded-xl border border-white/8 bg-white/3 overflow-hidden transition-all group hover:border-white/15"
                >
                  <div className="relative w-full overflow-hidden" style={{ paddingBottom: '55%' }}>
                    {iconUrl && (
                      <img
                        src={iconUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-30"
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shadow-lg">
                        {iconUrl ? (
                          <img src={iconUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-yellow-500/50">{Icons.shader}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="px-2 py-1.5">
                    <p className="text-[10px] font-medium text-white/70 truncate leading-tight">
                      {meta?.name || shader.displayName}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] text-white/25">{formatBytes(shader.size)}</span>
                      {confirmDelete === shader.fileName ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDelete(shader)}
                            disabled={deleting === shader.fileName}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50"
                          >
                            {deleting === shader.fileName ? '...' : 'Xóa'}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-white/8 text-white/40 hover:bg-white/12 transition-all"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(shader.fileName)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          {Icons.trash}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ResourcePacksTab ─────────────────────────────────────────────────────────
function ResourcePacksTab({ profile }) {
  const [packs, setPacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [metaCache, setMetaCache] = useState({})
  const [deleting, setDeleting] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const fetchingMeta = useRef(new Set())

  const load = useCallback(async () => {
    if (!isElectron || !profile?.id) { setLoading(false); return }
    setLoading(true)
    try {
      const r = await window.electronAPI.profileListResourcePacks(profile.id)
      if (r?.ok) setPacks(r.resourcePacks || [])
    } catch {}
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!isElectron || packs.length === 0) return
    for (const p of packs) {
      if (metaCache[p.fileName] !== undefined) continue
      if (fetchingMeta.current.has(p.fileName)) continue
      fetchingMeta.current.add(p.fileName)
      window.electronAPI.profileGetResourcePackMeta(profile.id, p.fileName)
        .then(r => setMetaCache(prev => ({ ...prev, [p.fileName]: r?.meta || null })))
        .catch(() => setMetaCache(prev => ({ ...prev, [p.fileName]: null })))
        .finally(() => fetchingMeta.current.delete(p.fileName))
    }
  }, [packs, profile?.id])

  async function handleDelete(fileName) {
    if (!isElectron) return
    setDeleting(fileName)
    try {
      await window.electronAPI.profileDeleteResourcePack(profile.id, fileName)
      setPacks(prev => prev.filter(p => p.fileName !== fileName))
      setMetaCache(prev => { const n = { ...prev }; delete n[fileName]; return n })
    } catch {}
    setDeleting(null)
    setConfirmDelete(null)
  }

  if (loading) return <LoadingState text="Đang tải resource packs..." />

  if (packs.length === 0) return (
    <EmptyState
      icon={Icons.resourcepack}
      title="Chưa có resource pack nào"
      desc="Thêm resource pack vào thư mục resourcepacks của profile"
    />
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <span className="text-xs text-white/30">{packs.length} resource pack</span>
        <ViewToggle view={view} onChange={setView} />
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
        {view === 'list' ? (
          <div className="flex flex-col gap-1 p-2.5">
            {packs.map(pack => {
              const meta = metaCache[pack.fileName]
              const iconUrl = meta?.iconUrl || null
              return (
                <div
                  key={pack.fileName}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 border border-white/5 hover:bg-white/5 hover:border-white/8 transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-purple-500/8 border border-purple-500/15 flex items-center justify-center">
                    {iconUrl ? (
                      <img src={iconUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-purple-400/40 scale-90">{Icons.resourcepack}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/80 truncate">
                      {meta?.name || pack.displayName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-white/25">{formatBytes(pack.size)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {confirmDelete === pack.fileName ? (
                      <>
                        <span className="text-[10px] text-red-400/70">Xóa?</span>
                        <button
                          onClick={() => handleDelete(pack.fileName)}
                          disabled={deleting === pack.fileName}
                          className="px-2 py-1 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-[10px] font-bold hover:bg-red-500/25 transition-all disabled:opacity-50"
                        >
                          {deleting === pack.fileName ? '...' : 'Xóa'}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-2 py-1 rounded-lg bg-white/5 border border-white/8 text-white/40 text-[10px] hover:bg-white/10 transition-all"
                        >
                          Hủy
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(pack.fileName)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Xóa resource pack"
                      >
                        {Icons.trash}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 p-2.5">
            {packs.map(pack => {
              const meta = metaCache[pack.fileName]
              const iconUrl = meta?.iconUrl || null
              return (
                <div
                  key={pack.fileName}
                  className="relative rounded-xl border border-white/8 bg-white/3 overflow-hidden transition-all group hover:border-white/15"
                >
                  <div className="relative w-full overflow-hidden" style={{ paddingBottom: '55%' }}>
                    {iconUrl && (
                      <img
                        src={iconUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-30"
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shadow-lg">
                        {iconUrl ? (
                          <img src={iconUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-purple-400/50">{Icons.resourcepack}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="px-2 py-1.5">
                    <p className="text-[10px] font-medium text-white/70 truncate leading-tight">
                      {meta?.name || pack.displayName}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] text-white/25">{formatBytes(pack.size)}</span>
                      {confirmDelete === pack.fileName ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDelete(pack.fileName)}
                            disabled={deleting === pack.fileName}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50"
                          >
                            {deleting === pack.fileName ? '...' : 'Xóa'}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-white/8 text-white/40 hover:bg-white/12 transition-all"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(pack.fileName)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          {Icons.trash}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TABS definition ──────────────────────────────────────────────────────────
const ALL_TABS = [
  {
    id: 'general',
    label: 'Cài đặt',
    icon: Icons.settings,
    component: GeneralTab,
  },
  {
    id: 'worlds',
    label: 'Thế giới',
    icon: Icons.world,
    component: WorldsTab,
  },
  {
    id: 'mods',
    label: 'Mods',
    icon: Icons.mod,
    component: ModsTab,
  },
  {
    id: 'shaders',
    label: 'Shaders',
    icon: Icons.shader,
    component: ShadersTab,
  },
  {
    id: 'resourcepacks',
    label: 'Resource Packs',
    icon: Icons.resourcepack,
    component: ResourcePacksTab,
  },
]

// ─── ProfileSettingsPanel ─────────────────────────────────────────────────────
export default function ProfileSettingsPanel({ profile, onClose, onProfileUpdated }) {
  const isVanilla = !profile?.loader || profile.loader === 'vanilla'

  const tabs = ALL_TABS.filter(t => {
    if (t.id === 'shaders' && isVanilla) return false
    return true
  })

  const [activeTab, setActiveTab] = useState('general')

  useEffect(() => {
    setActiveTab('general')
  }, [profile?.id])

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const currentTab = tabs.find(t => t.id === activeTab) || tabs[0]
  const TabComponent = currentTab?.component

  if (!profile) return null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all flex-shrink-0"
          title="Quay lại"
        >
          {Icons.back}
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white/90 truncate">{profile.name}</h3>
          <p className="text-[10px] text-white/30 mt-0.5">
            {profile.loader
              ? `${profile.loader.charAt(0).toUpperCase() + profile.loader.slice(1)} ${profile.gameVersion}`
              : profile.gameVersion
            }
          </p>
        </div>
      </div>

      {}
      <div className="flex-shrink-0 flex items-center gap-0.5 px-3 py-2 border-b border-white/5 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
              activeTab === tab.id
                ? 'bg-white/10 text-white/90'
                : 'text-white/35 hover:text-white/65 hover:bg-white/5'
            }`}
          >
            <span className={activeTab === tab.id ? 'text-green-400' : 'text-white/30'}>
              {tab.icon}
            </span>
            {tab.label}
          </button>
        ))}
      </div>

      {}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
        {TabComponent && (
          <TabComponent
            profile={profile}
            onProfileUpdated={onProfileUpdated}
          />
        )}
      </div>
    </div>
  )
}

