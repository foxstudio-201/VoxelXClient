import { useState } from 'react'
import ModrinthTab from './modrinth/ModrinthTab'
import CurseForgeTab from './curseforge/CurseForgeTab'

import modrinthIcon    from '../../assets/loader/modrinth.png'
import curseforgeIcon  from '../../assets/loader/curseforge.png'

const PLATFORM_TABS = [
  { id: 'modrinth',    label: 'Modrinth',    icon: modrinthIcon },
  { id: 'curseforge',  label: 'CurseForge',  icon: curseforgeIcon },
]

export default function ModsPage() {
  const [platform, setPlatform] = useState('modrinth')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-0">
        <div className="mb-3">
          <h1 className="text-lg font-bold text-white">Mods</h1>
          <p className="text-xs text-white/30 mt-0.5">Browse and install mods, modpacks, shaders and more</p>
        </div>

        {/* Platform tabs */}
        <div className="flex gap-1 border-b border-white/5">
          {PLATFORM_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setPlatform(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 text-xs font-semibold
                border-b-2 transition-all duration-150 -mb-px
                ${platform === tab.id
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-white/35 hover:text-white/60 hover:border-white/15'
                }
              `}
            >
              <img
                src={tab.icon}
                alt={tab.label}
                className={`w-4 h-4 object-contain transition-opacity ${platform === tab.id ? 'opacity-100' : 'opacity-40'}`}
              />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {platform === 'modrinth'   && <ModrinthTab />}
        {platform === 'curseforge' && <CurseForgeTab />}
      </div>
    </div>
  )
}
