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
  // gameVersion can be empty when importing a modpack (will be filled from manifest)
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
      importIconUrl: profileData.importIconUrl || null,  // modpack icon image URL
      importBgUrl:   profileData.importBgUrl   || null,  // modpack background image URL
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

    // Remove profileId from all groups
    try {
      const groupsData = readGroups()
      let changed = false
      for (const g of groupsData.groups) {
        const before = g.profileIds.length
        g.profileIds = g.profileIds.filter(pid => pid !== id)
        if (g.profileIds.length !== before) changed = true
      }
      if (changed) writeGroups(groupsData)
    } catch {}

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

  // profiles:updateRam — save RAM setting for profile
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

  // profiles:openFolder — open instance folder in File Explorer
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

// ─── Groups ───────────────────────────────────────────────────────────────────
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
    return JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf-8'))
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

function registerGroupHandlers(getTrustedWindow) {
  // groups:get — read groups.json, enrich with profiles
  ipcMain.handle('groups:get', (e) => {
    if (!getTrustedWindow(e)) return { groups: [] }
    const groupsData   = readGroups()
    const profilesData = readProfiles()
    const profileMap   = new Map((profilesData.profiles || []).map(p => [p.id, p]))

    const enriched = (groupsData.groups || []).map(g => {
      const profiles = (g.profileIds || [])
        .map(id => profileMap.get(id))
        .filter(Boolean)
        .map(p => ({ ...p, sizeBytes: getDirSizeBytes(p.instancePath) }))

      const totalSize    = profiles.reduce((sum, p) => sum + (p.sizeBytes || 0), 0)
      const profileCount = profiles.length

      return { ...g, profiles, totalSize, profileCount }
    })

    return { groups: enriched }
  })

  // groups:create — create a new group
  ipcMain.handle('groups:create', (e, data) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!data || typeof data.name !== 'string' || !data.name.trim()) {
      return { error: 'Tên nhóm không hợp lệ' }
    }

    const id  = generateUUID()
    const now = new Date().toISOString()
    const group = {
      id,
      name:       data.name.trim(),
      createdAt:  now,
      profileIds: [],
    }

    const groupsData = readGroups()
    groupsData.groups.push(group)
    writeGroups(groupsData)

    return { ok: true, group }
  })

  // groups:delete — delete group (does not delete profiles)
  ipcMain.handle('groups:delete', (e, id) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(id)) return { error: 'ID không hợp lệ' }

    const groupsData = readGroups()
    groupsData.groups = groupsData.groups.filter(g => g.id !== id)
    writeGroups(groupsData)

    return { ok: true }
  })

  // groups:addProfile — add profileId to group
  ipcMain.handle('groups:addProfile', (e, groupId, profileId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(groupId))   return { error: 'Group ID không hợp lệ' }
    if (!validateId(profileId)) return { error: 'Profile ID không hợp lệ' }

    const groupsData = readGroups()
    const group = groupsData.groups.find(g => g.id === groupId)
    if (!group) return { error: 'Group không tồn tại' }

    if (!group.profileIds.includes(profileId)) {
      group.profileIds.push(profileId)
      writeGroups(groupsData)
    }

    return { ok: true }
  })

  // groups:removeProfile — remove profileId from group
  ipcMain.handle('groups:removeProfile', (e, groupId, profileId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(groupId))   return { error: 'Group ID không hợp lệ' }
    if (!validateId(profileId)) return { error: 'Profile ID không hợp lệ' }

    const groupsData = readGroups()
    const group = groupsData.groups.find(g => g.id === groupId)
    if (!group) return { error: 'Group không tồn tại' }

    group.profileIds = group.profileIds.filter(id => id !== profileId)
    writeGroups(groupsData)

    return { ok: true }
  })

  // groups:rename — rename group
  ipcMain.handle('groups:rename', (e, id, name) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(id)) return { error: 'ID không hợp lệ' }
    if (typeof name !== 'string' || !name.trim()) return { error: 'Tên không hợp lệ' }

    const groupsData = readGroups()
    const group = groupsData.groups.find(g => g.id === id)
    if (!group) return { error: 'Group không tồn tại' }

    group.name = name.trim()
    writeGroups(groupsData)

    return { ok: true }
  })
}

module.exports = { registerProfileHandlers, registerGroupHandlers }

