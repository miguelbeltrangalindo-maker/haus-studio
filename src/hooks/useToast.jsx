import { createContext, useContext, useState, useCallback } from 'react'

const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ msg: '', type: '', show: false })

  const show = useCallback((msg, type = '') => {
    setToast({ msg, type, show: true })
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000)
  }, [])

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className={`toast ${toast.type} ${toast.show ? 'show' : ''}`}>
        {toast.msg}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
