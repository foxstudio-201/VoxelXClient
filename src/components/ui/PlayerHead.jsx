import { useState } from 'react'

/**
 * Fallback chain — ưu tiên username để lấy đúng skin premium:
 * 1. minotar.net/avatar/<username>  — nhận username trực tiếp, không cần UUID
 * 2. crafthead.net/avatar/<username>
 * 3. crafthead.net/avatar/<uuid>    — fallback UUID offline
 * 4. Chữ cái đầu
 */
function buildSrcs(uuid, username) {
  const srcs = []
  if (username) {
    srcs.push(`https://minotar.net/avatar/${username}/64`)
    srcs.push(`https://crafthead.net/avatar/${username}`)
  }
  if (uuid) {
    srcs.push(`https://crafthead.net/avatar/${uuid}`)
    srcs.push(`https://minotar.net/avatar/${uuid}/64`)
  }
  return srcs
}

export default function PlayerHead({ uuid, username, size = 32, customSkinUrl = null, className = '' }) {
  const srcs = buildSrcs(uuid, username)
  const [idx, setIdx] = useState(0)

  // Reset khi uuid/username thay đổi
  const key = `${uuid}-${username}`

  // customSkinUrl takes priority
  const src = customSkinUrl || (srcs[idx] ?? null)
  const initial = username?.[0]?.toUpperCase() ?? '?'
  const rounded = Math.round(size * 0.2)

  if (src) {
    return (
      <img
        key={`${key}-${idx}`}
        src={src}
        alt={username ?? uuid}
        width={size}
        height={size}
        style={{
          width: size, height: size,
          borderRadius: rounded,
          imageRendering: 'pixelated',
          flexShrink: 0,
          display: 'block',
        }}
        className={`object-cover ${className}`}
        onError={() => setIdx(i => Math.min(i + 1, srcs.length))}
        draggable={false}
      />
    )
  }

  return (
    <div
      style={{
        width: size, height: size, borderRadius: rounded,
        flexShrink: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.42, fontWeight: 700,
        userSelect: 'none',
        background: 'linear-gradient(135deg, #4ade80, #059669)',
        color: '#fff',
      }}
      className={className}
    >
      {initial}
    </div>
  )
}
