/**
 * Discord Rich Presence cho VoxelXClient.
 *
 * Để dùng được bạn cần:
 * 1. Vào https://discord.com/developers/applications
 * 2. Tạo application mới, đặt tên "VoxelXClient"
 * 3. Copy Application ID → thay vào CLIENT_ID bên dưới
 * 4. Vào tab "Rich Presence" → "Art Assets" → upload ảnh voxelxclient-logo.png
 *    đặt tên asset là "logo" (phải khớp với largeImageKey bên dưới)
 */

const DiscordRPC = require('discord-rpc')

// ── Thay bằng Application ID của bạn từ Discord Developer Portal ──────────────
const CLIENT_ID = '1502586952040452249'

let client    = null
let connected = false
let retryTimer = null

const DEFAULT_ACTIVITY = {
  details:      'VoxelXClient Launcher',
  state:        'Đang ở menu chính',
  largeImageKey:  'logo',
  largeImageText: 'VoxelXClient',
  smallImageKey:  'logo',
  smallImageText: 'VoxelXClient Launcher',
  instance: false,
}

let currentActivity = { ...DEFAULT_ACTIVITY }

// ─── Connect ──────────────────────────────────────────────────────────────────
async function connect() {
  if (CLIENT_ID === 'YOUR_DISCORD_CLIENT_ID') {
    console.log('[Discord RPC] CLIENT_ID chưa được cấu hình — bỏ qua')
    return
  }

  try {
    DiscordRPC.register(CLIENT_ID)
    client = new DiscordRPC.Client({ transport: 'ipc' })

    client.on('ready', () => {
      connected = true
      console.log('[Discord RPC] Connected as', client.user?.username)
      setActivity(currentActivity)
    })

    client.on('disconnected', () => {
      connected = false
      console.log('[Discord RPC] Disconnected')
      scheduleRetry()
    })

    await client.login({ clientId: CLIENT_ID })
  } catch (err) {
    console.warn('[Discord RPC] Connect failed:', err.message)
    connected = false
    scheduleRetry()
  }
}

function scheduleRetry() {
  if (retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    connect()
  }, 15000) // retry sau 15s
}

// ─── Set activity ─────────────────────────────────────────────────────────────
function setActivity(activity = {}) {
  currentActivity = {
    ...DEFAULT_ACTIVITY,
    ...activity,
    startTimestamp: currentActivity.startTimestamp ?? Date.now(),
  }

  if (!connected || !client) return

  client.setActivity(currentActivity).catch(err => {
    console.warn('[Discord RPC] setActivity failed:', err.message)
  })
}

// ─── Disconnect ───────────────────────────────────────────────────────────────
function disconnect() {
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
  if (client) {
    try { client.destroy() } catch {}
    client    = null
    connected = false
  }
}

// ─── Presets ──────────────────────────────────────────────────────────────────
const PRESETS = {
  menu: () => setActivity({
    details: 'VoxelXClient Launcher',
    state:   'Đang ở menu chính',
  }),
  browsing: (page) => setActivity({
    details: 'VoxelXClient Launcher',
    state:   `Đang xem: ${page}`,
  }),
  launching: (version) => setActivity({
    details: `Đang khởi chạy Minecraft ${version}`,
    state:   'Chuẩn bị vào game...',
  }),
  playing: (version, username) => setActivity({
    details: `Đang chơi Minecraft ${version}`,
    state:   username ? `Tài khoản: ${username}` : 'Đang chơi',
  }),
}

module.exports = { connect, disconnect, setActivity, PRESETS }
