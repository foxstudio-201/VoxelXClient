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

const BASE = 'https://api.curse.tools/v1/cf'

async function fetchCf(endpoint) {
  try {
    const res = await fetch(`${BASE}${endpoint}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    })
    if (!res.ok) throw new Error(`CF API Error: ${res.status} ${res.statusText}`)
    return await res.json()
  } catch (error) {
    console.error(`[CurseForge API] Error fetching ${endpoint}:`, error)
    return null
  }
}

async function searchProjects(opts) {
  const { query, gameVersions = [], loaders = [], categoryId, sortBy = 'relevance', offset = 0, limit = 20, projectType = 'mod' } = opts
  const params = new URLSearchParams()
  params.append('gameId', '432')

  const classMap = {
    'mod': 6,
    'modpack': 4471,
    'shader': 6552,
    'resourcepack': 12,
    'datapack': 12
  }
  params.append('classId', classMap[projectType] || 6)

  if (query) params.append('searchFilter', query)
  if (categoryId) params.append('categoryId', categoryId)
  if (gameVersions.length > 0) params.append('gameVersion', gameVersions[0])
  if (loaders.length > 0) params.append('modLoaderType', getModLoaderType(loaders[0]))

  const sortMap = {
    relevance: 1,
    downloads: 2,
    updated: 3,
    newest: 4,
  }
  params.append('sortField', sortMap[sortBy] || 1)
  params.append('sortOrder', 'desc')

  params.append('index', offset)
  params.append('pageSize', limit)

  const data = await fetchCf(`/mods/search?${params.toString()}`)
  if (!data || !data.data) return { hits: [], total_hits: 0 }

  return {
    hits: data.data.map(p => formatProject(p)),
    total_hits: data.pagination ? data.pagination.totalCount : data.data.length
  }
}

function getModLoaderType(loader) {
  const map = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 }
  return map[loader.toLowerCase()] || 0
}

function formatProject(p) {
  return {
    project_id: p.id,
    slug: p.slug,
    title: p.name,
    description: p.summary,
    author: p.authors ? p.authors.map(a => a.name).join(', ') : 'Unknown',
    downloads: p.downloadCount,
    follows: 0,
    icon_url: p.logo ? p.logo.thumbnailUrl : '',
    date_modified: p.dateModified,
    date_created: p.dateCreated,
    categories: p.categories ? p.categories.map(c => c.name) : [],
    display_categories: p.categories ? p.categories.map(c => c.name) : [],
    versions: [],
    client_side: 'optional',
    server_side: 'optional',
    source: 'curseforge'
  }
}

async function getProject(id) {
  const data = await fetchCf(`/mods/${id}`)
  if (!data || !data.data) return null
  const p = data.data
  const proj = formatProject(p)
  proj.body = p.summary

  const descData = await fetchCf(`/mods/${id}/description`)
  if (descData && descData.data) {
    proj.body = descData.data
  }
  return proj
}

async function getProjectVersions(id, filters = {}) {

  const data = await fetchCf(`/mods/${id}/files`)
  if (!data || !data.data) return []

  let files = data.data
  if (filters.loaders && filters.loaders.length > 0) {
    files = files.filter(f => f.gameVersions.some(gv => filters.loaders.some(l => gv.toLowerCase().includes(l.toLowerCase()))))
  }
  if (filters.gameVersions && filters.gameVersions.length > 0) {
    files = files.filter(f => f.gameVersions.some(gv => filters.gameVersions.includes(gv)))
  }

  return files.map(f => ({
    id: f.id,
    project_id: f.modId,
    name: f.displayName,
    version_number: f.displayName,
    version_type: f.releaseType === 1 ? 'release' : f.releaseType === 2 ? 'beta' : 'alpha',
    date_published: f.fileDate,
    downloads: f.downloadCount,
    game_versions: f.gameVersions.filter(v => /^1\.\d+/.test(v)),
    loaders: f.gameVersions.filter(v => ['forge', 'fabric', 'quilt', 'neoforge'].includes(v.toLowerCase())).map(v => v.toLowerCase()),
    files: [{
      url: f.downloadUrl,
      filename: f.fileName,
      size: f.fileLength,
      primary: true
    }]
  }))
}

async function getCategories(projectType = 'mod') {
  const classMap = {
    'mod': 6,
    'modpack': 4471,
    'shader': 6552,
    'resourcepack': 12,
    'datapack': 12
  }
  const classId = classMap[projectType] || 6
  const data = await fetchCf(`/categories?gameId=432&classId=${classId}&classesOnly=false`)
  if (!data || !data.data) return []
  return data.data.filter(c => c.classId === classId).map(c => ({
    id: c.id,
    icon: c.iconUrl,
    name: c.name,
    project_type: projectType
  }))
}

const fs = require('fs')
const path = require('path')

async function installVersion(opts, onProgress) {
  const { versionId, instancePath } = opts

  const fileData = await fetchCf(`/files/${versionId}`)
  if (!fileData || !fileData.data) throw new Error('File not found')

  const file = fileData.data
  const downloadUrl = file.downloadUrl
  const filename = file.fileName

  if (!downloadUrl) throw new Error('No download URL available (possibly disabled by author)')

  const destDir = path.join(instancePath, 'mods')
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

  const destPath = path.join(destDir, filename)

  return new Promise((resolve, reject) => {
    if (onProgress) onProgress({ log: `Bắt đầu tải ${filename}...`, percent: 0, total: file.fileLength })

    fetch(downloadUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const arrayBuffer = await res.arrayBuffer()
        fs.writeFileSync(destPath, Buffer.from(arrayBuffer))
        if (onProgress) onProgress({ log: `Đã cài đặt ${filename}`, percent: 100, total: file.fileLength })
        resolve({ success: true, file: filename })
      })
      .catch(reject)
  })
}

module.exports = {
  searchProjects,
  getProject,
  getProjectVersions,
  getCategories,
  installVersion
}

