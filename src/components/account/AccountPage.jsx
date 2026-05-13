/**
 * VoxelXClient — Minecraft Launcher
 * Created by FoxStudio. AI-assisted development.
 *
 * Source code : https://github.com/foxstudio-201/VoxelXClient
 * Website     : https://voxxelxclient.vercel.app
 *
 * NOTICE:
 *   - This software is provided as-is without warranty of any kind.
 *   - Do not redistribute or resell without explicit permission from FoxStudio.
 *   - If you use or reference this code, please credit FoxStudio.
 *   - Minecraft is a trademark of Mojang Studios / Microsoft. This project is not affiliated with Mojang.
 */

 /**
 * VoxelXClient — Minecraft Launcher
 * Created by FoxStudio. AI-assisted development.
 *
 * Source code : https://github.com/foxstudio-201/VoxelXClient
 * Website     : https://voxxelxclient.vercel.app
 *
 * NOTICE:
 *   - Dành cho mấy cháu cứ thích phỉ báng.
 *   - Launcher sử dụng ai đi kèm trong việc tạo, bản thân người tạo không tự nhận là code toàn bộ do có sự hỗ trợ của ai, vậy nên đừng có mà nói này nói nọ.
 *   - Giỏi giang thì tự code bằng năng lực của mình đi, còn không làm được đừng có kích đểu ảnh hưởng đến người sử dụng.
 *   - Bạn chẳng phải là anh hùng mặc áo choàng đỏ mặc quần xịt như thằng trẻ trâu rồi lên mạng ra vẻ ta đây là người tốt, là anh hùng, là người bảo vệ công lý gì đâu :).
 *   - Vậy nên bớt ảo tưởng đi.
 *   - Nếu có sử dụng hoặc tham khảo code này, hãy ghi công cho FoxStudio.
 *   - Minecraft là một thương hiệu của Mojang Studios / Microsoft. Dự án này không liên kết với Mojang.
 */

import { useState, useEffect } from 'react'
import { useAccounts } from '../../hooks/useAccounts'
import { useToast } from '../../hooks/useToast'
import AddAccountModal from './AddAccountModal'
import SkinCustomizeModal from './SkinCustomizeModal'
import PlayerHead from '../ui/PlayerHead'
import PlayerModel3D from '../ui/PlayerModel3D'

function AccountTypeTag({ type }) {
  if (type === 'offline') {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/8 text-white/35">
        OFFLINE
      </span>
    )
  }
  if (type === 'discord') {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
        DISCORD
      </span>
    )
  }
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
      MICROSOFT
    </span>
  )
}

function AccountRow({ account, isSelected, onSelect, onRemove, confirmId }) {
  return (
    <div
      onClick={() => onSelect(account.id)}
      className={`
        group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer
        transition-all duration-150
        ${isSelected
          ? 'bg-green-500/12 border border-green-500/25'
          : 'border border-transparent hover:bg-white/4 hover:border-white/8'
        }
      `}
    >
      {}
      <div className={`rounded-lg overflow-hidden flex-shrink-0 ${isSelected ? 'ring-1 ring-green-500/50' : ''}`}>
        <PlayerHead uuid={account.uuid} username={account.username} size={36} />
      </div>

      {}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`text-sm font-semibold truncate ${isSelected ? 'text-white' : 'text-white/65'}`}>
            {account.username}
          </span>
          <AccountTypeTag type={account.type} />
        </div>
        <p className="text-[10px] text-white/25 truncate font-mono">
          {account.uuid.slice(0, 8)}···
        </p>
      </div>

      {}
      {isSelected && (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-green-400 flex-shrink-0">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      )}

      {}
      {confirmId !== account.id && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(account.id) }}
          className="
            absolute right-2 top-1/2 -translate-y-1/2
            w-6 h-6 flex items-center justify-center rounded-md
            opacity-0 group-hover:opacity-100
            text-white/25 hover:text-red-400 hover:bg-red-500/10
            transition-all duration-150
          "
          title="Xóa"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
        </button>
      )}
    </div>
  )
}

