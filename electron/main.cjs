const { app, BrowserWindow, ipcMain, nativeImage, Tray, Menu, shell } = require('electron')
const path = require('path')
const fs   = require('fs')
const rpc  = require('./discordRPC.cjs')
const { registerProfileHandlers } = require('./profileManager.cjs')
const { registerLauncherHandlers } = require('./launcher.cjs')
const { loginWithWindow, refreshMinecraftToken } = require('./msAuth.cjs')

const isDev = process.env.NODE_ENV === 'development'

app.setAppUserModelId('com.voxelxclient.launcher')

// ─── Paths ────────────────────────────────────────────────────────────────────
const ICON_PATH     = path.join(__dirname, '../public/icon.ico')
const ACCOUNTS_DIR  = path.join(app.getPath('appData'), '.VoxelXClient')
const ACCOUNTS_FILE = path.join(ACCOUNTS_DIR, 'accounts.json')

// ─── Trusted origins ──────────────────────────────────────────────────────────
// Chỉ cho phép load từ các origin này
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
    // Avatar API domains — chỉ cho phép load ảnh, không navigate
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
  return null // ok
}

function sanitizeAccount(account) {
  // Chỉ giữ lại các field được phép — loại bỏ mọi field lạ
  const base = {
    id:        account.id,
    uuid:      account.uuid,
    type:      account.type,
    username:  account.username,
    createdAt: account.createdAt,
  }
  // Microsoft accounts lưu thêm token để auto-refresh
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
  // Atomic write: ghi vào file tạm rồi rename để tránh corrupt
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
  fontWeight:           400,
  colorAccent:          '#4ade80',
  colorHover:           '#86efac',
  colorActive:          '#22c55e',
  background:           'dark',
  agreedTos:            false,
  agreedPrivacy:        false,
}

function readSettings() {
  ensureAccountsFile() // đảm bảo thư mục tồn tại
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) }
  } catch { return { ...DEFAULT_SETTINGS } }
}

function writeSettings(data) {
  ensureAccountsFile()
  const tmp = SETTINGS_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 })
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
    contextIsolation:            true,   // renderer không access Node
    nodeIntegration:             false,  // không cho renderer dùng Node APIs
    nodeIntegrationInWorker:     false,
    nodeIntegrationInSubFrames:  false,
    // sandbox: true — disabled trên Windows do lỗi GPU cache permission
    // contextIsolation + nodeIntegration:false đã đủ bảo mật
    webSecurity:                 true,   // enforce same-origin
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

  // Chặn navigation ra ngoài allowed origins
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!isTrustedOrigin(url)) {
      e.preventDefault()
      shell.openExternal(url) // mở browser ngoài thay vì trong app
    }
  })

  // Chặn mở window mới (popup, target=_blank)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedOrigin(url)) return { action: 'allow' }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Disable dev tools trong production
  if (!isDev) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools()
    })
  }

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
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
    // No parent — independent window
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
  if (!fs.existsSync(ICON_PATH)) return
  const trayIcon = nativeImage.createFromPath(ICON_PATH).resize({ width: 16, height: 16 })
  tray = new Tray(trayIcon)
  tray.setToolTip('VoxelXClient')
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'VoxelXClient', enabled: false,
      icon: nativeImage.createFromPath(ICON_PATH).resize({ width: 16, height: 16 }),
    },
    { type: 'separator' },
    {
      label: 'Mở VoxelXClient',
      click: () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus() }
        else createMainWindow()
      },
    },
    {
      label: 'Kiểm tra cập nhật...',
      click: () => {
        // Mở update window độc lập — không cần show main window
        createUpdateWindow()
      },
    },
    { type: 'separator' },
    {
      label: 'Thoát',
      click: () => { app.isQuitting = true; app.quit() },
    },
  ]))
  tray.on('double-click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus() }
    else createMainWindow()
  })
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Cho phép load ảnh từ các Minecraft avatar API
  // Không inject CSP vào cửa sổ auth Microsoft
  const { session } = require('electron')
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // Bỏ qua CSP cho các trang Microsoft auth
    const url = details.url || ''
    if (
      url.includes('login.live.com') ||
      url.includes('login.microsoftonline.com') ||
      url.includes('microsoft.com') ||
      url.includes('xbox.com')
    ) {
      return callback({ responseHeaders: details.responseHeaders })
    }

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173 ws://localhost:5173;" +
          "img-src 'self' data: blob: https://crafthead.net https://mc-heads.net https://minotar.net https://crafatar.com https://textures.minecraft.net https://media.forgecdn.net https://cdn.modrinth.com;" +
          "connect-src 'self' http://localhost:5173 ws://localhost:5173 https://minotar.net https://crafthead.net https://mc-heads.net https://meta.fabricmc.net https://maven.fabricmc.net https://api.modrinth.com https://cdn.modrinth.com https://maven.minecraftforge.net https://files.minecraftforge.net https://repo1.maven.org https://maven.neoforged.net;"
        ],
      },
    })
  })

  createMainWindow()
  createTray()

  // Khởi động Discord RPC nếu setting bật
  const initSettings = readSettings()
  if (initSettings.discordRPC) rpc.connect()

  app.on('activate', () => {
    if (!mainWindow) createMainWindow(); else mainWindow.show()
  })
})

