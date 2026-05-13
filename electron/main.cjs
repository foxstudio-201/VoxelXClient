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

 /**
 * VoxelXClient — Minecraft Launcher
 * Created by FoxStudio. AI-assisted development.
 *
 * Source code : https://github.com/foxstudio-201/VoxelXClient
 * Website     : https://voxxelxclient.vercel.app
 *
 * NOTICE:
 *   - Dành cho mấy cháu cứ thích phỉ báng.
 *   - Launcher sử dụng ai đi kèm trong việc tạo, bản thân người tạo không tự nhận là code toàn bộ do có sự hỗ trợ của ai, vậy nên đừng có mà nói này nói nọ.
 *   - Giỏi giang thì tự code bằng năng lực của mình đi, còn không làm được đừng có kích đểu ảnh hưởng đến người sử dụng.
 *   - Bạn chẳng phải là anh hùng mặc áo choàng đỏ mặc quần xịt như thằng trẻ trâu rồi lên mạng ra vẻ ta đây là người tốt, là anh hùng, là người bảo vệ công lý gì đâu :).
 *   - Vậy nên bớt ảo tưởng đi.
 *   - Nếu có sử dụng hoặc tham khảo code này, hãy ghi công cho FoxStudio.
 *   - Minecraft là một thương hiệu của Mojang Studios / Microsoft. Dự án này không liên kết với Mojang.
 */

const { app, BrowserWindow, ipcMain, nativeImage, Tray, Menu, shell } = require('electron')
const path = require('path')
const fs   = require('fs')
const rpc  = require('./discordRPC.cjs')
const { registerProfileHandlers, registerGroupHandlers, registerProfileContentHandlers, registerJavaDistroHandlers } = require('./profileManager.cjs')
const { registerServerHandlers } = require('./serverManager.cjs')
const { registerLauncherHandlers } = require('./launcher.cjs')
const { loginWithWindow, refreshMinecraftToken } = require('./msAuth.cjs')

const isDev = process.env.NODE_ENV === 'development'

app.setAppUserModelId('com.voxelxclient.launcher')

// ─── Paths ────────────────────────────────────────────────────────────────────

function resolveIconPath() {

  const devPath = path.join(__dirname, '../public/icon.ico')
  if (isDev && fs.existsSync(devPath)) return devPath

  const resourcesIcon = path.join(process.resourcesPath, 'icon.ico')
  if (fs.existsSync(resourcesIcon)) return resourcesIcon

  const exeDir = path.dirname(process.execPath)
  const exeIcon = path.join(exeDir, 'resources', 'icon.ico')
  if (fs.existsSync(exeIcon)) return exeIcon

  return devPath
}

const ICON_PATH     = resolveIconPath()
const ACCOUNTS_DIR  = path.join(app.getPath('appData'), '.VoxelXClient')
const ACCOUNTS_FILE = path.join(ACCOUNTS_DIR, 'accounts.json')

// ─── Trusted origins ──────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = isDev
  ? ['http://localhost:5173']
  : ['file://']

const AVATAR_DOMAINS = [
  'https://crafthead.net',
  'https://mc-heads.net',
  'https://minotar.net',
  'https://crafatar.com',
  'https://textures.minecraft.net',
]

function isTrustedOrigin(url) {
  try {
    const u = new URL(url)
    if (!isDev && u.protocol === 'file:') return true
    if (ALLOWED_ORIGINS.some(o => url.startsWith(o))) return true
    return false
  } catch { return false }
}

// ─── Input validation ─────────────────────────────────────────────────────────
const USERNAME_RE = /^[a-zA-Z0-9_]{3,16}$/

function validateAccount(account) {
  if (!account || typeof account !== 'object') return 'Dữ liệu không hợp lệ'
  if (!['offline', 'microsoft'].includes(account.type)) return 'Loại tài khoản không hợp lệ'
  if (typeof account.username !== 'string') return 'Username không hợp lệ'
  if (!USERNAME_RE.test(account.username)) return 'Username chỉ được chứa chữ, số và _ (3-16 ký tự)'
  if (typeof account.uuid !== 'string' || !/^[0-9a-f-]{36}$/.test(account.uuid)) return 'UUID không hợp lệ'
  return null
}

function sanitizeAccount(account) {
  const base = {
    id:        account.id,
    uuid:      account.uuid,
    type:      account.type,
    username:  account.username,
    createdAt: account.createdAt,
  }
  if (account.type === 'microsoft') {
    base.msRefreshToken = account.msRefreshToken || null
    base.mcToken        = account.mcToken        || null
    base.mcTokenExpiry  = account.mcTokenExpiry  || 0
  }
  return base
}

function validateId(id) {
  return typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id)
}

// ─── Accounts helpers ─────────────────────────────────────────────────────────
function ensureAccountsFile() {
  if (!fs.existsSync(ACCOUNTS_DIR)) fs.mkdirSync(ACCOUNTS_DIR, { recursive: true })
  if (!fs.existsSync(ACCOUNTS_FILE))
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify({ accounts: [], selectedId: null }, null, 2), { mode: 0o600 })
}
function readAccounts() {
  ensureAccountsFile()
  try { return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8')) }
  catch { return { accounts: [], selectedId: null } }
}
function writeAccounts(data) {
  ensureAccountsFile()
  const tmp = ACCOUNTS_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 })
  fs.renameSync(tmp, ACCOUNTS_FILE)
}

// ─── Settings file ────────────────────────────────────────────────────────────
const SETTINGS_FILE = path.join(ACCOUNTS_DIR, 'settings.json')

