const { ipcMain, dialog, shell } = require('electron')
const path  = require('path')
const fs    = require('fs')
const { app } = require('electron')

// ─── Paths ────────────────────────────────────────────────────────────────────
const DATA_DIR      = path.join(app.getPath('appData'), '.VoxelXClient')
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json')
const INSTANCES_DIR = path.join(DATA_DIR, 'instances')

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function ensureProfilesFile() {
  ensureDir(DATA_DIR)
  if (!fs.existsSync(PROFILES_FILE)) {
    fs.writeFileSync(
      PROFILES_FILE,
      JSON.stringify({ profiles: [], selectedProfileId: null }, null, 2),
      { mode: 0o600 }
    )
  }
}

function readProfiles() {
  ensureProfilesFile()
  try {
    return JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf-8'))
  } catch {
    return { profiles: [], selectedProfileId: null }
  }
}

function writeProfiles(data) {
  ensureProfilesFile()
  const tmp = PROFILES_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 })
  fs.renameSync(tmp, PROFILES_FILE)
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function validateId(id) {
  return typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id)
}

function validateProfile(profile) {
  if (!profile || typeof profile !== 'object') return 'Dữ liệu không hợp lệ'
  if (!['vanilla', 'fabric', 'forge', 'neoforge'].includes(profile.loader)) return 'Loader không hợp lệ'
  // gameVersion có thể rỗng khi import modpack (sẽ được điền từ manifest)
  if (typeof profile.gameVersion !== 'string') return 'Phiên bản game không hợp lệ'
  return null
}

function getDirSizeBytes(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return 0
    let total = 0
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += getDirSizeBytes(full)
      } else {
        try { total += fs.statSync(full).size } catch {}
      }
    }
    return total
  } catch {
    return 0
  }
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────
function registerProfileHandlers(getTrustedWindow) {
  // profiles:get
  ipcMain.handle('profiles:get', (e) => {
    if (!getTrustedWindow(e)) return { profiles: [], selectedProfileId: null }
    const data = readProfiles()
    // Enrich with current size
    data.profiles = data.profiles.map(p => ({
      ...p,
      sizeBytes: getDirSizeBytes(p.instancePath),
    }))
    return data
  })

  // profiles:create
  ipcMain.handle('profiles:create', (e, profileData) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }

    const err = validateProfile(profileData)
    if (err) return { error: err }

    const id = generateUUID()
    const now = new Date().toISOString()

    // Determine instance path
    let instancePath = profileData.instancePath
    let isCustomPath = false

    if (instancePath && instancePath.trim()) {
      isCustomPath = true
      instancePath = instancePath.trim()
    } else {
      instancePath = path.join(INSTANCES_DIR, id)
      isCustomPath = false
    }

    // Create instance directory
    try {
      ensureDir(instancePath)
    } catch (ex) {
      return { error: `Không thể tạo thư mục: ${ex.message}` }
    }

    // Auto-generate name if empty
    const loaderLabel = profileData.loader.charAt(0).toUpperCase() + profileData.loader.slice(1)
    const name = (profileData.name && profileData.name.trim())
      ? profileData.name.trim()
      : `${loaderLabel} ${profileData.gameVersion}`

    const profile = {
      id,
      name,
      loader:        profileData.loader,
      gameVersion:   profileData.gameVersion,
      loaderVersion: profileData.loaderVersion || '',
      instancePath,
      isCustomPath,
      createdAt:     now,
      lastPlayed:    null,
      sizeBytes:     0,
      // Import metadata (chỉ có khi import từ modpack)
      importSource:  profileData.importSource  || null,  // 'curseforge' | 'modrinth' | null
      importIconUrl: profileData.importIconUrl || null,  // URL ảnh icon modpack
      importBgUrl:   profileData.importBgUrl   || null,  // URL ảnh background modpack
    }

    const data = readProfiles()
    data.profiles.push(profile)
    if (!data.selectedProfileId) data.selectedProfileId = id
    writeProfiles(data)

    return { ok: true, profile, data }
  })

  // profiles:delete
  ipcMain.handle('profiles:delete', (e, id) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(id)) return { error: 'ID không hợp lệ' }

    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === id)
    if (!profile) return { error: 'Profile không tồn tại' }

    // Remove instance folder only if it's the default path (inside our instances dir)
    if (!profile.isCustomPath && profile.instancePath.startsWith(INSTANCES_DIR)) {
      try {
        if (fs.existsSync(profile.instancePath)) {
          fs.rmSync(profile.instancePath, { recursive: true, force: true })
        }
      } catch (ex) {
        // Non-fatal — still remove from list
        console.warn('[profileManager] Could not delete instance dir:', ex.message)
      }
    }

    data.profiles = data.profiles.filter(p => p.id !== id)
    if (data.selectedProfileId === id) {
      data.selectedProfileId = data.profiles[0]?.id ?? null
    }
    writeProfiles(data)

    return { ok: true, data }
  })

  // profiles:select
  ipcMain.handle('profiles:select', (e, id) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(id)) return { error: 'ID không hợp lệ' }

    const data = readProfiles()
    if (!data.profiles.find(p => p.id === id)) return { error: 'Profile không tồn tại' }
    data.selectedProfileId = id
    writeProfiles(data)

    return { ok: true, data }
  })

  // profiles:browse — open folder picker dialog
  ipcMain.handle('profiles:browse', async (e) => {
    const win = getTrustedWindow(e)
    if (!win) return { error: 'Unauthorized' }

    const result = await dialog.showOpenDialog(win, {
      title:       'Chọn thư mục instance',
      buttonLabel: 'Chọn thư mục',
      properties:  ['openDirectory', 'createDirectory'],
    })

    if (result.canceled || !result.filePaths.length) return { canceled: true }
    return { ok: true, path: result.filePaths[0] }
  })

  // profiles:updateRam — lưu RAM setting cho profile
  ipcMain.handle('profiles:updateRam', (e, id, ramGb) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(id)) return { error: 'ID không hợp lệ' }
    const gb = Number(ramGb)
    if (!Number.isFinite(gb) || gb < 1 || gb > 64) return { error: 'RAM không hợp lệ' }

    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === id)
    if (!profile) return { error: 'Profile không tồn tại' }
    profile.ramGb = gb
    writeProfiles(data)
    return { ok: true }
  })

  // profiles:openFolder — mở thư mục instance trong File Explorer
  ipcMain.handle('profiles:openFolder', async (e, id) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(id)) return { error: 'ID không hợp lệ' }

    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === id)
    if (!profile) return { error: 'Profile không tồn tại' }

    const folderPath = profile.instancePath
    if (!fs.existsSync(folderPath)) {
      try { ensureDir(folderPath) } catch {}
    }

    const err = await shell.openPath(folderPath)
    if (err) return { error: err }
    return { ok: true }
  })
}

module.exports = { registerProfileHandlers }