app.on('window-all-closed', () => { /* chạy ở tray */ })
app.on('before-quit', () => { app.isQuitting = true })

// ─── Window controls IPC ──────────────────────────────────────────────────────
// Validate sender frame trước khi thực hiện
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
ipcMain.handle('updater:check', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  await new Promise(r => setTimeout(r, 1500))
  return {
    hasUpdate: false,
    currentVersion: app.getVersion(),
    latestVersion:  app.getVersion(),
    message: 'Bạn đang dùng phiên bản mới nhất.',
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

ipcMain.handle('accounts:add', (e, account) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }

  // Validate input
  const err = validateAccount(account)
  if (err) return { error: err }

  const data = readAccounts()
  const exists = data.accounts.find(
    a => a.username === account.username && a.type === account.type
  )
  if (exists) return { error: 'Tài khoản đã tồn tại' }

  // Chỉ lưu các field được whitelist
  const safe = sanitizeAccount(account)
  data.accounts.push(safe)
  if (!data.selectedId) data.selectedId = safe.id
  writeAccounts(data)
  return { ok: true, data }
})

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
  // Đảm bảo id tồn tại trong danh sách
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

    // Lưu tài khoản
    const data = readAccounts()
    const exists = data.accounts.find(a => a.uuid === result.uuid)
    if (exists) {
      // Cập nhật token nếu đã tồn tại
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
  // Với window flow, cancel được xử lý bởi người dùng đóng cửa sổ
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  return { ok: true }
})

// Auto-refresh: lấy mcToken mới nếu sắp hết hạn (< 5 phút)
ipcMain.handle('ms:refreshToken', async (e, id) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  if (!validateId(id)) return { error: 'ID không hợp lệ' }

  const data = readAccounts()
  const account = data.accounts.find(a => a.id === id)
  if (!account) return { error: 'Tài khoản không tồn tại' }
  if (account.type !== 'microsoft') return { error: 'Không phải tài khoản Microsoft' }
  if (!account.msRefreshToken) return { error: 'Không có refresh token' }

  // Kiểm tra xem có cần refresh không (còn > 5 phút thì bỏ qua)
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
  // Chỉ cho phép https URLs
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return { error: 'Chỉ cho phép HTTPS' }
    shell.openExternal(url)
    return { ok: true }
  } catch { return { error: 'URL không hợp lệ' } }
})

// ─── Profile IPC ──────────────────────────────────────────────────────────────
registerProfileHandlers(getTrustedWindow)

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

// ─── Forge Meta API IPC ───────────────────────────────────────────────────────
ipcMain.handle('forge:getVersions', async (e, gameVersion) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  if (typeof gameVersion !== 'string' || !/^[a-zA-Z0-9._+\-]+$/.test(gameVersion)) {
    return { error: 'Invalid game version' }
  }
  try {
    const https = require('https')

    function httpsGet(url) {
      return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'VoxelXClient/1.0' } }, (res) => {
          let body = ''
          res.on('data', chunk => { body += chunk })
          res.on('end', () => {
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
            resolve(body)
          })
        }).on('error', reject)
      })
    }

    // Fetch cả 2 song song
    const [xmlBody, promoBody] = await Promise.all([
      httpsGet('https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml'),
      httpsGet('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'),
    ])

    // Parse XML — lấy tất cả <version> tag
    const allVersions = []
    const versionRe = /<version>([^<]+)<\/version>/g
    let m
    while ((m = versionRe.exec(xmlBody)) !== null) {
      allVersions.push(m[1])
    }

    // Lọc theo gameVersion prefix: "1.21.4-..." 
    const prefix = gameVersion + '-'
    const filtered = allVersions
      .filter(v => v.startsWith(prefix))
      .map(v => v.slice(prefix.length)) // chỉ lấy phần forge version

    // Parse promotions
    const promos = JSON.parse(promoBody).promos || {}
    const recommended = promos[`${gameVersion}-recommended`] || null
    const latest      = promos[`${gameVersion}-latest`]      || null

    return { ok: true, data: { versions: filtered, recommended, latest } }
  } catch (err) {
    return { error: err.message }
  }
})

