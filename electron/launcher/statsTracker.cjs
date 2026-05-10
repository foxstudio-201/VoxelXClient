'use strict'
/**
 * statsTracker.cjs
 * Theo dõi thời gian chơi, đọc worlds và mods từ instance folder.
 */

const fs   = require('fs')
const path = require('path')

// ─── Playtime ─────────────────────────────────────────────────────────────────
/**
 * Bắt đầu đếm giờ chơi cho một profile.
 * Trả về hàm stop() để dừng và lưu.
 */
function startPlaytimeTracker(profileId, profilesData, writeProfiles) {
  const startTime = Date.now()

  return function stop() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000) // seconds
    const profile = profilesData.profiles.find(p => p.id === profileId)
    if (!profile) return

    profile.playtimeSeconds = (profile.playtimeSeconds || 0) + elapsed
    profile.lastPlayed = new Date().toISOString()
    writeProfiles(profilesData)
    return elapsed
  }
}

/**
 * Format giờ chơi thành chuỗi dễ đọc.
 */
function formatPlaytime(seconds) {
  if (!seconds || seconds < 60) return '< 1 phút'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m} phút`
  if (m === 0) return `${h} giờ`
  return `${h} giờ ${m} phút`
}

function formatPlaytimeShort(seconds) {
  if (!seconds) return '0'
  const h = seconds / 3600
  if (h < 1) return `${Math.floor(seconds / 60)}m`
  return `${h.toFixed(1)}h`
}

// ─── Worlds ───────────────────────────────────────────────────────────────────
/**
 * Đọc danh sách worlds từ instance folder.
 * Minecraft lưu worlds trong <instancePath>/saves/
 */
function getWorlds(instancePath) {
  const savesDir = path.join(instancePath, 'saves')
  if (!fs.existsSync(savesDir)) return []

  try {
    const entries = fs.readdirSync(savesDir, { withFileTypes: true })
    return entries
      .filter(e => e.isDirectory())
      .map(e => {
        const worldDir = path.join(savesDir, e.name)
        const levelDat = path.join(worldDir, 'level.dat')
        let lastPlayed = null
        let size = 0

        try {
          const stat = fs.statSync(levelDat)
          lastPlayed = stat.mtime.toISOString()
        } catch {}

        try {
          size = getDirSize(worldDir)
        } catch {}

        return {
          name:       e.name,
          path:       worldDir,
          lastPlayed,
          sizeBytes:  size,
        }
      })
      .sort((a, b) => {
        if (!a.lastPlayed) return 1
        if (!b.lastPlayed) return -1
        return new Date(b.lastPlayed) - new Date(a.lastPlayed)
      })
  } catch {
    return []
  }
}

// ─── Mods ─────────────────────────────────────────────────────────────────────
/**
 * Đọc danh sách mods từ instance folder.
 * Minecraft lưu mods trong <instancePath>/mods/
 */
function getMods(instancePath) {
  const modsDir = path.join(instancePath, 'mods')
  if (!fs.existsSync(modsDir)) return []

  try {
    const entries = fs.readdirSync(modsDir, { withFileTypes: true })
    return entries
      .filter(e => e.isFile() && (e.name.endsWith('.jar') || e.name.endsWith('.jar.disabled')))
      .map(e => {
        const modPath = path.join(modsDir, e.name)
        const enabled = e.name.endsWith('.jar')
        let size = 0
        try { size = fs.statSync(modPath).size } catch {}

        return {
          filename: e.name,
          name:     e.name.replace(/\.jar(\.disabled)?$/, ''),
          path:     modPath,
          enabled,
          sizeBytes: size,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDirSize(dirPath) {
  let total = 0
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(dirPath, e.name)
      if (e.isDirectory()) total += getDirSize(full)
      else try { total += fs.statSync(full).size } catch {}
    }
  } catch {}
  return total
}

/**
 * Lấy stats tổng hợp cho một profile.
 * Worlds và mods được đọc từ tất cả account subdirs trong instancePath/accounts/
 */
function getProfileStats(profile) {
  const instancePath = profile.instancePath

  // Collect all account game dirs: instancePath/accounts/<accountId>/
  const accountsDir = path.join(instancePath, 'accounts')
  const gameDirs = []

  if (fs.existsSync(accountsDir)) {
    try {
      const entries = fs.readdirSync(accountsDir, { withFileTypes: true })
      for (const e of entries) {
        if (e.isDirectory()) {
          gameDirs.push(path.join(accountsDir, e.name))
        }
      }
    } catch {}
  }

  // Fallback: also check instancePath directly (legacy / custom path)
  if (gameDirs.length === 0) {
    gameDirs.push(instancePath)
  }

  // Merge worlds from all account dirs (deduplicate by name)
  const worldMap = new Map()
  for (const dir of gameDirs) {
    for (const w of getWorlds(dir)) {
      // Keep the most recently played version if duplicate name
      const existing = worldMap.get(w.name)
      if (!existing || (w.lastPlayed && (!existing.lastPlayed || w.lastPlayed > existing.lastPlayed))) {
        worldMap.set(w.name, w)
      }
    }
  }
  const worlds = Array.from(worldMap.values()).sort((a, b) => {
    if (!a.lastPlayed) return 1
    if (!b.lastPlayed) return -1
    return new Date(b.lastPlayed) - new Date(a.lastPlayed)
  })

  // Merge mods from all account dirs (deduplicate by filename)
  const modMap = new Map()
  for (const dir of gameDirs) {
    for (const m of getMods(dir)) {
      if (!modMap.has(m.filename)) modMap.set(m.filename, m)
    }
  }
  const mods = Array.from(modMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  return {
    playtimeSeconds:   profile.playtimeSeconds || 0,
    playtimeFormatted: formatPlaytime(profile.playtimeSeconds || 0),
    playtimeShort:     formatPlaytimeShort(profile.playtimeSeconds || 0),
    lastPlayed:        profile.lastPlayed || null,
    worldCount:        worlds.length,
    worlds,
    modCount:          mods.filter(m => m.enabled).length,
    mods,
  }
}

module.exports = {
  startPlaytimeTracker,
  formatPlaytime,
  formatPlaytimeShort,
  getWorlds,
  getMods,
  getProfileStats,
}
