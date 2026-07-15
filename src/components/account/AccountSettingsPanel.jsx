import { useState } from 'react'
import { useLang } from '../../i18n/LangProvider'
import { useAccounts } from '../../hooks/useAccounts'
import { useToast } from '../../hooks/useToast'
import PlayerHead from '../ui/PlayerHead'

function Section({ title, icon, children }) {
  return (
    <div className="rounded-xl border border-white/6">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5"
        style={{ background: 'rgba(255,255,255,0.02)' }}>
        {icon && <span className="text-white/40">{icon}</span>}
        <span className="text-xs font-semibold uppercase tracking-wider text-white/40">{title}</span>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3" style={{ background: 'rgba(255,255,255,0.01)' }}>
        {children}
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/35">{label}</span>
      <span className={`text-xs ${mono ? 'font-mono text-white/50' : 'text-white/65'}`}>{value || '\u2014'}</span>
    </div>
  )
}

export default function AccountSettingsPanel({ account, onBack }) {
  const { t } = useLang()
  const { updateAccount } = useAccounts()
  const toast = useToast()
  const [discordLoading, setDiscordLoading] = useState(false)

  const isElectron = typeof window !== 'undefined' && window.electronAPI

  async function handleLinkDiscord() {
    if (!isElectron) return
    setDiscordLoading(true)
    try {
      const result = await window.electronAPI.discordStartLink()
      if (result?.error) throw new Error(result.error)
      const profile = result?.profile
      if (!profile?.discordId) throw new Error('Kh\xf4ng nh\u1eadn \u0111\u01b0\u1ee3c d\u1eef li\u1ec7u Discord')
      await updateAccount(account.id, {
        discordId:            profile.discordId,
        discordUsername:      profile.discordUsername,
        discordGlobalName:    profile.discordGlobalName,
        discordDiscriminator: profile.discordDiscriminator,
        discordAvatarUrl:     profile.discordAvatarUrl,
        linkedAt:             new Date().toISOString(),
      })
      toast({ type: 'success', title: '\u0110\xe3 li\xean k\u1ebft Discord', message: profile.discordUsername })
    } catch (err) {
      toast({ type: 'error', title: 'Li\xean k\u1ebft Discord th\u1ea5t b\u1ea1i', message: err.message })
    } finally {
      setDiscordLoading(false)
    }
  }

  async function handleUnlinkDiscord() {
    await updateAccount(account.id, {
      discordId: null, discordUsername: null, discordGlobalName: null,
      discordDiscriminator: null, discordAvatarUrl: null, linkedAt: null,
    })
    toast({ type: 'info', title: '\u0110\xe3 h\u1ee7y li\xean k\u1ebft Discord' })
  }

  const hasDiscord = !!account.discordId
  const createdAt = account.createdAt
    ? new Date(account.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '\u2014'

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/5">
        <button
          onClick={onBack}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-all flex-shrink-0"
          title="Quay l\u1ea1i"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="rounded-lg overflow-hidden flex-shrink-0">
            <PlayerHead uuid={account.uuid} username={account.username} size={28} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{account.username}</p>
            <p className="text-[10px] text-white/30">Account Settings</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4"
        style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        <div className="flex flex-col gap-4">

        <Section title="Th\xf4ng tin t\xe0i kho\u1ea3n" icon={
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        }>
          <InfoRow label="T\xean ng\u01b0\u1eddi d\xf9ng" value={account.username} />
          <InfoRow label="UUID" value={account.uuid.slice(0, 8) + '\u00b7\u00b7\u00b7'} mono />
          <InfoRow label="Lo\u1ea1i t\xe0i kho\u1ea3n" value={account.type === 'discord' ? 'Discord' : 'Offline'} />
          <InfoRow label="Ng\xe0y t\u1ea1o" value={createdAt} />
        </Section>

        <Section title="Li\xean k\u1ebft Discord" icon={
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M20.317 4.369A19.791 19.791 0 0015.885 3c-.191.34-.404.798-.553 1.165a18.27 18.27 0 00-5.327 0A12.04 12.04 0 009.45 3a19.736 19.736 0 00-4.434 1.371C2.21 8.622 1.449 12.77 1.822 16.863A19.923 19.923 0 007.245 19.5c.438-.6.83-1.235 1.165-1.905-.63-.238-1.23-.53-1.793-.867.149-.107.294-.221.434-.339 3.46 1.623 7.214 1.623 10.633 0 .142.118.287.232.434.339-.565.339-1.167.63-1.795.867.336.67.728 1.307 1.167 1.905a19.874 19.874 0 005.422-2.638c.438-4.745-.75-8.855-3.595-12.494z"/>
          </svg>
        }>
          {hasDiscord ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg"
                style={{ background: 'rgba(88,101,242,0.1)', border: '1px solid rgba(88,101,242,0.2)' }}>
                {account.discordAvatarUrl ? (
                  <img src={account.discordAvatarUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-[#5865F2]/20 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[#8b9cf4]">
                      <path d="M20.317 4.369A19.791 19.791 0 0015.885 3c-.191.34-.404.798-.553 1.165a18.27 18.27 0 00-5.327 0A12.04 12.04 0 009.45 3a19.736 19.736 0 00-4.434 1.371C2.21 8.622 1.449 12.77 1.822 16.863A19.923 19.923 0 007.245 19.5c.438-.6.83-1.235 1.165-1.905-.63-.238-1.23-.53-1.793-.867.149-.107.294-.221.434-.339 3.46 1.623 7.214 1.623 10.633 0 .142.118.287.232.434.339-.565.339-1.167.63-1.795.867.336.67.728 1.307 1.167 1.905a19.874 19.874 0 005.422-2.638c.438-4.745-.75-8.855-3.595-12.494z"/>
                    </svg>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">
                    {account.discordGlobalName || account.discordUsername}
                  </p>
                  <p className="text-[10px] text-white/40">@{account.discordUsername}</p>
                </div>
                <span className="flex-shrink-0 text-[9px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded-full">
                  Linked
                </span>
              </div>
              <button onClick={handleUnlinkDiscord}
                className="w-full py-2 rounded-lg text-xs font-semibold text-red-400 transition-all hover:bg-red-500/10"
                style={{ border: '1px solid rgba(248,113,113,0.2)' }}>
                H\u1ee7y li\xean k\u1ebft Discord
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <p className="text-[11px] text-white/30 leading-relaxed">
                Li\xean k\u1ebft t\xe0i kho\u1ea3n Discord \u0111\u1ec3 nh\u1eadn role v\xe0 th\xf4ng b\xe1o trong server Martian Launcher.
              </p>
              <button onClick={handleLinkDiscord} disabled={discordLoading || !isElectron}
                className="w-full py-2 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: '#5865F2' }}>
                {discordLoading
                  ? <><div className="w-3 h-3 rounded-full border border-white border-t-transparent animate-spin" />\u0110ang li\xean k\u1ebft...</>
                  : <>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M20.317 4.369A19.791 19.791 0 0015.885 3c-.191.34-.404.798-.553 1.165a18.27 18.27 0 00-5.327 0A12.04 12.04 0 009.45 3a19.736 19.736 0 00-4.434 1.371C2.21 8.622 1.449 12.77 1.822 16.863A19.923 19.923 0 007.245 19.5c.438-.6.83-1.235 1.165-1.905-.63-.238-1.23-.53-1.793-.867.149-.107.294-.221.434-.339 3.46 1.623 7.214 1.623 10.633 0 .142.118.287.232.434.339-.565.339-1.167.63-1.795.867.336.67.728 1.307 1.167 1.905a19.874 19.874 0 005.422-2.638c.438-4.745-.75-8.855-3.595-12.494z"/>
                      </svg>
                      Li\xean k\u1ebft Discord
                    </>
                }
              </button>
            </div>
          )}
        </Section>

        </div>
      </div>
    </div>
  )
}
