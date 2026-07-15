import { useState, useRef, createContext, useContext } from 'react'
import { useGamingMode } from '../../hooks/useGamingMode'

/**
 * Context để các nút bên trong modal (nút X, Cancel...) có thể
 * trigger animation out trước khi unmount thay vì đóng ngay lập tức.
 */
export const ModalCloseContext = createContext(null)

/**
 * Hook dùng trong nội dung modal để lấy hàm đóng có animation.
 * Fallback về onClose gốc nếu không ở gaming mode hoặc không có context.
 */
export function useModalClose(fallbackOnClose) {
  const ctx = useContext(ModalCloseContext)
  return ctx ?? fallbackOnClose
}

/**
 * Wrap inner content của modal với animation gaming.
 * - Gaming mode: bounce-in khi mount, fade-out khi đóng
 * - Normal mode: render thẳng, không animation
 *
 * Cách dùng:
 *   <GamingModalWrapper onClose={onClose} className="..." style={...}>
 *     <Content />
 *   </GamingModalWrapper>
 *
 * Bên trong Content, dùng useModalClose(onClose) để lấy hàm đóng đúng:
 *   const close = useModalClose(onClose)
 *   <button onClick={close}>X</button>
 */
export default function GamingModalWrapper({ children, onClose, className = '', style = {} }) {
  const gamingMode = useGamingMode()
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)

  function handleClose() {
    if (!gamingMode) {
      onClose()
      return
    }
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    // Đợi animation out chạy xong (0.18s) rồi mới unmount
    setTimeout(() => onClose(), 170)
  }

  if (!gamingMode) {
    return (
      <ModalCloseContext.Provider value={onClose}>
        <div className={className} style={style}>
          {children}
        </div>
      </ModalCloseContext.Provider>
    )
  }

  return (
    <ModalCloseContext.Provider value={handleClose}>
      <div
        className={`${closing ? 'gaming-modal-out' : 'gaming-modal-in'} ${className}`}
        style={style}
      >
        {children}
      </div>
    </ModalCloseContext.Provider>
  )
}
