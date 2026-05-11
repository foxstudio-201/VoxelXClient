import {
  PuzzlePiece,
  Package,
  Sparkle,
  PaintBrush,
  Database,
} from '@phosphor-icons/react'

const SUB_TABS = [
  { id: 'mod',          label: 'Mods',           Icon: PuzzlePiece },
  { id: 'modpack',      label: 'Modpacks',        Icon: Package     },
  { id: 'shader',       label: 'Shaders',         Icon: Sparkle     },
  { id: 'resourcepack', label: 'Resource Packs',  Icon: PaintBrush  },
  { id: 'datapack',     label: 'Data Packs',      Icon: Database    },
]

export default function TechnicSubTabs({ active, onChange }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {SUB_TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
            active === id
              ? 'bg-green-500/15 text-green-400 border border-green-500/25'
              : 'text-white/35 hover:text-white/60 hover:bg-white/5 border border-transparent'
          }`}
        >
          <Icon size={14} weight={active === id ? 'fill' : 'regular'} />
          {label}
        </button>
      ))}
    </div>
  )
}

export { SUB_TABS }
