/**
 * VoxelXLauncher — Minecraft Launcher
 * Created by FoxStudio. AI-assisted development.
 *
 * Source code : https://github.com/foxstudio-201/VoxelXLauncher
 * Website     : https://voxxelxclient.vercel.app
 *
 * NOTICE:
 *   - This software is provided as-is without warranty of any kind.
 *   - Do not redistribute or resell without explicit permission from FoxStudio.
 *   - If you use or reference this code, please credit FoxStudio.
 *   - Minecraft is a trademark of Mojang Studios / Microsoft. This project is not affiliated with Mojang.
 */

 /**
 * VoxelXLauncher — Minecraft Launcher
 * Created by FoxStudio. AI-assisted development.
 *
 * Source code : https://github.com/foxstudio-201/VoxelXLauncher
 * Website     : https://voxxelxclient.vercel.app
 *
 * NOTICE:
 *   - Dành cho mấy cháu cứ thích phỉ báng.
 *   - Launcher sử dụng ai đi kèm trong việc tạo, bản thân người tạo không tự nhận là code toàn bộ do có sự hỗ trợ của ai.
 *   - Giỏi giang thì tự code bằng năng lực của mình đang video làm toàn bộ từ đầu đến cuối, còn không làm được đừng có kích đểu ảnh hưởng đến người sử dụng.
 *   - Bạn chẳng phải là anh hùng mặc áo choàng đỏ mặc quần xịt như thằng trẻ trâu rồi lên mạng ra vẻ ta đây là người tốt, là anh hùng, là người bảo vệ công lý gì đâu :).
 *   - Vậy nên bớt ảo tưởng đi.
 *   - Nếu có sử dụng hoặc tham khảo code này, hãy ghi công cho FoxStudio.
 *   - Minecraft là một thương hiệu của Mojang Studios / Microsoft. Dự án này không liên kết với Mojang.
 */

import {
  House,
  PlayCircle,
  PuzzlePiece,
  HardDrives,
  Gear,
  UserCircle,
} from '@phosphor-icons/react'

import PlayerHead from './ui/PlayerHead'
import { useLang } from '../i18n/LangProvider'

export default function Sidebar({ activePage, onNavigate, selectedAccount, settingsOpen, onOpenSettings }) {
  const isAccountPage = activePage === 'account'
  const { t } = useLang()

  const navItems = [
    { id: 'home',     label: t('sidebar.home'),     Icon: House       },
    { id: 'mods',     label: t('sidebar.mods'),     Icon: PuzzlePiece },
    { id: 'worlds',   label: t('sidebar.worlds'),   Icon: HardDrives  },
  ]

  function navIndex(id) {
    if (id === 'account' || id === 'settings') return -1
    return navItems.findIndex(n => n.id === id)
  }

  return (
    <aside className="w-[68px] flex flex-col items-center py-3 gap-0.5 bg-black/25 backdrop-blur-md rounded-xl ml-3 mt-3 mb-3 z-50 overflow-visible">
      {}
      <div className="w-full px-2 pt-1">
        <button
          onClick={() => onNavigate('account')}
          className={`
            relative w-full h-12 rounded-xl flex items-center justify-center
            transition-all duration-150 group
            ${isAccountPage
              ? 'bg-orange-500/15 text-orange-400'
              : 'text-white/30 hover:text-white/70 hover:bg-white/[0.06]'
            }
          `}
        >
          {selectedAccount ? (
            <div className={`rounded-lg overflow-hidden ${isAccountPage ? 'ring-2 ring-orange-400/50 ring-offset-1 ring-offset-black/50' : ''}`}>
              <PlayerHead uuid={selectedAccount.uuid} username={selectedAccount.username} size={34} />
            </div>
          ) : (
            <UserCircle size={24} weight="duotone" />
          )}
          {selectedAccount && (
            <span className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-400 border-2 border-black/60" />
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

      {}
      <div className="w-8 h-px bg-white/10 my-2" />

      {}
      <nav className="flex flex-col gap-1 flex-1 w-full px-2 relative">
        <div
          className="absolute left-0 w-[3px] h-6 bg-orange-400 rounded-r-full transition-all duration-300 ease-out z-20"
          style={{
            top: (() => {
              const idx = navIndex(activePage)
              if (idx < 0) return '-100px'
              return `${idx * 52 + 12}px`
            })(),
            opacity: navIndex(activePage) >= 0 ? 1 : 0,
          }}
        />
        {navItems.map(({ id, label, Icon }) => {
          const isActive = activePage === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`
                relative w-full h-12 rounded-xl flex items-center justify-center
                transition-all duration-200 group
                ${isActive
                  ? 'bg-orange-500/15 text-orange-400'
                  : 'text-white/30 hover:text-white/70 hover:bg-white/[0.06]'
                }
              `}
            >
              <Icon size={24} weight="duotone" />
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

      {}
      <div className="w-8 h-px bg-white/10 my-2" />

      {}
      <div className="w-full px-2 pb-1">
        <button
          onClick={onOpenSettings}
          className={`
            relative w-full h-12 rounded-xl flex items-center justify-center
            transition-all duration-150 group
            ${settingsOpen
              ? 'bg-orange-500/15 text-orange-400'
              : 'text-white/30 hover:text-white/70 hover:bg-white/[0.06]'
            }
          `}
        >
          <Gear size={28} weight="duotone" />
          <span className="
            pointer-events-none absolute left-[calc(100%+10px)] px-2.5 py-1.5
            bg-[#1a1a1a] border border-white/[0.08] rounded-lg
            text-white/80 text-[11px] font-semibold whitespace-nowrap
            shadow-2xl shadow-black/60
            opacity-0 group-hover:opacity-100
            -translate-x-2 group-hover:translate-x-0
            transition-all duration-150 z-[999]
          ">{t('sidebar.settings')}</span>
        </button>
      </div>
    </aside>
  )
}

