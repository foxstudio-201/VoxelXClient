import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '../../hooks/useToast'
import ProfileCard from './ProfileCard'
import CreateProfileModal from './CreateProfileModal'
import ImportProfileModal from './ImportProfileModal'

// ─── localStorage fallback ────────────────────────────────────────────────────
const LS_KEY = 'vxc_profiles'

function lsRead() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : { profiles: [], selectedProfileId: null }
  } catch {
    return { profiles: [], selectedProfileId: null }
  }
}

function lsWrite(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)) } catch {}
}

// ─── API wrapper ──────────────────────────────────────────────────────────────
const isElectron = typeof window !== 'undefined' && window.electronAPI

async function apiGetProfiles() {
  if (isElectron) return window.electronAPI.getProfiles()
  return lsRead()
}

async function apiCreateProfile(profileData) {
  if (isElectron) return window.electronAPI.createProfile(profileData)
  const data = lsRead()
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const loaderLabel = profileData.loader.charAt(0).toUpperCase() + profileData.loader.slice(1)
  const name = (profileData.name && profileData.name.trim())
    ? profileData.name.trim()
    : `${loaderLabel} ${profileData.gameVersion}`
  const profile = {
    id, name,
    loader:        profileData.loader,
    gameVersion:   profileData.gameVersion,
    loaderVersion: profileData.loaderVersion || '',
    instancePath:  profileData.instancePath || `instances/${id}`,
    isCustomPath:  !!(profileData.instancePath && profileData.instancePath.trim()),
    createdAt:     now,
    lastPlayed:    null,
    sizeBytes:     0,
  }
  data.profiles.push(profile)
  if (!data.selectedProfileId) data.selectedProfileId = id
  lsWrite(data)
  return { ok: true, profile, data }
}

async function apiDeleteProfile(id) {
  if (isElectron) return window.electronAPI.deleteProfile(id)
  const data = lsRead()
  data.profiles = data.profiles.filter(p => p.id !== id)
  if (data.selectedProfileId === id) data.selectedProfileId = data.profiles[0]?.id ?? null
  lsWrite(data)
  return { ok: true, data }
}