const DEFAULT_SETTINGS = {
  autoCheckUpdate:      true,
  hideLauncherOnLaunch: true,
  showLogWindow:        true,
  discordRPC:           false,
  fontId:               'system',
  colorAccent:          '#4ade80',
  colorHover:           '#86efac',
  colorActive:          '#22c55e',
  background:           'dark',
  borderRadius:         12,
  borderColor:          'rgba(255,255,255,0.08)',
  agreedTos:            false,
  agreedPrivacy:        false,
}

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS)

function sanitizeSettings(input = {}) {
  const safe = { ...DEFAULT_SETTINGS }
  if (!input || typeof input !== 'object') return safe

  for (const key of SETTING_KEYS) {
    if (key in input) safe[key] = input[key]
  }

  return safe
}

function readSettings() {
  ensureAccountsFile()
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return sanitizeSettings()
    return sanitizeSettings(JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')))
  } catch { return sanitizeSettings() }
}

function writeSettings(data) {
  ensureAccountsFile()
  const tmp = SETTINGS_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(sanitizeSettings(data), null, 2), { mode: 0o600 })
  fs.renameSync(tmp, SETTINGS_FILE)
}

// ─── Globals ──────────────────────────────────────────────────────────────────
let mainWindow   = null
let updateWindow = null
let tray         = null

// ─── Secure window options (shared) ──────────────────────────────────────────
function secureWebPrefs() {
  return {
    preload:                     path.join(__dirname, 'preload.cjs'),
    contextIsolation:            true,
    nodeIntegration:             false,
    nodeIntegrationInWorker:     false,
    nodeIntegrationInSubFrames:  false,

    webSecurity:                 true,
    allowRunningInsecureContent: false,
    experimentalFeatures:        false,
  }
}

// ─── Main window ──────────────────────────────────────────────────────────────
function createMainWindow() {
  const icon = fs.existsSync(ICON_PATH) ? nativeImage.createFromPath(ICON_PATH) : undefined

  mainWindow = new BrowserWindow({
    width: 1280, height: 720,
    minWidth: 1024, minHeight: 600,
    frame: false, transparent: false,
    backgroundColor: '#0f0f0f',
    title: 'VoxelXClient',
    icon,
    webPreferences: secureWebPrefs(),
  })

  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!isTrustedOrigin(url)) {
      e.preventDefault()
      shell.openExternal(url)
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedOrigin(url)) return { action: 'allow' }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!isDev) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools()
    })
  }

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); mainWindow.hide() }
  })
  mainWindow.on('closed', () => { mainWindow = null })
}

// ─── Update window ────────────────────────────────────────────────────────────
function createUpdateWindow() {
  if (updateWindow && !updateWindow.isDestroyed()) { updateWindow.focus(); return }

  const icon = fs.existsSync(ICON_PATH) ? nativeImage.createFromPath(ICON_PATH) : undefined

  updateWindow = new BrowserWindow({
    width: 480, height: 620,
    resizable: false, frame: false,
    backgroundColor: '#0f0f0f',
    title: 'VoxelXClient – Check for Updates',
    icon,
    modal:       false,
    skipTaskbar: false,
    webPreferences: secureWebPrefs(),
  })

  updateWindow.webContents.on('will-navigate', (e, url) => {
    if (!isTrustedOrigin(url)) { e.preventDefault(); shell.openExternal(url) }
  })
  updateWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url); return { action: 'deny' }
  })

  if (!isDev) {
    updateWindow.webContents.on('devtools-opened', () => {
      updateWindow.webContents.closeDevTools()
    })
  }

  if (isDev) {
    updateWindow.loadURL('http://localhost:5173/?window=update')
  } else {
    updateWindow.loadFile(path.join(__dirname, '../dist/index.html'), { query: { window: 'update' } })
  }

  updateWindow.on('closed', () => { updateWindow = null })
}

// ─── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  try {
    let trayIcon
    if (fs.existsSync(ICON_PATH)) {
      trayIcon = nativeImage.createFromPath(ICON_PATH).resize({ width: 16, height: 16 })
    } else {

      trayIcon = nativeImage.createEmpty()
    }

    tray = new Tray(trayIcon)
    tray.setToolTip('VoxelXClient')

    const openMainWindow = () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        createMainWindow()
        return
      }
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }

    const menuIcon = fs.existsSync(ICON_PATH)
      ? nativeImage.createFromPath(ICON_PATH).resize({ width: 16, height: 16 })
      : undefined

    const trayMenu = Menu.buildFromTemplate([
      {
        label: 'VoxelXClient', enabled: false,
        ...(menuIcon ? { icon: menuIcon } : {}),
      },
      { type: 'separator' },
      {
        label: 'Mở VoxelXClient',
        click: () => openMainWindow(),
      },
      {
        label: 'Kiểm tra cập nhật...',
        click: () => { createUpdateWindow() },
      },
      { type: 'separator' },
      {
        label: 'Thoát',
        click: () => { app.isQuitting = true; app.quit() },
      },
    ])

    tray.on('click', () => {
      openMainWindow()
    })

    tray.on('double-click', () => {
      openMainWindow()
    })

    tray.on('right-click', () => {
      tray.popUpContextMenu(trayMenu)
    })
  } catch (err) {
    console.error('[Tray] Failed to create tray:', err.message)
  }
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {

  try {
    const os = require('os')
    const updateDir = path.join(os.tmpdir(), 'VoxelXClient-update')
    if (fs.existsSync(updateDir)) {
      const files = fs.readdirSync(updateDir)
      for (const f of files) {
        if (f.endsWith('.exe') || f.endsWith('.AppImage') || f.endsWith('.deb')) {
          try { fs.unlinkSync(path.join(updateDir, f)) } catch {}
        }
      }
    }
  } catch {}
  const { session } = require('electron')
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const url = details.url || ''
    if (
      url.includes('login.live.com') ||
      url.includes('login.microsoftonline.com') ||
      url.includes('microsoft.com') ||
      url.includes('xbox.com') ||
      url.includes('youtube.com') ||
      url.includes('youtube-nocookie.com') ||
      url.includes('googlevideo.com') ||
      url.includes('ytimg.com')
    ) {
      return callback({ responseHeaders: details.responseHeaders })
    }

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' http://localhost:5173 ws://localhost:5173;" +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173;" +
          "worker-src 'self' blob:;" +
          "font-src 'self' data:;" +
          "img-src 'self' data: blob: https:;" +
          "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://youtube-nocookie.com https://youtube.com;" +
          "connect-src 'self' blob: http://localhost:5173 ws://localhost:5173 https://minotar.net https://crafthead.net https://mc-heads.net https://meta.fabricmc.net https://maven.fabricmc.net https://api.modrinth.com https://cdn.modrinth.com https://maven.minecraftforge.net https://files.minecraftforge.net https://repo1.maven.org https://maven.neoforged.net https://api.foxstudio.site https://api.github.com https://github.com;"
        ],
      },
    })
  })

  createMainWindow()
  createTray()
  const initSettings = readSettings()
  if (initSettings.discordRPC) rpc.connect()

  app.on('activate', () => {
    if (!mainWindow) createMainWindow(); else mainWindow.show()
  })
})

