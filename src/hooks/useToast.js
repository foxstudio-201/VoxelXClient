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

import { createContext, useContext, useState, useCallback, useRef } from 'react'

export const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx.show
}

export function useToastState() {

  const [toast, setToast]       = useState(null)
  const [visible, setVisible]   = useState(false)
  const hideTimer  = useRef(null)
  const resetTimer = useRef(null)

  const show = useCallback(({ type = 'info', title, message, duration = 3500 }) => {

    clearTimeout(hideTimer.current)
    clearTimeout(resetTimer.current)

    if (visible) {
      setVisible(false)
      resetTimer.current = setTimeout(() => {
        setToast({ id: Date.now(), type, title, message })
        setVisible(true)
        scheduleHide(duration)
      }, 280)
    } else {
      setToast({ id: Date.now(), type, title, message })
      setVisible(true)
      scheduleHide(duration)
    }

    function scheduleHide(ms) {
      hideTimer.current = setTimeout(() => setVisible(false), ms)
    }
  }, [visible])

  const dismiss = useCallback(() => {
    clearTimeout(hideTimer.current)
    clearTimeout(resetTimer.current)
    setVisible(false)
  }, [])

  return { toast, visible, show, dismiss }
}

