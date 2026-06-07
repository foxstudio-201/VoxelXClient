'use strict'

/**
 * VoxelX P2P LAN — WireGuard Manager
 *
 * Windows: wireguard.exe /installtunnelservice — cần admin
 *   → Nếu chưa có admin, tự relaunch với UAC prompt (ShellExecute runas)
 * Linux: wg-quick (cần sudo)
 */

const path      = require('path')
const fs        = require('fs')
const crypto    = require('crypto')
const { app, ipcMain } = require('electron')
const { spawnSync, execFileSync } = require('child_process')

const API_BASE         = process.env.VXC_WEB_BASE_URL || 'https://www.voxelx.io.vn'
const WG_PORT          = 51820
const PING_INTERVAL_MS = 10000

// ── Paths ─────────────────────────────────────────────────────────────────────
const DATA_DIR = path.join(app.getPath('appData'), '.VoxelXClient')
const WG_DIR   = path.join(DATA_DIR, 'wireguard')
const WG_CONF  = path.join(WG_DIR,   'voxelx-lan.conf')
const WG_EXE   = path.join(WG_DIR,   'wireguard.exe')
const WG_TOOL  = path.join(WG_DIR,   'wg.exe')
const WINTUN   = path.join(WG_DIR,   'wintun.dll')

const WG_MSI_URL    = 'https://download.wireguard.com/windows-client/wireguard-amd64-0.5.3.msi'
const WINTUN_URL    = 'https://www.wintun.net/builds/wintun-0.14.1.zip'

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

