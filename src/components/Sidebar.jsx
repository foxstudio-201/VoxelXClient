import {
  HomeIcon as HomeOutline,
  PlayCircleIcon as PlayOutline,
  PuzzlePieceIcon as PuzzleOutline,
  GlobeAltIcon as GlobeOutline,
  Cog6ToothIcon as CogOutline,
  UserCircleIcon as UserOutline,
} from '@heroicons/react/24/outline'

import {
  HomeIcon as HomeSolid,
  PlayCircleIcon as PlaySolid,
  PuzzlePieceIcon as PuzzleSolid,
  GlobeAltIcon as GlobeSolid,
  Cog6ToothIcon as CogSolid,
  UserCircleIcon as UserSolid,
} from '@heroicons/react/24/solid'

import PlayerHead from './ui/PlayerHead'

const navItems = [
  { id: 'home',     label: 'Home',     Outline: HomeOutline,   Solid: HomeSolid   },
  { id: 'play',     label: 'Play',     Outline: PlayOutline,   Solid: PlaySolid   },
  { id: 'mods',     label: 'Mods',     Outline: PuzzleOutline, Solid: PuzzleSolid },
  { id: 'worlds',   label: 'Worlds',   Outline: GlobeOutline,  Solid: GlobeSolid  },
  { id: 'settings', label: 'Settings', Outline: CogOutline,    Solid: CogSolid    },
]

export default function Sidebar({ activePage, onNavigate, selectedAccount }) {
  const isAccountPage = activePage === 'account'

  return (
    <aside className="w-[68px] flex flex-col items-center py-4 gap-0.5 bg-black/25 backdrop-blur-md border-r border-white/[0.06] z-10 overflow-visible">
      {/* Logo */}
      <div className="mb-4 mt-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-sm font-black text-white shadow-lg shadow-green-500/20 select-none">
          V
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1 w-full px-2">
        {navItems.map(({ id, label, Outline, Solid }) => {
          const isActive = activePage === id
          const Icon = isActive ? Solid : Outline
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`
                relative w-full h-12 rounded-xl flex items-center justify-center
                transition-all duration-150 group
                ${isActive
                  ? 'bg-green-500/15 text-green-400'
                  : 'text-white/30 hover:text-white/70 hover:bg-white/[0.06]'
                }
              `}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-green-400 rounded-r-full" />
              )}
              <Icon className="w-6 h-6" />
              <span className="
                pointer-events-none absolute left-[calc(100%+10px)] px-2.5 py-1.5
                bg-[#1a1a1a] border border-white/[0.08] rounded-lg
                text-white/80 text-[11px] font-semibold whitespace-nowrap
                shadow-2xl shadow-black/60
                opacity-0 group-hover:opacity-100
                -translate-x-2 group-hover:translate-x-0
                transition-all duration-150 z-[999]
              ">{label}</span>
            </button>
          )
        })}
      </nav>

      {/* Divider above account */}
      <div className="w-8 h-px bg-white/10 my-2" />

      {/* Account */}
      <div className="w-full px-2 pb-1">
        <button
          onClick={() => onNavigate('account')}
          className={`
            relative w-full h-12 rounded-xl flex items-center justify-center
            transition-all duration-150 group
            ${isAccountPage
              ? 'bg-green-500/15 text-green-400'
              : 'text-white/30 hover:text-white/70 hover:bg-white/[0.06]'
            }
          `}
        >
          {isAccountPage && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-green-400 rounded-r-full" />
          )}
          {selectedAccount ? (
            <div className={`rounded-lg overflow-hidden ${isAccountPage ? 'ring-2 ring-green-400/50 ring-offset-1 ring-offset-black/50' : ''}`}>
              <PlayerHead uuid={selectedAccount.uuid} username={selectedAccount.username} size={34} />
            </div>
          ) : (
            isAccountPage
              ? <UserSolid className="w-6 h-6" />
              : <UserOutline className="w-6 h-6" />
          )}
          {selectedAccount && (
            <span className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full bg-green-400 border-2 border-black/60" />
          )}
          <span className="
            pointer-events-none absolute left-[calc(100%+10px)] px-2.5 py-1.5
            bg-[#1a1a1a] border border-white/[0.08] rounded-lg
            text-white/80 text-[11px] font-semibold whitespace-nowrap
            shadow-2xl shadow-black/60
            opacity-0 group-hover:opacity-100
            -translate-x-2 group-hover:translate-x-0
            transition-all duration-150 z-[999]
          ">{selectedAccount?.username ?? 'Account'}</span>
        </button>
      </div>
    </aside>
  )
}