export default function AccountPage() {
  const { accounts, selectedId, loading, addAccount, removeAccount, selectAccount } = useAccounts()
  const toast = useToast()
  const [showModal, setShowModal]             = useState(false)
  const [showSkinModal, setShowSkinModal]     = useState(false)
  const [removeConfirm, setRemoveConfirm]     = useState(null)
  const [slim, setSlim]                       = useState(false)
  const [showUuid, setShowUuid]               = useState(false)
  const [copied, setCopied]                   = useState(false)
  const [skinSubTab, setSkinSubTab]           = useState('skin')
  const [cosmeticData, setCosmeticData]       = useState([])
  const [cosmeticLoading, setCosmeticLoading] = useState(false)
  const [appliedSkinUrl, setAppliedSkinUrl]   = useState(null)
  const isElectronCtx = typeof window !== 'undefined' && window.electronAPI

  const selected = accounts.find(a => a.id === selectedId) ?? accounts[0] ?? null

  const isElectron = typeof window !== 'undefined' && window.electronAPI
  useEffect(() => {
    if (!selected?.uuid) { setAppliedSkinUrl(null); return }
    const load = async () => {
      try {
        const prefs = isElectron
          ? await window.electronAPI.getSkinPrefs({ uuid: selected.uuid })
          : JSON.parse(localStorage.getItem(`vxc_skin_prefs_${selected.uuid}`) || 'null')

        const skinUrl = prefs?.skinUrl
        if (skinUrl && skinUrl.startsWith('blob:')) {
          console.warn('Invalid blob URL found in prefs, clearing:', skinUrl)
          setAppliedSkinUrl(null)
        } else {
          setAppliedSkinUrl(skinUrl || null)
        }
      } catch { setAppliedSkinUrl(null) }
    }
    load()
  }, [selected?.uuid])

  useEffect(() => {
    const controller = new AbortController()
    setCosmeticLoading(true)
    fetch('https://api.foxstudio.site/api/player/api_player_cosmetics.php', { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : [])
        setCosmeticData(list)
      })
      .catch(err => { if (err.name !== 'AbortError') setCosmeticData([]) })
      .finally(() => setCosmeticLoading(false))
    return () => controller.abort()
  }, [])

  const prevSelectedId = useState(selectedId)
  if (prevSelectedId[0] !== selectedId) {
    prevSelectedId[0] = selectedId
    if (showUuid) setShowUuid(false)
  }

  function handleCopyUuid() {
    if (!selected?.uuid) return
    navigator.clipboard.writeText(selected.uuid).then(() => {
      setCopied(true)
      toast({ type: 'success', title: 'Đã sao chép UUID', message: selected.uuid.slice(0, 18) + '...' })
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleRemove(id) {
    if (removeConfirm === id) {
      const acc = accounts.find(a => a.id === id)
      await removeAccount(id)
      setRemoveConfirm(null)
      toast({ type: 'info', title: 'Đã xóa tài khoản', message: acc?.username })
    } else {
      setRemoveConfirm(id)
      setTimeout(() => setRemoveConfirm(prev => prev === id ? null : prev), 3000)
    }
  }

  async function handleSelect(id) {
    if (id === selectedId) return
    await selectAccount(id)
    const acc = accounts.find(a => a.id === id)
    toast({ type: 'success', title: 'Đã chọn tài khoản', message: acc?.username })
  }

  async function handleAdd(account) {
    const result = await addAccount(account)
    if (!result?.error) {
      toast({ type: 'success', title: 'Thêm thành công', message: account.username })
    }
    return result
  }

  async function handleSelectSkinFromGrid(item) {
    if (item.isDefault) {

      const newPrefs = {
        uuid:      selected?.uuid,
        skinUrl:   null,
        capeUrl:   null,
        elytraUrl: null,
      }
      try {
        if (isElectronCtx) {
          await window.electronAPI.saveSkinPrefs(newPrefs)
        } else {
          localStorage.setItem(`vxc_skin_prefs_${selected?.uuid}`, JSON.stringify(newPrefs))
        }
      } catch {}
      setAppliedSkinUrl(null)
      setSlim(false)
      toast({ type: 'success', title: 'Đã áp dụng', message: 'Skin mặc định' })
    } else {

      setAppliedSkinUrl(item.url)
      toast({ type: 'success', title: 'Đã áp dụng', message: 'Skin custom' })
    }
  }

  return (
    <div className="flex w-full h-full overflow-hidden">

      {}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden border-r border-white/5">

        {}
        <div className="flex flex-col" style={{ maxHeight: '55%', minHeight: 180 }}>
          {}
          <div className="flex-shrink-0 flex items-center justify-between px-6 pt-6 pb-4">
            <div>
              <h1 className="text-lg font-bold text-white">Tài khoản</h1>
              <p className="text-xs text-white/30 mt-0.5">Quản lý tài khoản Minecraft</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="
                flex items-center gap-1.5 px-3.5 py-2 rounded-xl
                bg-green-500 hover:bg-green-400 text-white text-xs font-bold
                transition-all duration-150 active:scale-95 shadow-lg shadow-green-500/20
              "
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              Thêm tài khoản
            </button>
          </div>

          {}
          <div className="flex-1 overflow-y-auto px-4 pb-3" style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            {loading ? (
              <div className="flex items-center justify-center h-24">
                <svg className="animate-spin w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              </div>
            ) : accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white/15">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-white/30 font-medium">Chưa có tài khoản</p>
                  <p className="text-xs text-white/15 mt-0.5">Nhấn "Thêm tài khoản" để bắt đầu</p>
                </div>
                <button
                  onClick={() => setShowModal(true)}
                  className="px-4 py-2 rounded-xl bg-green-500/15 text-green-400 text-xs font-semibold border border-green-500/20 hover:bg-green-500/25 transition-all"
                >
                  + Thêm tài khoản đầu tiên
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {accounts.map(account => (
                  <div key={account.id} className="relative">
                    <AccountRow
                      account={account}
                      isSelected={account.id === selectedId}
                      onSelect={handleSelect}
                      onRemove={handleRemove}
                      confirmId={removeConfirm}
                    />
                    {removeConfirm === account.id && (
                      <div className="absolute inset-0 rounded-xl bg-[#141414]/95 border border-red-500/25 flex items-center justify-center gap-2 z-10 px-3">
                        <span className="text-xs text-white/60 flex-1">Xóa tài khoản này?</span>
                        <button onClick={() => handleRemove(account.id)}
                          className="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-all">Xóa</button>
                        <button onClick={() => setRemoveConfirm(null)}
                          className="px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/12 text-white/50 text-xs transition-all">Hủy</button>
                      </div>
                    )}
                  </div>
                ))}
                <p className="text-[10px] text-white/15 mt-2 px-1">
                  {accounts.length} tài khoản
                </p>
              </div>
            )}
          </div>
        </div>

        {}
        <div className="flex-shrink-0 h-px bg-white/5 mx-4" />

        {}
        <div className="flex flex-col flex-1 overflow-hidden">
          {}
          <div className="flex-shrink-0 flex items-center justify-between px-4 pt-3 pb-2">
            <div className="flex gap-0 border-b border-white/5 flex-1">
              {[
                { id: 'skin',   label: 'Skin' },
                { id: 'cape',   label: 'Cape' },
                { id: 'elytra', label: 'Elytra' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setSkinSubTab(tab.id)}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
                    skinSubTab === tab.id
                      ? 'border-green-500 text-green-400'
                      : 'border-transparent text-white/30 hover:text-white/60'
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>
            {}
            <button
              onClick={() => setShowSkinModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/50 hover:text-white hover:bg-white/8 border border-white/8 transition-all ml-2 flex-shrink-0"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              Tuỳ chỉnh
            </button>
          </div>

          {}
          <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
{(() => {

  const defaultSkinUrl = selected?.username ? `https://minotar.net/skin/${selected.username}` : null

  const savedItems = []

  if (skinSubTab === 'skin' && defaultSkinUrl) {
    savedItems.push({
      url: defaultSkinUrl,
      label: 'Skin mặc định',
      active: !appliedSkinUrl,
      isDefault: true
    })
  }

  if (skinSubTab === 'skin' && appliedSkinUrl) {
    savedItems.push({ url: appliedSkinUrl, label: 'Custom', active: true, isDefault: false })
  }

  if (savedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-24 gap-2">
        <p className="text-xs text-white/20">
          {skinSubTab === 'skin' ? 'Chưa áp dụng skin nào' : `Chưa áp dụng ${skinSubTab} nào`}
        </p>
        <button onClick={() => setShowSkinModal(true)}
          className="text-xs text-green-400/60 hover:text-green-400 transition-colors">
          + Chọn {skinSubTab}
        </button>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {savedItems.map((item, i) => (
        <div key={i}
          onClick={() => handleSelectSkinFromGrid(item)}
          className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all cursor-pointer group relative"
          style={{
            background: item.active ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${item.active ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.07)'}`,
          }}
        >
          {item.active && (
            <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-green-400" />
          )}
          <img src={item.url} alt={item.label}
            className="w-10 h-10 rounded-lg object-contain"
            style={{ imageRendering: 'pixelated', background: 'rgba(255,255,255,0.05)' }}
            onError={e => { e.currentTarget.style.display = 'none' }} />
          <span className="text-[9px] text-white/40 truncate w-full text-center">{item.label}</span>
          {!item.active && (
            <span className="text-[9px] text-green-400/50 group-hover:text-green-400 transition-colors opacity-0 group-hover:opacity-100">
              Áp dụng
            </span>
          )}
          {item.active && (
            <span className="text-[9px] text-green-400/60">Đang dùng</span>
          )}
        </div>
      ))}
    </div>
  )
})()}
            </div>
        </div>
      </div>

      {}
      <div
        className="flex-shrink-0 flex flex-col relative overflow-hidden"
        style={{ width: 240, minWidth: 200, maxWidth: 260 }}
      >
        {}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d2b1a] via-[#0a1a0f] to-[#050d07]">
          {}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(rgba(74,222,128,0.4) 1px, transparent 1px),
                linear-gradient(90deg, rgba(74,222,128,0.4) 1px, transparent 1px)
              `,
              backgroundSize: '24px 24px',
            }}
          />
          {}
          <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-40 h-40 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {selected ? (
          <>
            {}
            <div className="relative z-10 w-full flex-1 min-h-0">
              <PlayerModel3D
                uuid={selected.uuid}
                username={selected.username}
                slim={slim}
                customSkinUrl={appliedSkinUrl}
              />
            </div>

            {}
            <div className="relative z-10 text-center px-4 py-3 flex-shrink-0 border-t border-white/5">
              <p className="text-sm font-bold text-white truncate">{selected.username}</p>

              {}
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <p className="text-[10px] text-white/30 font-mono truncate max-w-[120px]">
                  {showUuid
                    ? selected.uuid
                    : selected.uuid.slice(0, 8) + '···'
                  }
                </p>
                {}
                <button
                  onClick={() => setShowUuid(v => !v)}
                  className="text-white/20 hover:text-white/60 transition-colors flex-shrink-0"
                  title={showUuid ? 'Ẩn UUID' : 'Hiện UUID'}
                >
                  {showUuid ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
                {}
                <button
                  onClick={handleCopyUuid}
                  className="text-white/20 hover:text-white/60 transition-colors flex-shrink-0"
                  title="Sao chép UUID"
                >
                  {copied ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-green-400">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                  )}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-center gap-2">
                <AccountTypeTag type={selected.type} />
                {}
                <button
                  onClick={() => setSlim(v => !v)}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-white/30 hover:text-white/60 hover:border-white/20 transition-all"
                >
                  {slim ? 'Slim' : 'Wide'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="relative z-10 flex flex-col items-center justify-center flex-1 gap-3 text-center px-6">
            <div className="w-16 h-28 rounded-xl bg-white/4 border border-white/5 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white/10">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <p className="text-xs text-white/20">Chọn tài khoản để xem skin</p>
          </div>
        )}
      </div>

      {}
      {showModal && (
        <AddAccountModal
          onClose={() => setShowModal(false)}
          onAdd={handleAdd}
        />
      )}

      {}
      {showSkinModal && (
        <SkinCustomizeModal
          account={selected}
          cosmeticData={cosmeticData}
          onClose={() => setShowSkinModal(false)}
          onApply={({ type, url, skinType }) => {
            if (type === 'skin') {
              setAppliedSkinUrl(url)
              if (skinType === 'slim') setSlim(true)
              else setSlim(false)
            }
            toast({ type: 'success', title: 'Đã áp dụng', message: `${type} mới` })
          }}
        />
      )}
    </div>
  )
}
