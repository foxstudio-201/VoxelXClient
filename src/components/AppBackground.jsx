import { useState, useEffect } from 'react'

export const BG_THEMES = [
  {
    id: 'dark',
    label: 'Tối',
    category: 'Nền',
    preview: 'linear-gradient(135deg, #080c14, #0d1a24, #0a1018)',
    style: {
      backgroundImage: [
        'radial-gradient(ellipse at 20% 0%, rgba(0,180,255,0.06) 0%, transparent 50%)',
        'radial-gradient(ellipse at 80% 100%, rgba(100,0,255,0.05) 0%, transparent 50%)',
        'radial-gradient(ellipse at 50% 50%, rgba(0,200,150,0.03) 0%, transparent 60%)',
      ].join(','),
      backgroundColor: '#080c14',
    },
  },
  {
    id: 'light',
    label: 'Sáng',
    category: 'Nền',
    preview: 'linear-gradient(135deg, #7a6b5a, #6b5f50, #7a6b5a)',
    style: {
      backgroundImage: [
        'radial-gradient(ellipse at 20% 0%, rgba(100,180,255,0.10) 0%, transparent 50%)',
        'radial-gradient(ellipse at 80% 100%, rgba(200,150,100,0.08) 0%, transparent 50%)',
        'radial-gradient(ellipse at 50% 50%, rgba(200,150,255,0.06) 0%, transparent 60%)',
      ].join(','),
      backgroundColor: '#7a6b5a',
    },
  },
  {
    id: 'custom',
    label: 'Tùy chỉnh',
    category: 'Nền',
    preview: 'linear-gradient(135deg, #1a1a2e, #16213e)',
    style: {
      backgroundColor: '#1a1a2e',
    },
  },
]

const MIME = {
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.webp':'image/webp','.bmp':'image/bmp','.gif':'image/gif',
  '.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime',
  '.avi':'video/x-msvideo',
}

function isVideo(ext) { return /^video\//.test(MIME[ext] || '') }

export default function AppBackground({ bgId, customBgPath }) {
  const [bgUrl, setBgUrl] = useState(null)

  useEffect(() => {
    if (bgId !== 'custom' || !customBgPath) {
      setBgUrl(null)
      return
    }

    let cancelled = false

    if (window.electronAPI?.readBgFile) {
      window.electronAPI.readBgFile(customBgPath).then(result => {
        if (cancelled) return
        if (!result?.data) {
          const p = customBgPath.replace(/\\/g, '/')
          setBgUrl(`vxc-bg://local?path=${encodeURIComponent(p)}&t=${Date.now()}`)
          return
        }
        const ext = '.' + customBgPath.split('.').pop().toLowerCase()
        const blob = new Blob([result.data], { type: MIME[ext] || 'image/png' })
        const url = URL.createObjectURL(blob)
        if (!cancelled) setBgUrl(url)
      }).catch(() => {
        if (cancelled) return
        const p = customBgPath.replace(/\\/g, '/')
        setBgUrl(`vxc-bg://local?path=${encodeURIComponent(p)}&t=${Date.now()}`)
      })
    } else {
      const p = customBgPath.replace(/\\/g, '/')
      setBgUrl(`vxc-bg://local?path=${encodeURIComponent(p)}&t=${Date.now()}`)
    }

    return () => { cancelled = true }
  }, [bgId, customBgPath])

  const isCustom = bgId === 'custom'

  if (isCustom && bgUrl) {
    const ext = '.' + customBgPath.split('.').pop().toLowerCase()
    if (isVideo(ext)) {
      return (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <video className="w-full h-full object-cover" src={bgUrl} autoPlay loop muted playsInline />
          <div className="absolute inset-0 bg-black/30" />
        </div>
      )
    }
    return (
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <img className="w-full h-full object-cover" src={bgUrl} draggable={false} />
        <div className="absolute inset-0 bg-black/30" />
      </div>
    )
  }

  const theme = BG_THEMES.find(t => t.id === bgId) ?? BG_THEMES[0]
  return (
    <div className="fixed inset-0 z-0 pointer-events-none" style={theme.style} />
  )
}
