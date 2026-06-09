'use client'
import { createContext, useContext, useState, useCallback, useRef } from 'react'

type Kind = 'error' | 'warn' | 'success'
type ErrorEntry = { id: number; message: string; kind: Kind }

type ErrorCtx = {
  pushError:   (message: string, kind?: 'error' | 'warn') => void
  pushSuccess: (message: string) => void
}

const ErrorContext = createContext<ErrorCtx>({ pushError: () => {}, pushSuccess: () => {} })

export function useGlobalError() {
  return useContext(ErrorContext)
}

export function ErrorProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ErrorEntry[]>([])
  const counter = useRef(0)

  const push = useCallback((message: string, kind: Kind = 'error') => {
    const id = ++counter.current
    setToasts(prev => [...prev, { id, message, kind }])
    setTimeout(() => {
      setToasts(prev => prev.filter(e => e.id !== id))
    }, kind === 'success' ? 4000 : 7000)
  }, [])

  const pushError   = useCallback((msg: string, kind: 'error' | 'warn' = 'error') => push(msg, kind), [push])
  const pushSuccess = useCallback((msg: string) => push(msg, 'success'), [push])

  const dismiss = (id: number) => setToasts(prev => prev.filter(e => e.id !== id))

  const styles: Record<Kind, { bg: string; border: string; color: string; icon: string }> = {
    error:   { bg: '#fef2f2', border: '#fca5a5', color: '#991b1b', icon: '⚠️' },
    warn:    { bg: '#fffbeb', border: '#fcd34d', color: '#92400e', icon: '💡' },
    success: { bg: '#f0fdf4', border: '#86efac', color: '#166534', icon: '✓' },
  }

  return (
    <ErrorContext.Provider value={{ pushError, pushSuccess }}>
      {children}

      {toasts.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8,
          maxWidth: 380, width: '90vw',
        }} aria-live="assertive">
          {toasts.map(e => {
            const s = styles[e.kind]
            return (
              <div key={e.id} style={{
                background: s.bg, border: `1px solid ${s.border}`,
                borderRadius: 14, padding: '10px 14px',
                display: 'flex', alignItems: 'flex-start', gap: 10,
                boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
                animation: 'slideInRight 0.2s ease',
              }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
                <p style={{ flex: 1, margin: 0, fontSize: 13, lineHeight: 1.45, color: s.color, fontWeight: 500 }}>
                  {e.message}
                </p>
                <button onClick={() => dismiss(e.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#9ca3af', fontSize: 14, padding: '0 2px', flexShrink: 0,
                }} aria-label="Dismiss">✕</button>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ErrorContext.Provider>
  )
}
