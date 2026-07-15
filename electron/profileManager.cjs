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

const { ipcMain, dialog, shell } = require('electron')
const path  = require('path')
const fs    = require('fs')
const { app } = require('electron')

const DATA_DIR      = path.join(app.getPath('appData'), '.VoxelXClient')
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json')
const INSTANCES_DIR = path.join(DATA_DIR, 'instances')

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
    const data = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf-8'))
    if (!Array.isArray(data.profiles)) data.profiles = []
    return data
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
  if (typeof profile.gameVersion !== 'string') return 'Phiên bản game không hợp lệ'
  return null
}

// ── Dir size cache ────────────────────────────────────────────────────────────
// Cache size theo mtime của thư mục top-level để tránh tính lại mỗi lần load
const _sizeCache = new Map() // instancePath → { size, mtime, ts }
const SIZE_CACHE_TTL = 60_000 // 1 phút

function getDirSizeBytes(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return 0

    // Kiểm tra cache còn hợp lệ không
    const cached = _sizeCache.get(dirPath)
    if (cached) {
      const age = Date.now() - cached.ts
      if (age < SIZE_CACHE_TTL) return cached.size
      // Kiểm tra mtime thư mục — nếu chưa đổi thì dùng cache cũ (không expire)
      try {
        const mtime = fs.statSync(dirPath).mtimeMs
        if (mtime === cached.mtime) {
          cached.ts = Date.now() // reset TTL
          return cached.size
        }
      } catch {}
    }

    // Tính size — giới hạn độ sâu để tránh quá chậm với thư mục lớn
    const size = calcDirSize(dirPath, 0)
    const mtime = fs.statSync(dirPath).mtimeMs
    _sizeCache.set(dirPath, { size, mtime, ts: Date.now() })
    return size
  } catch {
    return 0
  }
}

function calcDirSize(dirPath, depth) {
  // Giới hạn depth = 6 — đủ để bao gồm mods/config/saves nhưng không quét quá sâu
  if (depth > 6) return 0
  try {
    let total = 0
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      // Bỏ qua các thư mục nặng không cần thiết cho size display
      if (entry.isDirectory() && (entry.name === 'natives' || entry.name === 'logs' || entry.name === '.git')) continue
      const full = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += calcDirSize(full, depth + 1)
      } else {
        try { total += fs.statSync(full).size } catch {}
      }
    }
    return total
  } catch {
    return 0
  }
}

/**
 * Trả về size từ cache ngay (0 nếu chưa có), đồng thời kick off background calc
 * → UI render ngay, size cập nhật sau khi tính xong qua event
 */
function getDirSizeLazy(dirPath) {
  const cached = _sizeCache.get(dirPath)
  if (cached) {
    const age = Date.now() - cached.ts
    if (age < SIZE_CACHE_TTL) return cached.size
    try {
      const mtime = fs.statSync(dirPath).mtimeMs
      if (mtime === cached.mtime) { cached.ts = Date.now(); return cached.size }
    } catch {}
  }
  // Background: tính không block main thread
  setImmediate(() => {
    try {
      if (!fs.existsSync(dirPath)) return
      const size = calcDirSize(dirPath, 0)
      const mtime = fs.statSync(dirPath).mtimeMs
      _sizeCache.set(dirPath, { size, mtime, ts: Date.now() })
    } catch {}
  })
  return cached?.size ?? 0
}



const SYNC_EXCLUDED_DIRS = new Set(['assets', 'libraries', 'versions', 'accounts', 'logs', 'crash-reports'])

function syncDirRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return
  const stat = fs.statSync(srcDir)
  if (!stat.isDirectory()) return
  fs.mkdirSync(destDir, { recursive: true })
  const entries = fs.readdirSync(srcDir, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name)
    const destPath = path.join(destDir, entry.name)
    if (entry.isDirectory()) {
      syncDirRecursive(srcPath, destPath)
      continue
    }
    if (!entry.isFile()) continue
    let shouldCopy = true
    if (fs.existsSync(destPath)) {
      try {
        const srcStat = fs.statSync(srcPath)
        const destStat = fs.statSync(destPath)
        shouldCopy = srcStat.size !== destStat.size || srcStat.mtimeMs > destStat.mtimeMs + 1000
      } catch {
        shouldCopy = true
      }
    }
    if (shouldCopy) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true })
      try { fs.rmSync(destPath, { force: true }) } catch {}
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function syncAccountToProfileDir(accountDir, profileDir) {
  if (!fs.existsSync(accountDir)) return
  const entries = fs.readdirSync(accountDir, { withFileTypes: true })
  for (const entry of entries) {
    if (SYNC_EXCLUDED_DIRS.has(entry.name)) continue
    if (entry.name.startsWith('.')) continue
    if (entry.name.endsWith('.tmp')) continue
    const srcPath = path.join(accountDir, entry.name)
    const destPath = path.join(profileDir, entry.name)
    if (entry.isDirectory()) {
      syncDirRecursive(srcPath, destPath)
    } else if (entry.isFile()) {
      let shouldCopy = true
      if (fs.existsSync(destPath)) {
        try {
          const srcStat = fs.statSync(srcPath)
          const destStat = fs.statSync(destPath)
          shouldCopy = srcStat.size !== destStat.size || srcStat.mtimeMs > destStat.mtimeMs + 1000
        } catch {
          shouldCopy = true
        }
      }
      if (shouldCopy) {
        try { fs.rmSync(destPath, { force: true }) } catch {}
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }
}

function syncProfileToAccountDir(srcDir, destDir) {
  const marker = path.join(destDir, '.initialized')
  if (fs.existsSync(marker)) return
  if (!fs.existsSync(srcDir)) return
  const entries = fs.readdirSync(srcDir, { withFileTypes: true })
  for (const entry of entries) {
    if (SYNC_EXCLUDED_DIRS.has(entry.name)) continue
    if (entry.name.startsWith('.')) continue
    if (entry.name.endsWith('.tmp')) continue
    const srcPath = path.join(srcDir, entry.name)
    const destPath = path.join(destDir, entry.name)
    if (entry.isDirectory()) {
      syncDirRecursive(srcPath, destPath)
    } else if (entry.isFile()) {
      let shouldCopy = true
      if (fs.existsSync(destPath)) {
        try {
          const srcStat = fs.statSync(srcPath)
          const destStat = fs.statSync(destPath)
          shouldCopy = srcStat.size !== destStat.size || srcStat.mtimeMs > destStat.mtimeMs + 1000
        } catch {
          shouldCopy = true
        }
      }
      if (shouldCopy) {
        try { fs.rmSync(destPath, { force: true }) } catch {}
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }
  try { fs.writeFileSync(marker, '') } catch {}
}

function getGameDir(profile, accountId) {
  if (!profile?.instancePath) return null
  if (accountId) {
    const accDir = path.join(profile.instancePath, 'accounts', accountId)
    ensureDir(accDir)
    try { syncProfileToAccountDir(profile.instancePath, accDir) } catch (e) { console.warn('[profileManager] Sync error:', e.message) }
    try { syncAccountToProfileDir(accDir, profile.instancePath) } catch (e) { console.warn('[profileManager] Sync back error:', e.message) }
    return accDir
  }
  return profile.instancePath
}

function registerProfileHandlers(getTrustedWindow) {
  ipcMain.handle('profiles:get', (e) => {
    if (!getTrustedWindow(e)) return { profiles: [], selectedProfileId: null }
    const data = readProfiles()
    data.profiles = data.profiles.map(p => ({
      ...p,
      sizeBytes: getDirSizeLazy(p.instancePath),
    }))
    return data
  })

  ipcMain.handle('profiles:create', (e, profileData) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const err = validateProfile(profileData)
    if (err) return { error: err }
    const id = generateUUID()
    const now = new Date().toISOString()
    let instancePath = profileData.instancePath
    let isCustomPath = false
    if (instancePath && instancePath.trim()) {
      isCustomPath = true
      instancePath = instancePath.trim()
    } else {
      instancePath = path.join(INSTANCES_DIR, id)
      isCustomPath = false
    }
    try {
      ensureDir(instancePath)
    } catch (ex) {
      return { error: `Không thể tạo thư mục: ${ex.message}` }
    }
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
      importSource:  profileData.importSource  || null,
      importIconUrl: profileData.importIconUrl || null,
      importBgUrl:   profileData.importBgUrl   || null,
    }
    const data = readProfiles()
    data.profiles.push(profile)
    if (!data.selectedProfileId) data.selectedProfileId = id
    writeProfiles(data)
    return { ok: true, profile, data }
  })

  ipcMain.handle('profiles:delete', (e, id) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(id)) return { error: 'ID không hợp lệ' }
    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === id)
    if (!profile) return { error: 'Profile không tồn tại' }
    if (!profile.isCustomPath) {
      const normalizedPath = path.resolve(profile.instancePath)
      const normalizedInstances = path.resolve(INSTANCES_DIR)
      if (normalizedPath.startsWith(normalizedInstances)) {
        try {
          if (fs.existsSync(normalizedPath)) {
            fs.rmSync(normalizedPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
          }
        } catch (ex) {
          try { fs.rmSync(normalizedPath, { recursive: true, force: true }) } catch {}
        }
      }
    }
    data.profiles = data.profiles.filter(p => p.id !== id)
    if (data.selectedProfileId === id) {
      data.selectedProfileId = data.profiles[0]?.id ?? null
    }
    writeProfiles(data)
    return { ok: true, data }
  })

  ipcMain.handle('profiles:select', (e, id) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(id)) return { error: 'ID không hợp lệ' }
    const data = readProfiles()
    if (!data.profiles.find(p => p.id === id)) return { error: 'Profile không tồn tại' }
    data.selectedProfileId = id
    writeProfiles(data)
    return { ok: true, data }
  })

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

