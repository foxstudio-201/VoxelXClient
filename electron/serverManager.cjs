'use strict'
/**
 * serverManager.cjs
 * Manages Minecraft server instances — create, start, stop, console I/O.
 */

const { ipcMain, dialog } = require('electron')
const path  = require('path')
const fs    = require('fs')
const https = require('https')
const http  = require('http')
const { app } = require('electron')
const { spawn } = require('child_process')

const DATA_DIR    = path.join(app.getPath('appData'), '.VoxelXClient')
const SERVERS_DIR = path.join(DATA_DIR, 'servers')
const SERVERS_FILE = path.join(DATA_DIR, 'servers.json')

// Download URLs for each server type (latest stable)
const SERVER_DOWNLOAD_URLS = {
  vanilla:   (ver) => `https://launchermeta.mojang.com/mc/game/version_manifest_v2.json`,
  paper:     (ver) => `https://api.papermc.io/v2/projects/paper/versions/${ver}/builds`,
  purpur:    (ver) => `https://api.purpurmc.org/v2/purpur/${ver}/latest/download`,
  folia:     (ver) => `https://api.papermc.io/v2/projects/folia/versions/${ver}/builds`,
  fabric:    (ver) => `https://meta.fabricmc.net/v2/versions/loader/${ver}`,
  forge:     (ver) => `https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json`,
  neoforge:  (ver) => `https://maven.neoforged.net/releases/net/neoforged/neoforge/`,
  mohist:    (ver) => `https://mohistmc.com/api/v2/projects/mohist/${ver}/builds`,
  sponge:    (ver) => `https://dl.spongepowered.org/api/v2/downloads/`,
}

// Running server processes: Map<serverId, { proc, logs, status }>
const runningServers = new Map()

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }) }

function readServers() {
  ensureDir(DATA_DIR)
  if (!fs.existsSync(SERVERS_FILE)) {
    fs.writeFileSync(SERVERS_FILE, JSON.stringify({ servers: [] }, null, 2))
  }
  try { return JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf-8')) }
  catch { return { servers: [] } }
}

function writeServers(data) {
  ensureDir(DATA_DIR)
  const tmp = SERVERS_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, SERVERS_FILE)
}

function generateId() {
  return 'srv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { headers: { 'User-Agent': 'VoxelXClient/1.0' }, timeout: 10000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location).then(resolve).catch(reject)
      }
      let body = ''
      res.on('data', c => { body += c })
      res.on('end', () => {
        if (res.statusCode !== 200) return resolve(null)
        try { resolve(JSON.parse(body)) } catch { resolve(null) }
      })
    })
    req.on('error', () => resolve(null))
    req.on('timeout', () => { req.destroy(); resolve(null) })
  })
}

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    function doGet(u) {
      client.get(u, { headers: { 'User-Agent': 'VoxelXClient/1.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doGet(res.headers.location)
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
        const total = parseInt(res.headers['content-length'] || '0', 10)
        let downloaded = 0
        const out = fs.createWriteStream(destPath)
        res.on('data', chunk => {
          downloaded += chunk.length
          onProgress?.({ downloaded, total, percent: total > 0 ? Math.round(downloaded / total * 100) : 0 })
        })
        res.pipe(out)
        out.on('finish', resolve)
        out.on('error', reject)
        res.on('error', reject)
      }).on('error', reject)
    }
    doGet(url)
  })
}

// Resolve actual download URL for each server type
async function resolveServerJarUrl(type, gameVersion) {
  try {
    switch (type) {
      case 'vanilla': {
        const manifest = await httpsGet('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json')
        const ver = manifest?.versions?.find(v => v.id === gameVersion)
        if (!ver) return null
        const verJson = await httpsGet(ver.url)
        return verJson?.downloads?.server?.url || null
      }
      case 'paper': {
        const builds = await httpsGet(`https://api.papermc.io/v2/projects/paper/versions/${gameVersion}/builds`)
        const latest = builds?.builds?.slice(-1)[0]
        if (!latest) return null
        const build = latest.build
        const jar   = latest.downloads?.application?.name
        return `https://api.papermc.io/v2/projects/paper/versions/${gameVersion}/builds/${build}/downloads/${jar}`
      }
      case 'purpur': {
        return `https://api.purpurmc.org/v2/purpur/${gameVersion}/latest/download`
      }
      case 'folia': {
        const builds = await httpsGet(`https://api.papermc.io/v2/projects/folia/versions/${gameVersion}/builds`)
        const latest = builds?.builds?.slice(-1)[0]
        if (!latest) return null
        const build = latest.build
        const jar   = latest.downloads?.application?.name
        return `https://api.papermc.io/v2/projects/folia/versions/${gameVersion}/builds/${build}/downloads/${jar}`
      }
      case 'mohist': {
        const builds = await httpsGet(`https://mohistmc.com/api/v2/projects/mohist/${gameVersion}/builds`)
        const latest = builds?.builds?.slice(-1)[0]
        return latest?.url || null
      }
      default:
        return null
    }
  } catch { return null }
}

