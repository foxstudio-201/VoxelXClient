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

import { useState, useEffect, useRef } from 'react'
import {
  House,
  PlayCircle,
  PuzzlePiece,
  HardDrives,
  Gear,
  UserCircle,
  CaretDown,
  Check,
  Plus,
  FileArrowDown,
} from '@phosphor-icons/react'

import PlayerHead from './ui/PlayerHead'
import { useLang } from '../i18n/LangProvider'
import { useAccounts } from '../hooks/useAccounts'

export default function NavBar({ activePage, onNavigate, onOpenSettings, onAddAccount, onSkinCustomize, hidden }) {
  const { t } = useLang()
  const { selectedAccount, accounts, selectAccount, removeAccount } = useAccounts()
  const [navHover, setNavHover] = useState(null)
  const [accDropdown, setAccDropdown] = useState(false)
  const [removeConfirmId, setRemoveConfirmId] = useState(null)
  const [showPlayDropdown, setShowPlayDropdown] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') setShowPlayDropdown(false)
    }
    if (showPlayDropdown) window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showPlayDropdown])

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setAccDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const NAV_ITEMS = [
    { id: 'home',   Icon: House },
    { id: 'play',   Icon: PlayCircle },
    { id: 'mods',   Icon: PuzzlePiece },
    { id: 'worlds', Icon: HardDrives },
  ]

  return (
    <nav className={`absolute right-4 top-4 z-50 bg-black/25 backdrop-blur-md rounded-xl px-3 py-2 flex items-center gap-1 shadow-2xl transition-all duration-300 ${
      hidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
    }`}>
      {NAV_ITEMS.map(({ id, Icon }) => {
        const isActive = activePage === id
        const isHovered = navHover === id
        if (id === 'play') {
          const dropOpen = showPlayDropdown || isActive
          const dropHover = showPlayDropdown || navHover === 'play'
          return (
            <div key={id} className="relative">
              <button
                onClick={() => setShowPlayDropdown(prev => !prev)}
                onMouseEnter={() => setNavHover('play')}
                onMouseLeave={() => setNavHover(null)}
                className={`relative h-10 rounded-xl flex items-center gap-2 transition-all duration-300 ${
                  dropOpen
                    ? 'bg-orange-500/15 text-orange-400'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.06]'
                }`}
                style={{ width: dropHover || dropOpen ? '130px' : '40px' }}>
                <Icon size={20} weight="duotone" className="flex-shrink-0 ml-[10px]" />
                <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 text-xs font-semibold ${
                  dropHover || dropOpen ? 'max-w-[90px] opacity-100' : 'max-w-0 opacity-0'
                }`}>
                  {t(`sidebar.${id}`)}
                </span>
              </button>
              {showPlayDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowPlayDropdown(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] py-1.5 bg-[#16161a] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                    <button
                      onClick={() => { window.dispatchEvent(new CustomEvent('vxc:openCreateProfile')); setShowPlayDropdown(false) }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-all"
                    >
                      <Plus size={16} className="text-orange-400" />
                      Create Profile
                    </button>
                    <button
                      onClick={() => { window.dispatchEvent(new CustomEvent('vxc:openImportProfile')); setShowPlayDropdown(false) }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-all"
                    >
                      <FileArrowDown size={16} className="text-blue-400" />
                      Import Profile
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        }
        return (
          <button key={id}
            onClick={() => onNavigate(id)}
            onMouseEnter={() => setNavHover(id)}
            onMouseLeave={() => setNavHover(null)}
            className={`relative h-10 rounded-xl flex items-center gap-2 transition-all duration-300 ${
              isActive
                ? 'bg-orange-500/15 text-orange-400'
                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.06]'
            }`}
            style={{ width: isHovered || isActive ? '130px' : '40px' }}>
            <Icon size={20} weight="duotone" className="flex-shrink-0 ml-[10px]" />
            <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 text-xs font-semibold ${
              isHovered || isActive ? 'max-w-[90px] opacity-100' : 'max-w-0 opacity-0'
            }`}>
              {t(`sidebar.${id}`)}
            </span>
          </button>
        )
      })}
      <div className="w-px h-6 bg-white/10 mx-1" />
      <div className="relative" ref={dropdownRef}>
        <button onClick={() => setAccDropdown(!accDropdown)}
          className="h-10 rounded-xl flex items-center gap-1.5 px-2.5 text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-all">
          {selectedAccount ? (
            <div className="rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-white/10">
              <PlayerHead uuid={selectedAccount.uuid} username={selectedAccount.username} size={26} />
            </div>
          ) : (
            <UserCircle size={20} weight="duotone" />
          )}
          <span className="text-xs font-semibold text-white/70">{selectedAccount?.username || 'Account'}</span>
          <CaretDown size={12} weight="bold" className={`transition-transform ${accDropdown ? 'rotate-180' : ''}`} />
        </button>
        {accDropdown && (
          <div className="absolute right-0 top-full mt-1 min-w-[180px] bg-[#16161a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
            <div className="py-1 max-h-[200px] overflow-y-auto">
              {accounts.map(acc => {
                const isSel = acc.id === selectedAccount?.id
                const isConfirm = removeConfirmId === acc.id
                return (
                  <div key={acc.id} className="relative group">
                    <button
                      onClick={() => { selectAccount(acc.id); setAccDropdown(false); setRemoveConfirmId(null) }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-all pr-8 ${
                        isSel ? 'text-orange-400 bg-orange-500/10' : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                      }`}>
                      <Check size={14} weight="bold" className={`flex-shrink-0 ${isSel ? 'opacity-100' : 'opacity-0'}`} />
                      <span className="font-semibold truncate">{acc.username}</span>
                      <span className="text-[9px] text-white/30 ml-auto">{acc.type === 'microsoft' ? 'MS' : 'Off'}</span>
                    </button>
                    {isConfirm ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeAccount(acc.id)
                          setRemoveConfirmId(null)
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/80 hover:bg-red-500 text-white transition-all"
                        title="Xác nhận xóa"
                      >
                        Xóa?
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setRemoveConfirmId(acc.id)
                          setTimeout(() => setRemoveConfirmId(p => p === acc.id ? null : p), 3000)
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Xóa tài khoản"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="h-px bg-white/10" />
            <button onClick={() => { onAddAccount(); setAccDropdown(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/40 hover:text-white hover:bg-white/[0.04] transition-all">
              <UserCircle size={14} weight="duotone" />
              {t('account.addModal.title')}
            </button>
            {selectedAccount && (
              <button onClick={() => { onSkinCustomize(); setAccDropdown(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/40 hover:text-white hover:bg-white/[0.04] transition-all">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 flex-shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                {t('account.page.customize')}
              </button>
            )}
          </div>
        )}
      </div>
      <button onClick={onOpenSettings}
        className="h-10 w-10 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-all">
        <Gear size={20} weight="duotone" />
      </button>
    </nav>
  )
}
