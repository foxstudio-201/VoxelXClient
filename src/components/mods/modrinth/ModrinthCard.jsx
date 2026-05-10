// ModrinthCard — single project card in grid or list view
function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const CATEGORY_COLORS = {
  fabric:   'bg-purple-500/15 text-purple-400',
  forge:    'bg-orange-500/15 text-orange-400',
  neoforge: 'bg-rose-500/15 text-rose-400',
  quilt:    'bg-blue-500/15 text-blue-400',
}

export default function ModrinthCard({ project, view = 'grid', onClick }) {
  const isGrid = view === 'grid'

  const loaderBadges = (project.categories || [])
    .filter(c => ['fabric','forge','neoforge','quilt','vanilla'].includes(c))
    .slice(0, 2)

  if (isGrid) {
    return (
      <button
        onClick={() => onClick(project)}
        className="group text-left rounded-xl p-3 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(74,222,128,0.25)'; e.currentTarget.style.background = 'rgba(74,222,128,0.04)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
      >
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl overflow-hidden mb-3 flex-shrink-0 bg-white/5 flex items-center justify-center">
          {project.icon_url
            ? <img src={project.icon_url} alt="" className="w-full h-full object-cover" loading="lazy" />
            : <svg className="w-6 h-6 text-white/20" fill="currentColor" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
          }
        </div>

        {/* Title */}
        <p className="text-white text-xs font-semibold leading-snug line-clamp-1 mb-1 group-hover:text-green-400 transition-colors">
          {project.title}
        </p>

        {/* Description */}
        <p className="text-white/35 text-[10px] leading-relaxed line-clamp-2 mb-2">
          {project.description}
        </p>

        {/* Loader badges */}
        {loaderBadges.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {loaderBadges.map(l => (
              <span key={l} className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold capitalize ${CATEGORY_COLORS[l] || 'bg-white/10 text-white/40'}`}>
                {l}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 text-[10px] text-white/25">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            {formatNumber(project.downloads)}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
            {formatNumber(project.follows)}
          </span>
        </div>
      </button>
    )
  }

  // List view
  return (
    <button
      onClick={() => onClick(project)}
      className="group w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(74,222,128,0.2)'; e.currentTarget.style.background = 'rgba(74,222,128,0.03)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
    >
      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 flex items-center justify-center">
        {project.icon_url
          ? <img src={project.icon_url} alt="" className="w-full h-full object-cover" loading="lazy" />
          : <svg className="w-5 h-5 text-white/20" fill="currentColor" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-white text-xs font-semibold truncate group-hover:text-green-400 transition-colors">{project.title}</p>
          {loaderBadges.map(l => (
            <span key={l} className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold capitalize flex-shrink-0 ${CATEGORY_COLORS[l] || 'bg-white/10 text-white/40'}`}>{l}</span>
          ))}
        </div>
        <p className="text-white/35 text-[10px] truncate">{project.description}</p>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-white/25 flex-shrink-0">
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          {formatNumber(project.downloads)}
        </span>
      </div>
    </button>
  )
}
