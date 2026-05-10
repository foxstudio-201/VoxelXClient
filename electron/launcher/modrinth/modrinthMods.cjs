'use strict'
/**
 * modrinthMods.cjs
 * Auto-download essential Fabric mods from Modrinth:
 *   - Fabric API  (project id: P7dR8mSH)
 *   - Mod Menu    (project id: mOgUt4GM)
 *
 * Only downloads if not already present for the given game version.
 * Saves to <instancePath>/accounts/<accountId>/mods/
 */

const https  = require('https')
const http   = require('http')
const fs     = require('fs')
const path   = require('path')

const MODRINTH_API = 'https://api.modrinth.com/v2'

// Mods to auto-install for Fabric profiles
const FABRIC_AUTO_MODS = [
  { id: 'P7dR8mSH', name: 'Fabric API' },
  { id: 'mOgUt4GM', name: 'Mod Menu'   },
]

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url)
    https.get({
      hostname: opts.hostname,
      path:     opts.pathname + opts.search,
      headers:  {
        'User-Agent': 'VoxelXClient/1.0 (github.com/voxelxclient)',
        'Accept':     'application/json',
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGetJson(res.headers.location).then(resolve).catch(reject)
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

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const dir = path.dirname(destPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const tmpPath = destPath + '.tmp'

    client.get(url, { headers: { 'User-Agent': 'VoxelXClient/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`HTTP ${res.statusCode}: ${url}`))
      }
      const out = fs.createWriteStream(tmpPath)
      res.pipe(out)
      out.on('finish', () => { fs.renameSync(tmpPath, destPath); resolve() })
      out.on('error', err => { try { fs.unlinkSync(tmpPath) } catch {} reject(err) })
      res.on('error', err => { try { fs.unlinkSync(tmpPath) } catch {} reject(err) })
    }).on('error', reject)
  })
}

// ─── Find best version for a mod ─────────────────────────────────────────────
/**
 * Query Modrinth for the latest version of a mod compatible with:
 *   - game_versions: [mcVersion]
 *   - loaders: ['fabric']
 *
 * Returns the first matching version object, or null.
 */
async function findModVersion(projectId, mcVersion) {
  const url = `${MODRINTH_API}/project/${projectId}/version?game_versions=["${mcVersion}"]&loaders=["fabric"]`
  const versions = await httpsGetJson(url)
  if (!Array.isArray(versions) || versions.length === 0) return null

  // Sort by date_published descending, pick latest
  versions.sort((a, b) => new Date(b.date_published) - new Date(a.date_published))
  return versions[0]
}

// ─── Main: ensure mods are installed ─────────────────────────────────────────
/**
 * Download Fabric API and Mod Menu into the mods folder if not already present.
 *
 * @param {string} mcVersion  - e.g. "1.21.4"
 * @param {string} modsDir    - path to mods folder (instancePath/accounts/<id>/mods)
 * @param {function} onProgress - callback({ log, done, total })
 */
async function ensureFabricMods(mcVersion, modsDir, onProgress) {
  if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true })

  let done = 0
  const total = FABRIC_AUTO_MODS.length

  for (const mod of FABRIC_AUTO_MODS) {
    done++
    onProgress?.({ log: `Checking ${mod.name} for ${mcVersion}...`, done, total })

    let version
    try {
      version = await findModVersion(mod.id, mcVersion)
    } catch (err) {
      onProgress?.({ log: `Warning: Could not fetch ${mod.name}: ${err.message}`, done, total })
      continue
    }

    if (!version) {
      onProgress?.({ log: `${mod.name}: no compatible version for ${mcVersion}, skipping.`, done, total })
      continue
    }

    // Find the primary jar file
    const primaryFile = version.files?.find(f => f.primary) || version.files?.[0]
    if (!primaryFile) {
      onProgress?.({ log: `${mod.name}: no file found, skipping.`, done, total })
      continue
    }

    const fileName = primaryFile.filename
    const destPath = path.join(modsDir, fileName)

    // Check if already downloaded (by filename — includes version in name)
    if (fs.existsSync(destPath)) {
      onProgress?.({ log: `${mod.name} already installed (${fileName}).`, done, total })
      continue
    }

    // Remove old versions of this mod (same project, different version)
    // Detect by checking if any existing jar starts with the mod's slug pattern
    try {
      const existing = fs.readdirSync(modsDir)
      for (const f of existing) {
        // Modrinth filenames typically: modname-version+mcversion.jar
        // We identify old versions by checking the version_id stored in a sidecar or
        // simply by removing files that match the mod's known filename patterns
        if (f !== fileName && version.files?.some(vf => {
          // If the existing file shares the same project slug prefix
          const slug = vf.filename.split('-')[0]
          return f.startsWith(slug + '-') && f.endsWith('.jar')
        })) {
          fs.unlinkSync(path.join(modsDir, f))
          onProgress?.({ log: `Removed old ${mod.name}: ${f}`, done, total })
        }
      }
    } catch {}

    onProgress?.({ log: `Downloading ${mod.name} ${version.version_number}...`, done, total })
    try {
      await downloadFile(primaryFile.url, destPath)
      onProgress?.({ log: `${mod.name} ${version.version_number} installed.`, done, total })
    } catch (err) {
      onProgress?.({ log: `Failed to download ${mod.name}: ${err.message}`, done, total })
    }
  }
}

module.exports = { ensureFabricMods }
