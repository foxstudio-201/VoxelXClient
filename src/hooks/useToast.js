import { createContext, useContext, useState, useCallback, useRef } from 'react'

export const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx.show
}

export function useToastState() {
  // toast: { id, type, title, message } | null
  const [toast, setToast]       = useState(null)
  const [visible, setVisible]   = useState(false)   // controls enter/leave animation
  const hideTimer  = useRef(null)
  const resetTimer = useRef(null)

  const show = useCallback(({ type = 'info', title, message, duration = 3500 }) => {
    // Clear any pending timers
    clearTimeout(hideTimer.current)
    clearTimeout(resetTimer.current)

    // If a toast is already visible → collapse it first, then re-show
    if (visible) {
      setVisible(false)
      resetTimer.current = setTimeout(() => {
        setToast({ id: Date.now(), type, title, message })
        setVisible(true)
        scheduleHide(duration)
      }, 280) // wait for collapse animation
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