app.on('window-all-closed', () => {  })
app.on('before-quit', () => { app.isQuitting = true })

// ─── Window controls IPC ──────────────────────────────────────────────────────
function getTrustedWindow(event) {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return null
  const url = event.sender.getURL()
  if (!isTrustedOrigin(url)) return null
  return win
}

ipcMain.on('window-minimize', (e) => getTrustedWindow(e)?.minimize())
ipcMain.on('window-maximize', (e) => {
  const win = getTrustedWindow(e)
  if (!win) return
  win.isMaximized() ? win.unmaximize() : win.maximize()
})
ipcMain.on('window-close', (e) => {
  const win = getTrustedWindow(e)
  if (!win) return
  if (win === updateWindow) win.close()
  else win.hide()
})

// ─── Updater IPC ──────────────────────────────────────────────────────────────
const GITHUB_REPO = 'foxstudio-201/VoxelXClient'

ipcMain.handle('updater:openUpdateWindow', (e, checkResult) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }

  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide()

  createUpdateWindow()

  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.webContents.once('did-finish-load', () => {
      if (!updateWindow.isDestroyed()) {
        updateWindow.webContents.send('updater:preloadResult', checkResult)
      }
    })

    if (updateWindow.webContents.getURL() !== '') {
      setTimeout(() => {
        if (updateWindow && !updateWindow.isDestroyed()) {
          updateWindow.webContents.send('updater:preloadResult', checkResult)
        }
      }, 300)
    }
  }
  return { ok: true }
})

ipcMain.handle('updater:check', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }

  const currentVersion = app.getVersion()

  try {
    const https = require('https')

    const data = await new Promise((resolve, reject) => {
      const req = https.get(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        {
          headers: {
            'User-Agent': 'VoxelXClient/' + currentVersion,
            'Accept': 'application/vnd.github+json',
          },
          timeout: 8000,
        },
        (res) => {
          let body = ''
          res.on('data', c => { body += c })
          res.on('end', () => {

            if (res.statusCode === 404) {
              resolve(null)
              return
            }
            if (res.statusCode !== 200) {
              reject(new Error(`GitHub API returned HTTP ${res.statusCode}`))
              return
            }
            try { resolve(JSON.parse(body)) }
            catch { reject(new Error('Invalid JSON from GitHub API')) }
          })
        }
      )
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
    })

    if (!data) {
      return {
        hasUpdate:      false,
        currentVersion,
        latestVersion:  currentVersion,
        message:        'Chưa có bản phát hành nào trên GitHub.',
        releaseUrl:     `https://github.com/${GITHUB_REPO}/releases`,
        noRelease:      true,
      }
    }

    const latestVersion = (data.tag_name || '').replace(/^v/, '')
    const hasUpdate = latestVersion && latestVersion !== currentVersion
      && compareVersions(latestVersion, currentVersion) > 0

    const assets = (data.assets || []).map(a => ({
      name:        a.name,
      downloadUrl: a.browser_download_url,
      size:        a.size,
    }))

    let installerAsset = null
    if (process.platform === 'win32') {

      const exePath = process.execPath || ''
      const isInstalled = /program files/i.test(exePath) || /appdata/i.test(exePath)
      if (isInstalled) {

        installerAsset = assets.find(a => /setup/i.test(a.name) && /\.exe$/i.test(a.name))
      }

    } else if (process.platform === 'darwin') {
      installerAsset = assets.find(a => /\.dmg$/i.test(a.name))
    } else {
      installerAsset = assets.find(a => /\.AppImage$/i.test(a.name))
        || assets.find(a => /\.deb$/i.test(a.name))
    }

    return {
      hasUpdate,
      currentVersion,
      latestVersion:  latestVersion || currentVersion,
      releaseName:    data.name || latestVersion,
      releaseNotes:   data.body || '',
      releaseUrl:     data.html_url || `https://github.com/${GITHUB_REPO}/releases`,
      publishedAt:    data.published_at || null,
      installerAsset,
      assets,
      message: hasUpdate
        ? `Phiên bản mới ${latestVersion} đã có sẵn!`
        : 'Bạn đang dùng phiên bản mới nhất.',
    }
  } catch (err) {
    return {
      error:          true,
      currentVersion,
      message:        `Không thể kiểm tra cập nhật: ${err.message}`,
    }
  }
})