// ─── Profile Content Handlers (mods, worlds, shaders, resourcepacks) ──────────
function registerProfileContentHandlers(getTrustedWindow) {
  const https = require('https')

  function httpsGet(url) {
    return new Promise((resolve, reject) => {
      https.get(url, {
        headers: { 'User-Agent': 'VoxelXClient/1.0' },
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

  // Fetch mod metadata from Modrinth first, fallback to CurseForge
  async function fetchModMeta(fileName) {
    // Try to extract project slug from filename (modrinth format: name-version.jar)
    const base = fileName.replace(/\.jar$/i, '').replace(/\.off$/i, '')
    // Modrinth: search by name
    try {
      const slug = base.split('-')[0].toLowerCase()
      const data = await httpsGet(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(slug)}&limit=1&facets=[["project_type:mod"]]`)
      if (data?.hits?.[0]) {
        const h = data.hits[0]
        return {
          source: 'modrinth',
          name:        h.title || base,
          description: h.description || '',
          iconUrl:     h.icon_url || null,
          author:      h.author || '',
          downloads:   h.downloads || 0,
          projectUrl:  `https://modrinth.com/mod/${h.slug}`,
        }
      }
    } catch {}
    // CurseForge fallback
    try {
      const data = await httpsGet(`https://api.curseforge.com/v1/mods/search?gameId=432&searchFilter=${encodeURIComponent(slug)}&pageSize=1`)
      if (data?.data?.[0]) {
        const m = data.data[0]
        return {
          source: 'curseforge',
          name:        m.name || base,
          description: m.summary || '',
          iconUrl:     m.logo?.thumbnailUrl || null,
          author:      m.authors?.[0]?.name || '',
          downloads:   m.downloadCount || 0,
          projectUrl:  m.links?.websiteUrl || '',
        }
      }
    } catch {}
    return null
  }

  // profile:listMods
  ipcMain.handle('profile:listMods', async (e, profileId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(profileId)) return { error: 'ID không hợp lệ' }

    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile không tồn tại' }

    // Find all game directories (account subdirs or instancePath directly)
    // Same logic as in statsTracker.cjs
    const instancePath = profile.instancePath
    const accountsDir = path.join(instancePath, 'accounts')
    const gameDirs = []

    if (fs.existsSync(accountsDir)) {
      try {
        const entries = fs.readdirSync(accountsDir, { withFileTypes: true })
        for (const e of entries) {
          if (e.isDirectory()) gameDirs.push(path.join(accountsDir, e.name))
        }
      } catch {}
    }
    if (gameDirs.length === 0) gameDirs.push(instancePath)

    // Collect mods from all game dirs, deduplicate by fileName
    const modMap = new Map()
    for (const gameDir of gameDirs) {
      const modsDir = path.join(gameDir, 'mods')
      if (!fs.existsSync(modsDir)) continue
      try {
        const files = fs.readdirSync(modsDir)
        for (const f of files) {
          if (!/\.(jar|jar\.off|jar\.disabled)$/i.test(f)) continue
          if (modMap.has(f)) continue
          const fullPath = path.join(modsDir, f)
          const stat = fs.statSync(fullPath)
          const enabled = !f.endsWith('.off') && !f.endsWith('.disabled')
          const displayName = f.replace(/\.jar(\.off|\.disabled)?$/i, '')
          modMap.set(f, {
            fileName: f,
            displayName,
            enabled,
            size: stat.size,
            mtime: stat.mtimeMs,
            gameDir, // lưu để toggle/delete biết đường dẫn
          })
        }
      } catch {}
    }

    const mods = Array.from(modMap.values())
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
    return { ok: true, mods }
  })

  // profile:toggleMod — toggle .jar ↔ .jar.off
  ipcMain.handle('profile:toggleMod', (e, profileId, fileName) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(profileId)) return { error: 'ID không hợp lệ' }
    if (typeof fileName !== 'string' || !/\.(jar|jar\.off|jar\.disabled)$/i.test(fileName)) {
      return { error: 'Tên file không hợp lệ' }
    }

    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile không tồn tại' }

    // Tìm file trong tất cả gameDirs
    const instancePath = profile.instancePath
    const accountsDir = path.join(instancePath, 'accounts')
    const gameDirs = []
    if (fs.existsSync(accountsDir)) {
      try {
        const entries = fs.readdirSync(accountsDir, { withFileTypes: true })
        for (const e of entries) { if (e.isDirectory()) gameDirs.push(path.join(accountsDir, e.name)) }
      } catch {}
    }
    if (gameDirs.length === 0) gameDirs.push(instancePath)

    for (const gameDir of gameDirs) {
      const modsDir = path.join(gameDir, 'mods')
      const oldPath = path.join(modsDir, fileName)
      if (!fs.existsSync(oldPath)) continue
      if (!oldPath.startsWith(modsDir + path.sep)) return { error: 'Đường dẫn không hợp lệ' }

      const newName = (fileName.endsWith('.off') || fileName.endsWith('.disabled'))
        ? fileName.replace(/\.(off|disabled)$/, '')
        : fileName + '.off'
      const newPath = path.join(modsDir, newName)

      try {
        fs.renameSync(oldPath, newPath)
        // newName là tên sau khi toggle — enabled nếu KHÔNG có đuôi .off/.disabled
        const nowEnabled = !(newName.endsWith('.off') || newName.endsWith('.disabled'))
        return { ok: true, newFileName: newName, enabled: nowEnabled }
      } catch (err) {
        return { error: err.message }
      }
    }
    return { error: 'File không tồn tại' }
  })

  // profile:deleteMod
  ipcMain.handle('profile:deleteMod', (e, profileId, fileName) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(profileId)) return { error: 'ID không hợp lệ' }
    if (typeof fileName !== 'string' || !/\.(jar|jar\.off|jar\.disabled)$/i.test(fileName)) {
      return { error: 'Tên file không hợp lệ' }
    }

    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile không tồn tại' }

    const instancePath = profile.instancePath
    const accountsDir = path.join(instancePath, 'accounts')
    const gameDirs = []
    if (fs.existsSync(accountsDir)) {
      try {
        const entries = fs.readdirSync(accountsDir, { withFileTypes: true })
        for (const e of entries) { if (e.isDirectory()) gameDirs.push(path.join(accountsDir, e.name)) }
      } catch {}
    }
    if (gameDirs.length === 0) gameDirs.push(instancePath)

    for (const gameDir of gameDirs) {
      const modsDir = path.join(gameDir, 'mods')
      const filePath = path.join(modsDir, fileName)
      if (!fs.existsSync(filePath)) continue
      if (!filePath.startsWith(modsDir + path.sep)) return { error: 'Đường dẫn không hợp lệ' }
      try {
        fs.unlinkSync(filePath)
        return { ok: true }
      } catch (err) {
        return { error: err.message }
      }
    }
    return { error: 'File không tồn tại' }
  })

  // profile:getModMeta — fetch metadata from Modrinth/CurseForge, prioritize icon from jar
  ipcMain.handle('profile:getModMeta', async (e, profileId, fileName) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }

    // 1. Try reading icon directly from .jar file
    let jarIconBase64 = null
    try {
      const data = readProfiles()
      const profile = data.profiles.find(p => p.id === profileId)
      if (profile) {
        const instancePath = profile.instancePath
        const accountsDir = path.join(instancePath, 'accounts')
        const gameDirs = []
        if (fs.existsSync(accountsDir)) {
          try {
            const entries = fs.readdirSync(accountsDir, { withFileTypes: true })
            for (const e2 of entries) { if (e2.isDirectory()) gameDirs.push(path.join(accountsDir, e2.name)) }
          } catch {}
        }
        if (gameDirs.length === 0) gameDirs.push(instancePath)

        for (const gameDir of gameDirs) {
          const jarPath = path.join(gameDir, 'mods', fileName)
          if (!fs.existsSync(jarPath)) continue
          try {
            const buf = fs.readFileSync(jarPath)
            // Try reading pack.png or icon.png from jar (zip format)
            for (const iconName of ['pack.png', 'icon.png', 'assets/icon.png']) {
              const iconData = readZipEntry(buf, iconName)
              if (iconData && iconData.length > 0) {
                jarIconBase64 = 'data:image/png;base64,' + iconData.toString('base64')
                break
              }
            }
            // Try reading fabric.mod.json to get icon path
            if (!jarIconBase64) {
              const fabricMeta = readZipEntry(buf, 'fabric.mod.json')
              if (fabricMeta) {
                try {
                  const meta = JSON.parse(fabricMeta.toString('utf-8'))
                  if (meta.icon) {
                    const iconData = readZipEntry(buf, meta.icon)
                    if (iconData) jarIconBase64 = 'data:image/png;base64,' + iconData.toString('base64')
                  }
                } catch {}
              }
            }
            // Try reading META-INF/mods.toml (Forge)
            if (!jarIconBase64) {
              const forgeMeta = readZipEntry(buf, 'META-INF/mods.toml')
              if (forgeMeta) {
                const toml = forgeMeta.toString('utf-8')
                const logoMatch = toml.match(/logoFile\s*=\s*["']?([^"'\n]+)["']?/)
                if (logoMatch) {
                  const iconData = readZipEntry(buf, logoMatch[1].trim())
                  if (iconData) jarIconBase64 = 'data:image/png;base64,' + iconData.toString('base64')
                }
              }
            }
          } catch {}
          if (jarIconBase64) break
        }
      }
    } catch {}

    // 2. Fetch API metadata (Modrinth first, then CurseForge)
    const apiMeta = await fetchModMeta(fileName)

    // Merge: prioritize icon from jar, fallback to API
    const finalMeta = apiMeta
      ? { ...apiMeta, iconUrl: jarIconBase64 || apiMeta.iconUrl }
      : jarIconBase64
        ? { source: 'local', name: null, iconUrl: jarIconBase64 }
        : null

    return finalMeta ? { ok: true, meta: finalMeta } : { ok: true, meta: null }
  })

  // profile:getShaderMeta — fetch shader metadata from Modrinth (project_type:shader)
  ipcMain.handle('profile:getShaderMeta', async (e, profileId, fileName) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }

    // Clean up filename to use as search query
    // e.g. "ComplementaryReimagined_r5.7.1.zip" → "ComplementaryReimagined"
    const base = fileName
      .replace(/\.(zip|jar)$/i, '')
      .replace(/_r?\d[\d.]*.*$/, '')   // strip version suffix like _r5.7.1
      .replace(/-\d[\d.]*.*$/, '')     // strip version suffix like -1.2.3
      .replace(/[_-]/g, ' ')
      .trim()

    try {
      const data = await httpsGet(
        `https://api.modrinth.com/v2/search?query=${encodeURIComponent(base)}&limit=1&facets=[["project_type:shader"]]`
      )
      if (data?.hits?.[0]) {
        const h = data.hits[0]
        return {
          ok: true,
          meta: {
            source:      'modrinth',
            name:        h.title || base,
            description: h.description || '',
            iconUrl:     h.icon_url || null,
            author:      h.author || '',
            downloads:   h.downloads || 0,
            projectUrl:  `https://modrinth.com/shader/${h.slug}`,
          }
        }
      }
    } catch {}

    return { ok: true, meta: null }
  })

  // profile:getResourcePackMeta — fetch resource pack metadata from Modrinth (project_type:resourcepack)
  ipcMain.handle('profile:getResourcePackMeta', async (e, profileId, fileName) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }

    // Clean filename: "Faithful 32x-1.20.zip" → "Faithful 32x"
    const base = fileName
      .replace(/\.(zip|jar)$/i, '')
      .replace(/_r?\d[\d.]*.*$/, '')
      .replace(/-\d[\d.]*.*$/, '')
      .replace(/[_]/g, ' ')
      .trim()

    // First try reading pack.png from the zip file itself
    let localIcon = null
    try {
      const data = readProfiles()
      const profile = data.profiles.find(p => p.id === profileId)
      if (profile) {
        const instancePath = profile.instancePath
        const accountsDir = path.join(instancePath, 'accounts')
        const gameDirs = []
        if (fs.existsSync(accountsDir)) {
          try {
            const entries = fs.readdirSync(accountsDir, { withFileTypes: true })
            for (const e2 of entries) { if (e2.isDirectory()) gameDirs.push(path.join(accountsDir, e2.name)) }
          } catch {}
        }
        if (gameDirs.length === 0) gameDirs.push(instancePath)

        for (const gameDir of gameDirs) {
          const packPath = path.join(gameDir, 'resourcepacks', fileName)
          if (!fs.existsSync(packPath)) continue
          try {
            const buf = fs.readFileSync(packPath)
            const iconData = readZipEntry(buf, 'pack.png')
            if (iconData && iconData.length > 0) {
              localIcon = 'data:image/png;base64,' + iconData.toString('base64')
              break
            }
          } catch {}
        }
      }
    } catch {}

    if (localIcon) return { ok: true, meta: { source: 'local', name: null, iconUrl: localIcon } }

    // Fallback: search Modrinth
    try {
      const data = await httpsGet(
        `https://api.modrinth.com/v2/search?query=${encodeURIComponent(base)}&limit=1&facets=[["project_type:resourcepack"]]`
      )
      if (data?.hits?.[0]) {
        const h = data.hits[0]
        return {
          ok: true,
          meta: {
            source:      'modrinth',
            name:        h.title || base,
            description: h.description || '',
            iconUrl:     h.icon_url || null,
            author:      h.author || '',
            downloads:   h.downloads || 0,
            projectUrl:  `https://modrinth.com/resourcepack/${h.slug}`,
          }
        }
      }
    } catch {}

    return { ok: true, meta: null }
  })

  // profile:listShaders
  ipcMain.handle('profile:listShaders', async (e, profileId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(profileId)) return { error: 'ID không hợp lệ' }

    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile không tồn tại' }

    // Shaders có thể ở shaderpacks/ hoặc shaders/
    const dirs = ['shaderpacks', 'shaders']
    let shaders = []
    for (const dir of dirs) {
      const shadersDir = path.join(profile.instancePath, dir)
      if (!fs.existsSync(shadersDir)) continue
      try {
        const files = fs.readdirSync(shadersDir)
        for (const f of files) {
          const fullPath = path.join(shadersDir, f)
          const stat = fs.statSync(fullPath)
          if (stat.isFile() && /\.(zip|txt)$/i.test(f)) {
            shaders.push({ fileName: f, displayName: f.replace(/\.(zip)$/i, ''), size: stat.size, mtime: stat.mtimeMs, subDir: dir })
          } else if (stat.isDirectory()) {
            shaders.push({ fileName: f, displayName: f, size: 0, mtime: stat.mtimeMs, subDir: dir, isDir: true })
          }
        }
      } catch {}
    }
    shaders.sort((a, b) => a.displayName.localeCompare(b.displayName))
    return { ok: true, shaders }
  })

  // profile:deleteShader
  ipcMain.handle('profile:deleteShader', (e, profileId, fileName, subDir) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(profileId)) return { error: 'ID không hợp lệ' }
    if (typeof fileName !== 'string' || fileName.includes('..')) return { error: 'Tên file không hợp lệ' }

    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile không tồn tại' }

    const dir = ['shaderpacks', 'shaders'].includes(subDir) ? subDir : 'shaderpacks'
    const targetPath = path.join(profile.instancePath, dir, fileName)
    const baseDir = path.join(profile.instancePath, dir)
    if (!targetPath.startsWith(baseDir + path.sep)) return { error: 'Đường dẫn không hợp lệ' }
    if (!fs.existsSync(targetPath)) return { error: 'File không tồn tại' }

    try {
      const stat = fs.statSync(targetPath)
      if (stat.isDirectory()) fs.rmSync(targetPath, { recursive: true, force: true })
      else fs.unlinkSync(targetPath)
      return { ok: true }
    } catch (err) {
      return { error: err.message }
    }
  })

  // profile:listResourcePacks
  ipcMain.handle('profile:listResourcePacks', async (e, profileId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(profileId)) return { error: 'ID không hợp lệ' }

    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile không tồn tại' }

    const rpDir = path.join(profile.instancePath, 'resourcepacks')
    if (!fs.existsSync(rpDir)) return { ok: true, packs: [] }

    try {
      const files = fs.readdirSync(rpDir)
      const packs = []
      for (const f of files) {
        const fullPath = path.join(rpDir, f)
        const stat = fs.statSync(fullPath)
        let iconBase64 = null
        let description = ''
        // Read pack.mcmeta and pack.png if it's a folder or zip
        if (stat.isDirectory()) {
          const metaPath = path.join(fullPath, 'pack.mcmeta')
          const iconPath = path.join(fullPath, 'pack.png')
          if (fs.existsSync(metaPath)) {
            try {
              const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
              description = meta?.pack?.description || ''
            } catch {}
          }
          if (fs.existsSync(iconPath)) {
            try {
              iconBase64 = 'data:image/png;base64,' + fs.readFileSync(iconPath).toString('base64')
            } catch {}
          }
        } else if (/\.zip$/i.test(f)) {
          // Read pack.png from zip
          try {
            const buf = fs.readFileSync(fullPath)
            const iconData = readZipEntry(buf, 'pack.png')
            if (iconData) iconBase64 = 'data:image/png;base64,' + iconData.toString('base64')
            const metaData = readZipEntry(buf, 'pack.mcmeta')
            if (metaData) {
              const meta = JSON.parse(metaData.toString('utf-8'))
              description = meta?.pack?.description || ''
            }
          } catch {}
        }
        packs.push({
          fileName: f,
          displayName: f.replace(/\.zip$/i, ''),
          description,
          iconBase64,
          size: stat.size,
          mtime: stat.mtimeMs,
          isDir: stat.isDirectory(),
        })
      }
      packs.sort((a, b) => a.displayName.localeCompare(b.displayName))
      return { ok: true, packs }
    } catch (err) {
      return { error: err.message }
    }
  })

  // profile:deleteResourcePack
  ipcMain.handle('profile:deleteResourcePack', (e, profileId, fileName) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(profileId)) return { error: 'ID không hợp lệ' }
    if (typeof fileName !== 'string' || fileName.includes('..')) return { error: 'Tên file không hợp lệ' }

    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile không tồn tại' }

    const rpDir = path.join(profile.instancePath, 'resourcepacks')
    const targetPath = path.join(rpDir, fileName)
    if (!targetPath.startsWith(rpDir + path.sep)) return { error: 'Đường dẫn không hợp lệ' }
    if (!fs.existsSync(targetPath)) return { error: 'File không tồn tại' }

    try {
      const stat = fs.statSync(targetPath)
      if (stat.isDirectory()) fs.rmSync(targetPath, { recursive: true, force: true })
      else fs.unlinkSync(targetPath)
      return { ok: true }
    } catch (err) {
      return { error: err.message }
    }
  })

  // profile:listWorlds
  ipcMain.handle('profile:listWorlds', async (e, profileId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(profileId)) return { error: 'ID không hợp lệ' }

    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile không tồn tại' }

    // Collect game dirs — same logic as statsTracker.getProfileStats:
    // worlds live in instancePath/accounts/<accountId>/saves/
    // with fallback to instancePath/saves/ (legacy)
    const instancePath = profile.instancePath
    const accountsDir = path.join(instancePath, 'accounts')
    const gameDirs = []

    if (fs.existsSync(accountsDir)) {
      try {
        const entries = fs.readdirSync(accountsDir, { withFileTypes: true })
        for (const e of entries) {
          if (e.isDirectory()) gameDirs.push(path.join(accountsDir, e.name))
        }
      } catch {}
    }
    if (gameDirs.length === 0) gameDirs.push(instancePath)

    try {
      // Merge worlds from all account dirs, deduplicate by folderName
      const worldMap = new Map()

      for (const gameDir of gameDirs) {
        const savesDir = path.join(gameDir, 'saves')
        if (!fs.existsSync(savesDir)) continue

        const entries = fs.readdirSync(savesDir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          const worldPath = path.join(savesDir, entry.name)
          const levelDat = path.join(worldPath, 'level.dat')
          const iconPath = path.join(worldPath, 'icon.png')

          let iconBase64 = null
          let lastPlayed = null

          if (fs.existsSync(iconPath)) {
            try { iconBase64 = 'data:image/png;base64,' + fs.readFileSync(iconPath).toString('base64') } catch {}
          }
          if (fs.existsSync(levelDat)) {
            try { lastPlayed = fs.statSync(levelDat).mtimeMs } catch {}
          }

          const existing = worldMap.get(entry.name)
          if (!existing || (lastPlayed && (!existing.lastPlayed || lastPlayed > existing.lastPlayed))) {
            worldMap.set(entry.name, {
              folderName:  entry.name,
              displayName: entry.name,
              iconBase64,
              lastPlayed,
              size:        getDirSizeBytes(worldPath),
              mtime:       fs.statSync(worldPath).mtimeMs,
            })
          }
        }
      }

      const worlds = Array.from(worldMap.values())
        .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))
      return { ok: true, worlds }
    } catch (err) {
      return { error: err.message }
    }
  })

  // profile:deleteWorld
  ipcMain.handle('profile:deleteWorld', (e, profileId, folderName) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(profileId)) return { error: 'ID không hợp lệ' }
    if (typeof folderName !== 'string' || folderName.includes('..') || folderName.includes('/') || folderName.includes('\\')) {
      return { error: 'Tên thư mục không hợp lệ' }
    }

    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile không tồn tại' }

    const savesDir = path.join(profile.instancePath, 'saves')
    const worldPath = path.join(savesDir, folderName)
    if (!worldPath.startsWith(savesDir + path.sep)) return { error: 'Đường dẫn không hợp lệ' }
    if (!fs.existsSync(worldPath)) return { error: 'World không tồn tại' }

    try {
      fs.rmSync(worldPath, { recursive: true, force: true })
      return { ok: true }
    } catch (err) {
      return { error: err.message }
    }
  })

  // profile:update — update profile configuration (ram, jvm, windowSize, javaPath, name)
  ipcMain.handle('profile:update', (e, profileId, patch) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(profileId)) return { error: 'ID không hợp lệ' }
    if (!patch || typeof patch !== 'object') return { error: 'Dữ liệu không hợp lệ' }

    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile không tồn tại' }

    // Whitelist các field được phép update
    const allowed = ['name', 'ramGb', 'jvmArgs', 'windowWidth', 'windowHeight', 'javaPath', 'gameVersion', 'loaderVersion']
    for (const key of allowed) {
      if (key in patch) {
        if (key === 'ramGb') {
          const v = Number(patch[key])
          if (Number.isFinite(v) && v >= 1 && v <= 64) profile[key] = v
        } else if (key === 'windowWidth' || key === 'windowHeight') {
          const v = Number(patch[key])
          if (Number.isFinite(v) && v >= 320 && v <= 7680) profile[key] = v
        } else if (typeof patch[key] === 'string') {
          profile[key] = patch[key]
        }
      }
    }

    writeProfiles(data)
    return { ok: true, profile }
  })

  // profile:listJavas — list known Java installations
  ipcMain.handle('profile:listJavas', async (e) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    try {
      const { findJavaInstallations } = require('./launcher/java/javaManager.cjs')
      const javas = await findJavaInstallations()
      return { ok: true, javas }
    } catch (err) {
      return { ok: true, javas: [] }
    }
  })
}