async function apiSelectProfile(id) {
  if (isElectron) return window.electronAPI.selectProfile(id)
  const data = lsRead()
  data.selectedProfileId = id
  lsWrite(data)
  return { ok: true, data }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PlayPage() {
  const toast = useToast()
  const [profiles, setProfiles]           = useState([])
  const [selectedProfileId, setSelectedProfileId] = useState(null)
  const [loading, setLoading]             = useState(true)
  const [showCreate, setShowCreate]       = useState(false)
  const [showImport, setShowImport]       = useState(false)
  const [showDropdown, setShowDropdown]   = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const dropdownRef                       = useRef(null)

  const loadProfiles = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGetProfiles()
      setProfiles(data.profiles || [])
      setSelectedProfileId(data.selectedProfileId || null)
    } catch {
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProfiles() }, [loadProfiles])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDropdown])

  async function handleSelect(id) {
    if (id === selectedProfileId) return
    const result = await apiSelectProfile(id)
    if (result?.error) {
      toast({ type: 'error', title: 'Lỗi', message: result.error })
      return
    }
    setSelectedProfileId(id)
    const p = profiles.find(x => x.id === id)
    toast({ type: 'success', title: 'Đã chọn profile', message: p?.name })
  }

  async function handleDelete(id) {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id)
      setTimeout(() => setDeleteConfirm(prev => prev === id ? null : prev), 3000)
      return
    }
    const p = profiles.find(x => x.id === id)
    const result = await apiDeleteProfile(id)
    if (result?.error) {
      toast({ type: 'error', title: 'Lỗi xóa profile', message: result.error })
      return
    }
    setDeleteConfirm(null)
    setProfiles(result.data.profiles || [])
    setSelectedProfileId(result.data.selectedProfileId || null)
    toast({ type: 'info', title: 'Đã xóa profile', message: p?.name })
  }

  async function handleCreate(profileData) {
    const result = await apiCreateProfile(profileData)
    if (result?.error) {
      toast({ type: 'error', title: 'Lỗi tạo profile', message: result.error })
      return result
    }
    setProfiles(result.data.profiles || [])
    setSelectedProfileId(result.data.selectedProfileId || null)
    setShowCreate(false)
    toast({ type: 'success', title: 'Đã tạo profile', message: result.profile?.name })
    return result
  }

  // handleCreateForImport — tạo profile nhưng không đóng modal Create
  // (ImportProfileModal tự quản lý việc đóng)
  async function handleCreateForImport(profileData) {
    const result = await apiCreateProfile(profileData)
    if (result?.error) {
      toast({ type: 'error', title: 'Lỗi tạo profile', message: result.error })
      return result
    }
    setProfiles(result.data.profiles || [])
    setSelectedProfileId(result.data.selectedProfileId || null)
    return result
  }

  function handleImportClose() {
    setShowImport(false)
    loadProfiles() // reload để cập nhật profile list sau import
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 pt-6 pb-4">
        <div>
          <h1 className="text-lg font-bold text-white">Play</h1>
          <p className="text-xs text-white/30 mt-0.5">Quản lý profile Minecraft</p>
        </div>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(v => !v)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-green-500 hover:bg-green-400 text-white text-xs font-bold transition-all duration-150 active:scale-95 shadow-lg shadow-green-500/20"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Create
            <svg viewBox="0 0 24 24" fill="currentColor" className={`w-3 h-3 transition-transform duration-150 ${showDropdown ? 'rotate-180' : ''}`}>
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden z-50">
              <button
                onClick={() => { setShowCreate(true); setShowDropdown(false) }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-all"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-green-400">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                New Profile
              </button>
              <div className="h-px bg-white/5 mx-2" />
              <button
                onClick={() => { setShowImport(true); setShowDropdown(false) }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-all"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-blue-400">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                Import Profile
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <svg className="animate-spin w-6 h-6 text-green-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        ) : profiles.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white/15">
                <path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.06 15.94 0 13.36 0c-1.46 0-2.75.67-3.6 1.72L9 3 8.24 1.72C7.39.67 6.1 0 4.64 0 2.06 0 0 2.06 0 4.64c0 .48.11.92.18 1.36H0v2h20V6zm-9.5-3.5c.55-.67 1.38-1.1 2.36-1.1 1.58 0 2.64 1.06 2.64 2.64 0 .48-.13.92-.32 1.36H11V3.5l-.5-1zm-5.86 0C5.19 2.5 6.06 2 7 2c.98 0 1.81.43 2.36 1.1L10 4.5H6.68c-.19-.44-.32-.88-.32-1.36 0-.24.04-.47.1-.68l-.82.04zM0 8v14h20V8H0zm9 11H2v-2h7v2zm0-4H2v-2h7v2zm0-4H2v-2h7v2zm9 8h-7v-2h7v2zm0-4h-7v-2h7v2zm0-4h-7v-2h7v2z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm text-white/30 font-medium">Chưa có profile nào</p>
              <p className="text-xs text-white/15 mt-0.5">Tạo profile để bắt đầu chơi Minecraft</p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-xl bg-green-500/15 text-green-400 text-xs font-semibold border border-green-500/20 hover:bg-green-500/25 transition-all"
            >
              + Tạo profile đầu tiên
            </button>
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
          >
            {profiles.map(profile => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                isSelected={profile.id === selectedProfileId}
                confirmDelete={deleteConfirm === profile.id}
                onSelect={handleSelect}
                onDelete={handleDelete}
                onCancelDelete={() => setDeleteConfirm(null)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateProfileModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}

      {/* Import modal */}
      {showImport && (
        <ImportProfileModal
          onClose={handleImportClose}
          onCreate={handleCreateForImport}
        />
      )}
    </div>
  )
}
