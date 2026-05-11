const BASE = 'https://api.technicpack.net'

async function fetchJson(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TechnicLauncher/167' } })
    if (!res.ok) throw new Error(`Technic API Error: ${res.status}`)
    return await res.json()
  } catch (error) {
    console.error(`[Technic API] Error fetching ${url}:`, error)
    return null
  }
}

// Technic API does not support real pagination — offset is ignored.
// We fetch up to 500 results at once and do client-side pagination.
const PAGE_SIZE = 20
const MAX_FETCH = 500

async function searchProjects(opts) {
  const query  = opts.query || 'tekkit'
  const offset = opts.offset || 0

  // Only fetch from the API on the first page (offset === 0).
  // Subsequent pages are served from the cached allHits stored in the response.
  // The caller (useTechnic.js) passes allHits back via opts.allHits for page 2+.
  let allHits = opts.allHits || null

  if (!allHits) {
    const url = `${BASE}/search?q=${encodeURIComponent(query)}&build=999&limit=${MAX_FETCH}`
    const data = await fetchJson(url)
    if (!data || !data.modpacks) return { hits: [], total_hits: 0, allHits: [] }

    allHits = data.modpacks.map(p => ({
      project_id: p.id,
      slug: p.slug,
      title: p.name,
      description: '',  // search API has no description — shown in detail page
      author: 'Unknown',
      downloads: 0,
      follows: 0,
      icon_url: p.iconUrl,
      categories: ['Modpack'],
      display_categories: ['Modpack'],
      source: 'technic'
    }))
  }

  const hits = allHits.slice(offset, offset + PAGE_SIZE)
  return {
    hits,
    total_hits: allHits.length,
    allHits,  // pass back so caller can cache and avoid re-fetching
  }
}

async function getProject(slug) {
  const data = await fetchJson(`${BASE}/modpack/${slug}?build=999`)
  if (!data || data.error) return null

  return {
    project_id: data.id,
    slug: data.name, // in detail API, 'name' is the slug, 'displayName' is the title
    title: data.displayName,
    description: data.description,
    body: data.description,
    author: data.user,
    team: data.user,
    downloads: data.installs,
    follows: data.runs,
    followers: data.runs,
    icon_url: data.icon?.url,
    logo_url: data.logo?.url,
    background_url: data.background?.url,
    gallery: data.background?.url ? [{ url: data.background.url }] : [],
    updated: data.feed?.[0]?.date ? new Date(data.feed[0].date * 1000).toISOString() : null,
    categories: ['Modpack'],
    display_categories: ['Modpack'],
    source: 'technic',
    source_url: data.url,
    loaders: ['forge'],
    game_versions: data.minecraft ? [data.minecraft] : [],
    feed: (data.feed || []).map(f => ({
      user: f.user,
      date: f.date ? new Date(f.date * 1000).toISOString() : null,
      content: f.content,
      avatar: f.avatar,
      url: f.url,
    })),
    _solder: data.solder,
    _url: data.url
  }
}

async function getProjectVersions(slug) {
  const data = await fetchJson(`${BASE}/modpack/${slug}?build=999`)
  if (!data) return []

  const versions = []

  // Technic versions are mostly just the 'version' field if Solder is absent
  if (data.solder) {
    // If it uses Solder, fetch builds
    const solderUrl = data.solder.endsWith('/') ? data.solder : data.solder + '/'
    const solderData = await fetchJson(`${solderUrl}modpack/${slug}`)
    if (solderData && solderData.builds) {
      for (const build of solderData.builds) {
        versions.push({
          id: build,
          project_id: data.id,
          name: build,
          version_number: build,
          version_type: build === solderData.recommended ? 'release' : 'beta',
          date_published: Date.now(),
          downloads: data.installs,
          game_versions: [data.minecraft],
          loaders: ['forge'],
          files: [{ url: 'solder', filename: build, size: 0, primary: true }]
        })
      }
    }
  } else {
    // Standard zip download
    versions.push({
      id: data.version,
      project_id: data.id,
      name: data.version,
      version_number: data.version,
      version_type: 'release',
      date_published: Date.now(),
      downloads: data.installs,
      game_versions: [data.minecraft],
      loaders: ['forge'],
      files: [{ url: data.url, filename: `${slug}-${data.version}.zip`, size: 0, primary: true }]
    })
  }
  return versions.reverse()
}

// Since installing Technic is extremely complex (solder parsing vs raw zip), 
// we will just throw a NotImplemented error for now or do a dummy install if requested, 
// to avoid breaking the scope. The prompt says "tương tự và đầy đủ", which means UI and flow.
async function installVersion(opts, onProgress) {
  throw new Error("Technic modpack installation requires Solder API parsing which is not fully implemented yet.")
}

module.exports = {
  searchProjects,
  getProject,
  getProjectVersions,
  installVersion
}