function registerServerHandlers(getTrustedWindow) {

  // server:list
  ipcMain.handle('server:list', (e) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readServers()
    // Enrich with running status
    return {
      ok: true,
      servers: data.servers.map(s => ({
        ...s,
        running: runningServers.has(s.id),
        status:  runningServers.has(s.id) ? 'online' : 'offline',
      }))
    }
  })

  // server:create
  ipcMain.handle('server:create', async (e, opts) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const { name, type, gameVersion, ramGb, jvmArgs, cores, javaPath, serverPath, acceptEula } = opts || {}

    if (!name || !type || !gameVersion) return { error: 'Thiếu thông tin bắt buộc' }

    const id = generateId()
    const serverDir = serverPath?.trim()
      ? serverPath.trim()
      : path.join(SERVERS_DIR, id)

    ensureDir(serverDir)

    // Write eula.txt if accepted
    if (acceptEula) {
      fs.writeFileSync(path.join(serverDir, 'eula.txt'), '#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).\neula=true\n')
    }

    const server = {
      id,
      name,
      type,
      gameVersion,
      ramGb:      ramGb      ?? 2,
      jvmArgs:    jvmArgs    || '',
      cores:      cores      ?? 2,
      javaPath:   javaPath   || '',
      serverDir,
      createdAt:  new Date().toISOString(),
      jarFile:    null, // will be set after download
    }

    const data = readServers()
    data.servers.push(server)
    writeServers(data)

    return { ok: true, server }
  })

  // server:delete
  ipcMain.handle('server:delete', (e, serverId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }
    if (runningServers.has(serverId)) return { error: 'Server đang chạy, hãy dừng trước' }

    data.servers = data.servers.filter(s => s.id !== serverId)
    writeServers(data)
    return { ok: true }
  })

  // server:update — update server config
  ipcMain.handle('server:update', (e, serverId, patch) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readServers()
    const idx = data.servers.findIndex(s => s.id === serverId)
    if (idx < 0) return { error: 'Server không tồn tại' }

    const allowed = ['name', 'ramGb', 'jvmArgs', 'cores', 'javaPath']
    for (const k of allowed) {
      if (k in patch) data.servers[idx][k] = patch[k]
    }
    writeServers(data)
    return { ok: true, server: data.servers[idx] }
  })

  // server:downloadJar — download server jar with progress
  ipcMain.handle('server:downloadJar', async (e, serverId) => {
    const win = getTrustedWindow(e)
    if (!win) return { error: 'Unauthorized' }

    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }

    const jarUrl = await resolveServerJarUrl(server.type, server.gameVersion)
    if (!jarUrl) return { error: `Không tìm thấy server jar cho ${server.type} ${server.gameVersion}` }

    const jarName = `${server.type}-${server.gameVersion}.jar`
    const jarPath = path.join(server.serverDir, jarName)

    try {
      await downloadFile(jarUrl, jarPath, (p) => {
        win.webContents.send('server:downloadProgress', { serverId, ...p })
      })

      // Update server record
      const idx = data.servers.findIndex(s => s.id === serverId)
      data.servers[idx].jarFile = jarName
      writeServers(data)

      return { ok: true, jarPath }
    } catch (err) {
      return { error: err.message }
    }
  })

  // server:installJava — install Java distro into server's .jre/ folder (used by JavaManagerModal)
  ipcMain.handle('server:installJava', async (e, pkg, serverId) => {
    const win = getTrustedWindow(e)
    if (!win) return { error: 'Unauthorized' }
    if (!pkg || !pkg.downloadUrl) return { error: 'Thiếu thông tin package' }

    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }

    const jreDir = path.join(server.serverDir, '.jre')
    const javaExe = process.platform === 'win32'
      ? path.join(jreDir, 'bin', 'java.exe')
      : path.join(jreDir, 'bin', 'java')

    // Already installed
    if (fs.existsSync(javaExe)) {
      return { ok: true, javaExe, cached: true }
    }

    try {
      const { installDistro } = require('./launcher/java/javaDistros.cjs')

      // Remove old .jre if exists
      if (fs.existsSync(jreDir)) {
        fs.rmSync(jreDir, { recursive: true, force: true })
      }

      const exe = await installDistro(pkg, jreDir, (p) => {
        win.webContents.send('server:javaProgress', { serverId, ...p })
      })

      // Mark .jre as hidden on Windows
      if (process.platform === 'win32') {
        try { require('child_process').execSync(`attrib +h "${jreDir}"`, { windowsHide: true }) } catch {}
      }

      // Save javaPath to server record
      const idx = data.servers.findIndex(s => s.id === serverId)
      if (idx >= 0) {
        data.servers[idx].javaPath = exe
        writeServers(data)
      }

      return { ok: true, javaExe: exe }
    } catch (err) {
      return { error: err.message }
    }
  })

  // server:downloadJava — download Java into server's .jre/ hidden folder
  ipcMain.handle('server:downloadJava', async (e, serverId) => {
    const win = getTrustedWindow(e)
    if (!win) return { error: 'Unauthorized' }

    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }

    const jreDir = path.join(server.serverDir, '.jre')
    const javaExe = process.platform === 'win32'
      ? path.join(jreDir, 'bin', 'java.exe')
      : path.join(jreDir, 'bin', 'java')

    // Already installed
    if (fs.existsSync(javaExe)) {
      return { ok: true, javaExe, cached: true }
    }

    try {
      const { installDistro } = require('./launcher/java/javaDistros.cjs')

      // Determine best Java version for this MC version
      const mcMinor = parseInt((server.gameVersion || '1.21').split('.')[1] || '21', 10)
      const javaVersion = mcMinor >= 21 ? 21 : mcMinor >= 17 ? 17 : 8

      // Fetch available packages from Adoptium (most reliable)
      const { fetchAllDistros } = require('./launcher/java/javaDistros.cjs')
      win.webContents.send('server:javaProgress', { serverId, phase: 'fetching', percent: 0 })

      const distros = await fetchAllDistros()
      const pkg = distros.adoptium?.find(p => p.javaVersion === javaVersion)
        || distros.azul?.find(p => p.javaVersion === javaVersion)

      if (!pkg) return { error: `Không tìm thấy Java ${javaVersion} để tải` }

      win.webContents.send('server:javaProgress', { serverId, phase: 'downloading', percent: 0 })

      const exe = await installDistro(pkg, jreDir, (p) => {
        win.webContents.send('server:javaProgress', { serverId, ...p })
      })

      // Mark .jre as hidden on Windows
      if (process.platform === 'win32') {
        try { require('child_process').execSync(`attrib +h "${jreDir}"`, { windowsHide: true }) } catch {}
      }

      // Save javaPath to server record
      const idx = data.servers.findIndex(s => s.id === serverId)
      if (idx >= 0) {
        data.servers[idx].javaPath = exe
        writeServers(data)
      }

      win.webContents.send('server:javaProgress', { serverId, phase: 'done', percent: 100 })
      return { ok: true, javaExe: exe }
    } catch (err) {
      return { error: err.message }
    }
  })
  ipcMain.handle('server:start', (e, serverId) => {
    const win = getTrustedWindow(e)
    if (!win) return { error: 'Unauthorized' }
    if (runningServers.has(serverId)) return { error: 'Server đã đang chạy' }

    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }
    if (!server.jarFile) return { error: 'Chưa tải server jar. Hãy tải xuống trước.' }

    const jarPath = path.join(server.serverDir, server.jarFile)
    if (!fs.existsSync(jarPath)) return { error: `Không tìm thấy jar: ${server.jarFile}` }

    // Resolve java executable — priority order:
    // 1. User-specified javaPath
    // 2. Launcher-managed Mojang runtimes (java-runtime-delta for 1.21+, etc.)
    // 3. Custom distro runtimes installed via JavaManager
    // 4. System PATH 'java' (last resort)
    let javaExe = null

    if (server.javaPath && fs.existsSync(server.javaPath)) {
      javaExe = server.javaPath
    } else {
      const runtimesDir = path.join(DATA_DIR, 'runtimes')
      if (fs.existsSync(runtimesDir)) {
        // Prefer Mojang-managed runtimes first (java-runtime-delta = Java 21)
        const preferredOrder = ['java-runtime-delta', 'java-runtime-gamma', 'jre-legacy']
        for (const comp of preferredOrder) {
          const candidate = process.platform === 'win32'
            ? path.join(runtimesDir, comp, 'bin', 'java.exe')
            : path.join(runtimesDir, comp, 'bin', 'java')
          if (fs.existsSync(candidate)) { javaExe = candidate; break }
        }

        // If not found in preferred, scan all subdirs
        if (!javaExe) {
          for (const d of fs.readdirSync(runtimesDir)) {
            if (d.startsWith('.')) continue
            const candidate = process.platform === 'win32'
              ? path.join(runtimesDir, d, 'bin', 'java.exe')
              : path.join(runtimesDir, d, 'bin', 'java')
            if (fs.existsSync(candidate)) { javaExe = candidate; break }
          }
        }
      }
    }

    // Final fallback: system java
    if (!javaExe) javaExe = process.platform === 'win32' ? 'java.exe' : 'java'

    const ramMb = (server.ramGb || 2) * 1024
    const jvmArgs = server.jvmArgs ? server.jvmArgs.split(/\s+/).filter(Boolean) : []

    // Only add default memory flags if jvmArgs doesn't already contain -Xmx
    const hasMemFlags = jvmArgs.some(a => a.startsWith('-Xmx') || a.startsWith('-Xms'))
    const memArgs = hasMemFlags ? [] : [
      `-Xmx${ramMb}m`,
      `-Xms${Math.min(512, ramMb)}m`,
    ]

    const args = [
      ...memArgs,
      ...jvmArgs,
      // Force UTF-8 output on all platforms (especially Windows CP1252)
      '-Dfile.encoding=UTF-8',
      '-Dstdout.encoding=UTF-8',
      '-Dstderr.encoding=UTF-8',
      '-jar', jarPath,
      '--nogui',
    ]

    const proc = spawn(javaExe, args, {
      cwd:   server.serverDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        FORCE_COLOR: '1',
      },
    })

    const entry = { proc, logs: [], status: 'starting' }
    runningServers.set(serverId, entry)

    function sendLog(line) {
      entry.logs.push(line)
      if (entry.logs.length > 5000) entry.logs = entry.logs.slice(-4000)
      const allWins = require('electron').BrowserWindow.getAllWindows()
      allWins.forEach(w => {
        if (!w.isDestroyed()) w.webContents.send('server:log', { serverId, line })
      })
    }

    function sendStatus(status) {
      entry.status = status
      const allWins = require('electron').BrowserWindow.getAllWindows()
      allWins.forEach(w => {
        if (!w.isDestroyed()) w.webContents.send('server:status', { serverId, status })
      })
    }

    // Use StringDecoder to correctly handle multi-byte UTF-8 characters
    // (e.g. Vietnamese diacritics, § sign) that may be split across chunks
    const { StringDecoder } = require('string_decoder')
    const stdoutDecoder = new StringDecoder('utf8')
    const stderrDecoder = new StringDecoder('utf8')
    let stdoutBuf = ''
    let stderrBuf = ''

    proc.stdout.on('data', chunk => {
      stdoutBuf += stdoutDecoder.write(chunk)
      const lines = stdoutBuf.split('\n')
      stdoutBuf = lines.pop() // keep incomplete last line
      lines.filter(Boolean).forEach(line => {
        sendLog(line)
        if (line.includes('Done') && line.includes('For help')) sendStatus('online')
      })
    })
    proc.stdout.on('end', () => {
      const remaining = stdoutDecoder.end()
      if (stdoutBuf + remaining) sendLog(stdoutBuf + remaining)
    })

    proc.stderr.on('data', chunk => {
      stderrBuf += stderrDecoder.write(chunk)
      const lines = stderrBuf.split('\n')
      stderrBuf = lines.pop()
      lines.filter(Boolean).forEach(line => sendLog(line))
    })
    proc.stderr.on('end', () => {
      const remaining = stderrDecoder.end()
      if (stderrBuf + remaining) sendLog(stderrBuf + remaining)
    })
    proc.on('close', (code) => {
      sendLog(`[Server] Process exited with code ${code}`)
      sendStatus('offline')
      runningServers.delete(serverId)
    })
    proc.on('error', (err) => {
      sendLog(`[Server] Spawn error: ${err.message}`)
      sendStatus('offline')
      runningServers.delete(serverId)
    })

    sendStatus('starting')
    sendLog(`[Server] Java: ${javaExe}`)
    sendLog(`[Server] Jar: ${jarPath}`)
    return { ok: true }
  })

  // server:stop
  ipcMain.handle('server:stop', (e, serverId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const entry = runningServers.get(serverId)
    if (!entry) return { error: 'Server không đang chạy' }
    try {
      entry.proc.stdin.write('stop\n')
      setTimeout(() => {
        if (runningServers.has(serverId)) {
          try { entry.proc.kill() } catch {}
        }
      }, 8000)
      return { ok: true }
    } catch (err) {
      return { error: err.message }
    }
  })

  // server:restart
  ipcMain.handle('server:restart', async (e, serverId) => {
    const win = getTrustedWindow(e)
    if (!win) return { error: 'Unauthorized' }
    const entry = runningServers.get(serverId)
    if (entry) {
      try { entry.proc.stdin.write('stop\n') } catch {}
      await new Promise(r => setTimeout(r, 3000))
    }
    return ipcMain.emit('server:start', { sender: win.webContents }, serverId)
  })

  // server:sendCommand
  ipcMain.handle('server:sendCommand', (e, serverId, command) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const entry = runningServers.get(serverId)
    if (!entry) return { error: 'Server không đang chạy' }
    try {
      entry.proc.stdin.write(command + '\n')
      return { ok: true }
    } catch (err) {
      return { error: err.message }
    }
  })

  // server:getLogs — get buffered logs
  ipcMain.handle('server:getLogs', (e, serverId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const entry = runningServers.get(serverId)
    return { ok: true, logs: entry?.logs || [] }
  })

  // server:getStatus
  ipcMain.handle('server:getStatus', (e, serverId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const entry = runningServers.get(serverId)
    return { ok: true, running: !!entry, status: entry?.status || 'offline' }
  })

  // server:listDir — list directories inside server folder
  ipcMain.handle('server:listDir', (e, serverId, subPath) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }

    const base = server.serverDir
    const target = subPath ? path.join(base, subPath) : base

    // Security: must be inside serverDir
    if (!target.startsWith(base)) return { error: 'Đường dẫn không hợp lệ' }
    if (!fs.existsSync(target)) return { ok: true, entries: [] }

    try {
      const entries = fs.readdirSync(target, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => ({
          name: e.name,
          path: path.join(subPath || '', e.name),
          isDir: true,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
      return { ok: true, entries }
    } catch (err) {
      return { error: err.message }
    }
  })

  // server:listFiles — list files at root of server folder
  ipcMain.handle('server:listFiles', (e, serverId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }

    try {
      const entries = fs.readdirSync(server.serverDir, { withFileTypes: true })
        .filter(e => e.isFile())
        .map(e => {
          const stat = fs.statSync(path.join(server.serverDir, e.name))
          return { name: e.name, size: stat.size, mtime: stat.mtimeMs }
        })
        .sort((a, b) => a.name.localeCompare(b.name))
      return { ok: true, entries }
    } catch (err) {
      return { error: err.message }
    }
  })

  // server:openFolder
  ipcMain.handle('server:openFolder', async (e, serverId, subPath) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }

    const { shell } = require('electron')
    const target = subPath ? path.join(server.serverDir, subPath) : server.serverDir
    if (!target.startsWith(server.serverDir)) return { error: 'Đường dẫn không hợp lệ' }
    ensureDir(target)
    await shell.openPath(target)
    return { ok: true }
  })

  // server:browse — pick server directory
  ipcMain.handle('server:browse', async (e) => {
    const win = getTrustedWindow(e)
    if (!win) return { error: 'Unauthorized' }
    const result = await dialog.showOpenDialog(win, {
      title: 'Chọn thư mục server',
      buttonLabel: 'Chọn',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || !result.filePaths.length) return { canceled: true }
    return { ok: true, path: result.filePaths[0] }
  })

  // server:getVersions — list available MC versions for server
  ipcMain.handle('server:getVersions', async (e) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    try {
      const manifest = await httpsGet('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json')
      const releases = (manifest?.versions || [])
        .filter(v => v.type === 'release')
        .map(v => v.id)
        .slice(0, 30)
      return { ok: true, versions: releases }
    } catch {
      return { ok: true, versions: ['1.21.4', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.17.1', '1.16.5'] }
    }
  })
}

module.exports = { registerServerHandlers }
