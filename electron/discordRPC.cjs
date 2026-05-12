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

const DiscordRPC = require('discord-rpc')

const CLIENT_ID = '1502586952040452249'

let client    = null
let connected = false
let retryTimer = null
let intentionalDisconnect = false

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
    console.log('[Discord RPC] CLIENT_ID not configured — skipping')
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
      if (!intentionalDisconnect) scheduleRetry()
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
  }, 15000)
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

