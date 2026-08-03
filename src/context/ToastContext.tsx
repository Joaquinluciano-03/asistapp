import React, { createContext, useContext, useState, useCallback, useRef } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType, duration?: number) => void
  toastSuccess: (message: string) => void
  toastError: (message: string) => void
  toastInfo: (message: string) => void
  toastWarning: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counterRef = useRef(0)

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = `toast-${Date.now()}-${++counterRef.current}`
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  const toastSuccess = useCallback((m: string) => addToast(m, 'success'), [addToast])
  const toastError = useCallback((m: string) => addToast(m, 'error', 5000), [addToast])
  const toastInfo = useCallback((m: string) => addToast(m, 'info'), [addToast])
  const toastWarning = useCallback((m: string) => addToast(m, 'warning'), [addToast])

  return (
    <ToastContext.Provider value={{ addToast, toastSuccess, toastError, toastInfo, toastWarning }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{ICONS[t.type]}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
