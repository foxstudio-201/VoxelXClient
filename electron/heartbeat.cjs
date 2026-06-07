'use strict'

/**
 * VoxelX Heartbeat — gửi online status lên server mỗi 30s
 */

const { app } = require('electron')
const path = require('path')
const fs   = require('fs')

const API_BASE = 'https://www.voxelx.io.vn/api/friends'
const INTERVAL_MS = 30000 // 30s

const DATA_DIR      = path.join(app.getPath('appData'), '.VoxelXClient')
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json')

let _timer = null
let _isPlaying = false
let _gameInfo  = null

function getSelectedAccount() {
  try {
    const data = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'))
    const acc = data.accounts?.find(a => a.id === data.selectedId)
    return acc || null
  } catch { return null }
}

function apiPost(action, body) {
  const https   = require('https')
  const bodyStr = JSON.stringify(body)
  const url     = new URL(`${API_BASE}?action=${action}`)
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
          try { resolve(JSON.parse(d)) } catch { resolve(null) }
        })
      })
      req.on('error', () => resolve(null))
      req.setTimeout(8000, () => { req.destroy(); resolve(null) })
      req.write(bodyStr); req.end()
    }
    doReq(url.hostname, url.pathname + url.search)
  })
}

async function sendHeartbeat() {
  const acc = getSelectedAccount()
  if (!acc?.uuid) return

  await apiPost('heartbeat', {
    uuid: acc.uuid,
    username: acc.username || '',
    isPlaying: _isPlaying,
    gameInfo: _gameInfo,
  })
}

function startHeartbeat() {
  if (_timer) return
  // Gửi ngay lần đầu
  sendHeartbeat()
  _timer = setInterval(sendHeartbeat, INTERVAL_MS)
}

function stopHeartbeat() {
  if (_timer) { clearInterval(_timer); _timer = null }
}

function setPlayingState(playing, info = null) {
  _isPlaying = playing
  _gameInfo  = info
  // Gửi ngay khi trạng thái thay đổi
  sendHeartbeat()
}

module.exports = { startHeartbeat, stopHeartbeat, setPlayingState }