function registerProfileContentHandlers(getTrustedWindow) {
  const https = require('https')

  function httpsGet(url) {
    return new Promise((resolve, reject) => {
      https.get(url, {
        headers: { 'User-Agent': 'VoxelXLauncher/1.0' },
        timeout: 8000,
      }, (res) => {
        let body = ''
        res.on('data', c => { body += c })
        res.on('end', () => {
          if (res.statusCode === 200) {
            try { resolve(JSON.parse(body)) } catch { resolve(null) }
          } else { resolve(null) }
        })
      }).on('error', () => resolve(null))
        .on('timeout', () => resolve(null))
    })
  }

  // Extract a clean search query from a file name by stripping extension,
  // version suffixes (e.g. _r5.8, -1.20.1, _v1.10.5, +mc1.21) and keeping
  // only the meaningful name part so Modrinth search returns the right project.
  function extractSearchSlug(fileName) {
    return fileName
      .replace(/\.(jar|zip)$/i, '')                        // remove extension
      .replace(/\.(off|disabled)$/i, '')                   // remove toggle suffix
      .replace(/[-_+](v?\d[\d._\-+]*).*$/i, '')           // strip version like _r5.8 -1.20.1 _v1.10 +mc1.21
      .replace(/[-_+][rv]\d.*$/i, '')                      // strip _r5 _v8 +r3 style versions
      .replace(/[-_]/g, ' ')                               // turn separators into spaces for better search
      .trim()
      .toLowerCase()
  }

  async function fetchModMeta(fileName) {
    const query = extractSearchSlug(fileName)
    try {
      const data = await httpsGet(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=1&facets=[["project_type:mod"]]`)
      if (data?.hits?.[0]) {
        const h = data.hits[0]
        return {
          source: 'modrinth',
          name:        h.title,
          description: h.description,
          iconUrl:     h.icon_url,
          author:      h.author,
          downloads:   h.downloads,
          projectUrl:  `https://modrinth.com/mod/${h.slug}`,
        }
      }
    } catch {}
    return null
  }

  async function fetchShaderMeta(fileName) {
    const query = extractSearchSlug(fileName)
    try {
      const data = await httpsGet(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=1&facets=[["project_type:shader"]]`)
      if (data?.hits?.[0]) {
        const h = data.hits[0]
        return {
          source: 'modrinth',
          name: h.title,
          description: h.description,
          iconUrl: h.icon_url,
          author: h.author,
          downloads: h.downloads,
          projectUrl: `https://modrinth.com/shader/${h.slug}`,
        }
      }
    } catch {}
    return null
  }

  async function fetchResourcePackMeta(fileName) {
    const query = extractSearchSlug(fileName)
    try {
      const data = await httpsGet(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=1&facets=[["project_type:resourcepack"]]`)
      if (data?.hits?.[0]) {
        const h = data.hits[0]
        return {
          source: 'modrinth',
          name: h.title,
          description: h.description,
          iconUrl: h.icon_url,
          author: h.author,
          downloads: h.downloads,
          projectUrl: `https://modrinth.com/resourcepack/${h.slug}`,
        }
      }
    } catch {}
    return null
  }

  ipcMain.handle('profile:listMods', async (e, profileId, accountId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { ok: false, error: 'Profile not found' }
    const gameDir = getGameDir(profile, accountId)
    if (!gameDir) return { ok: false, error: 'Profile instancePath not set' }
    const modDir = path.join(gameDir, 'mods')
    ensureDir(modDir)
    const files = fs.readdirSync(modDir).filter(f => /\.(jar|jar\.off|jar\.disabled)$/i.test(f))
    const mods = files.map(f => {
      const fullPath = path.join(modDir, f)
      const stat = fs.statSync(fullPath)
      const enabled = !f.endsWith('.off') && !f.endsWith('.disabled')
      return {
        fileName: f,
        displayName: f.replace(/\.jar(\.off|\.disabled)?$/i, ''),
        enabled,
        size: stat.size,
        mtime: stat.mtimeMs
      }
    })
    return { ok: true, mods }
  })

  ipcMain.handle('profile:toggleMod', async (e, profileId, fileName, accountId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (typeof profileId !== 'string') return { ok: false, error: `Invalid profileId: ${profileId}` }
    if (typeof fileName !== 'string') return { ok: false, error: `Invalid fileName: ${fileName}` }
    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { ok: false, error: 'Profile not found' }
    const gameDir = getGameDir(profile, accountId)
    if (!gameDir) return { ok: false, error: `Profile instancePath not set (instancePath=${profile.instancePath})` }
    const modDir = path.join(gameDir, 'mods')
    const oldPath = path.join(modDir, fileName)
    if (!fs.existsSync(oldPath)) return { ok: false, error: 'File not found' }
    const newName = (fileName.endsWith('.off') || fileName.endsWith('.disabled'))
      ? fileName.replace(/\.(off|disabled)$/, '')
      : fileName + '.off'
    fs.renameSync(oldPath, path.join(modDir, newName))
    return { ok: true, newFileName: newName, enabled: !newName.endsWith('.off') }
  })

  ipcMain.handle('profile:deleteMod', (e, profileId, fileName, accountId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile not found' }
    const gameDir = getGameDir(profile, accountId)
    if (!gameDir) return { error: 'Profile instancePath not set' }
    const filePath = path.join(gameDir, 'mods', fileName)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    return { ok: true }
  })

  ipcMain.handle('profile:getModMeta', async (e, profileId, fileName, accountId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { ok: true, meta: null }
    const apiMeta = await fetchModMeta(fileName)
    return { ok: true, meta: apiMeta }
  })

  ipcMain.handle('profile:listShaders', async (e, profileId, accountId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile not found' }
    const gameDir = getGameDir(profile, accountId)
    if (!gameDir) return { error: 'Profile instancePath not set' }
    const shadersDir = path.join(gameDir, 'shaderpacks')
    ensureDir(shadersDir)
    const files = fs.readdirSync(shadersDir)
    const shaders = files.map(f => {
      const stat = fs.statSync(path.join(shadersDir, f))
      return { fileName: f, displayName: f, size: stat.size, mtime: stat.mtimeMs, isDir: stat.isDirectory() }
    })
    return { ok: true, shaders }
  })

  ipcMain.handle('profile:getShaderMeta', async (e, profileId, fileName, accountId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { ok: true, meta: null }
    const apiMeta = await fetchShaderMeta(fileName)
    return { ok: true, meta: apiMeta }
  })

  ipcMain.handle('profile:deleteShader', (e, profileId, fileName, subDir, accountId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile not found' }
    const gameDir = getGameDir(profile, accountId)
    if (!gameDir) return { error: 'Profile instancePath not set' }
    const targetPath = path.join(gameDir, 'shaderpacks', fileName)
    if (fs.existsSync(targetPath)) {
      if (fs.statSync(targetPath).isDirectory()) fs.rmSync(targetPath, { recursive: true })
      else fs.unlinkSync(targetPath)
    }
    return { ok: true }
  })

  ipcMain.handle('profile:listResourcePacks', async (e, profileId, accountId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile not found' }
    const gameDir = getGameDir(profile, accountId)
    if (!gameDir) return { error: 'Profile instancePath not set' }
    const rpDir = path.join(gameDir, 'resourcepacks')
    ensureDir(rpDir)
    const files = fs.readdirSync(rpDir)
    const packs = files.map(f => {
      const stat = fs.statSync(path.join(rpDir, f))
      return { fileName: f, displayName: f, size: stat.size, mtime: stat.mtimeMs, isDir: stat.isDirectory() }
    })
    return { ok: true, packs }
  })

  ipcMain.handle('profile:getResourcePackMeta', async (e, profileId, fileName, accountId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { ok: true, meta: null }
    const apiMeta = await fetchResourcePackMeta(fileName)
    return { ok: true, meta: apiMeta }
  })

  ipcMain.handle('profile:deleteResourcePack', (e, profileId, fileName, accountId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile not found' }
    const gameDir = getGameDir(profile, accountId)
    if (!gameDir) return { error: 'Profile instancePath not set' }
    const targetPath = path.join(gameDir, 'resourcepacks', fileName)
    if (fs.existsSync(targetPath)) {
      if (fs.statSync(targetPath).isDirectory()) fs.rmSync(targetPath, { recursive: true })
      else fs.unlinkSync(targetPath)
    }
    return { ok: true }
  })

  // Install a file (mod/shader/resourcepack) by copying from a local path into the correct subfolder.
  // type: 'mod' | 'shader' | 'resourcepack'
  ipcMain.handle('profile:installFile', async (e, profileId, type, srcPath, accountId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile not found' }

    const dirMap = { mod: 'mods', shader: 'shaderpacks', resourcepack: 'resourcepacks' }
    const subDir = dirMap[type]
    if (!subDir) return { error: 'Invalid type' }

    const gameDir = getGameDir(profile, accountId)
    if (!gameDir) return { error: 'Profile instancePath not set' }
    const destDir = path.join(gameDir, subDir)
    ensureDir(destDir)

    const fileName = path.basename(srcPath)
    const destPath = path.join(destDir, fileName)

    // If file already exists, skip (don't overwrite silently)
    if (fs.existsSync(destPath)) return { ok: true, fileName, skipped: true }

    fs.copyFileSync(srcPath, destPath)
    const stat = fs.statSync(destPath)
    return { ok: true, fileName, size: stat.size, mtime: stat.mtimeMs, skipped: false }
  })

  ipcMain.handle('profile:listWorlds', async (e, profileId, accountId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile not found' }
    const gameDir = getGameDir(profile, accountId)
    const savesDir = path.join(gameDir, 'saves')
    ensureDir(savesDir)
    const files = fs.readdirSync(savesDir).filter(f => fs.statSync(path.join(savesDir, f)).isDirectory())
    const worlds = files.map(f => {
      const worldPath = path.join(savesDir, f)
      const stat = fs.statSync(worldPath)
      return { folderName: f, displayName: f, mtime: stat.mtimeMs, size: getDirSizeBytes(worldPath) }
    })
    return { ok: true, worlds }
  })

  ipcMain.handle('profile:deleteWorld', (e, profileId, folderName, accountId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile not found' }
    const gameDir = getGameDir(profile, accountId)
    const worldPath = path.join(gameDir, 'saves', folderName)
    if (fs.existsSync(worldPath)) fs.rmSync(worldPath, { recursive: true })
    return { ok: true }
  })

  ipcMain.handle('profile:listDirFull', (e, profileId, subPath, accountId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile not found' }
    const gameDir = getGameDir(profile, accountId)
    const target = subPath ? path.join(gameDir, subPath) : gameDir
    if (!fs.existsSync(target)) return { ok: true, entries: [] }
    const files = fs.readdirSync(target, { withFileTypes: true })
    const entries = files.map(entry => {
      const full = path.join(target, entry.name)
      const stat = fs.statSync(full)
      return {
        name: entry.name,
        path: subPath ? path.join(subPath, entry.name) : entry.name,
        isDir: entry.isDirectory(),
        size: entry.isFile() ? stat.size : null,
        mtime: stat.mtimeMs
      }
    })
    return { ok: true, entries }
  })

  ipcMain.handle('profile:update', (e, profileId, patch) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile not found' }
    Object.assign(profile, patch)
    writeProfiles(data)
    return { ok: true, profile }
  })

  ipcMain.handle('profile:listJavas', async (e) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    try {
      const { findJavaInstallations } = require('./launcher/java/javaManager.cjs')
      const javas = await findJavaInstallations()
      return { ok: true, javas }
    } catch { return { ok: true, javas: [] } }
  })
}