ipcMain.handle('updater:download', async (e, { downloadUrl, fileName }) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  if (typeof downloadUrl !== 'string' || !downloadUrl.startsWith('https://')) {
    return { error: 'Invalid download URL' }
  }

  const win = getTrustedWindow(e)
  const https = require('https')
  const os    = require('os')
  const tmpDir  = path.join(os.tmpdir(), 'VoxelXClient-update')
  const tmpFile = path.join(tmpDir, fileName || 'VoxelXClient-update.exe')

  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

  if (fs.existsSync(tmpFile)) {
    const stat = fs.statSync(tmpFile)
    if (stat.size > 1024 * 1024) {
      if (!win.isDestroyed()) {
        win.webContents.send('updater:downloadProgress', { downloaded: stat.size, total: stat.size, percent: 100, speed: 0 })
      }
      return { ok: true, filePath: tmpFile, cached: true }
    }

    try { fs.unlinkSync(tmpFile) } catch {}
  }

  try {
    await new Promise((resolve, reject) => {
      function doGet(url) {
        https.get(url, { headers: { 'User-Agent': 'VoxelXClient/' + app.getVersion() } }, (res) => {

          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return doGet(res.headers.location)
          }
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))

          const total = parseInt(res.headers['content-length'] || '0', 10)
          let downloaded = 0
          const startTime = Date.now()
          const out = fs.createWriteStream(tmpFile)

          res.on('data', chunk => {
            downloaded += chunk.length
            const elapsed = (Date.now() - startTime) / 1000
            const speed   = elapsed > 0 ? Math.round(downloaded / elapsed) : 0
            const percent = total > 0 ? Math.round(downloaded / total * 100) : 0
            if (!win.isDestroyed()) {
              win.webContents.send('updater:downloadProgress', { downloaded, total, percent, speed })
            }
          })
          res.pipe(out)
          out.on('finish', resolve)
          out.on('error', reject)
          res.on('error', reject)
        }).on('error', reject)
      }
      doGet(downloadUrl)
    })

    return { ok: true, filePath: tmpFile }
  } catch (err) {

    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile) } catch {}
    return { error: err.message }
  }
})

ipcMain.handle('updater:install', async (e, { filePath }) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  if (typeof filePath !== 'string') return { error: 'Invalid file path' }
  if (!fs.existsSync(filePath)) return { error: 'Installer file not found' }

  const os = require('os')
  const tmpDir = path.join(os.tmpdir(), 'VoxelXClient-update')
  if (!filePath.startsWith(tmpDir)) return { error: 'Invalid installer path' }

  try {
    const { spawn } = require('child_process')

    await new Promise(r => setTimeout(r, 1500))

    if (process.platform === 'win32') {

      spawn(filePath, [], {
        detached: true,
        stdio:    'ignore',
      }).unref()
    } else if (process.platform === 'darwin') {
      spawn('open', [filePath], { detached: true, stdio: 'ignore' }).unref()
    } else {

      fs.chmodSync(filePath, 0o755)
      spawn(filePath, [], { detached: true, stdio: 'ignore' }).unref()
    }

    setTimeout(() => {
      try { fs.unlinkSync(filePath) } catch {}
      app.isQuitting = true
      app.quit()
    }, 500)
    return { ok: true }
  } catch (err) {
    return { error: err.message }
  }
})

function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

function fetchGitHubReleaseByTag(repo, tag, currentVersion) {
  const https = require('https')
  return new Promise((resolve, reject) => {
    const req = https.get(
      `https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`,
      {
        headers: {
          'User-Agent': 'VoxelXClient/' + currentVersion,
          'Accept': 'application/vnd.github+json',
        },
        timeout: 8000,
      },
      (res) => {
        let body = ''
        res.on('data', c => { body += c })
        res.on('end', () => {
          if (res.statusCode === 404) {
            resolve(null)
            return
          }
          if (res.statusCode !== 200) {
            reject(new Error(`GitHub API returned HTTP ${res.statusCode}`))
            return
          }
          try { resolve(JSON.parse(body)) }
          catch { reject(new Error('Invalid JSON from GitHub API')) }
        })
      }
    )
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
  })
}

ipcMain.handle('patchnotes:getCurrentVersion', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }

  const currentVersion = app.getVersion()

  try {
    const release =
      await fetchGitHubReleaseByTag(GITHUB_REPO, `v${currentVersion}`, currentVersion) ||
      await fetchGitHubReleaseByTag(GITHUB_REPO, currentVersion, currentVersion)

    if (!release) {
      return {
        ok: false,
        currentVersion,
        message: 'Không tìm thấy patch note cho phiên bản hiện tại.',
      }
    }

    return {
      ok: true,
      currentVersion,
      version: (release.tag_name || currentVersion).replace(/^v/, ''),
      title: release.name || `VoxelXClient ${currentVersion}`,
      body: release.body || '',
      htmlUrl: release.html_url || `https://github.com/${GITHUB_REPO}/releases`,
      publishedAt: release.published_at || null,
    }
  } catch (err) {
    return {
      ok: false,
      currentVersion,
      message: `Không thể tải patch note: ${err.message}`,
    }
  }
})

ipcMain.handle('app:version', (e) => {
  if (!getTrustedWindow(e)) return null
  return app.getVersion()
})

// ─── Account IPC ──────────────────────────────────────────────────────────────
ipcMain.handle('accounts:get', (e) => {
  if (!getTrustedWindow(e)) return { accounts: [], selectedId: null }
  return readAccounts()
})

// ─── Account ADD ──────────────────────────────────────────────────────────────
ipcMain.handle('accounts:add', (e, account) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }

  const err = validateAccount(account)
  if (err) return { error: err }

  const data = readAccounts()
  const exists = data.accounts.find(
    a => a.username === account.username && a.type === account.type
  )
  if (exists) return { error: 'Tài khoản đã tồn tại' }

  const safe = sanitizeAccount(account)
  data.accounts.push(safe)
  if (!data.selectedId) data.selectedId = safe.id
  writeAccounts(data)
  return { ok: true, data }
})

