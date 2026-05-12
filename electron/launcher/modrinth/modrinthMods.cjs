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

const https  = require('https')
const http   = require('http')
const fs     = require('fs')
const path   = require('path')

const MODRINTH_API = 'https://api.modrinth.com/v2'

const FABRIC_AUTO_MODS = [
  { id: 'P7dR8mSH', name: 'Fabric API' },
  { id: 'mOgUt4GM', name: 'Mod Menu'   },
]

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url)
    https.get({
      hostname: opts.hostname,
      path:     opts.pathname + opts.search,
      headers:  {
        'User-Agent': 'VoxelXClient/1.0 (github.com/voxelxclient)',
        'Accept':     'application/json',
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGetJson(res.headers.location).then(resolve).catch(reject)
      }
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${url}`))
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error(`Invalid JSON from ${url}`)) }
      })
    }).on('error', reject)
  })
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const dir = path.dirname(destPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const tmpPath = destPath + '.tmp'

    client.get(url, { headers: { 'User-Agent': 'VoxelXClient/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`HTTP ${res.statusCode}: ${url}`))
      }
      const out = fs.createWriteStream(tmpPath)
      res.pipe(out)
      out.on('finish', () => { fs.renameSync(tmpPath, destPath); resolve() })
      out.on('error', err => { try { fs.unlinkSync(tmpPath) } catch {} reject(err) })
      res.on('error', err => { try { fs.unlinkSync(tmpPath) } catch {} reject(err) })
    }).on('error', reject)
  })
}

// ─── Find best version for a mod ─────────────────────────────────────────────

async function findModVersion(projectId, mcVersion) {
  const url = `${MODRINTH_API}/project/${projectId}/version?game_versions=["${mcVersion}"]&loaders=["fabric"]`
  const versions = await httpsGetJson(url)
  if (!Array.isArray(versions) || versions.length === 0) return null

  versions.sort((a, b) => new Date(b.date_published) - new Date(a.date_published))
  return versions[0]
}

// ─── Main: ensure mods are installed ─────────────────────────────────────────

async function ensureFabricMods(mcVersion, modsDir, onProgress) {
  if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true })

  let done = 0
  const total = FABRIC_AUTO_MODS.length

  for (const mod of FABRIC_AUTO_MODS) {
    done++
    onProgress?.({ log: `Checking ${mod.name} for ${mcVersion}...`, done, total })

    let version
    try {
      version = await findModVersion(mod.id, mcVersion)
    } catch (err) {
      onProgress?.({ log: `Warning: Could not fetch ${mod.name}: ${err.message}`, done, total })
      continue
    }

    if (!version) {
      onProgress?.({ log: `${mod.name}: no compatible version for ${mcVersion}, skipping.`, done, total })
      continue
    }

    const primaryFile = version.files?.find(f => f.primary) || version.files?.[0]
    if (!primaryFile) {
      onProgress?.({ log: `${mod.name}: no file found, skipping.`, done, total })
      continue
    }

    const fileName = primaryFile.filename
    const destPath = path.join(modsDir, fileName)

    if (fs.existsSync(destPath)) {
      onProgress?.({ log: `${mod.name} already installed (${fileName}).`, done, total })
      continue
    }

    try {
      const existing = fs.readdirSync(modsDir)
      for (const f of existing) {

        if (f !== fileName && version.files?.some(vf => {

          const slug = vf.filename.split('-')[0]
          return f.startsWith(slug + '-') && f.endsWith('.jar')
        })) {
          fs.unlinkSync(path.join(modsDir, f))
          onProgress?.({ log: `Removed old ${mod.name}: ${f}`, done, total })
        }
      }
    } catch {}

    onProgress?.({ log: `Downloading ${mod.name} ${version.version_number}...`, done, total })
    try {
      await downloadFile(primaryFile.url, destPath)
      onProgress?.({ log: `${mod.name} ${version.version_number} installed.`, done, total })
    } catch (err) {
      onProgress?.({ log: `Failed to download ${mod.name}: ${err.message}`, done, total })
    }
  }
}

module.exports = { ensureFabricMods }

