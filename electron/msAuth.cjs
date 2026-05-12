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

'use strict'

const https   = require('https')
const http    = require('http')
const crypto  = require('crypto')
const { BrowserWindow } = require('electron')

// ─── OAuth config — using the official Minecraft Launcher client ID ───────────
const CLIENT_ID    = '00000000402b5328'
const REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf'
const SCOPE        = 'XboxLive.signin offline_access'
const AUTH_URL     = 'https://login.live.com/oauth20_authorize.srf'
const TOKEN_URL    = 'https://login.live.com/oauth20_token.srf'

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function httpsPost(url, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
    const ctype   = typeof body === 'string' ? 'application/x-www-form-urlencoded' : 'application/json'
    const u       = new URL(url)

    const req = https.request({
      hostname: u.hostname,
      path:     u.pathname + u.search,
      method:   'POST',
      headers:  {
        'Content-Type':   ctype,
        'Content-Length': Buffer.byteLength(bodyStr),
        'User-Agent':     'VoxelXClient/1.0',
        'Accept':         'application/json',
        ...extraHeaders,
      },
    }, (res) => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    req.write(bodyStr)
    req.end()
  })
}

function encodeForm(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
}

// ─── Step 1: Open Microsoft login window ─────────────────────────────────────

function openAuthWindow(parentWindow) {
  return new Promise((resolve, reject) => {
    const state = crypto.randomBytes(16).toString('hex')

    const authUrl = AUTH_URL +
      `?client_id=${CLIENT_ID}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=${encodeURIComponent(SCOPE)}` +
      `&state=${state}` +
      `&prompt=select_account`

    const win = new BrowserWindow({
      width:  520,
      height: 680,
      parent: parentWindow ?? undefined,
      modal:  true,
      title:  'Đăng nhập Microsoft',
      frame:  true,
      resizable: false,
      webPreferences: {
        nodeIntegration:  false,
        contextIsolation: true,
        sandbox:          false,
        webSecurity:      false,
        partition:        'auth-window',
      },
    })

    win.setMenuBarVisibility(false)

    let resolved = false

    function handleRedirect(url) {
      if (!url.startsWith(REDIRECT_URI)) return false
      try {
        const u      = new URL(url)
        const code   = u.searchParams.get('code')
        const retState = u.searchParams.get('state')
        const error  = u.searchParams.get('error')
        const errDesc = u.searchParams.get('error_description')

        if (error) {
          resolved = true
          win.close()
          reject(new Error(errDesc || error))
          return true
        }
        if (code && retState === state) {
          resolved = true
          win.close()
          resolve(code)
          return true
        }
      } catch {}
      return false
    }

    win.webContents.on('will-redirect', (_e, url) => { handleRedirect(url) })
    win.webContents.on('will-navigate', (_e, url) => { handleRedirect(url) })

    win.webContents.on('did-navigate', (_e, url) => { handleRedirect(url) })

    win.on('closed', () => {
      if (!resolved) reject(new Error('Người dùng đã đóng cửa sổ đăng nhập.'))
    })

    win.loadURL(authUrl)
  })
}

// ─── Step 2: Exchange authorization code for tokens ──────────────────────────
async function exchangeCodeForTokens(code) {
  const res = await httpsPost(TOKEN_URL, encodeForm({
    client_id:    CLIENT_ID,
    code,
    grant_type:   'authorization_code',
    redirect_uri: REDIRECT_URI,
    scope:        SCOPE,
  }))
  if (!res.body.access_token) {
    throw new Error(res.body.error_description || res.body.error || `Token exchange failed: ${res.status}`)
  }
  return res.body
}

// ─── Step 3: Refresh access token ────────────────────────────────────────────
async function refreshAccessToken(refreshToken) {
  const res = await httpsPost(TOKEN_URL, encodeForm({
    client_id:     CLIENT_ID,
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
    scope:         SCOPE,
  }))
  if (!res.body.access_token) {
    throw new Error(res.body.error_description || 'Refresh token thất bại')
  }
  return res.body
}