// ── Check admin ───────────────────────────────────────────────────────────────
function isRunningAsAdmin() {
  if (process.platform !== 'win32') return true
  try {
    // net session chỉ thành công khi có admin
    execFileSync('net', ['session'], { windowsHide: true, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// Relaunch app với UAC elevation
function relaunchAsAdmin() {
  if (process.platform !== 'win32') return false
  const exePath = process.execPath
  const args = process.argv.slice(1)

  try {
    // Dùng spawnSync — sẽ BLOCK cho đến khi UAC được user xử lý (Yes hoặc No)
    // Nếu user bấm Yes → process mới chạy → spawnSync return → app cũ quit
    // Nếu user bấm No → spawnSync return → app cũ KHÔNG quit
    const argsStr = args.length > 0
      ? `-ArgumentList '${args.join("','")}'`
      : ''
    const result = spawnSync('powershell.exe', [
      '-NoProfile', '-Command',
      `Start-Process -FilePath '${exePath.replace(/'/g, "''")}' ${argsStr} -Verb RunAs -Wait:$false`,
    ], {
      windowsHide: true,
      timeout: 60000, // 60s timeout cho UAC
    })
    // Nếu PowerShell exit 0 → UAC passed, process mới đã chạy
    return result.status === 0
  } catch {
    return false
  }
}

// ── HTTPS helpers ─────────────────────────────────────────────────────────────
function httpsDownload(url, destPath, onProgress) {
  const https = require('https')
  const http  = require('http')
  return new Promise((resolve, reject) => {
    function doGet(u) {
      const client = u.startsWith('https') ? https : http
      client.get(u, { headers: { 'User-Agent': 'VoxelXLauncher/1.0' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
          return doGet(res.headers.location)
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${u}`))
        const total = parseInt(res.headers['content-length'] || '0', 10)
        let done = 0
        const out = fs.createWriteStream(destPath)
        res.on('data', c => { done += c.length; if (onProgress && total) onProgress(Math.round(done/total*100)) })
        res.pipe(out)
        out.on('finish', resolve)
        out.on('error', reject)
        res.on('error', reject)
      }).on('error', reject)
    }
    doGet(url)
  })
}

function extractZip(zipPath, destDir) {
  ensureDir(destDir)
  const r = spawnSync('powershell', ['-Command',
    `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`
  ], { windowsHide: true, timeout: 30000 })
  if (r.status !== 0) throw new Error('Giải nén thất bại: ' + (r.stderr?.toString() || ''))
}

function extractMsi(msiPath, destDir) {
  ensureDir(destDir)
  const r = spawnSync('msiexec', ['/a', msiPath, '/qn', `TARGETDIR=${destDir}`],
    { windowsHide: true, timeout: 60000 })
  if (r.status !== 0 && r.status !== 3010)
    throw new Error(`msiexec lỗi (${r.status})`)
}

function findFile(dir, name) {
  if (!fs.existsSync(dir)) return null
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) { const f = findFile(full, name); if (f) return f }
    else if (e.name.toLowerCase() === name.toLowerCase()) return full
  }
  return null
}

// ── Ensure WireGuard binaries ─────────────────────────────────────────────────
async function ensureWgBinaries(logFn) {
  ensureDir(WG_DIR)
  if (process.platform !== 'win32') return // Linux dùng wg-quick hệ thống

  // Windows Defender exclusion (best-effort)
  try {
    spawnSync('powershell', ['-Command',
      `Add-MpPreference -ExclusionPath '${WG_DIR}' -ErrorAction SilentlyContinue`
    ], { windowsHide: true, timeout: 5000 })
  } catch {}

  // Tải wg.exe + wireguard.exe từ MSI
  if (!fs.existsSync(WG_TOOL) || !fs.existsSync(WG_EXE)) {
    logFn('Đang tải WireGuard...')
    const msiPath    = path.join(WG_DIR, 'wireguard-setup.msi')
    const extractDir = path.join(WG_DIR, 'msi-extract')
    try {
      await httpsDownload(WG_MSI_URL, msiPath, pct => logFn(`Tải WireGuard: ${pct}%`))
      logFn('Đang giải nén...')
      extractMsi(msiPath, extractDir)
      const wgFound  = findFile(extractDir, 'wg.exe')
      const wgeFound = findFile(extractDir, 'wireguard.exe')
      if (wgFound)  fs.copyFileSync(wgFound, WG_TOOL)
      if (wgeFound) fs.copyFileSync(wgeFound, WG_EXE)
      logFn('Đã có WireGuard tools')
    } finally {
      try { if (fs.existsSync(msiPath)) fs.unlinkSync(msiPath) } catch {}
      try { fs.rmSync(extractDir, { recursive: true, force: true }) } catch {}
    }
  }

  // Tải wintun.dll
  if (!fs.existsSync(WINTUN)) {
    logFn('Đang tải wintun.dll...')
    const zipPath    = path.join(WG_DIR, 'wintun.zip')
    const extractDir = path.join(WG_DIR, 'wintun-extract')
    try {
      await httpsDownload(WINTUN_URL, zipPath, pct => logFn(`Tải wintun: ${pct}%`))
      extractZip(zipPath, extractDir)
      const dll = findFile(extractDir, 'wintun.dll')
      if (dll) { fs.copyFileSync(dll, WINTUN); logFn('Đã có wintun.dll') }
      else throw new Error('Không tìm thấy wintun.dll')
    } finally {
      try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath) } catch {}
      try { fs.rmSync(extractDir, { recursive: true, force: true }) } catch {}
    }
  }

  if (!fs.existsSync(WG_TOOL))
    throw new Error('wg.exe không tồn tại. Có thể bị Windows Defender xóa. Thêm exclusion cho: ' + WG_DIR)
}

// ── Key generation ────────────────────────────────────────────────────────────
function generatePrivateKey() {
  const key = crypto.randomBytes(32)
  key[0]  &= 248; key[31] &= 127; key[31] |= 64
  return key.toString('base64')
}

function derivePublicKey(privB64) {
  const tool = process.platform === 'win32' ? WG_TOOL : 'wg'
  const r = spawnSync(tool, ['pubkey'], {
    input: privB64 + '\n', encoding: 'utf8', timeout: 5000,
    env: process.platform === 'win32'
      ? { ...process.env, PATH: WG_DIR + ';' + (process.env.PATH || '') }
      : process.env,
  })
  if (r.status === 0 && r.stdout?.trim()) return r.stdout.trim()
  throw new Error('Không thể tạo public key: ' + (r.stderr || ''))
}

// ── WireGuard config ──────────────────────────────────────────────────────────
function buildWgConf(virtualIp, privateKey, peers) {
  let conf = `[Interface]\nPrivateKey = ${privateKey}\nAddress = ${virtualIp}/24\nListenPort = ${WG_PORT}\n\n`
  for (const p of peers) {
    conf += `[Peer]\nPublicKey = ${p.publicKey}\nAllowedIPs = ${p.virtualIp}/32\nPersistentKeepalive = 25\n`
    if (p.endpoint) conf += `Endpoint = ${p.endpoint}\n`
    conf += '\n'
  }
  return conf
}

async function applyWgConfig(virtualIp, privateKey, peers) {
  ensureDir(WG_DIR)
  fs.writeFileSync(WG_CONF, buildWgConf(virtualIp, privateKey, peers), { mode: 0o600 })

  if (process.platform === 'win32') {
    // Gỡ tunnel cũ nếu có
    try {
      spawnSync(WG_EXE, ['/uninstalltunnelservice', 'voxelx-lan'], {
        windowsHide: true, timeout: 5000,
        env: { ...process.env, PATH: WG_DIR + ';' + (process.env.PATH || '') },
      })
      await new Promise(r => setTimeout(r, 800))
    } catch {}

    const r = spawnSync(WG_EXE, ['/installtunnelservice', WG_CONF], {
      windowsHide: true, timeout: 15000,
      env: { ...process.env, PATH: WG_DIR + ';' + (process.env.PATH || ''), WINTUN_DLL: WINTUN },
    })
    if (r.status !== 0)
      throw new Error('WireGuard tunnel lỗi: ' + (r.stderr?.toString() || r.status))
  } else {
    try { spawnSync('wg-quick', ['down', WG_CONF], { timeout: 5000 }) } catch {}
    const r = spawnSync('wg-quick', ['up', WG_CONF], { timeout: 15000, stdio: 'pipe' })
    if (r.status !== 0) throw new Error('wg-quick lỗi: ' + (r.stderr?.toString() || ''))
  }
  log('WireGuard tunnel đã khởi động')
}

async function stopWg() {
  try {
    if (process.platform === 'win32') {
      spawnSync(WG_EXE, ['/uninstalltunnelservice', 'voxelx-lan'], {
        windowsHide: true, timeout: 5000,
        env: { ...process.env, PATH: WG_DIR + ';' + (process.env.PATH || '') },
      })
    } else {
      if (fs.existsSync(WG_CONF)) spawnSync('wg-quick', ['down', WG_CONF], { timeout: 5000 })
    }
  } catch {}
  try { if (fs.existsSync(WG_CONF)) fs.unlinkSync(WG_CONF) } catch {}
}

// ── API ───────────────────────────────────────────────────────────────────────
function apiPost(action, body) {
  const https   = require('https')
  const bodyStr = JSON.stringify(body)
  const url     = new URL(`${API_BASE}/api/lan-room?action=${action}`)
  return new Promise((resolve, reject) => {
    function doReq(host, p) {
      const req = https.request({
        hostname: host, port: 443, path: p, method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          'User-Agent': 'VoxelXLauncher/1.0',
        },
      }, res => {
        if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
          res.resume(); const loc = new URL(res.headers.location)
          return doReq(loc.hostname, loc.pathname + loc.search)
        }
        let d = ''
        res.on('data', c => { d += c })
        res.on('end', () => {
          try { resolve(JSON.parse(d)) }
          catch { reject(new Error(`HTTP ${res.statusCode}: ${d.slice(0,200)}`)) }
        })
      })
      req.on('error', reject)
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')) })
      req.write(bodyStr); req.end()
    }
    doReq(url.hostname, url.pathname + url.search)
  })
}

function apiGet(action, params = {}) {
  const https = require('https')
  const qs    = new URLSearchParams({ action, ...params }).toString()
  const url   = new URL(`${API_BASE}/api/lan-room?${qs}`)
  return new Promise((resolve, reject) => {
    function doGet(host, p) {
      https.get({ hostname: host, port: 443, path: p,
        headers: { 'User-Agent': 'VoxelXLauncher/1.0' }, timeout: 10000,
      }, res => {
        if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
          res.resume(); const loc = new URL(res.headers.location)
          return doGet(loc.hostname, loc.pathname + loc.search)
        }
        let d = ''
        res.on('data', c => { d += c })
        res.on('end', () => {
          try { resolve(JSON.parse(d)) }
          catch { reject(new Error(`HTTP ${res.statusCode}: ${d.slice(0,200)}`)) }
        })
      }).on('error', reject)
    }
    doGet(url.hostname, url.pathname + url.search)
  })
}

// ── State ─────────────────────────────────────────────────────────────────────
let _state = {
  active: false, role: null, roomCode: null,
  hostToken: null, peerToken: null, virtualIp: null,
  privateKey: null, publicKey: null, peers: [],
  pingTimer: null, onEvent: null,
}

function emit(event, data) {
  if (typeof _state.onEvent === 'function') _state.onEvent(event, data)
}
function log(msg) { emit('vxlan:log', { msg }) }

// ── Ping loop ─────────────────────────────────────────────────────────────────
function startPingLoop() {
  stopPingLoop()
  _state.pingTimer = setInterval(async () => {
    if (!_state.peerToken) return
    try { await apiPost('ping', { token: _state.peerToken }) } catch {}
    try {
      const r = await apiGet('peers', { roomCode: _state.roomCode, token: _state.peerToken })
      if (r.ok && JSON.stringify(r.peers) !== JSON.stringify(_state.peers)) {
        _state.peers = r.peers
        emit('vxlan:peers', { peers: r.peers })
        await applyWgConfig(_state.virtualIp, _state.privateKey, r.peers).catch(e =>
          log(`Cập nhật WireGuard lỗi: ${e.message}`)
        )
      }
    } catch {}
  }, PING_INTERVAL_MS)
}

function stopPingLoop() {
  if (_state.pingTimer) { clearInterval(_state.pingTimer); _state.pingTimer = null }
}

// ── Create / Join / Leave ─────────────────────────────────────────────────────
async function createRoom({ nickname }) {
  log('Kiểm tra WireGuard...')
  await ensureWgBinaries(log)

  const privateKey = generatePrivateKey()
  log('Đang tạo keypair...')
  const publicKey = derivePublicKey(privateKey)

  log('Đang tạo phòng...')
  const r = await apiPost('create', { publicKey, nickname: nickname || 'Host' })
  if (!r.ok) throw new Error(r.error || 'Không thể tạo phòng')

  Object.assign(_state, {
    active: true, role: 'host',
    roomCode: r.roomCode, hostToken: r.hostToken, peerToken: r.peerToken,
    virtualIp: r.virtualIp, privateKey, publicKey, peers: [],
  })

  log('Đang khởi động WireGuard tunnel...')
  await applyWgConfig(r.virtualIp, privateKey, [])
  startPingLoop()

  log(`Phòng: ${r.roomCode} | IP: ${r.virtualIp}`)
  emit('vxlan:created', { roomCode: r.roomCode, virtualIp: r.virtualIp })
  return r
}

async function joinRoom({ roomCode, nickname }) {
  log('Kiểm tra WireGuard...')
  await ensureWgBinaries(log)

  const privateKey = generatePrivateKey()
  log('Đang tạo keypair...')
  const publicKey = derivePublicKey(privateKey)

  log(`Đang kết nối phòng ${roomCode}...`)
  const r = await apiPost('join', {
    roomCode: roomCode.toUpperCase(), publicKey, nickname: nickname || 'Player',
  })
  if (!r.ok) throw new Error(r.error || 'Không thể join phòng')

  Object.assign(_state, {
    active: true, role: 'peer',
    roomCode: roomCode.toUpperCase(), peerToken: r.peerToken,
    virtualIp: r.virtualIp, privateKey, publicKey, peers: r.peers || [],
  })

  log('Đang khởi động WireGuard tunnel...')
  await applyWgConfig(r.virtualIp, privateKey, r.peers || [])
  startPingLoop()

  log(`Đã vào phòng | IP: ${r.virtualIp}`)
  emit('vxlan:joined', { roomCode: roomCode.toUpperCase(), virtualIp: r.virtualIp, peers: r.peers })
  return r
}

async function leaveRoom() {
  stopPingLoop()
  if (_state.hostToken) {
    try { await apiPost('close', { hostToken: _state.hostToken }) } catch {}
  }
  await stopWg()
  Object.assign(_state, {
    active: false, role: null, roomCode: null,
    hostToken: null, peerToken: null, virtualIp: null,
    privateKey: null, publicKey: null, peers: [],
  })
  emit('vxlan:left', {})
  log('Đã rời phòng')
}

function getState() {
  return {
    active: _state.active, role: _state.role,
    roomCode: _state.roomCode, virtualIp: _state.virtualIp,
    peers: _state.peers,
  }
}

function checkWgReady() {
  if (process.platform !== 'win32') {
    return spawnSync('which', ['wg-quick'], { encoding: 'utf8', timeout: 2000 }).status === 0
  }
  return fs.existsSync(WG_TOOL) && fs.existsSync(WG_EXE) && fs.existsSync(WINTUN)
}

// ── IPC ───────────────────────────────────────────────────────────────────────
function registerVxLanHandlers(getTrustedWindow) {

  ipcMain.handle('vxlan:check', e => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    return {
      installed: checkWgReady(),
      isAdmin: isRunningAsAdmin(),
      state: getState(),
    }
  })

  // Khi bấm tạo/join phòng: kiểm tra admin trước
  // Nếu chưa admin → trả về { needAdmin: true } để UI hiện thông báo
  // Sau khi user đồng ý → gọi vxlan:relaunchAsAdmin để relaunch

  ipcMain.handle('vxlan:create', async (e, { nickname } = {}) => {
    const win = getTrustedWindow(e)
    if (!win) return { error: 'Unauthorized' }

    if (process.platform === 'win32' && !isRunningAsAdmin()) {
      return { needAdmin: true }
    }

    _state.onEvent = (ev, d) => { if (!win.isDestroyed()) win.webContents.send(ev, d) }
    try { return { ok: true, ...(await createRoom({ nickname })) }
    } catch (err) { return { error: err.message } }
  })

  ipcMain.handle('vxlan:join', async (e, { roomCode, nickname } = {}) => {
    const win = getTrustedWindow(e)
    if (!win) return { error: 'Unauthorized' }

    if (process.platform === 'win32' && !isRunningAsAdmin()) {
      return { needAdmin: true }
    }

    _state.onEvent = (ev, d) => { if (!win.isDestroyed()) win.webContents.send(ev, d) }
    try { return { ok: true, ...(await joinRoom({ roomCode, nickname })) }
    } catch (err) { return { error: err.message } }
  })

  ipcMain.handle('vxlan:relaunchAsAdmin', async (e) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const ok = relaunchAsAdmin()
    if (ok) {
      // Process mới đã chạy với admin → quit app cũ
      setTimeout(() => {
        app.isQuitting = true
        app.quit()
      }, 500)
    }
    return { ok }
  })

  ipcMain.handle('vxlan:leave', async e => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    try { await leaveRoom(); return { ok: true } }
    catch (err) { return { error: err.message } }
  })

  ipcMain.handle('vxlan:state', e => {
    if (!getTrustedWindow(e)) return null
    return getState()
  })
}

module.exports = { registerVxLanHandlers, checkWgReady, getState }
