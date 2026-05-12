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

const https  = require('https')
const http   = require('http')
const fs     = require('fs')
const path   = require('path')
const crypto = require('crypto')

const FABRIC_META = 'https://meta.fabricmc.net'
const FABRIC_MAVEN = 'https://maven.fabricmc.net'

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, { headers: { 'User-Agent': 'VoxelXClient/1.0' } }, (res) => {
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

function mavenToPath(name) {
  const parts = name.split(':')
  if (parts.length < 3) return null
  const [group, artifact, version] = parts
  const groupPath = group.replace(/\./g, '/')
  return `${groupPath}/${artifact}/${version}/${artifact}-${version}.jar`
}

// ─── Main: setup Fabric ───────────────────────────────────────────────────────

async function setupFabric(mcVersion, loaderVersion, librariesDir, onProgress) {

  const profileUrl = `${FABRIC_META}/v2/versions/loader/${encodeURIComponent(mcVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`
  onProgress?.({ log: `Fetching Fabric profile for ${mcVersion} + loader ${loaderVersion}...`, done: 0, total: 0 })

  const fabricProfile = await httpsGetJson(profileUrl)

  const mainClass = fabricProfile.mainClass
  if (!mainClass) throw new Error('Fabric profile missing mainClass')

  const fabricLibs = fabricProfile.libraries || []
  const libPaths = []
  let done = 0
  const total = fabricLibs.length

  for (const lib of fabricLibs) {

    const relPath = mavenToPath(lib.name)
    if (!relPath) { done++; continue }

    const destPath = path.join(librariesDir, relPath)
    libPaths.push(destPath)

    if (!fs.existsSync(destPath)) {

      const baseUrl = (lib.url || FABRIC_MAVEN + '/').replace(/\/$/, '')
      const downloadUrl = `${baseUrl}/${relPath}`

      onProgress?.({ log: `Downloading ${lib.name}...`, done, total })
      await downloadFile(downloadUrl, destPath)
    }

    done++
    onProgress?.({ log: `Fabric libs: ${done}/${total}`, done, total })
  }

  return { mainClass, extraLibraries: libPaths }
}

module.exports = { setupFabric }