// Helper: read entry from ZIP buffer (used for resourcepacks)
function readZipEntry(buf, name) {
  try {
    const zlib = require('zlib')
    let eocdOffset = -1
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--) {
      if (buf.readUInt32LE(i) === 0x06054b50) { eocdOffset = i; break }
    }
    if (eocdOffset < 0) return null
    const cdOffset = buf.readUInt32LE(eocdOffset + 16)
    const cdCount  = buf.readUInt16LE(eocdOffset + 10)
    let pos = cdOffset
    for (let i = 0; i < cdCount; i++) {
      if (buf.readUInt32LE(pos) !== 0x02014b50) break
      const compMethod  = buf.readUInt16LE(pos + 10)
      const compSize    = buf.readUInt32LE(pos + 20)
      const fnLen       = buf.readUInt16LE(pos + 28)
      const extraLen    = buf.readUInt16LE(pos + 30)
      const commentLen  = buf.readUInt16LE(pos + 32)
      const localOffset = buf.readUInt32LE(pos + 42)
      const fileName    = buf.slice(pos + 46, pos + 46 + fnLen).toString('utf8')
      if (fileName === name) {
        const lfnLen  = buf.readUInt16LE(localOffset + 26)
        const lexLen  = buf.readUInt16LE(localOffset + 28)
        const dataOff = localOffset + 30 + lfnLen + lexLen
        const comp    = buf.slice(dataOff, dataOff + compSize)
        if (compMethod === 0) return comp
        if (compMethod === 8) return zlib.inflateRawSync(comp)
        return null
      }
      pos += 46 + fnLen + extraLen + commentLen
    }
    return null
  } catch { return null }
}