// ─── Account REMOVE ──────────────────────────────────────────────────────────────
ipcMain.handle('accounts:remove', (e, id) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  if (!validateId(id)) return { error: 'ID không hợp lệ' }

  const data = readAccounts()
  data.accounts = data.accounts.filter(a => a.id !== id)
  if (data.selectedId === id) data.selectedId = data.accounts[0]?.id ?? null
  writeAccounts(data)
  return { ok: true, data }
})

ipcMain.handle('accounts:select', (e, id) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  if (!validateId(id)) return { error: 'ID không hợp lệ' }

  const data = readAccounts()
  if (!data.accounts.find(a => a.id === id)) return { error: 'Tài khoản không tồn tại' }
  data.selectedId = id
  writeAccounts(data)
  return { ok: true, data }
})

// ─── Microsoft Auth IPC ───────────────────────────────────────────────────────
ipcMain.handle('ms:startLogin', async (e) => {
  const win = getTrustedWindow(e)
  if (!win) return { error: 'Unauthorized' }

  try {
    const result = await loginWithWindow(win)
    const data = readAccounts()
    const exists = data.accounts.find(a => a.uuid === result.uuid)
    if (exists) {
      const idx = data.accounts.indexOf(exists)
      data.accounts[idx] = sanitizeAccount({
        ...exists,
        username:       result.username,
        msRefreshToken: result.msRefreshToken,
        mcToken:        result.mcToken,
        mcTokenExpiry:  result.mcTokenExpiry,
      })
      writeAccounts(data)
      return { ok: true, updated: true, account: data.accounts[idx], data }
    }

    const id  = require('crypto').randomUUID()
    const now = new Date().toISOString()
    const account = sanitizeAccount({
      id,
      uuid:           result.uuid,
      type:           'microsoft',
      username:       result.username,
      createdAt:      now,
      msRefreshToken: result.msRefreshToken,
      mcToken:        result.mcToken,
      mcTokenExpiry:  result.mcTokenExpiry,
    })
    data.accounts.push(account)
    if (!data.selectedId) data.selectedId = id
    writeAccounts(data)
    return { ok: true, account, data }

  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('ms:cancelLogin', (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  return { ok: true }
})

// ─── Auto-refresh ──────────────────────────────────────────────────────────────
ipcMain.handle('ms:refreshToken', async (e, id) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  if (!validateId(id)) return { error: 'ID không hợp lệ' }

  const data = readAccounts()
  const account = data.accounts.find(a => a.id === id)
  if (!account) return { error: 'Tài khoản không tồn tại' }
  if (account.type !== 'microsoft') return { error: 'Không phải tài khoản Microsoft' }
  if (!account.msRefreshToken) return { error: 'Không có refresh token' }
  const fiveMin = 5 * 60 * 1000
  if (account.mcTokenExpiry && account.mcTokenExpiry - Date.now() > fiveMin) {
    return { ok: true, skipped: true, mcToken: account.mcToken }
  }

  try {
    const result = await refreshMinecraftToken(account.msRefreshToken)
    const idx = data.accounts.indexOf(account)
    data.accounts[idx] = sanitizeAccount({
      ...account,
      username:       result.username,
      msRefreshToken: result.msRefreshToken,
      mcToken:        result.mcToken,
      mcTokenExpiry:  result.mcTokenExpiry,
    })
    writeAccounts(data)
    return { ok: true, mcToken: result.mcToken, account: data.accounts[idx] }
  } catch (err) {
    return { error: err.message }
  }
})

// ─── Shell IPC ────────────────────────────────────────────────────────────────
ipcMain.handle('shell:openExternal', (e, url) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return { error: 'Chỉ cho phép HTTPS' }
    shell.openExternal(url)
    return { ok: true }
  } catch { return { error: 'URL không hợp lệ' } }
})

// ─── Profile IPC ──────────────────────────────────────────────────────────────
registerProfileHandlers(getTrustedWindow)
registerGroupHandlers(getTrustedWindow)
registerProfileContentHandlers(getTrustedWindow)
registerJavaDistroHandlers(getTrustedWindow)
registerServerHandlers(getTrustedWindow)

// ─── Launcher IPC ─────────────────────────────────────────────────────────────
registerLauncherHandlers(getTrustedWindow)

// ─── Fabric Meta API IPC ──────────────────────────────────────────────────────
ipcMain.handle('fabric:getLoaderVersions', async (e, gameVersion) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  if (typeof gameVersion !== 'string' || !/^[a-zA-Z0-9._+\-]+$/.test(gameVersion)) {
    return { error: 'Invalid game version' }
  }
  try {
    const https = require('https')
    const url = `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(gameVersion)}`
    const data = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'VoxelXClient/1.0' } }, (res) => {
        let body = ''
        res.on('data', chunk => { body += chunk })
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
          try { resolve(JSON.parse(body)) } catch { reject(new Error('Invalid JSON')) }
        })
      }).on('error', reject)
    })
    return { ok: true, data: data.map(item => ({ version: item.loader.version, stable: item.loader.stable })) }
  } catch (err) {
    return { error: err.message }
  }
})

// ─── Minecraft Version Manifest IPC ──────────────────────────────────────────
ipcMain.handle('minecraft:listVersions', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const { listVersions } = require('./launcher/vanilla/versionResolver.cjs')
    const versions = await listVersions()
    return { ok: true, data: versions }
  } catch (err) {
    return { error: err.message }
  }
})

