'use strict'
/**
 * curseforgeImporter.cjs
 * Import a CurseForge modpack (.zip) into a profile instance.
 *
 * CurseForge .zip contains:
 *   manifest.json   — metadata + mod list (projectID + fileID)
 *   overrides/      — files to copy directly into the instance
 *
 * NOTE: CurseForge API requires an API key to get download URLs.
 * We use the open proxy at https://api.curse.tools (no key needed)
 * as a fallback, or the official API if a key is configured.
 */

const https  = require('https')
const http   = require('http')
const fs     = require('fs')
const path   = require('path')
const zlib   = require('zlib')

const CF_API_BASE  = 'https://api.curseforge.com/v1'
const CF_PROXY     = 'https://api.curse.tools/v1/cf'  // open proxy, no key needed

// ─── ZIP reader (same as modrinthImporter) ────────────────────────────────────
function readZipEntry(buf, entryName) {
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

    if (fileName === entryName) {
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
}

function iterZipEntries(buf, cb) {
  let eocdOffset = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocdOffset = i; break }
  }
  if (eocdOffset < 0) return

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

    cb(fileName, () => {
      const lfnLen  = buf.readUInt16LE(localOffset + 26)
      const lexLen  = buf.readUInt16LE(localOffset + 28)
      const dataOff = localOffset + 30 + lfnLen + lexLen
      const comp    = buf.slice(dataOff, dataOff + compSize)
      if (compMethod === 0) return comp
      if (compMethod === 8) return zlib.inflateRawSync(comp)
      return null
    })
    pos += 46 + fnLen + extraLen + commentLen
  }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function httpsGetJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, { headers: { 'User-Agent': 'VoxelXClient/1.0', ...headers } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGetJson(res.headers.location, headers).then(resolve).catch(reject)
      }
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${url}`))
        try { resolve(JSON.parse(data)) } catch { reject(new Error('Invalid JSON')) }
      })
    }).on('error', reject)
  })
}

function downloadFile(url, destPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const client  = url.startsWith('https') ? https : http
    const dir     = path.dirname(destPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const tmpPath = destPath + '.tmp'

    const req = client.get(url, { headers: { 'User-Agent': 'VoxelXClient/1.0', ...headers } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, destPath, headers).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`HTTP ${res.statusCode}: ${url}`))
      }
      const out = fs.createWriteStream(tmpPath)
      res.pipe(out)
      out.on('finish', () => {
        try { fs.renameSync(tmpPath, destPath) } catch {
          fs.copyFileSync(tmpPath, destPath)
          try { fs.unlinkSync(tmpPath) } catch {}
        }
        resolve()
      })
      out.on('error', err => { try { fs.unlinkSync(tmpPath) } catch {}; reject(err) })
      res.on('error',  err => { try { fs.unlinkSync(tmpPath) } catch {}; reject(err) })
    })
    req.on('error', reject)
  })
}

// ─── Get mod download URL ─────────────────────────────────────────────────────
async function getModDownloadUrl(projectId, fileId, apiKey) {
  // Try official API first if key available
  if (apiKey) {
    try {
      const data = await httpsGetJson(
        `${CF_API_BASE}/mods/${projectId}/files/${fileId}/download-url`,
        { 'x-api-key': apiKey }
      )
      if (data?.data) return data.data
    } catch {}
  }

  // Fallback: open proxy (no key needed)
  try {
    const data = await httpsGetJson(`${CF_PROXY}/mods/${projectId}/files/${fileId}/download-url`)
    if (data?.data) return data.data
  } catch {}

  // Last resort: construct CDN URL directly (works for many mods)
  // Format: https://edge.forgecdn.net/files/{fileId/1000}/{fileId%1000}/{filename}
  return null
}

// ─── Main import function ─────────────────────────────────────────────────────
/**
 * @param {string}   zipPath      path to CurseForge .zip file
 * @param {string}   instancePath destination instance directory
 * @param {function} onProgress   callback({ phase, log, done, total, percent })
 * @param {string}   [apiKey]     optional CurseForge API key
 * @returns {{ name, gameVersion, loader, loaderVersion }}
 */
async function importCurseForgePack(zipPath, instancePath, onProgress, apiKey) {
  onProgress?.({ phase: 'read', log: 'Đọc file modpack...', percent: 2 })

  const buf = fs.readFileSync(zipPath)

  // 1. Read manifest
  const manifestData = readZipEntry(buf, 'manifest.json')
  if (!manifestData) throw new Error('manifest.json không tìm thấy trong file')

  const manifest = JSON.parse(manifestData.toString('utf8'))
  const name        = manifest.name || path.basename(zipPath, '.zip')
  const gameVersion = manifest.minecraft?.version || ''
  const loaderArr   = manifest.minecraft?.modLoaders || []
  const loaderRaw   = loaderArr[0]?.id || ''
  const iconUrl     = manifest.image || null   // CurseForge avatar URL

  let loader = 'forge', loaderVersion = ''
  if (loaderRaw.startsWith('forge-'))     { loader = 'forge';    loaderVersion = loaderRaw.replace('forge-', '') }
  else if (loaderRaw.startsWith('fabric-'))   { loader = 'fabric';   loaderVersion = loaderRaw.replace('fabric-', '') }
  else if (loaderRaw.startsWith('neoforge-')) { loader = 'neoforge'; loaderVersion = loaderRaw.replace('neoforge-', '') }

  // 2. Download mods
  const mods  = manifest.files || []
  const total = mods.length
  const modsDir = path.join(instancePath, 'mods')
  if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true })

  onProgress?.({ phase: 'mods', log: `Tải ${total} mods...`, done: 0, total, percent: 5 })

  let done = 0
  let skipped = 0

  for (const mod of mods) {
    done++
    const pct = 5 + Math.round((done / total) * 80)

    const url = await getModDownloadUrl(mod.projectID, mod.fileID, apiKey)
    if (!url) {
      skipped++
      onProgress?.({ phase: 'mods', log: `[${done}/${total}] Bỏ qua (không lấy được URL): projectID=${mod.projectID}`, done, total, percent: pct })
      continue
    }

    const fileName = url.split('/').pop().split('?')[0]
    const destPath = path.join(modsDir, decodeURIComponent(fileName))

    if (fs.existsSync(destPath)) {
      onProgress?.({ phase: 'mods', log: `[${done}/${total}] Đã có: ${fileName}`, done, total, percent: pct })
      continue
    }

    onProgress?.({ phase: 'mods', log: `[${done}/${total}] Tải: ${fileName}`, done, total, percent: pct })
    try {
      await downloadFile(url, destPath)
    } catch (err) {
      skipped++
      onProgress?.({ phase: 'mods', log: `[WARN] Lỗi tải ${fileName}: ${err.message}`, done, total, percent: pct })
    }
  }

  // 3. Extract overrides
  onProgress?.({ phase: 'overrides', log: 'Giải nén overrides...', percent: 87 })

  iterZipEntries(buf, (fileName, getData) => {
    if (!fileName.startsWith('overrides/') || fileName.endsWith('/')) return
    const relPath  = fileName.slice('overrides/'.length)
    const destPath = path.join(instancePath, relPath)
    const destDir  = path.dirname(destPath)

    try {
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
      const data = getData()
      if (data) fs.writeFileSync(destPath, data)
    } catch {}
  })

  const msg = skipped > 0
    ? `Import hoàn tất: ${name} (${skipped} mod bỏ qua — cần CurseForge API key)`
    : `Import hoàn tất: ${name}`
  onProgress?.({ phase: 'done', log: msg, percent: 100 })

  return { name, gameVersion, loader, loaderVersion, iconUrl, bgUrl: iconUrl }
}

module.exports = { importCurseForgePack }
