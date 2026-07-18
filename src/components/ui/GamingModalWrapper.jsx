import { createContext, useContext } from 'react'

export const ModalCloseContext = createContext(null)

export function useModalClose(fallbackOnClose) {
  const ctx = useContext(ModalCloseContext)
  return ctx ?? fallbackOnClose
}

export default function GamingModalWrapper({ children, onClose, className = '', style = {} }) {
  return (
    <ModalCloseContext.Provider value={onClose}>
      <div className={className} style={style}>
        {children}
      </div>
    </ModalCloseContext.Provider>
  )
}
