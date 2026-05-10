'use strict'
/**
 * javaManager.cjs
 * Tự động chọn và tải Java runtime phù hợp theo game version.
 *
 * Mapping:
 *   MC ≤ 1.16  → Java 8  (jre-legacy)
 *   MC 1.17-1.20 → Java 17 (java-runtime-gamma)
 *   MC ≥ 1.21  → Java 21 (java-runtime-delta)
 *
 * Tải từ Mojang JRE manifest, giải nén vào <dataDir>/runtimes/<component>/
 */

const https  = require('https')
const http   = require('http')
const fs     = require('fs')
const path   = require('path')
const zlib   = require('zlib')
const { pipeline } = require('stream')
const { promisify } = require('util')
const pipelineAsync = promisify(pipeline)

const JRE_MANIFEST_URL = 'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json'

// ─── Version → Java component mapping ────────────────────────────────────────
function getJavaComponent(gameVersion) {
  const parts = gameVersion.split('.')
  const minor = parseInt(parts[1] || '0', 10)
  const patch = parseInt(parts[2] || '0', 10)

  if (minor <= 16) return 'jre-legacy'          // Java 8
  if (minor <= 20) return 'java-runtime-gamma'  // Java 17
  return 'java-runtime-delta'                   // Java 21
}

function getJavaVersion(component) {
  if (component === 'jre-legacy')        return '8'
  if (component === 'java-runtime-gamma') return '17'
  return '21'
}

// ─── Platform detection ───────────────────────────────────────────────────────
function getMojangPlatform() {
  const arch = process.arch === 'x64' ? 'x64' : 'x86'
  switch (process.platform) {
    case 'win32':  return `windows-${arch}`
    case 'darwin': return process.arch === 'arm64' ? 'mac-os-arm64' : 'mac-os'
    case 'linux':  return `linux${arch === 'x86' ? '-i386' : ''}`
    default:       return 'linux'
  }
}

function getJavaExecutable(javaDir) {
  if (process.platform === 'win32') return path.join(javaDir, 'bin', 'java.exe')
  return path.join(javaDir, 'bin', 'java')
}

// ─── HTTP download helper ─────────────────────────────────────────────────────
function httpsGetRaw(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, { headers: { 'User-Agent': 'VoxelXClient/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGetRaw(res.headers.location).then(resolve).catch(reject)
      }
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error('Invalid JSON')) }
      })
    }).on('error', reject)
  })
}

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const dir = path.dirname(destPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    client.get(url, { headers: { 'User-Agent': 'VoxelXClient/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, destPath, onProgress).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${url}`))

      const total = parseInt(res.headers['content-length'] || '0', 10)
      let downloaded = 0
      const out = fs.createWriteStream(destPath)

      res.on('data', chunk => {
        downloaded += chunk.length
        onProgress?.({ downloaded, total })
      })
      res.pipe(out)
      out.on('finish', resolve)
      out.on('error', reject)
      res.on('error', reject)
    }).on('error', reject)
  })
}

// ─── Giải nén .tar.gz ─────────────────────────────────────────────────────────
async function extractTarGz(tarPath, destDir) {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

  // Dùng tar built-in của Node (child_process) hoặc manual extract
  const { spawn } = require('child_process')
  return new Promise((resolve, reject) => {
    const tar = spawn('tar', ['-xzf', tarPath, '-C', destDir, '--strip-components=1'], {
      stdio: 'pipe',
    })
    tar.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`tar exit code ${code}`))
    })
    tar.on('error', reject)
  })
}

// ─── Giải nén .zip (Windows) ─────────────────────────────────────────────────
async function extractZip(zipPath, destDir) {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

  // Dùng PowerShell trên Windows
  const { spawn } = require('child_process')
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell', [
      '-NoProfile', '-Command',
      `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`,
    ], { stdio: 'pipe' })
    ps.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`PowerShell exit code ${code}`))
    })
    ps.on('error', reject)
  })
}

// ─── Main: ensure Java is available ──────────────────────────────────────────
/**
 * Đảm bảo Java runtime cho gameVersion đã được tải.
 * Trả về đường dẫn đến java executable.
 *
 * @param {string} gameVersion  - e.g. "1.21.4"
 * @param {string} runtimesDir  - thư mục lưu runtimes
 * @param {function} onProgress - callback({ phase, component, javaVersion, downloaded, total, percent })
 */
async function ensureJava(gameVersion, runtimesDir, onProgress) {
  const component   = getJavaComponent(gameVersion)
  const javaVersion = getJavaVersion(component)
  const javaDir     = path.join(runtimesDir, component)
  const javaExe     = getJavaExecutable(javaDir)

  onProgress?.({ phase: 'java_check', component, javaVersion })

  // Đã có rồi
  if (fs.existsSync(javaExe)) {
    onProgress?.({ phase: 'java_ready', component, javaVersion, path: javaExe })
    return javaExe
  }

  onProgress?.({ phase: 'java_fetch_manifest', component, javaVersion })

  // Fetch JRE manifest
  const allManifest = await httpsGetRaw(JRE_MANIFEST_URL)
  const platform    = getMojangPlatform()
  const platformData = allManifest[platform]
  if (!platformData) throw new Error(`Không hỗ trợ platform: ${platform}`)

  const componentData = platformData[component]
  if (!componentData || !componentData.length) {
    throw new Error(`Không tìm thấy Java ${javaVersion} (${component}) cho ${platform}`)
  }

  const manifest = componentData[0].manifest
  onProgress?.({ phase: 'java_fetch_files', component, javaVersion })

  // Fetch file list
  const fileManifest = await httpsGetRaw(manifest.url)
  const files = Object.entries(fileManifest.files)

  // Tải từng file
  let done = 0
  const total = files.length

  for (const [filePath, fileData] of files) {
    if (fileData.type === 'directory') {
      const dir = path.join(javaDir, filePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      done++
      continue
    }

    if (fileData.type !== 'file' || !fileData.downloads?.raw) {
      done++
      continue
    }

    const destPath = path.join(javaDir, filePath)
    const destDir  = path.dirname(destPath)
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

    // Skip nếu đã có và đúng size
    if (fs.existsSync(destPath)) {
      const stat = fs.statSync(destPath)
      if (stat.size === fileData.downloads.raw.size) {
        done++
        onProgress?.({ phase: 'java_download', component, javaVersion, done, total, file: filePath })
        continue
      }
    }

    await downloadFile(fileData.downloads.raw.url, destPath, null)

    // Set executable bit trên Unix
    if (process.platform !== 'win32' && fileData.executable) {
      try { fs.chmodSync(destPath, 0o755) } catch {}
    }

    done++
    onProgress?.({ phase: 'java_download', component, javaVersion, done, total, file: filePath, percent: Math.round(done / total * 100) })
  }

  if (!fs.existsSync(javaExe)) {
    throw new Error(`Java executable không tìm thấy sau khi tải: ${javaExe}`)
  }

  onProgress?.({ phase: 'java_ready', component, javaVersion, path: javaExe })
  return javaExe
}

module.exports = { ensureJava, getJavaComponent, getJavaVersion }
