import { useState, useCallback } from 'react'
import ModrinthSubTabs from './ModrinthSubTabs'
import ModrinthFilters from './ModrinthFilters'
import ModrinthGrid from './ModrinthGrid'
import ModrinthDetail from './ModrinthDetail'
import ViewToggle from '../shared/ViewToggle'
import { useModrinthSearch } from './useModrinth'

const DEFAULT_FILTERS = {
  query:        '',
  projectType:  'mod',
  sortBy:       'relevance',
  gameVersions: [],
  loaders:      [],
  categories:   [],
}

export default function ModrinthTab() {
  const [filters, setFilters]         = useState(DEFAULT_FILTERS)
  const [view, setView]               = useState('grid')
  const [selectedProject, setProject] = useState(null) // { id, type }
  const [searchInput, setSearchInput] = useState('')

  const { results, total, loading, error, loadMore, hasMore, refresh } = useModrinthSearch(filters)

  function updateFilters(patch) {
    setFilters(prev => ({ ...prev, ...patch }))
    setProject(null)
  }

  function handleSubTab(type) {
    updateFilters({ projectType: type, query: '' })
    setSearchInput('')
  }

  function handleSearch(e) {
    e.preventDefault()
    updateFilters({ query: searchInput })
  }

  function handleSelectProject(project) {
    setProject({ id: project.project_id, type: filters.projectType })
  }

  // If a project is selected, show detail view
  if (selectedProject) {
    return (
      <ModrinthDetail
        projectId={selectedProject.id}
        projectType={selectedProject.type}
        onBack={() => setProject(null)}
      />
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-tabs + search bar */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2 space-y-2">
        <ModrinthSubTabs active={filters.projectType} onChange={handleSubTab} />

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder={`Search ${filters.projectType}s...`}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-green-500/50 transition-colors"
            />
          </div>
          <ViewToggle view={view} onChange={setView} />
        </form>

        {/* Result count */}
        {!loading && total > 0 && (
          <p className="text-[10px] text-white/25">{total.toLocaleString()} results</p>
        )}
      </div>

      {/* Main: filters + content */}
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Left: filters panel */}
        <div
          className="flex-shrink-0 w-36 border-r overflow-hidden"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <ModrinthFilters filters={filters} onChange={updateFilters} />
        </div>

        {/* Right: content */}
        <div className="flex-1 overflow-hidden px-2 py-1">
          <ModrinthGrid
            results={results}
            loading={loading}
            error={error}
            view={view}
            onSelect={handleSelectProject}
            hasMore={hasMore}
            onLoadMore={loadMore}
          />
        </div>
      </div>
    </div>
  )
}
