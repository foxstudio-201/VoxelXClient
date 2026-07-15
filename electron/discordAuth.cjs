/**
 * VoxelXLauncher — Minecraft Launcher
 * Created by FoxStudio. AI-assisted development.
 *
 * Source code : https://github.com/foxstudio-201/VoxelXLauncher
 * Website     : https://voxxelxclient.vercel.app
 *
 * NOTICE:
 *   - This software is provided as-is without warranty of any kind.
 *   - Do not redistribute or resell without explicit permission from FoxStudio.
 *   - If you use or reference this code, please credit FoxStudio.
 *   - Minecraft is a trademark of Mojang Studios / Microsoft. This project is not affiliated with Mojang.
 */

 /**
 * VoxelXLauncher — Minecraft Launcher
 * Created by FoxStudio. AI-assisted development.
 *
 * Source code : https://github.com/foxstudio-201/VoxelXLauncher
 * Website     : https://voxxelxclient.vercel.app
 *
 * NOTICE:
 *   - Dành cho mấy cháu cứ thích phỉ báng.
 *   - Launcher sử dụng ai đi kèm trong việc tạo, bản thân người tạo không tự nhận là code toàn bộ do có sự hỗ trợ của ai.
 *   - Giỏi giang thì tự code bằng năng lực của mình đang video làm toàn bộ từ đầu đến cuối, còn không làm được đừng có kích đểu ảnh hưởng đến người sử dụng.
 *   - Bạn chẳng phải là anh hùng mặc áo choàng đỏ mặc quần xịt như thằng trẻ trâu rồi lên mạng ra vẻ ta đây là người tốt, là anh hùng, là người bảo vệ công lý gì đâu :).
 *   - Vậy nên bớt ảo tưởng đi.
 *   - Nếu có sử dụng hoặc tham khảo code này, hãy ghi công cho FoxStudio.
 *   - Minecraft là một thương hiệu của Mojang Studios / Microsoft. Dự án này không liên kết với Mojang.
 */

const { shell } = require('electron')

const DEFAULT_WEB_BASE_URL = process.env.VXC_WEB_BASE_URL || 'https://voxelx.io.vn'
const DEFAULT_TIMEOUT_MS = 3 * 60 * 1000
const POLL_INTERVAL_MS = 2000

function getApiBaseUrl() {
  return `${DEFAULT_WEB_BASE_URL.replace(/\/+$/, '')}/api/discord-link`
}

async function createLinkSession() {
  const res = await fetch(getApiBaseUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'create_session',
      source: 'launcher',
    }),
  })

  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  if (!res.ok) {
    throw new Error(json?.error || `Khong the tao phien lien ket Discord (${res.status}).`)
  }
  if (!json?.ok || !json?.sessionId || !json?.pollToken || !json?.authUrl) {
    throw new Error('Backend Discord tra ve du lieu khong hop le.')
  }
  return json
}

async function getLinkSessionStatus(sessionId, pollToken) {
  const url = new URL(getApiBaseUrl())
  url.searchParams.set('sessionId', sessionId)
  url.searchParams.set('pollToken', pollToken)

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  })

  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  if (!res.ok) {
    throw new Error(json?.error || `Khong the lay trang thai lien ket Discord (${res.status}).`)
  }
  return json
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForLinkedProfile(sessionId, pollToken) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < DEFAULT_TIMEOUT_MS) {
    const status = await getLinkSessionStatus(sessionId, pollToken)
    if (status?.status === 'linked' && status.profile) return status.profile
    if (status?.status === 'expired') throw new Error('Phien lien ket Discord da het han.')
    if (status?.status === 'failed') throw new Error(status.error || 'Lien ket Discord that bai.')
    await sleep(POLL_INTERVAL_MS)
  }

  throw new Error('Het thoi gian cho lien ket Discord.')
}

async function startDiscordLink() {
  if (!process.env.VXC_WEB_BASE_URL) throw new Error('API Discord không khả dụng')
  const session = await createLinkSession()
  await shell.openExternal(session.authUrl)
  return waitForLinkedProfile(session.sessionId, session.pollToken)
}

module.exports = {
  startDiscordLink,
}