// ─── Modpack Browse & Read Meta IPC ──────────────────────────────────────────
ipcMain.handle('modpack:browse', async (e) => {
  const win = getTrustedWindow(e)
  if (!win) return { error: 'Unauthorized' }

  const { dialog } = require('electron')
  const result = await dialog.showOpenDialog(win, {
    title:       'Chọn file modpack',    buttonLabel: 'Chọn',
    filters: [
      { name: 'Modpack', extensions: ['zip', 'mrpack'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })

  if (result.canceled || !result.filePaths.length) return { canceled: true }
  const filePath = result.filePaths[0]
  const name = require('path').basename(filePath)
  return { ok: true, filePath, name }
})

ipcMain.handle('modpack:readMeta', async (e, filePath) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  if (typeof filePath !== 'string') return { error: 'Invalid path' }

  const fs   = require('fs')
  const path = require('path')
  const zlib = require('zlib')

  if (!fs.existsSync(filePath)) return { error: 'File không tồn tại' }

  try {
    const buf = fs.readFileSync(filePath)
    function readZipEntry(name) {
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
    }

    const baseName = path.basename(filePath).replace(/\.(zip|mrpack)$/i, '')
    let name = baseName, gameVersion = '', loader = '', loaderVersion = ''
    let iconBase64 = null
    let iconUrl    = null

    const manifestData = readZipEntry('manifest.json')
    if (manifestData) {
      const manifest = JSON.parse(manifestData.toString('utf8'))
      name        = manifest.name || baseName
      gameVersion = manifest.minecraft?.version || ''
      const loaderRaw = (manifest.minecraft?.modLoaders || [])[0]?.id || ''
      if (loaderRaw.startsWith('neoforge-'))    { loader = 'neoforge'; loaderVersion = loaderRaw.replace('neoforge-', '') }
      else if (loaderRaw.startsWith('forge-'))  { loader = 'forge';    loaderVersion = loaderRaw.replace('forge-', '') }
      else if (loaderRaw.startsWith('fabric-')) { loader = 'fabric';   loaderVersion = loaderRaw.replace('fabric-', '') }
      else { loader = 'forge'; loaderVersion = loaderRaw }
      if (manifest.image) iconUrl = manifest.image    }

    const mrData = readZipEntry('modrinth.index.json')
    if (mrData) {
      const mr = JSON.parse(mrData.toString('utf8'))
      name        = mr.name || baseName
      gameVersion = mr.dependencies?.minecraft || ''
      if (mr.dependencies?.['fabric-loader'])   { loader = 'fabric';   loaderVersion = mr.dependencies['fabric-loader'] }
      else if (mr.dependencies?.['neoforge'])   { loader = 'neoforge'; loaderVersion = mr.dependencies['neoforge'] }
      else if (mr.dependencies?.['forge'])      { loader = 'forge';    loaderVersion = mr.dependencies['forge'] }
      else if (mr.dependencies?.['quilt-loader']){ loader = 'quilt';   loaderVersion = mr.dependencies['quilt-loader'] }
    }
    for (const iconName of ['icon.png', 'pack.png']) {
      const iconData = readZipEntry(iconName)
      if (iconData) {
        iconBase64 = 'data:image/png;base64,' + iconData.toString('base64')
        break
      }
    }

    return { ok: true, name, gameVersion, loader, loaderVersion, iconBase64, iconUrl, filePath }
  } catch (err) {
    return { error: err.message }
  }
})

// ─── Modpack Import IPC ───────────────────────────────────────────────────────
ipcMain.handle('profiles:importModpack', async (e, { filePath, source, profileId }) => {
  const win = getTrustedWindow(e)
  if (!win) return { error: 'Unauthorized' }

  const path = require('path')
  const fs   = require('fs')

  if (!filePath || !fs.existsSync(filePath)) return { error: 'File không tồn tại' }
  if (!['curseforge', 'modrinth'].includes(source)) return { error: 'Source không hợp lệ' }

  const PROFILES_FILE_IMPORT = require('path').join(DATA_DIR_IMPORT, 'profiles.json')
  let profilesData
  try { profilesData = JSON.parse(fs.readFileSync(PROFILES_FILE_IMPORT, 'utf-8')) }
  catch { profilesData = { profiles: [] } }
  const profile = profilesData.profiles.find(p => p.id === profileId)
  if (!profile) return { error: 'Profile không tồn tại' }

  const instancePath = profile.instancePath
  if (!fs.existsSync(instancePath)) fs.mkdirSync(instancePath, { recursive: true })

  function sendProgress(data) {
    if (!win.isDestroyed()) win.webContents.send('import:progress', data)
  }

  try {
    let result
    if (source === 'modrinth') {
      const { importModrinthPack } = require('./launcher/modrinth/modrinthImporter.cjs')
      result = await importModrinthPack(filePath, instancePath, sendProgress)
    } else {
      const { importCurseForgePack } = require('./launcher/curseforge/curseforgeImporter.cjs')
      result = await importCurseForgePack(filePath, instancePath, sendProgress)
    }

    try {
      const latestData = JSON.parse(fs.readFileSync(PROFILES_FILE_IMPORT, 'utf-8'))
      const idx = latestData.profiles.findIndex(p => p.id === profileId)
      if (idx >= 0) {
        if (result.gameVersion)   latestData.profiles[idx].gameVersion   = result.gameVersion
        if (result.loader)        latestData.profiles[idx].loader        = result.loader
        if (result.loaderVersion) latestData.profiles[idx].loaderVersion = result.loaderVersion
        if (result.name && !latestData.profiles[idx].name.trim()) {
          latestData.profiles[idx].name = result.name
        }

        latestData.profiles[idx].importSource  = source

        if (result.iconUrl) {
          latestData.profiles[idx].importIconUrl = result.iconUrl
          latestData.profiles[idx].importBgUrl   = result.iconUrl
        }
        if (result.bgUrl && result.bgUrl !== result.iconUrl) {
          latestData.profiles[idx].importBgUrl = result.bgUrl
        }
        const tmp = PROFILES_FILE_IMPORT + '.tmp'
        fs.writeFileSync(tmp, JSON.stringify(latestData, null, 2), { mode: 0o600 })
        fs.renameSync(tmp, PROFILES_FILE_IMPORT)
      }
    } catch {}

    return { ok: true, ...result }
  } catch (err) {
    sendProgress({ phase: 'error', log: `Lỗi: ${err.message}`, percent: 0 })
    return { error: err.message }
  }
})

// ─── Save temp file IPC (fallback for webUtils) ───────────────────────────────
ipcMain.handle('profiles:saveTempFile', async (e, { name, buffer }) => {
  if (!getTrustedWindow(e)) return null
  try {
    const os   = require('os')
    const path = require('path')
    const fs   = require('fs')
    const tmpPath = path.join(os.tmpdir(), `vxc-import-${Date.now()}-${name}`)
    fs.writeFileSync(tmpPath, Buffer.from(buffer))
    return tmpPath
  } catch {
    return null
  }
})

// ─── modpack:downloadAndImport ────────────────────────────────────────────────

ipcMain.handle('modpack:downloadAndImport', async (e, { downloadUrl, filename, source, profileMeta, groupId }) => {
  const win = getTrustedWindow(e)
  if (!win) return { error: 'Unauthorized' }

  const os   = require('os')
  const path = require('path')
  const fs   = require('fs')
  const https = require('https')
  const http  = require('http')

  function sendProgress(data) {
    if (!win.isDestroyed()) win.webContents.send('import:progress', data)
  }

  const tmpPath = path.join(os.tmpdir(), `vxc-modpack-${Date.now()}-${filename}`)
  sendProgress({ phase: 'download', log: `Đang tải ${filename}...`, percent: 2 })

  try {
    await new Promise((resolve, reject) => {
      const client = downloadUrl.startsWith('https') ? https : http
      const tmpFile = fs.createWriteStream(tmpPath)
      const doGet = (url) => {
        client.get(url, { headers: { 'User-Agent': 'VoxelXClient/1.0' } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            tmpFile.close()
            return doGet(res.headers.location)
          }
          if (res.statusCode !== 200) {
            res.resume()
            return reject(new Error(`HTTP ${res.statusCode}: ${url}`))
          }
          const total = parseInt(res.headers['content-length'] || '0', 10)
          let received = 0
          res.on('data', chunk => {
            received += chunk.length
            if (total > 0) {
              const pct = 2 + Math.round((received / total) * 18)
              sendProgress({ phase: 'download', log: `Đang tải ${filename}: ${pct}%`, percent: pct })
            }
          })
          res.pipe(tmpFile)
          tmpFile.on('finish', () => { tmpFile.close(); resolve() })
          tmpFile.on('error', err => { try { fs.unlinkSync(tmpPath) } catch {} reject(err) })
          res.on('error',     err => { try { fs.unlinkSync(tmpPath) } catch {} reject(err) })
        }).on('error', reject)
      }
      doGet(downloadUrl)
    })
  } catch (err) {
    sendProgress({ phase: 'error', log: `Lỗi tải file: ${err.message}`, percent: 0 })
    return { error: err.message }
  }

  sendProgress({ phase: 'read', log: 'Đọc metadata modpack...', percent: 20 })

  let meta = {}
  try {
    const { ipcMain: _ipc, BrowserWindow } = require('electron')

    const zlib = require('zlib')
    const buf = fs.readFileSync(tmpPath)

    function readZipEntry(name) {
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
    }

    const baseName = path.basename(filename).replace(/\.(zip|mrpack)$/i, '')
    let name = profileMeta?.name || baseName
    let gameVersion = profileMeta?.gameVersion || ''
    let loader = profileMeta?.loader || 'forge'
    let loaderVersion = profileMeta?.loaderVersion || ''

    const manifestData = readZipEntry('manifest.json')
    if (manifestData) {
      const manifest = JSON.parse(manifestData.toString('utf8'))
      name        = manifest.name || name
      gameVersion = manifest.minecraft?.version || gameVersion
      const loaderRaw = (manifest.minecraft?.modLoaders || [])[0]?.id || ''
      if (loaderRaw.startsWith('neoforge-'))    { loader = 'neoforge'; loaderVersion = loaderRaw.replace('neoforge-', '') }
      else if (loaderRaw.startsWith('forge-'))  { loader = 'forge';    loaderVersion = loaderRaw.replace('forge-', '') }
      else if (loaderRaw.startsWith('fabric-')) { loader = 'fabric';   loaderVersion = loaderRaw.replace('fabric-', '') }
    }
    const mrData = readZipEntry('modrinth.index.json')
    if (mrData) {
      const mr = JSON.parse(mrData.toString('utf8'))
      name        = mr.name || name
      gameVersion = mr.dependencies?.minecraft || gameVersion
      if (mr.dependencies?.['fabric-loader'])    { loader = 'fabric';   loaderVersion = mr.dependencies['fabric-loader'] }
      else if (mr.dependencies?.['neoforge'])    { loader = 'neoforge'; loaderVersion = mr.dependencies['neoforge'] }
      else if (mr.dependencies?.['forge'])       { loader = 'forge';    loaderVersion = mr.dependencies['forge'] }
      else if (mr.dependencies?.['quilt-loader']){ loader = 'quilt';    loaderVersion = mr.dependencies['quilt-loader'] }
    }
    meta = { name, gameVersion, loader, loaderVersion }
  } catch (err) {
    meta = {
      name:          profileMeta?.name || path.basename(filename, path.extname(filename)),
      gameVersion:   profileMeta?.gameVersion || '',
      loader:        profileMeta?.loader || 'forge',
      loaderVersion: profileMeta?.loaderVersion || '',
    }
  }

  sendProgress({ phase: 'create', log: 'Tạo profile...', percent: 22 })

  const DATA_DIR_DL = path.join(require('electron').app.getPath('appData'), '.VoxelXClient')
  const PROFILES_FILE_DL = path.join(DATA_DIR_DL, 'profiles.json')

  const profileId = require('crypto').randomUUID()
  const now = new Date().toISOString()
  const INSTANCES_DIR_DL = path.join(DATA_DIR_DL, 'instances')
  const instancePath = path.join(INSTANCES_DIR_DL, profileId)
  try { fs.mkdirSync(instancePath, { recursive: true }) } catch {}

  const profile = {
    id:            profileId,
    name:          meta.name || 'Modpack',
    loader:        meta.loader,
    gameVersion:   meta.gameVersion,
    loaderVersion: meta.loaderVersion,
    instancePath,
    isCustomPath:  false,
    createdAt:     now,
    lastPlayed:    null,
    sizeBytes:     0,
    importSource:  source,
    importIconUrl: profileMeta?.iconUrl || null,
    importBgUrl:   profileMeta?.iconUrl || null,
  }

  try {
    let profilesData
    try { profilesData = JSON.parse(fs.readFileSync(PROFILES_FILE_DL, 'utf-8')) }
    catch { profilesData = { profiles: [], selectedProfileId: null } }
    profilesData.profiles.push(profile)
    if (!profilesData.selectedProfileId) profilesData.selectedProfileId = profileId
    const tmp = PROFILES_FILE_DL + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(profilesData, null, 2), { mode: 0o600 })
    fs.renameSync(tmp, PROFILES_FILE_DL)
  } catch (err) {
    try { fs.unlinkSync(tmpPath) } catch {}
    sendProgress({ phase: 'error', log: `Lỗi tạo profile: ${err.message}`, percent: 0 })
    return { error: err.message }
  }

  sendProgress({ phase: 'start', log: 'Bắt đầu import modpack...', percent: 25 })

  try {
    let result
    if (source === 'modrinth') {
      const { importModrinthPack } = require('./launcher/modrinth/modrinthImporter.cjs')
      result = await importModrinthPack(tmpPath, instancePath, sendProgress)
    } else if (source === 'curseforge') {
      const { importCurseForgePack } = require('./launcher/curseforge/curseforgeImporter.cjs')
      result = await importCurseForgePack(tmpPath, instancePath, sendProgress)
    } else {

      result = { name: meta.name, gameVersion: meta.gameVersion, loader: meta.loader, loaderVersion: meta.loaderVersion }
    }

    try {
      const latestData = JSON.parse(fs.readFileSync(PROFILES_FILE_DL, 'utf-8'))
      const idx = latestData.profiles.findIndex(p => p.id === profileId)
      if (idx >= 0) {
        if (result.gameVersion)   latestData.profiles[idx].gameVersion   = result.gameVersion
        if (result.loader)        latestData.profiles[idx].loader        = result.loader
        if (result.loaderVersion) latestData.profiles[idx].loaderVersion = result.loaderVersion
        if (result.name)          latestData.profiles[idx].name          = result.name
        if (result.iconUrl) {
          latestData.profiles[idx].importIconUrl = result.iconUrl
          latestData.profiles[idx].importBgUrl   = result.iconUrl
        }
        const tmp2 = PROFILES_FILE_DL + '.tmp'
        fs.writeFileSync(tmp2, JSON.stringify(latestData, null, 2), { mode: 0o600 })
        fs.renameSync(tmp2, PROFILES_FILE_DL)
      }
    } catch {}

    try { fs.unlinkSync(tmpPath) } catch {}

    if (groupId && typeof groupId === 'string' && /^[0-9a-f-]{36}$/.test(groupId)) {
      try {
        const GROUPS_FILE_DL = path.join(DATA_DIR_DL, 'groups.json')
        let groupsData
        try { groupsData = JSON.parse(fs.readFileSync(GROUPS_FILE_DL, 'utf-8')) }
        catch { groupsData = { groups: [] } }
        const grp = groupsData.groups.find(g => g.id === groupId)
        if (grp && !grp.profileIds.includes(profileId)) {
          grp.profileIds.push(profileId)
          const tmpG = GROUPS_FILE_DL + '.tmp'
          fs.writeFileSync(tmpG, JSON.stringify(groupsData, null, 2), { mode: 0o600 })
          fs.renameSync(tmpG, GROUPS_FILE_DL)
        }
      } catch {}
    }

    sendProgress({ phase: 'done', log: `Đã tạo profile "${meta.name}" thành công!`, percent: 100 })
    return { ok: true, profileId, profileName: meta.name }
  } catch (err) {
    try { fs.unlinkSync(tmpPath) } catch {}
    sendProgress({ phase: 'error', log: `Lỗi import: ${err.message}`, percent: 0 })
    return { error: err.message }
  }
})

ipcMain.handle('settings:get', (e) => {
  if (!getTrustedWindow(e)) return DEFAULT_SETTINGS
  return readSettings()
})

ipcMain.handle('settings:save', (e, patch) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  if (!patch || typeof patch !== 'object') return { error: 'Dữ liệu không hợp lệ' }

  const safe = {}
  for (const key of SETTING_KEYS) {
    if (key in patch) safe[key] = patch[key]
  }

  const current = readSettings()
  const updated = { ...current, ...safe }
  writeSettings(updated)

  if ('discordRPC' in safe) {
    if (safe.discordRPC) rpc.connect()
    else rpc.disconnect()
  }

  return { ok: true, data: updated }
})
