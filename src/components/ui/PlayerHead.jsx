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

  const key = `${uuid}-${username}`

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

