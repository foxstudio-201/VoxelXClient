'use strict'

const { ipcMain } = require('electron')
const path = require('path')
const fs   = require('fs')
const { app } = require('electron')

const DATA_DIR = path.join(app.getPath('appData'), '.VoxelXClient')
const BOOKMARKS_FILE = path.join(DATA_DIR, 'serverBookmarks.json')

function readBookmarks() {
  try { return JSON.parse(fs.readFileSync(BOOKMARKS_FILE, 'utf-8')) }
  catch { return { servers: [] } }
}

function writeBookmarks(data) {
  const dir = path.dirname(BOOKMARKS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = BOOKMARKS_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 })
  fs.renameSync(tmp, BOOKMARKS_FILE)
}

const { pingServer } = require('./serverPing.cjs')

function registerServerBookmarkHandlers(getTrustedWindow) {
  ipcMain.handle('serverBookmarks:get', (e) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    return readBookmarks()
  })

  ipcMain.handle('serverBookmarks:add', (e, server) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readBookmarks()
    data.servers.push({
      id: require('crypto').randomUUID(),
      name: server.name || 'Unknown Server',
      address: server.address || '',
      port: server.port || 25565,
      createdAt: new Date().toISOString(),
      lastPlayed: null,
    })
    writeBookmarks(data)
    return { ok: true, servers: data.servers }
  })

  ipcMain.handle('serverBookmarks:update', (e, { id, patch }) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readBookmarks()
    const idx = data.servers.findIndex(s => s.id === id)
    if (idx === -1) return { error: 'Server not found' }
    data.servers[idx] = { ...data.servers[idx], ...patch, id }
    writeBookmarks(data)
    return { ok: true, servers: data.servers }
  })

  ipcMain.handle('serverBookmarks:delete', (e, id) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const data = readBookmarks()
    data.servers = data.servers.filter(s => s.id !== id)
    writeBookmarks(data)
    return { ok: true, servers: data.servers }
  })

  ipcMain.handle('serverBookmarks:ping', async (e, { address, port }) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const result = await pingServer(address, port || 25565)
    return result
  })
}

module.exports = { registerServerBookmarkHandlers }
