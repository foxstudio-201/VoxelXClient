import { useState, useEffect } from 'react'

/**
 * Lắng nghe event vxc-gaming-mode để biết đang ở gaming mode hay không.
 * Dùng trong modal để apply animation bounce-in / fade-out.
 */
export function useGamingMode() {
  const [gamingMode, setGamingMode] = useState(() => {
    // Đọc giá trị ban đầu từ localStorage nếu có
    try {
      const s = localStorage.getItem('vxc_settings')
      if (s) return JSON.parse(s)?.gamingMode === true
    } catch {}
    return false
  })

  useEffect(() => {
    const handler = (e) => setGamingMode(!!e.detail)
    window.addEventListener('vxc-gaming-mode', handler)
    return () => window.removeEventListener('vxc-gaming-mode', handler)
  }, [])

  return gamingMode
}
