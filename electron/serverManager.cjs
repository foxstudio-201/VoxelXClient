'use strict'
/**
 * serverManager.cjs
 * Manages Minecraft server instances — create, start, stop, console I/O.
 */

const { ipcMain, dialog } = require('electron')
const { app } = require('electron')
const path  = require('path')
const fs    = require('fs')
const https = require('https')
const http  = require('http')
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
// Running playit tunnels: Map<serverId, ChildProcess>
const runningTunnels = new Map()

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
      case 'arclight': {
        // Arclight releases on GitHub
        const releases = await httpsGet(`https://api.github.com/repos/IzzelAliz/Arclight/releases/latest`)
        if (!releases?.assets) return null
        const asset = releases.assets.find(a => a.name.includes(gameVersion) && a.name.endsWith('.jar'))
          || releases.assets.find(a => a.name.endsWith('.jar'))
        return asset?.browser_download_url || null
      }
      case 'magma': {
        // Magma releases on GitHub
        const releases = await httpsGet(`https://api.github.com/repos/magmafoundation/Magma/releases/latest`)
        if (!releases?.assets) return null
        const asset = releases.assets.find(a => a.name.includes(gameVersion) && a.name.endsWith('.jar'))
          || releases.assets.find(a => a.name.endsWith('.jar'))
        return asset?.browser_download_url || null
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
        running:     runningServers.has(s.id),
        status:      runningServers.has(s.id) ? (runningServers.get(s.id).status || 'online') : 'offline',
        playerCount: runningServers.get(s.id)?.playerCount || 0,
        maxPlayers:  runningServers.get(s.id)?.maxPlayers  || 20,
      }))
    }
  })

  // server:create
  ipcMain.handle('server:create', async (e, opts) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const { name, type, gameVersion, ramGb, jvmArgs, cores, javaPath, serverPath, acceptEula, onlineMode, maxPlayers } = opts || {}

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

    // Write server.properties with online-mode and max-players
    const propsPath = path.join(serverDir, 'server.properties')
    if (!fs.existsSync(propsPath)) {
      const onlineModeVal = onlineMode === false ? 'false' : 'true'
      const maxPlayersVal = Math.max(1, Math.min(1000, parseInt(maxPlayers) || 20))
      fs.writeFileSync(propsPath,
        `#Minecraft server properties\n` +
        `online-mode=${onlineModeVal}\n` +
        `max-players=${maxPlayersVal}\n` +
        `server-port=25565\n` +
        `motd=A Minecraft Server\n`
      )
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
      onlineMode: onlineMode !== false,
      maxPlayers: Math.max(1, Math.min(1000, parseInt(maxPlayers) || 20)),
      createdAt:  new Date().toISOString(),
      jarFile:    null,
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

    const entry = { proc, logs: [], status: 'starting', playerCount: 0, maxPlayers: 20 }
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

    function sendPlayerCount() {
      const allWins = require('electron').BrowserWindow.getAllWindows()
      allWins.forEach(w => {
        if (!w.isDestroyed()) w.webContents.send('server:playerCount', {
          serverId,
          playerCount: entry.playerCount || 0,
          maxPlayers:  entry.maxPlayers  || 20,
        })
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
        // Parse player join/leave: "UUID of player xxx is ..." or "xxx joined the game" / "xxx left the game"
        if (line.includes('joined the game')) {
          entry.playerCount = Math.max(0, (entry.playerCount || 0) + 1)
          sendPlayerCount()
        } else if (line.includes('left the game')) {
          entry.playerCount = Math.max(0, (entry.playerCount || 0) - 1)
          sendPlayerCount()
        }
        // Parse "There are X of a max of Y players online"
        const playerMatch = line.match(/There are (\d+) of a max of (\d+) players online/)
        if (playerMatch) {
          entry.playerCount = parseInt(playerMatch[1], 10)
          entry.maxPlayers  = parseInt(playerMatch[2], 10)
          sendPlayerCount()
        }
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
      entry.playerCount = 0
      sendStatus('offline')
      runningServers.delete(serverId)
    })
    proc.on('error', (err) => {
      sendLog(`[Server] Spawn error: ${err.message}`)
      entry.playerCount = 0
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

  // server:getStats — get real-time RAM/CPU usage of running server process
  ipcMain.handle('server:getStats', async (e, serverId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const entry = runningServers.get(serverId)
    if (!entry || !entry.proc?.pid) return { ok: true, running: false }
    try {
      const pidusage = require('pidusage')
      const stats = await pidusage(entry.proc.pid)
      // RSS includes JVM overhead — cap at configured Xmx to avoid showing > 100%
      // Read server config to get ramGb
      const data = readServers()
      const server = data.servers.find(s => s.id === serverId)
      const xmxMb = (server?.ramGb || 2) * 1024
      const rssMb = Math.round(stats.memory / 1024 / 1024)
      // Heap used is typically RSS minus ~200-400MB JVM overhead
      // Cap display at xmxMb so bar never exceeds 100%
      const displayMb = Math.min(rssMb, xmxMb)
      return {
        ok:      true,
        running: true,
        cpu:     Math.min(100, Math.round(stats.cpu * 10) / 10),
        ramMb:   displayMb,
        rssMb,   // raw RSS for tooltip
        xmxMb,
      }
    } catch {
      return { ok: true, running: true, cpu: 0, ramMb: 0 }
    }
  })

  // server:getStatus
  ipcMain.handle('server:getStatus', (e, serverId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const entry = runningServers.get(serverId)
    return { ok: true, running: !!entry, status: entry?.status || 'offline' }
  })

  // server:ping — TCP connect to measure latency
  ipcMain.handle('server:ping', async (e, serverId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }

    // Read port from server.properties
    let port = 25565
    try {
      const propsPath = path.join(server.serverDir, 'server.properties')
      if (fs.existsSync(propsPath)) {
        const content = fs.readFileSync(propsPath, 'utf-8')
        const match = content.match(/^server-port\s*=\s*(\d+)/m)
        if (match) port = parseInt(match[1], 10)
      }
    } catch {}

    return new Promise((resolve) => {
      const net = require('net')
      const start = Date.now()
      const socket = new net.Socket()
      socket.setTimeout(3000)
      socket.connect(port, '127.0.0.1', () => {
        const ms = Date.now() - start
        socket.destroy()
        resolve({ ok: true, ms })
      })
      socket.on('error', () => { socket.destroy(); resolve({ ok: false, ms: null }) })
      socket.on('timeout', () => { socket.destroy(); resolve({ ok: false, ms: null }) })
    })
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

  // server:listDirFull — list both dirs and files in any subpath
  ipcMain.handle('server:listDirFull', (e, serverId, subPath) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }
    const base = server.serverDir
    const target = subPath ? path.join(base, subPath) : base
    if (!target.startsWith(base)) return { error: 'Đường dẫn không hợp lệ' }
    if (!fs.existsSync(target)) return { ok: true, entries: [] }
    try {
      const raw = fs.readdirSync(target, { withFileTypes: true })
      const entries = raw.map(e => {
        const fullPath = path.join(target, e.name)
        const relPath = subPath ? path.join(subPath, e.name) : e.name
        let size = null
        if (e.isFile()) {
          try { size = fs.statSync(fullPath).size } catch {}
        }
        return { name: e.name, path: relPath.replace(/\\/g, '/'), isDir: e.isDirectory(), size }
      })
      const dirs  = entries.filter(e => e.isDir).sort((a, b) => a.name.localeCompare(b.name))
      const files = entries.filter(e => !e.isDir).sort((a, b) => a.name.localeCompare(b.name))
      return { ok: true, entries: [...dirs, ...files] }
    } catch (err) { return { error: err.message } }
  })

  // server:getNetworkInfo — get local IP, public IP, and server port
  ipcMain.handle('server:getNetworkInfo', async (e, serverId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }

    // Get local IP
    const os = require('os')
    let localIp = '127.0.0.1'
    try {
      const ifaces = os.networkInterfaces()
      for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            localIp = iface.address
            break
          }
        }
        if (localIp !== '127.0.0.1') break
      }
    } catch {}

    // Get public IP
    let publicIp = null
    try {
      const body = await new Promise((resolve, reject) => {
        const https = require('https')
        https.get('https://api.ipify.org', { timeout: 5000 }, res => {
          let d = ''
          res.on('data', c => { d += c })
          res.on('end', () => resolve(d.trim()))
        }).on('error', reject).on('timeout', reject)
      })
      publicIp = body
    } catch {}

    // Read port from server.properties
    let port = '25565'
    try {
      const propsPath = path.join(server.serverDir, 'server.properties')
      if (fs.existsSync(propsPath)) {
        const content = fs.readFileSync(propsPath, 'utf-8')
        const match = content.match(/^server-port\s*=\s*(\d+)/m)
        if (match) port = match[1]
      }
    } catch {}

    return { ok: true, localIp, publicIp, port }
  })

  // server:startTunnel — start bore TCP tunnel (no account needed)
  // bore local <port> --to bore.pub
  ipcMain.handle('server:startTunnel', async (e, serverId, port) => {
    const win = getTrustedWindow(e)
    if (!win) return { error: 'Unauthorized' }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }

    const { spawn } = require('child_process')
    const zlib = require('zlib')

    const agentDir = path.join(app.getPath('appData'), '.VoxelXClient', 'bore')
    ensureDir(agentDir)
    const agentExe = path.join(agentDir, process.platform === 'win32' ? 'bore.exe' : 'bore')

    function sendLog(line, extra = {}) {
      if (!win.isDestroyed()) win.webContents.send('server:tunnelLog', { serverId, line, ...extra })
    }

    // Kill existing tunnel
    if (runningTunnels.has(serverId)) {
      try { runningTunnels.get(serverId).kill() } catch {}
      runningTunnels.delete(serverId)
    }

    // Add Windows Defender exclusion for the bore directory before downloading
    if (process.platform === 'win32') {
      try {
        const { execSync } = require('child_process')
        execSync(`powershell -Command "Add-MpPreference -ExclusionPath '${agentDir}'" -ErrorAction SilentlyContinue`, { windowsHide: true, timeout: 5000 })
        sendLog('Đã thêm exclusion Windows Defender cho thư mục bore')
      } catch { /* ignore if no permission */ }
    }

    // Download bore if not present
    if (!fs.existsSync(agentExe)) {
      sendLog('Đang tải bore tunnel...', { status: 'downloading' })
      try {
        // Fetch latest release
        const releaseInfo = await new Promise((resolve, reject) => {
          https.get('https://api.github.com/repos/ekzhang/bore/releases/latest',
            { headers: { 'User-Agent': 'VoxelXClient/1.0', 'Accept': 'application/vnd.github.v3+json' }, timeout: 10000 },
            res => {
              let body = ''
              res.on('data', c => { body += c })
              res.on('end', () => { try { resolve(JSON.parse(body)) } catch { reject(new Error('Invalid JSON')) } })
            }
          ).on('error', reject)
        })

        const platform = process.platform
        const arch = process.arch
        let assetName
        if (platform === 'win32') {
          assetName = 'bore-' + releaseInfo.tag_name + '-x86_64-pc-windows-msvc.zip'
        } else if (platform === 'darwin') {
          assetName = arch === 'arm64'
            ? 'bore-' + releaseInfo.tag_name + '-aarch64-apple-darwin.tar.gz'
            : 'bore-' + releaseInfo.tag_name + '-x86_64-apple-darwin.tar.gz'
        } else {
          assetName = arch === 'arm64'
            ? 'bore-' + releaseInfo.tag_name + '-aarch64-unknown-linux-musl.tar.gz'
            : 'bore-' + releaseInfo.tag_name + '-x86_64-unknown-linux-musl.tar.gz'
        }

        const asset = releaseInfo.assets?.find(a => a.name === assetName)
        if (!asset) throw new Error(`Không tìm thấy: ${assetName}`)

        sendLog(`Tải ${assetName}...`)
        const archivePath = path.join(agentDir, assetName)

        // Download archive
        await new Promise((resolve, reject) => {
          function doGet(url) {
            const client = url.startsWith('https') ? https : require('http')
            client.get(url, { headers: { 'User-Agent': 'VoxelXClient/1.0' } }, res => {
              if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return doGet(res.headers.location)
              if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
              const out = fs.createWriteStream(archivePath)
              res.pipe(out)
              out.on('finish', resolve)
              out.on('error', reject)
            }).on('error', reject)
          }
          doGet(asset.browser_download_url)
        })

        // Extract
        if (assetName.endsWith('.zip')) {
          // Use PowerShell on Windows
          const { execSync } = require('child_process')
          execSync(`powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${agentDir}' -Force"`, { windowsHide: true })
        } else {
          // tar.gz on Linux/Mac
          const { execSync } = require('child_process')
          execSync(`tar -xzf "${archivePath}" -C "${agentDir}"`, { cwd: agentDir })
        }

        // Cleanup archive
        try { fs.unlinkSync(archivePath) } catch {}
        if (process.platform !== 'win32') fs.chmodSync(agentExe, 0o755)

        // Verify file exists (Windows Defender may have deleted it)
        if (!fs.existsSync(agentExe)) {
          sendLog('⚠️ Windows Defender đã xóa bore.exe. Vui lòng thêm exclusion cho thư mục: ' + agentDir, { status: 'error' })
          sendLog('Hướng dẫn: Windows Security → Virus & threat protection → Manage settings → Add or remove exclusions → Add folder: ' + agentDir, {})
          return { error: 'Windows Defender blocked bore.exe. Add exclusion for: ' + agentDir }
        }

        sendLog('Tải xong bore tunnel')
      } catch (err) {
        sendLog(`Lỗi tải bore: ${err.message}`, { status: 'error' })
        return { error: err.message }
      }
    }

    // Start bore: bore local <port> --to bore.pub
    sendLog(`Khởi động tunnel: cổng ${port} → bore.pub...`, { status: 'starting' })

    // Check file exists (may have been deleted by antivirus)
    if (!fs.existsSync(agentExe)) {
      const msg = `bore.exe không tìm thấy tại: ${agentExe}\nCó thể bị Windows Defender xóa. Thêm exclusion cho thư mục: ${agentDir}`
      sendLog(msg, { status: 'error' })
      return { error: msg }
    }

    try {
      const proc = spawn(agentExe, ['local', String(port), '--to', 'bore.pub'], {
        cwd: agentDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      runningTunnels.set(serverId, proc)

      let buf = ''
      const onData = (d) => {
        buf += d.toString()
        const lines = buf.split('\n')
        buf = lines.pop()
        lines.filter(Boolean).forEach(line => {
          sendLog(line)
          // bore outputs: "listening at bore.pub:XXXXX"
          const m = line.match(/bore\.pub:(\d+)/i)
          if (m) {
            const addr = `bore.pub:${m[1]}`
            sendLog('', { status: 'running', addr })
          }
        })
      }

      proc.stdout.on('data', onData)
      proc.stderr.on('data', onData)
      proc.on('close', code => {
        if (buf.trim()) sendLog(buf.trim())
        runningTunnels.delete(serverId)
        sendLog(`Tunnel đã dừng (code ${code})`, { status: 'stopped' })
      })
      proc.on('error', err => sendLog(`Lỗi: ${err.message}`, { status: 'error' }))

      return { ok: true }
    } catch (err) {
      sendLog(`Lỗi khởi động: ${err.message}`, { status: 'error' })
      return { error: err.message }
    }
  })

  // server:stopTunnel — stop bore tunnel
  ipcMain.handle('server:stopTunnel', (e, serverId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const proc = runningTunnels.get(serverId)
    if (proc) {
      try { proc.kill() } catch {}
      runningTunnels.delete(serverId)
    }
    return { ok: true }
  })

  // server:uploadFile — write binary file from base64
  ipcMain.handle('server:uploadFile', (e, serverId, subPath, fileName, base64Data) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (typeof fileName !== 'string' || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return { error: 'Tên file không hợp lệ' }
    }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }
    const base = server.serverDir
    const dir = subPath ? path.join(base, subPath) : base
    if (!dir.startsWith(base)) return { error: 'Đường dẫn không hợp lệ' }
    ensureDir(dir)
    const target = path.join(dir, fileName)
    if (!target.startsWith(base + path.sep)) return { error: 'Đường dẫn không hợp lệ' }
    try {
      const buf = Buffer.from(base64Data, 'base64')
      fs.writeFileSync(target, buf)
      return { ok: true }
    } catch (err) { return { error: err.message } }
  })

  // server:installMod — download a mod/plugin from URL into server's mods/ or plugins/ folder
  ipcMain.handle('server:installMod', async (e, opts) => {
    const win = getTrustedWindow(e)
    if (!win) return { error: 'Unauthorized' }
    const { serverId, url, fileName, subDir } = opts || {}
    if (!serverId || !url || !fileName) return { error: 'Thiếu thông tin' }
    if (typeof fileName !== 'string' || fileName.includes('..')) return { error: 'Tên file không hợp lệ' }
    if (!url.startsWith('https://')) return { error: 'URL không hợp lệ' }

    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }

    const targetDir = path.join(server.serverDir, subDir || 'plugins')
    ensureDir(targetDir)
    const destPath = path.join(targetDir, fileName)

    try {
      await downloadFile(url, destPath, () => {})
      return { ok: true, path: destPath }
    } catch (err) {
      return { error: err.message }
    }
  })

  // server:readServerProps — read server.properties as key-value object
  ipcMain.handle('server:readServerProps', (e, serverId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }
    const propsPath = path.join(server.serverDir, 'server.properties')
    if (!fs.existsSync(propsPath)) return { ok: true, props: {} }
    try {
      const lines = fs.readFileSync(propsPath, 'utf-8').split('\n')
      const props = {}
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq < 0) continue
        props[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
      }
      return { ok: true, props }
    } catch (err) { return { error: err.message } }
  })

  // server:writeServerProps — write/merge key-value pairs into server.properties
  ipcMain.handle('server:writeServerProps', (e, serverId, patch) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }
    const propsPath = path.join(server.serverDir, 'server.properties')
    try {
      let lines = fs.existsSync(propsPath)
        ? fs.readFileSync(propsPath, 'utf-8').split('\n')
        : ['#Minecraft server properties']
      const updated = new Set()
      lines = lines.map(line => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) return line
        const eq = trimmed.indexOf('=')
        if (eq < 0) return line
        const key = trimmed.slice(0, eq).trim()
        if (key in patch) { updated.add(key); return `${key}=${patch[key]}` }
        return line
      })
      // Append keys not yet in file
      for (const [k, v] of Object.entries(patch)) {
        if (!updated.has(k)) lines.push(`${k}=${v}`)
      }
      fs.writeFileSync(propsPath, lines.join('\n'), 'utf-8')
      return { ok: true }
    } catch (err) { return { error: err.message } }
  })

  // server:getWhitelist — read whitelist.json
  ipcMain.handle('server:getWhitelist', (e, serverId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }
    const wlPath = path.join(server.serverDir, 'whitelist.json')
    if (!fs.existsSync(wlPath)) return { ok: true, list: [] }
    try {
      const list = JSON.parse(fs.readFileSync(wlPath, 'utf-8'))
      return { ok: true, list: Array.isArray(list) ? list : [] }
    } catch { return { ok: true, list: [] } }
  })

  // server:addWhitelist — add player to whitelist.json
  ipcMain.handle('server:addWhitelist', (e, serverId, name, uuid) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }
    const wlPath = path.join(server.serverDir, 'whitelist.json')
    let list = []
    if (fs.existsSync(wlPath)) {
      try { list = JSON.parse(fs.readFileSync(wlPath, 'utf-8')) } catch {}
    }
    if (!Array.isArray(list)) list = []
    if (!list.find(p => p.name?.toLowerCase() === name?.toLowerCase())) {
      list.push({ uuid: uuid || '00000000-0000-0000-0000-000000000000', name })
    }
    fs.writeFileSync(wlPath, JSON.stringify(list, null, 2), 'utf-8')
    // If server running, send whitelist reload command
    const entry = runningServers.get(serverId)
    if (entry) { try { entry.proc.stdin.write('whitelist reload\n') } catch {} }
    return { ok: true, list }
  })

  // server:removeWhitelist — remove players from whitelist.json
  ipcMain.handle('server:removeWhitelist', (e, serverId, names) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }
    const wlPath = path.join(server.serverDir, 'whitelist.json')
    let list = []
    if (fs.existsSync(wlPath)) {
      try { list = JSON.parse(fs.readFileSync(wlPath, 'utf-8')) } catch {}
    }
    const nameSet = new Set((names || []).map(n => n.toLowerCase()))
    list = list.filter(p => !nameSet.has(p.name?.toLowerCase()))
    fs.writeFileSync(wlPath, JSON.stringify(list, null, 2), 'utf-8')
    const entry = runningServers.get(serverId)
    if (entry) { try { entry.proc.stdin.write('whitelist reload\n') } catch {} }
    return { ok: true, list }
  })

  // server:getBanlist — read banned-players.json
  ipcMain.handle('server:getBanlist', (e, serverId) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }
    const banPath = path.join(server.serverDir, 'banned-players.json')
    if (!fs.existsSync(banPath)) return { ok: true, list: [] }
    try {
      const list = JSON.parse(fs.readFileSync(banPath, 'utf-8'))
      return { ok: true, list: Array.isArray(list) ? list : [] }
    } catch { return { ok: true, list: [] } }
  })

  // server:unban — remove players from banned-players.json
  ipcMain.handle('server:unban', (e, serverId, names) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }
    const banPath = path.join(server.serverDir, 'banned-players.json')
    let list = []
    if (fs.existsSync(banPath)) {
      try { list = JSON.parse(fs.readFileSync(banPath, 'utf-8')) } catch {}
    }
    const nameSet = new Set((names || []).map(n => n.toLowerCase()))
    list = list.filter(p => !nameSet.has(p.name?.toLowerCase()))
    fs.writeFileSync(banPath, JSON.stringify(list, null, 2), 'utf-8')
    const entry = runningServers.get(serverId)
    if (entry) {
      for (const name of (names || [])) {
        try { entry.proc.stdin.write(`pardon ${name}\n`) } catch {}
      }
    }
    return { ok: true, list }
  })

  // server:updateConfig — update server record (RAM, cores, JVM, javaPath)
  ipcMain.handle('server:updateConfig', (e, serverId, patch) => {
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

  // server:getVersionsForType — list versions supported by a specific server type
  ipcMain.handle('server:getVersionsForType', async (e, serverType) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    try {
      switch (serverType) {
        case 'vanilla': {
          const manifest = await httpsGet('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json')
          const versions = (manifest?.versions || []).filter(v => v.type === 'release').map(v => v.id).slice(0, 40)
          return { ok: true, versions }
        }
        case 'paper': {
          const data = await httpsGet('https://api.papermc.io/v2/projects/paper')
          const versions = (data?.versions || []).reverse()
          return { ok: true, versions }
        }
        case 'purpur': {
          const data = await httpsGet('https://api.purpurmc.org/v2/purpur')
          const versions = (data?.versions || []).reverse()
          return { ok: true, versions }
        }
        case 'folia': {
          const data = await httpsGet('https://api.papermc.io/v2/projects/folia')
          const versions = (data?.versions || []).reverse()
          return { ok: true, versions }
        }
        case 'fabric': {
          const data = await httpsGet('https://meta.fabricmc.net/v2/versions/game')
          const versions = (data || []).filter(v => v.stable).map(v => v.version).slice(0, 30)
          return { ok: true, versions }
        }
        case 'forge': {
          // Parse forge promotions to get supported MC versions
          const data = await httpsGet('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json')
          const promos = data?.promos || {}
          const versions = [...new Set(
            Object.keys(promos)
              .map(k => k.split('-')[0])
              .filter(v => /^\d+\.\d+/.test(v))
          )].sort((a, b) => {
            const pa = a.split('.').map(Number)
            const pb = b.split('.').map(Number)
            for (let i = 0; i < 3; i++) { if ((pb[i]||0) !== (pa[i]||0)) return (pb[i]||0) - (pa[i]||0) }
            return 0
          })
          return { ok: true, versions }
        }
        case 'neoforge': {
          // NeoForge supports 1.20.1+
          const manifest = await httpsGet('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json')
          const all = (manifest?.versions || []).filter(v => v.type === 'release').map(v => v.id)
          const versions = all.filter(v => {
            const parts = v.split('.').map(Number)
            return parts[1] > 20 || (parts[1] === 20 && (parts[2] || 0) >= 1)
          })
          return { ok: true, versions }
        }
        case 'mohist': {
          const data = await httpsGet('https://mohistmc.com/api/v2/projects/mohist')
          const versions = (data?.versions || []).reverse()
          return { ok: true, versions }
        }
        case 'arclight': {
          // Arclight supports 1.16.5 - 1.20.x (Forge+Paper)
          return { ok: true, versions: ['1.20.1', '1.19.4', '1.19.2', '1.18.2', '1.16.5'] }
        }
        case 'magma': {
          // Magma supports specific versions
          return { ok: true, versions: ['1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2'] }
        }
        case 'sponge': {
          // SpongeVanilla supports recent versions
          const manifest = await httpsGet('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json')
          const all = (manifest?.versions || []).filter(v => v.type === 'release').map(v => v.id)
          const versions = all.filter(v => {
            const parts = v.split('.').map(Number)
            return parts[1] >= 16
          }).slice(0, 20)
          return { ok: true, versions }
        }
        default: {
          // Fallback: all release versions
          const manifest = await httpsGet('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json')
          const versions = (manifest?.versions || []).filter(v => v.type === 'release').map(v => v.id).slice(0, 30)
          return { ok: true, versions }
        }
      }
    } catch (err) {
      // Fallback on error
      return { ok: true, versions: ['1.21.4', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2'] }
    }
  })

  // server:readFile — read text file content
  ipcMain.handle('server:readFile', (e, serverId, filePath) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }
    const base = server.serverDir
    const target = path.join(base, filePath)
    if (!target.startsWith(base + path.sep) && target !== base) return { error: 'Đường dẫn không hợp lệ' }
    try {
      const content = fs.readFileSync(target, 'utf-8')
      return { ok: true, content }
    } catch (err) { return { error: err.message } }
  })

  // server:writeFile — write text file content
  ipcMain.handle('server:writeFile', (e, serverId, filePath, content) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (typeof content !== 'string') return { error: 'Nội dung không hợp lệ' }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }
    const base = server.serverDir
    const target = path.join(base, filePath)
    if (!target.startsWith(base + path.sep)) return { error: 'Đường dẫn không hợp lệ' }
    try {
      fs.writeFileSync(target, content, 'utf-8')
      return { ok: true }
    } catch (err) { return { error: err.message } }
  })

  // server:deleteItems — delete files/folders
  ipcMain.handle('server:deleteItems', (e, serverId, itemPaths) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!Array.isArray(itemPaths)) return { error: 'Danh sách không hợp lệ' }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }
    const base = server.serverDir
    const errors = []
    for (const p of itemPaths) {
      const target = path.join(base, p)
      if (!target.startsWith(base + path.sep)) { errors.push(`Đường dẫn không hợp lệ: ${p}`); continue }
      try {
        if (!fs.existsSync(target)) continue
        const stat = fs.statSync(target)
        if (stat.isDirectory()) fs.rmSync(target, { recursive: true, force: true })
        else fs.unlinkSync(target)
      } catch (err) { errors.push(`${p}: ${err.message}`) }
    }
    return errors.length ? { error: errors.join('\n') } : { ok: true }
  })

  // server:compress — zip selected files/folders
  ipcMain.handle('server:compress', async (e, serverId, itemPaths, zipName) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!Array.isArray(itemPaths) || !itemPaths.length) return { error: 'Không có file để nén' }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }
    const base = server.serverDir
    const safeName = (zipName || 'archive.zip').replace(/[^a-zA-Z0-9._\-]/g, '_')
    const zipPath = path.join(base, safeName)
    if (!zipPath.startsWith(base + path.sep)) return { error: 'Đường dẫn không hợp lệ' }

    try {
      const { execSync } = require('child_process')
      // Use PowerShell Compress-Archive on Windows
      const targets = itemPaths.map(p => {
        const t = path.join(base, p)
        if (!t.startsWith(base + path.sep)) throw new Error(`Đường dẫn không hợp lệ: ${p}`)
        return t
      })
      if (process.platform === 'win32') {
        const pathList = targets.map(t => `"${t}"`).join(',')
        execSync(`powershell -Command "Compress-Archive -Path ${pathList} -DestinationPath '${zipPath}' -Force"`, { cwd: base, windowsHide: true })
      } else {
        const relPaths = itemPaths.map(p => `"${p}"`).join(' ')
        execSync(`zip -r "${safeName}" ${relPaths}`, { cwd: base })
      }
      return { ok: true, zipPath }
    } catch (err) { return { error: err.message } }
  })

  // server:extract — unzip a zip file
  ipcMain.handle('server:extract', async (e, serverId, zipFilePath) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readServers()
    const server = data.servers.find(s => s.id === serverId)
    if (!server) return { error: 'Server không tồn tại' }
    const base = server.serverDir
    const target = path.join(base, zipFilePath)
    if (!target.startsWith(base + path.sep)) return { error: 'Đường dẫn không hợp lệ' }
    if (!fs.existsSync(target)) return { error: 'File không tồn tại' }

    try {
      const { execSync } = require('child_process')
      if (process.platform === 'win32') {
        execSync(`powershell -Command "Expand-Archive -Path '${target}' -DestinationPath '${base}' -Force"`, { cwd: base, windowsHide: true })
      } else {
        execSync(`unzip -o "${target}" -d "${base}"`, { cwd: base })
      }
      return { ok: true }
    } catch (err) { return { error: err.message } }
  })
}

module.exports = { registerServerHandlers }
