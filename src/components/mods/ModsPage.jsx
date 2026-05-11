import { useState } from 'react'
import ModrinthTab from './modrinth/ModrinthTab'
import CurseForgeTab from './curseforge/CurseForgeTab'
import TechnicTab from './technic/TechnicTab'
import FtbTab from './ftb/FtbTab'

import modrinthIcon   from '../../assets/loader/modrinth.png'
import curseforgeIcon from '../../assets/loader/curseforge.png'
import technicIcon    from '../../assets/loader/technic.png'
import ftbIcon        from '../../assets/loader/ftb.png'

const PLATFORM_TABS = [
  { id: 'modrinth',   label: 'Modrinth',   icon: modrinthIcon },
  { id: 'curseforge', label: 'CurseForge', icon: curseforgeIcon },
  { id: 'technic',    label: 'Technic',    icon: technicIcon },
  { id: 'ftb',        label: 'FTB',        icon: ftbIcon },
]

export default function ModsPage() {
  const [platform, setPlatform] = useState('modrinth')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Platform tabs */}
      <div className="flex-shrink-0 px-4 pt-3 pb-0">
        <div className="flex gap-1 border-b border-white/5">
          {PLATFORM_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setPlatform(tab.id)}
              className={`
                flex items-center gap-2.5 px-5 py-3 text-sm font-semibold
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
                className={`w-5 h-5 object-contain transition-opacity ${platform === tab.id ? 'opacity-100' : 'opacity-40'}`}
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
        {platform === 'technic'    && <TechnicTab />}
        {platform === 'ftb'        && <FtbTab />}
      </div>
    </div>
  )
}