module.exports = { registerProfileHandlers, registerGroupHandlers, registerProfileContentHandlers }

// ─── Java Distro Handlers ─────────────────────────────────────────────────────
function registerJavaDistroHandlers(getTrustedWindow) {
  const { app } = require('electron')
  const { fetchAllDistros, installDistro, deleteDistro, isDistroInstalled, getProfileJreInfo, getJavaExe } = require('./launcher/java/javaDistros.cjs')

  function getProfileInstancePath(profileId) {
    const data = readProfiles()
    const profile = data.profiles.find(p => p.id === profileId)
    return profile?.instancePath || null
  }

  // java:fetchDistros — get version list from Adoptium/Azul/GraalVM
  // Also includes info about Java installed in the profile (if any)
  ipcMain.handle('java:fetchDistros', async (e, profileId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    try {
      const distros = await fetchAllDistros()

      // Check Java installed in profile
      let installedInfo = null
      if (profileId && validateId(profileId)) {
        const instancePath = getProfileInstancePath(profileId)
        if (instancePath) {
          installedInfo = getProfileJreInfo(instancePath)
        }
      }

      return { ok: true, distros, installedInfo }
    } catch (err) {
      return { error: err.message }
    }
  })

  // java:getInstalled — check Java installed in profile
  ipcMain.handle('java:getInstalled', (e, profileId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(profileId)) return { error: 'ID không hợp lệ' }
    try {
      const instancePath = getProfileInstancePath(profileId)
      if (!instancePath) return { ok: true, installedInfo: null }
      const installedInfo = getProfileJreInfo(instancePath)
      return { ok: true, installedInfo }
    } catch (err) {
      return { error: err.message }
    }
  })

  // java:install — download and install Java into the profile's jre/ directory
  ipcMain.handle('java:install', async (e, pkg, profileId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!pkg || typeof pkg !== 'object') return { error: 'Dữ liệu không hợp lệ' }
    if (!pkg.downloadUrl || !pkg.distro || !pkg.javaVersion) return { error: 'Thiếu thông tin package' }
    if (!validateId(profileId)) return { error: 'Profile ID không hợp lệ' }

    const instancePath = getProfileInstancePath(profileId)
    if (!instancePath) return { error: 'Profile không tồn tại' }

    // Install into <instancePath>/jre/
    const jreDir = path.join(instancePath, 'jre')
    const win = getTrustedWindow(e)

    try {
      // Remove old Java if present (replace)
      if (fs.existsSync(jreDir)) {
        fs.rmSync(jreDir, { recursive: true, force: true })
      }

      const javaExe = await installDistro(pkg, jreDir, (progress) => {
        win?.webContents?.send('java:installProgress', progress)
      })

      // Save metadata to know which distro/version is installed
      const metaPath = path.join(jreDir, '.vxc-java-meta.json')
      fs.writeFileSync(metaPath, JSON.stringify({
        distro:      pkg.distro,
        javaVersion: pkg.javaVersion,
        releaseVersion: pkg.releaseVersion,
        installedAt: new Date().toISOString(),
      }, null, 2))

      // Automatically update javaPath in profile
      const data = readProfiles()
      const profile = data.profiles.find(p => p.id === profileId)
      if (profile) {
        profile.javaPath = javaExe
        writeProfiles(data)
      }

      return { ok: true, javaExe }
    } catch (err) {
      return { error: err.message }
    }
  })

  // java:delete — remove Java installed in profile
  ipcMain.handle('java:delete', (e, profileId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!validateId(profileId)) return { error: 'ID không hợp lệ' }

    const instancePath = getProfileInstancePath(profileId)
    if (!instancePath) return { error: 'Profile không tồn tại' }

    try {
      const jreDir = path.join(instancePath, 'jre')
      const deleted = deleteDistro(jreDir)

      // Remove javaPath from profile
      if (deleted) {
        const data = readProfiles()
        const profile = data.profiles.find(p => p.id === profileId)
        if (profile) {
          profile.javaPath = ''
          writeProfiles(data)
        }
      }

      return { ok: true, deleted }
    } catch (err) {
      return { error: err.message }
    }
  })

  // java:installToDir — install Java into any custom directory (used by server manager)
  // Does NOT require a profile ID — installs into the provided installDir
  ipcMain.handle('java:installToDir', async (e, pkg, installDir) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!pkg || !pkg.downloadUrl) return { error: 'Thiếu thông tin package' }
    if (typeof installDir !== 'string' || !installDir) return { error: 'Thư mục không hợp lệ' }

    const win = getTrustedWindow(e)
    try {
      if (fs.existsSync(installDir)) {
        fs.rmSync(installDir, { recursive: true, force: true })
      }

      const javaExe = await installDistro(pkg, installDir, (progress) => {
        win?.webContents?.send('java:installProgress', progress)
      })

      // Mark as hidden on Windows
      if (process.platform === 'win32') {
        try { require('child_process').execSync(`attrib +h "${installDir}"`, { windowsHide: true }) } catch {}
      }

      return { ok: true, javaExe }
    } catch (err) {
      return { error: err.message }
    }
  })
}

module.exports = { registerProfileHandlers, registerGroupHandlers, registerProfileContentHandlers, registerJavaDistroHandlers }