function registerJavaDistroHandlers(getTrustedWindow) {
  const { fetchAllDistros, installDistro, deleteDistro, getProfileJreInfo, getAllInstalledJavas, isDistroInstalled, getJavaExe } = require('./launcher/java/javaDistros.cjs')

  // Global shared runtimes dir — tất cả profiles dùng chung
  const GLOBAL_RUNTIMES_DIR = path.join(DATA_DIR, 'runtimes')

  ipcMain.handle('java:fetchDistros', async (e, profileId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const distros = await fetchAllDistros()
    return { ok: true, distros }
  })

  ipcMain.handle('java:getInstalled', (e, profileId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const list = getAllInstalledJavas(GLOBAL_RUNTIMES_DIR)
    return { ok: true, installed: list }
  })

  ipcMain.handle('java:install', async (e, pkg, profileId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const win = getTrustedWindow(e)
    const javaExe = await installDistro(pkg, GLOBAL_RUNTIMES_DIR, (progress) => {
      if (win && !win.isDestroyed()) win.webContents.send('java:installProgress', progress)
    })
    return { ok: true, javaExe }
  })

  ipcMain.handle('java:installToDir', async (e, pkg, dir) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    // Nếu không chỉ định dir cụ thể, dùng global runtimes dir
    const targetDir = (typeof dir === 'string' && dir) ? dir : GLOBAL_RUNTIMES_DIR
    const win = getTrustedWindow(e)
    const javaExe = await installDistro(pkg, targetDir, (progress) => {
      if (win && !win.isDestroyed()) win.webContents.send('java:installProgress', progress)
    })
    return { ok: true, javaExe }
  })

  ipcMain.handle('java:select', (e, profileId, javaExe) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (typeof javaExe !== 'string') return { error: 'Invalid javaExe' }
    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile not found' }
    profile.javaPath = javaExe
    writeProfiles(data)
    return { ok: true }
  })

  ipcMain.handle('java:delete', (e, profileId, distro, javaVersion) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    // Xóa từ global runtimes dir
    const jreDir = distro && javaVersion
      ? path.join(GLOBAL_RUNTIMES_DIR, `${distro}-${javaVersion}`)
      : null
    if (!jreDir) return { error: 'Must specify distro and javaVersion' }
    const deleted = deleteDistro(jreDir)
    // Nếu profile nào đang dùng java này thì clear javaPath
    if (deleted) {
      const data = readProfiles()
      let changed = false
      for (const p of data.profiles) {
        if (p.javaPath?.startsWith(jreDir)) {
          p.javaPath = null
          changed = true
        }
      }
      if (changed) writeProfiles(data)
    }
    return { ok: true, deleted }
  })
}

