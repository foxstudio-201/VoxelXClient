// ViewToggle — switch between grid and list view
export default function ViewToggle({ view, onChange }) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/5 border border-white/8">
      <button
        onClick={() => onChange('grid')}
        title="Grid view"
        className={`p-1.5 rounded-md transition-all ${view === 'grid' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
          <rect x="1" y="1" width="6" height="6" rx="1"/>
          <rect x="9" y="1" width="6" height="6" rx="1"/>
          <rect x="1" y="9" width="6" height="6" rx="1"/>
          <rect x="9" y="9" width="6" height="6" rx="1"/>
        </svg>
      </button>
      <button
        onClick={() => onChange('list')}
        title="List view"
        className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
          <rect x="1" y="2" width="14" height="2.5" rx="1"/>
          <rect x="1" y="6.75" width="14" height="2.5" rx="1"/>
          <rect x="1" y="11.5" width="14" height="2.5" rx="1"/>
        </svg>
      </button>
    </div>
  )
}
