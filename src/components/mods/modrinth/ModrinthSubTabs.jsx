// Sub-tabs for Modrinth: mod, modpack, shader, resourcepack, datapack
const SUB_TABS = [
  { id: 'mod',          label: 'Mods',          icon: '🧩' },
  { id: 'modpack',      label: 'Modpacks',       icon: '📦' },
  { id: 'shader',       label: 'Shaders',        icon: '✨' },
  { id: 'resourcepack', label: 'Resource Packs', icon: '🎨' },
  { id: 'datapack',     label: 'Data Packs',     icon: '📋' },
]

export default function ModrinthSubTabs({ active, onChange }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {SUB_TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
            active === tab.id
              ? 'bg-green-500/15 text-green-400 border border-green-500/25'
              : 'text-white/35 hover:text-white/60 hover:bg-white/5 border border-transparent'
          }`}
        >
          <span className="text-sm leading-none">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export { SUB_TABS }
