import { useState, useEffect, useRef } from 'react'

/**
 * VersionSelect — custom dropdown thay thế <select> native
 * Dùng cho chọn phiên bản mod trong ModrinthDetail và InstallModal
 */
export default function VersionSelect({ versions, value, onChange, loading, placeholder }) {
  const [open, setOpen]   = useState(false)
  const ref               = useRef(null)
  const listRef           = useRef(null)

  const selected = versions?.find(v => v.id === value)

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Scroll selected item into view when opening
  useEffect(() => {
    if (open && listRef.current && selected) {
      const el = listRef.current.querySelector('[data-selected="true"]')
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [open, selected])

  function getTypeColor(type) {
    if (type === 'release') return 'bg-green-500/15 text-green-400'
    if (type === 'beta')    return 'bg-yellow-500/15 text-yellow-400'
    return 'bg-white/8 text-white/40'
  }

  return (
    <div ref={ref} className="relative flex-1">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !loading && setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs transition-all"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${open ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)'}`,
          color: selected ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)',
        }}
      >
        <span className="truncate flex items-center gap-2 min-w-0">
          {loading ? (
            <span className="text-white/30">Loading versions...</span>
          ) : selected ? (
            <>
              <span className="truncate">{selected.version_number}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${getTypeColor(selected.version_type)}`}>
                {selected.version_type}
              </span>
              <span className="text-white/25 flex-shrink-0 hidden sm:inline">
                {selected.game_versions?.slice(0, 2).join(', ')}
              </span>
            </>
          ) : (
            <span>{placeholder || `Select version${versions?.length ? ` (${versions.length})` : ''}`}</span>
          )}
        </span>
        <svg
          className={`w-3.5 h-3.5 flex-shrink-0 text-white/30 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {/* Dropdown list */}
      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl overflow-hidden"
          style={{
            background: 'rgba(16,16,16,0.98)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div
            ref={listRef}
            className="overflow-y-auto max-h-52 py-1 custom-scroll"
          >
            {(!versions || versions.length === 0) && (
              <div className="px-3 py-3 text-xs text-white/25 text-center">No versions available</div>
            )}
            {versions?.map(v => {
              const isSelected = v.id === value
              return (
                <button
                  key={v.id}
                  data-selected={isSelected}
                  type="button"
                  onClick={() => { onChange(v); setOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-100"
                  style={{
                    background: isSelected ? 'rgba(74,222,128,0.1)' : 'transparent',
                    color: isSelected ? '#4ade80' : 'rgba(255,255,255,0.65)',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  {/* Version number */}
                  <span className="text-xs font-semibold truncate flex-1 min-w-0">
                    {v.version_number}
                  </span>

                  {/* Type badge */}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${getTypeColor(v.version_type)}`}>
                    {v.version_type}
                  </span>

                  {/* Game versions */}
                  <span className="text-[10px] text-white/25 flex-shrink-0 hidden sm:inline">
                    {v.game_versions?.slice(0, 2).join(', ')}
                  </span>

                  {/* Checkmark */}
                  {isSelected && (
                    <svg className="w-3 h-3 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