// ─── NeoForge Meta API IPC ────────────────────────────────────────────────────
ipcMain.handle('neoforge:getVersions', async (e, gameVersion) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  if (typeof gameVersion !== 'string' || !/^[a-zA-Z0-9._+\-]+$/.test(gameVersion)) {
    return { error: 'Invalid game version' }
  }
  try {
    const https = require('https')

    function httpsGet(url) {
      return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'VoxelXClient/1.0' } }, (res) => {
          let body = ''
          res.on('data', chunk => { body += chunk })
          res.on('end', () => {
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
            resolve(body)
          })
        }).on('error', reject)
      })
    }

    // NeoForge version format: <mcMinor>.<mcPatch>.<build>
    // e.g. MC 1.21   → prefix "21.0."
    //      MC 1.21.1 → prefix "21.1."
    //      MC 1.21.4 → prefix "21.4."
    //      MC 1.20.2 → prefix "20.2."
    const mcParts = gameVersion.split('.')
    // mcParts: ["1","21"] or ["1","21","4"]
    const mcMinor = mcParts[1] ?? '0'
    const mcPatch = mcParts[2] ?? '0'
    const prefix  = `${mcMinor}.${mcPatch}.`

    // NeoForge does NOT have maven-metadata.xml — scrape directory listing instead
    const html = await httpsGet('https://maven.neoforged.net/releases/net/neoforged/neoforge/')

    // Extract version directories: href="./21.4.0/"
    const dirRe = /href="\.\/([\d]+\.[\d]+\.[\d]+)\/"/g
    const allVersions = []
    let m
    while ((m = dirRe.exec(html)) !== null) {
      allVersions.push(m[1])
    }

    // Filter by MC version prefix, sort descending (newest first)
    const filtered = allVersions
      .filter(v => v.startsWith(prefix))
      .sort((a, b) => {
        const aParts = a.split('.').map(Number)
        const bParts = b.split('.').map(Number)
        for (let i = 0; i < 3; i++) {
          const diff = (bParts[i] ?? 0) - (aParts[i] ?? 0)
          if (diff !== 0) return diff
        }
        return 0
      })

    const latest = filtered[0] || null

    return { ok: true, data: { versions: filtered, latest } }
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
    title:       'Chọn file modpack',
    buttonLabel: 'Chọn',
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

    // ZIP central directory parser
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
    let iconBase64 = null  // data:image/png;base64,... từ icon.png trong zip
    let iconUrl    = null  // URL từ manifest (CurseForge image field)

    // CurseForge: manifest.json
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
      // CurseForge stores avatar URL in manifest.image
      if (manifest.image) iconUrl = manifest.image
    }

    // Modrinth: modrinth.index.json
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

    // Icon từ zip (ưu tiên hơn URL nếu có)
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
// profiles:importModpack — import a CurseForge or Modrinth modpack file
// Progress events are sent via 'import:progress' channel to the renderer
ipcMain.handle('profiles:importModpack', async (e, { filePath, source, profileId }) => {
  const win = getTrustedWindow(e)
  if (!win) return { error: 'Unauthorized' }

  const path = require('path')
  const fs   = require('fs')

  if (!filePath || !fs.existsSync(filePath)) return { error: 'File không tồn tại' }
  if (!['curseforge', 'modrinth'].includes(source)) return { error: 'Source không hợp lệ' }

  // Get instance path from profile
  const DATA_DIR_IMPORT = require('path').join(require('electron').app.getPath('appData'), '.VoxelXClient')
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

    // Update profile with actual metadata from manifest (gameVersion, loader, loaderVersion, name)
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
        // Lưu import metadata để hiển thị trên ProfileCard
        latestData.profiles[idx].importSource  = source
        // Chỉ overwrite nếu importer trả về giá trị mới — giữ nguyên giá trị từ profiles:create nếu importer trả null
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

ipcMain.handle('settings:get', (e) => {
  if (!getTrustedWindow(e)) return DEFAULT_SETTINGS
  return readSettings()
})

ipcMain.handle('settings:save', (e, patch) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  if (!patch || typeof patch !== 'object') return { error: 'Dữ liệu không hợp lệ' }

  const ALLOWED_KEYS = Object.keys(DEFAULT_SETTINGS)
  const safe = {}
  for (const key of ALLOWED_KEYS) {
    if (key in patch) safe[key] = patch[key]
  }

  const current = readSettings()
  const updated = { ...current, ...safe }
  writeSettings(updated)

  // Toggle Discord RPC nếu setting thay đổi
  if ('discordRPC' in safe) {
    if (safe.discordRPC) rpc.connect()
    else rpc.disconnect()
  }

  return { ok: true, data: updated }
})