const GROUPS_FILE = path.join(DATA_DIR, 'groups.json')

function ensureGroupsFile() {
  ensureDir(DATA_DIR)
  if (!fs.existsSync(GROUPS_FILE)) {
    fs.writeFileSync(
      GROUPS_FILE,
      JSON.stringify({ groups: [] }, null, 2),
      { mode: 0o600 }
    )
  }
}

function readGroups() {
  ensureGroupsFile()
  try {
    const data = JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf-8'))
    if (!data || !Array.isArray(data.groups)) return { groups: [] }
    return data
  } catch {
    return { groups: [] }
  }
}

function writeGroups(data) {
  ensureGroupsFile()
  const tmp = GROUPS_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 })
  fs.renameSync(tmp, GROUPS_FILE)
}

function buildGroupView(group, profilesById) {
  const profileIds = Array.isArray(group.profileIds) ? group.profileIds : []
  const profiles = profileIds
    .map(id => profilesById.get(id))
    .filter(Boolean)
    .map(p => ({
      ...p,
      sizeBytes: getDirSizeLazy(p.instancePath),
    }))

  const totalSize = profiles.reduce((sum, p) => sum + (Number(p.sizeBytes) || 0), 0)

  return {
    id: group.id,
    name: group.name || 'Untitled Group',
    profileIds,
    profiles,
    profileCount: profiles.length,
    totalSize,
    createdAt: group.createdAt || null,
  }
}

