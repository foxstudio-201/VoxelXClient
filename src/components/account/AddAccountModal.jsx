import { useState } from 'react'
import PlayerHead from '../ui/PlayerHead'
import { offlineUUID } from '../../utils/offlineUUID'

const isElectron = typeof window !== 'undefined' && window.electronAPI

const TABS = [
  { id: 'offline', label: 'Offline' },
  { id: 'online', label: 'Microsoft' },
  { id: 'discord', label: 'Discord' },
]

function validatePlayerName(name) {
  const trimmed = name.trim()
  if (!trimmed) return 'Vui long nhap ten nguoi dung'
  if (trimmed.length < 3 || trimmed.length > 16) return 'Ten phai tu 3-16 ky tu'
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return 'Chi dung chu, so va dau _'
  return null
}

function normalizeDiscordProfile(profile) {
  if (!profile || typeof profile !== 'object') return null

  const discordId = String(
    profile.discordId ??
    profile.id ??
    profile.userId ??
    ''
  ).trim()

  const discordUsername = String(
    profile.discordUsername ??
    profile.username ??
    profile.login ??
    ''
  ).trim()

  const discordGlobalName = String(
    profile.discordGlobalName ??
    profile.globalName ??
    profile.global_name ??
    profile.displayName ??
    ''
  ).trim()

  const discriminatorValue =
    profile.discordDiscriminator ??
    profile.discriminator ??
    profile.tagSuffix ??
    null

  const discordDiscriminator = discriminatorValue == null
    ? null
    : String(discriminatorValue).trim() || null

  const discordAvatarUrl = String(
    profile.discordAvatarUrl ??
    profile.avatarUrl ??
    profile.avatar_url ??
    profile.avatar ??
    ''
  ).trim() || null

  if (!discordId || !discordUsername) return null

  return {
    discordId,
    discordUsername,
    discordGlobalName: discordGlobalName || null,
    discordDiscriminator,
    discordAvatarUrl,
  }
}