// ─── Step 4: Xbox Live auth ───────────────────────────────────────────────────
async function authXboxLive(msAccessToken) {
  const res = await httpsPost('https://user.auth.xboxlive.com/user/authenticate', {
    Properties: {
      AuthMethod: 'RPS',
      SiteName:   'user.auth.xboxlive.com',
      RpsTicket:  `d=${msAccessToken}`,
    },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType:    'JWT',
  })
  if (res.status !== 200) throw new Error(`XBL auth failed: ${res.status}`)
  const xblToken = res.body.Token
  const userHash = res.body.DisplayClaims?.xui?.[0]?.uhs
  if (!xblToken || !userHash) throw new Error('XBL response missing token/userhash')
  return { xblToken, userHash }
}

// ─── Step 5: XSTS token ───────────────────────────────────────────────────────
async function authXSTS(xblToken) {
  const res = await httpsPost('https://xsts.auth.xboxlive.com/xsts/authorize', {
    Properties: {
      SandboxId:  'RETAIL',
      UserTokens: [xblToken],
    },
    RelyingParty: 'rp://api.minecraftservices.com/',
    TokenType:    'JWT',
  })
  if (res.status === 401) {
    const xerr = res.body.XErr
    if (xerr === 2148916233) throw new Error('Tài khoản Microsoft chưa có Xbox Live. Vui lòng tạo tại xbox.com.')
    if (xerr === 2148916235) throw new Error('Xbox Live không khả dụng ở quốc gia của bạn.')
    if (xerr === 2148916238) throw new Error('Tài khoản trẻ em cần được phụ huynh xác nhận.')
    throw new Error(`XSTS lỗi: ${xerr}`)
  }
  if (res.status !== 200) throw new Error(`XSTS auth failed: ${res.status}`)
  const xstsToken = res.body.Token
  const userHash  = res.body.DisplayClaims?.xui?.[0]?.uhs
  if (!xstsToken || !userHash) throw new Error('XSTS response missing token/userhash')
  return { xstsToken, userHash }
}

// ─── Step 6: Minecraft Bearer token ──────────────────────────────────────────
async function authMinecraft(xstsToken, userHash) {
  const res = await httpsPost(
    'https://api.minecraftservices.com/authentication/login_with_xbox',
    { identityToken: `XBL3.0 x=${userHash};${xstsToken}` }
  )
  if (res.status !== 200) throw new Error(`Minecraft auth failed: ${res.status}`)
  const mcToken = res.body.access_token
  if (!mcToken) throw new Error('Không nhận được Minecraft access token')
  return { mcToken, expiresIn: res.body.expires_in || 86400 }
}

// ─── Step 7: Minecraft profile ────────────────────────────────────────────────
async function getMinecraftProfile(mcToken) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.minecraftservices.com',
      path:     '/minecraft/profile',
      method:   'GET',
      headers:  { 'Authorization': `Bearer ${mcToken}`, 'User-Agent': 'VoxelXClient/1.0' },
    }, (res) => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        try {
          const body = JSON.parse(data)
          if (res.statusCode === 404 || body.error === 'NOT_FOUND') {
            return reject(new Error('Tài khoản này chưa mua Minecraft Java Edition.'))
          }
          if (res.statusCode !== 200) return reject(new Error(`Profile fetch failed: ${res.statusCode}`))
          if (!body.id || !body.name) return reject(new Error('Profile response không hợp lệ'))
          const raw  = body.id
          const uuid = `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`
          resolve({ uuid, username: body.name })
        } catch { reject(new Error('Không parse được profile response')) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

// ─── Full chain from MS tokens → Minecraft profile ───────────────────────────
async function msTokensToMinecraft(msAccessToken, msRefreshToken) {
  const { xblToken }              = await authXboxLive(msAccessToken)
  const { xstsToken, userHash }   = await authXSTS(xblToken)
  const { mcToken, expiresIn }    = await authMinecraft(xstsToken, userHash)
  const { uuid, username }        = await getMinecraftProfile(mcToken)
  return {
    username, uuid,
    msRefreshToken,
    mcToken,
    mcTokenExpiry: Date.now() + expiresIn * 1000,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function loginWithWindow(parentWindow) {
  const code     = await openAuthWindow(parentWindow)
  const msTokens = await exchangeCodeForTokens(code)
  return msTokensToMinecraft(msTokens.access_token, msTokens.refresh_token)
}

async function refreshMinecraftToken(msRefreshToken) {
  const msTokens = await refreshAccessToken(msRefreshToken)
  return msTokensToMinecraft(msTokens.access_token, msTokens.refresh_token || msRefreshToken)
}

module.exports = { loginWithWindow, refreshMinecraftToken }