function registerGroupHandlers(getTrustedWindow) {
  ipcMain.handle('groups:get', (e) => {
    if (!getTrustedWindow(e)) return { groups: [] }

    const groupsData = readGroups()
    const profilesData = readProfiles()
    const profilesById = new Map((profilesData.profiles || []).map(p => [p.id, p]))

    const groups = (groupsData.groups || []).map(g => buildGroupView(g, profilesById))
    return { groups }
  })

  ipcMain.handle('groups:create', (e, payload) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }

    const name = String(payload?.name || '').trim()
    if (!name) return { error: 'Tên nhóm không hợp lệ' }
    if (name.length > 64) return { error: 'Tên nhóm quá dài' }

    const data = readGroups()
    const id = generateUUID()
    const now = new Date().toISOString()

    data.groups.push({
      id,
      name,
      profileIds: [],
      createdAt: now,
    })

    writeGroups(data)
    return { ok: true, id }
  })

  ipcMain.handle('groups:delete', (e, id) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(id)) return { error: 'ID không hợp lệ' }

    const data = readGroups()
    const before = data.groups.length
    data.groups = data.groups.filter(g => g.id !== id)

    if (data.groups.length === before) return { error: 'Nhóm không tồn tại' }

    writeGroups(data)
    return { ok: true }
  })

  ipcMain.handle('groups:rename', (e, id, nameRaw) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(id)) return { error: 'ID không hợp lệ' }

    const name = String(nameRaw || '').trim()
    if (!name) return { error: 'Tên nhóm không hợp lệ' }
    if (name.length > 64) return { error: 'Tên nhóm quá dài' }

    const data = readGroups()
    const group = data.groups.find(g => g.id === id)
    if (!group) return { error: 'Nhóm không tồn tại' }

    group.name = name
    writeGroups(data)
    return { ok: true }
  })

  ipcMain.handle('groups:addProfile', (e, groupId, profileId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(groupId) || !validateId(profileId)) return { error: 'ID không hợp lệ' }

    const profilesData = readProfiles()
    const profile = profilesData.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile không tồn tại' }

    const groupsData = readGroups()
    const group = groupsData.groups.find(g => g.id === groupId)
    if (!group) return { error: 'Nhóm không tồn tại' }

    if (!Array.isArray(group.profileIds)) group.profileIds = []
    if (!group.profileIds.includes(profileId)) group.profileIds.push(profileId)

    writeGroups(groupsData)
    return { ok: true }
  })

  ipcMain.handle('groups:removeProfile', (e, groupId, profileId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(groupId) || !validateId(profileId)) return { error: 'ID không hợp lệ' }

    const groupsData = readGroups()
    const group = groupsData.groups.find(g => g.id === groupId)
    if (!group) return { error: 'Nhóm không tồn tại' }

    const ids = Array.isArray(group.profileIds) ? group.profileIds : []
    group.profileIds = ids.filter(id => id !== profileId)

    writeGroups(groupsData)
    return { ok: true }
  })
}

module.exports = { 
  registerProfileHandlers, 
  registerGroupHandlers,
  registerProfileContentHandlers, 
  registerJavaDistroHandlers 
}