export default function AddAccountModal({ onClose, onAdd }) {
  const [tab, setTab] = useState('offline')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [msState, setMsState] = useState('idle')
  const [msAccount, setMsAccount] = useState(null)

  const [discordState, setDiscordState] = useState('idle')
  const [discordProfile, setDiscordProfile] = useState(null)
  const [discordPlayerName, setDiscordPlayerName] = useState('')

  function resetTab(nextTab) {
    setTab(nextTab)
    setError('')
    setLoading(false)
    setMsState('idle')
    setDiscordState('idle')
    setDiscordProfile(null)
    setDiscordPlayerName('')
  }

  async function handleOfflineSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const name = username.trim()
    const validationError = validatePlayerName(name)
    if (validationError) {
      setError(validationError)
      setLoading(false)
      return
    }

    const result = await onAdd({ type: 'offline', username: name })
    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    onClose()
  }

  async function startMsLogin() {
    if (!isElectron) {
      setError('Dang nhap Microsoft chi kha dung trong ung dung Electron.')
      return
    }

    setError('')
    setMsState('waiting')

    try {
      const result = await window.electronAPI.msStartLogin()
      if (result?.error) {
        setError(result.error)
        setMsState('idle')
        return
      }

      setMsAccount(result.account)
      setMsState('success')
      if (onAdd) await onAdd({ _msAlreadySaved: true, ...result.account })
    } catch (err) {
      setError(err?.message || 'Khong the dang nhap Microsoft luc nay.')
      setMsState('idle')
    }
  }

  async function startDiscordLink() {
    if (!isElectron) {
      setError('Lien ket Discord chi kha dung trong ung dung Electron.')
      return
    }

    setError('')
    setDiscordState('waiting')

    try {
      const result = await window.electronAPI.discordStartLink()
      if (result?.error) {
        setError(result.error)
        setDiscordState('idle')
        return
      }

      const normalizedProfile = normalizeDiscordProfile(result?.profile)
      if (!normalizedProfile) {
        setError('Du lieu tai khoan Discord tra ve khong hop le.')
        setDiscordState('idle')
        return
      }

      setDiscordProfile(normalizedProfile)
      setDiscordState('linked')
    } catch (err) {
      setError(err?.message || 'Khong the lien ket Discord luc nay.')
      setDiscordState('idle')
    }
  }

  async function handleDiscordSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!discordProfile?.discordId) {
      setError('Ban can lien ket Discord truoc.')
      setLoading(false)
      return
    }

    const name = discordPlayerName.trim()
    const validationError = validatePlayerName(name)
    if (validationError) {
      setError(validationError)
      setLoading(false)
      return
    }

    const result = await onAdd({
      type: 'discord',
      username: name,
      discordId: discordProfile.discordId,
      discordUsername: discordProfile.discordUsername,
      discordGlobalName: discordProfile.discordGlobalName,
      discordDiscriminator: discordProfile.discordDiscriminator,
      discordAvatarUrl: discordProfile.discordAvatarUrl,
      linkedAt: new Date().toISOString(),
    })

    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    onClose()
  }

  const offlinePreviewUuid = username.trim().length >= 3 ? offlineUUID(username.trim()) : null
  const discordPreviewUuid = discordPlayerName.trim().length >= 3 ? offlineUUID(discordPlayerName.trim()) : null
  const discordDisplayName = discordProfile?.discordGlobalName || discordProfile?.discordUsername || 'Discord user'
  const discordTag = discordProfile?.discordUsername
    ? `@${discordProfile.discordUsername}${discordProfile.discordDiscriminator && discordProfile.discordDiscriminator !== '0'
      ? `#${discordProfile.discordDiscriminator}`
      : ''}`
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[460px] bg-[#141414] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-base font-bold text-white">Them tai khoan</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex gap-1 px-6 pt-4">
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => resetTab(item.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === item.id
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {tab === 'offline' && (
            <form onSubmit={handleOfflineSubmit} className="flex flex-col gap-4">
              <TextField
                label="Ten nguoi dung"
                value={username}
                onChange={setUsername}
                placeholder="Steve"
                autoFocus
              />
              <p className="text-[11px] text-white/25 -mt-2">
                Tai khoan offline khong can internet. Chi choi duoc server khong yeu cau xac thuc.
              </p>

              <AccountPreview
                uuid={offlinePreviewUuid}
                username={username.trim() || 'Chua dat ten'}
                subtitle={`Offline · ${offlinePreviewUuid || '—'}`}
              />

              {error && <ErrorBanner message={error} />}

              <div className="flex gap-2 pt-1">
                <SecondaryButton type="button" onClick={onClose}>Huy</SecondaryButton>
                <PrimaryButton type="submit" disabled={loading}>
                  {loading ? 'Dang xu ly...' : 'Them tai khoan'}
                </PrimaryButton>
              </div>
            </form>
          )}

          {tab === 'online' && (
            <div className="flex flex-col gap-4">
              {msState === 'idle' && (
                <>
                  <div className="flex flex-col items-center gap-4 py-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#0078d4]/15 border border-[#0078d4]/25 flex items-center justify-center">
                      <svg viewBox="0 0 21 21" className="w-8 h-8">
                        <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                        <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                        <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                        <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white/80">Dang nhap Microsoft</p>
                      <p className="text-xs text-white/35 mt-1 leading-relaxed">
                        Launcher se mo mot cua so dang nhap de dong bo tai khoan Microsoft da mua Minecraft Java Edition.
                      </p>
                    </div>
                  </div>

                  {error && <ErrorBanner message={error} />}

                  <div className="flex gap-2">
                    <SecondaryButton onClick={onClose}>Huy</SecondaryButton>
                    <button
                      onClick={startMsLogin}
                      disabled={!isElectron}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#0078d4] hover:bg-[#106ebe] text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <svg viewBox="0 0 21 21" className="w-4 h-4 flex-shrink-0">
                        <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                        <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                        <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                        <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                      </svg>
                      Dang nhap voi Microsoft
                    </button>
                  </div>
                </>
              )}

              {msState === 'waiting' && (
                <WaitingState
                  title="Dang cho dang nhap..."
                  description="Hoan thanh dang nhap trong cua so Microsoft vua mo."
                  colorClass="text-[#0078d4]"
                />
              )}

              {msState === 'success' && msAccount && (
                <SuccessState
                  title={msAccount.username}
                  description="Dang nhap thanh cong · Microsoft"
                  actionLabel="Xong"
                  onAction={onClose}
                />
              )}
            </div>
          )}

          {tab === 'discord' && (
            <form onSubmit={handleDiscordSubmit} className="flex flex-col gap-4">
              {discordState === 'idle' && (
                <>
                  <div className="flex flex-col items-center gap-4 py-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#5865F2]/15 border border-[#5865F2]/25 flex items-center justify-center">
                      <DiscordGlyph className="w-8 h-8 text-[#5865F2]" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white/80">Lien ket tai khoan Discord</p>
                      <p className="text-xs text-white/35 mt-1 leading-relaxed">
                        Discord dung de xac minh danh tinh. Sau khi lien ket xong, ban se nhap ten player va tao tai khoan nhu cu.
                      </p>
                    </div>
                  </div>

                  {error && <ErrorBanner message={error} />}

                  <div className="flex gap-2">
                    <SecondaryButton type="button" onClick={onClose}>Huy</SecondaryButton>
                    <button
                      type="button"
                      onClick={startDiscordLink}
                      disabled={!isElectron}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#5865F2] hover:bg-[#4752c4] text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <DiscordGlyph className="w-4 h-4" />
                      Lien ket Discord
                    </button>
                  </div>
                </>
              )}

              {discordState === 'waiting' && (
                <WaitingState
                  title="Dang cho xac thuc Discord..."
                  description="Trinh duyet da duoc mo. Hoan thanh xac nhan Discord roi quay lai launcher."
                  colorClass="text-[#5865F2]"
                />
              )}

              {discordState === 'linked' && discordProfile && (
                <>
                  <div className="rounded-2xl border border-[#5865F2]/25 bg-[#5865F2]/8 p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-black/20 border border-white/10 overflow-hidden flex items-center justify-center">
                      {discordProfile.discordAvatarUrl ? (
                        <img src={discordProfile.discordAvatarUrl} alt={discordDisplayName} className="w-full h-full object-cover" />
                      ) : (
                        <DiscordGlyph className="w-6 h-6 text-[#c8ccff]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{discordDisplayName}</p>
                      <p className="text-xs text-white/45 truncate">
                        {discordTag || 'Discord'}
                      </p>
                    </div>
                  </div>

                  <TextField
                    label="Ten player"
                    value={discordPlayerName}
                    onChange={setDiscordPlayerName}
                    placeholder="Steve"
                    autoFocus
                  />
                  <p className="text-[11px] text-white/25 -mt-2">
                    Ten nay se duoc dung de tao account Minecraft trong launcher. Discord chi dung de lien ket va xac minh.
                  </p>

                  <AccountPreview
                    uuid={discordPreviewUuid}
                    username={discordPlayerName.trim() || 'Chua dat ten'}
                    subtitle={`Discord linked · ${discordPreviewUuid || '—'}`}
                  />

                  {error && <ErrorBanner message={error} />}

                  <div className="flex gap-2">
                    <SecondaryButton
                      type="button"
                      onClick={() => {
                        setDiscordState('idle')
                        setDiscordProfile(null)
                        setDiscordPlayerName('')
                        setError('')
                      }}
                    >
                      Lien ket lai
                    </SecondaryButton>
                    <PrimaryButton type="submit" disabled={loading}>
                      {loading ? 'Dang tao...' : 'Tao tai khoan'}
                    </PrimaryButton>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function TextField({ label, value, onChange, placeholder, autoFocus = false }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={16}
        autoFocus={autoFocus}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-green-500/50 focus:bg-white/8 transition-all"
      />
    </div>
  )
}

function AccountPreview({ uuid, username, subtitle }) {
  return (
    <div className="flex items-center gap-3 bg-white/3 rounded-xl p-3 border border-white/5">
      <div className="rounded-lg overflow-hidden flex-shrink-0">
        <PlayerHead uuid={uuid} username={username} size={40} />
      </div>
      <div>
        <div className="text-sm font-medium text-white/80">{username}</div>
        <div className="text-[11px] text-white/30">{subtitle}</div>
      </div>
    </div>
  )
}

function WaitingState({ title, description, colorClass }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <svg className={`animate-spin w-8 h-8 ${colorClass}`} viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <div className="text-center">
        <p className="text-sm font-semibold text-white/70">{title}</p>
        <p className="text-xs text-white/30 mt-1">{description}</p>
      </div>
    </div>
  )
}

function SuccessState({ title, description, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-green-400">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-xs text-white/35 mt-0.5">{description}</p>
      </div>
      <button
        onClick={onAction}
        className="w-full py-2.5 rounded-xl text-sm font-bold bg-green-500 hover:bg-green-400 text-white transition-all"
      >
        {actionLabel}
      </button>
    </div>
  )
}

function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-green-500 hover:bg-green-400 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

function SecondaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-white/70 hover:bg-white/5 transition-all border border-white/5"
    >
      {children}
    </button>
  )
}

function DiscordGlyph({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.317 4.369A19.791 19.791 0 0015.885 3c-.191.34-.404.798-.553 1.165a18.27 18.27 0 00-5.327 0A12.04 12.04 0 009.45 3a19.736 19.736 0 00-4.434 1.371C2.21 8.622 1.449 12.77 1.822 16.863A19.923 19.923 0 007.245 19.5c.438-.6.83-1.235 1.165-1.905-.63-.238-1.23-.53-1.793-.867.149-.107.294-.221.434-.339 3.46 1.623 7.214 1.623 10.633 0 .142.118.287.232.434.339-.565.339-1.167.63-1.795.867.336.67.728 1.307 1.167 1.905a19.874 19.874 0 005.422-2.638c.438-4.745-.75-8.855-3.595-12.494zM9.16 14.555c-1.036 0-1.886-.95-1.886-2.115 0-1.165.832-2.115 1.886-2.115 1.062 0 1.904.96 1.886 2.115 0 1.165-.832 2.115-1.886 2.115zm5.693 0c-1.036 0-1.886-.95-1.886-2.115 0-1.165.832-2.115 1.886-2.115 1.062 0 1.904.96 1.886 2.115 0 1.165-.824 2.115-1.886 2.115z" />
    </svg>
  )
}

function ErrorBanner({ message }) {
  return (
    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
      </svg>
      <span className="text-xs text-red-400 leading-relaxed">{message}</span>
    </div>
  )
}
