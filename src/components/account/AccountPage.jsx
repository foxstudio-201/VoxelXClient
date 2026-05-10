import { useState } from 'react'
import { useAccounts } from '../../hooks/useAccounts'
import { useToast } from '../../hooks/useToast'
import AddAccountModal from './AddAccountModal'
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
      {/* Head */}
      <div className={`rounded-lg overflow-hidden flex-shrink-0 ${isSelected ? 'ring-1 ring-green-500/50' : ''}`}>
        <PlayerHead uuid={account.uuid} username={account.username} size={36} />
      </div>

      {/* Info */}
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

      {/* Selected check */}
      {isSelected && (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-green-400 flex-shrink-0">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      )}

      {/* Delete — hover */}
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
  const [showModal, setShowModal]         = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState(null)
  const [slim, setSlim]                   = useState(false)
  const [showUuid, setShowUuid]           = useState(false)
  const [copied, setCopied]               = useState(false)

  const selected = accounts.find(a => a.id === selectedId) ?? accounts[0] ?? null

  // Reset showUuid khi đổi account
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

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── LEFT: danh sách tài khoản ── */}
      <div className="flex flex-col flex-1 overflow-hidden border-r border-white/5">

        {/* Header */}
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

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <svg className="animate-spin w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white/15">
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
                  {/* Confirm xóa */}
                  {removeConfirm === account.id && (
                    <div className="absolute inset-0 rounded-xl bg-[#141414]/95 border border-red-500/25 flex items-center justify-center gap-2 z-10 px-3">
                      <span className="text-xs text-white/60 flex-1">Xóa tài khoản này?</span>
                      <button
                        onClick={() => handleRemove(account.id)}
                        className="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-all"
                      >Xóa</button>
                      <button
                        onClick={() => setRemoveConfirm(null)}
                        className="px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/12 text-white/50 text-xs transition-all"
                      >Hủy</button>
                    </div>
                  )}
                </div>
              ))}

              <p className="text-[10px] text-white/15 mt-3 px-1">
                {accounts.length} tài khoản · %APPDATA%\.VoxelXClient\accounts.json
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: 3D skin model ── */}
      <div
        className="flex-shrink-0 flex flex-col relative overflow-hidden"
        style={{ width: 256, minWidth: 256, maxWidth: 256 }}
      >
        {/* Background — dark green gradient + grid như hero section */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d2b1a] via-[#0a1a0f] to-[#050d07]">
          {/* Grid pattern */}
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
          {/* Glow orb center */}
          <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-40 h-40 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {selected ? (
          <>
            {/* 3D Model — fixed height, không co giãn */}
            <div className="relative z-10 w-full flex-1 min-h-0" style={{ minHeight: 320 }}>
              <PlayerModel3D
                uuid={selected.uuid}
                username={selected.username}
                slim={slim}
              />
            </div>

            {/* Info + slim toggle */}
            <div className="relative z-10 text-center px-4 pb-4 flex-shrink-0">
              <p className="text-base font-bold text-white">{selected.username}</p>

              {/* UUID với show/hide + copy */}
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <p className="text-[10px] text-white/30 font-mono">
                  {showUuid
                    ? selected.uuid
                    : selected.uuid.slice(0, 8) + '···'
                  }
                </p>
                {/* Toggle show */}
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
                {/* Copy */}
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
                {/* Slim/Wide toggle */}
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

      {/* Modal */}
      {showModal && (
        <AddAccountModal
          onClose={() => setShowModal(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  )
}
