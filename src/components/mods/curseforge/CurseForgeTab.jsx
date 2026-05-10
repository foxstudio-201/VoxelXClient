// CurseForgeTab — placeholder, will be implemented in a future update
export default function CurseForgeTab() {
  return (
    <div className="flex flex-col h-full items-center justify-center gap-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.2)' }}>
        <svg className="w-8 h-8 text-orange-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
        </svg>
      </div>
      <div className="text-center">
        <h3 className="text-white/50 font-semibold text-sm mb-1">CurseForge</h3>
        <p className="text-white/25 text-xs">Coming soon</p>
      </div>
    </div>
  )
}
