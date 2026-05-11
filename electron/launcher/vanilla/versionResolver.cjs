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

'use strict'
/**
 * versionResolver.cjs
 * Fetch and cache the version manifest from Mojang.
 * Returns the full version JSON for a specific game version.
 */

const https = require('https')
const fs    = require('fs')
const path  = require('path')

const MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'VoxelXClient/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location).then(resolve).catch(reject)
      }
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${url}`))
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error(`Invalid JSON from ${url}`)) }
      })
    }).on('error', reject)
  })
}

// ─── Cache manifest in memory ─────────────────────────────────────────────────
let _manifestCache = null
let _manifestTime  = 0
const MANIFEST_TTL = 10 * 60 * 1000 // 10 minutes

async function getManifest() {
  if (_manifestCache && Date.now() - _manifestTime < MANIFEST_TTL) return _manifestCache
  _manifestCache = await httpsGet(MANIFEST_URL)
  _manifestTime  = Date.now()
  return _manifestCache
}

/**
 * Get the full version JSON for a game version.
 * Cached to disk for offline use.
 */
async function resolveVersion(gameVersion, cacheDir) {
  const cacheFile = path.join(cacheDir, 'versions', gameVersion, `${gameVersion}.json`)

  // Use cache if available
  if (fs.existsSync(cacheFile)) {
    try {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'))
    } catch {}
  }

  // Fetch manifest
  const manifest = await getManifest()
  const entry = manifest.versions.find(v => v.id === gameVersion)
  if (!entry) throw new Error(`Không tìm thấy version: ${gameVersion}`)

  // Fetch version JSON
  const versionJson = await httpsGet(entry.url)

  // Cache to disk
  const dir = path.dirname(cacheFile)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(cacheFile, JSON.stringify(versionJson, null, 2))

  return versionJson
}

/**
 * Get the list of all versions from the manifest.
 */
async function listVersions() {
  const manifest = await getManifest()
  return manifest.versions
}

module.exports = { resolveVersion, listVersions, httpsGet }
