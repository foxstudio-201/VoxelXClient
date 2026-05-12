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

import { useState } from 'react'
import PlayerHead from '../ui/PlayerHead'
import { offlineUUID } from '../../utils/offlineUUID'

const isElectron = typeof window !== 'undefined' && window.electronAPI

const TABS = [
  { id: 'offline', label: 'Offline' },
  { id: 'online',  label: 'Microsoft' },
]

export default function AddAccountModal({ onClose, onAdd }) {
  const [tab, setTab]           = useState('offline')
  const [username, setUsername] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const [msState, setMsState]     = useState('idle')
  const [msAccount, setMsAccount] = useState(null)

  async function handleOfflineSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const name = username.trim()
    if (!name) { setError('Vui lòng nhập tên người dùng'); setLoading(false); return }
    if (name.length < 3 || name.length > 16) { setError('Tên phải từ 3–16 ký tự'); setLoading(false); return }
    if (!/^[a-zA-Z0-9_]+$/.test(name)) { setError('Chỉ dùng chữ, số và dấu _'); setLoading(false); return }
    const result = await onAdd({ type: 'offline', username: name })
    if (result?.error) { setError(result.error); setLoading(false); return }
    onClose()
  }

  async function startMsLogin() {
    if (!isElectron) {
      setError('Đăng nhập Microsoft chỉ khả dụng trong ứng dụng Electron.')
      return
    }
    setError('')
    setMsState('waiting')

    const result = await window.electronAPI.msStartLogin()

    if (result?.error) {
      setError(result.error)
      setMsState('idle')
      return
    }

    setMsAccount(result.account)
    setMsState('success')
    if (onAdd) await onAdd({ _msAlreadySaved: true, ...result.account })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[440px] bg-[#141414] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

        {}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-base font-bold text-white">Thêm tài khoản</h2>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {}
        <div className="flex gap-1 px-6 pt-4">
          {TABS.map(t => (
            <button key={t.id}
              onClick={() => { setTab(t.id); setError(''); setMsState('idle') }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${tab === t.id
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">

          {}
          {tab === 'offline' && (
            <form onSubmit={handleOfflineSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">
                  Tên người dùng
                </label>
                <input
                  type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="Steve" maxLength={16} autoFocus
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-green-500/50 focus:bg-white/8 transition-all"
                />
                <p className="text-[11px] text-white/25">
                  Tài khoản offline không cần internet. Chỉ chơi được server không yêu cầu xác thực.
                </p>
              </div>

              {}
              <div className="flex items-center gap-3 bg-white/3 rounded-xl p-3 border border-white/5">
                <div className="rounded-lg overflow-hidden flex-shrink-0">
                  <PlayerHead uuid={username.length >= 3 ? offlineUUID(username) : null} username={username} size={40} />
                </div>
                <div>
                  <div className="text-sm font-medium text-white/80">{username || 'Chưa đặt tên'}</div>
                  <div className="text-[11px] text-white/30">Offline · {username.length >= 3 ? offlineUUID(username) : '—'}</div>
                </div>
              </div>

              {error && <ErrorBanner message={error} />}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-white/70 hover:bg-white/5 transition-all border border-white/5">
                  Hủy
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-green-500 hover:bg-green-400 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Đang xử lý...' : 'Thêm tài khoản'}
                </button>
              </div>
            </form>
          )}

          {}
          {tab === 'online' && (
            <div className="flex flex-col gap-4">

              {}
              {msState === 'idle' && (
                <>
                  <div className="flex flex-col items-center gap-4 py-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#0078d4]/15 border border-[#0078d4]/25 flex items-center justify-center">
                      <svg viewBox="0 0 21 21" className="w-8 h-8">
                        <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                        <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                        <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                        <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white/80">Đăng nhập Microsoft</p>
                      <p className="text-xs text-white/35 mt-1 leading-relaxed">
                        Một cửa sổ đăng nhập sẽ mở ra. Đăng nhập bằng tài khoản Microsoft
                        đã mua Minecraft Java Edition.
                      </p>
                    </div>
                  </div>

                  {error && <ErrorBanner message={error} />}

                  <div className="flex gap-2">
                    <button onClick={onClose}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-white/70 hover:bg-white/5 transition-all border border-white/5">
                      Hủy
                    </button>
                    <button onClick={startMsLogin} disabled={!isElectron}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#0078d4] hover:bg-[#106ebe] text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      <svg viewBox="0 0 21 21" className="w-4 h-4 flex-shrink-0">
                        <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                        <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                        <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                        <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                      </svg>
                      Đăng nhập với Microsoft
                    </button>
                  </div>
                </>
              )}

              {}
              {msState === 'waiting' && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <svg className="animate-spin w-8 h-8 text-[#0078d4]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white/70">Đang chờ đăng nhập...</p>
                    <p className="text-xs text-white/30 mt-1">Hoàn thành đăng nhập trong cửa sổ Microsoft vừa mở.</p>
                  </div>
                </div>
              )}

              {}
              {msState === 'success' && msAccount && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-green-400">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-white">{msAccount.username}</p>
                    <p className="text-xs text-white/35 mt-0.5">Đăng nhập thành công · Microsoft</p>
                  </div>
                  <button onClick={onClose}
                    className="w-full py-2.5 rounded-xl text-sm font-bold bg-green-500 hover:bg-green-400 text-white transition-all">
                    Xong
                  </button>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ErrorBanner({ message }) {
  return (
    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
      <span className="text-xs text-red-400 leading-relaxed">{message}</span>
    </div>
  )
}

