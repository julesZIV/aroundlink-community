'use client'
import { useEffect } from 'react'
import { ErrorProvider } from '@/lib/context/ErrorContext'
import { AuthProvider }  from '@/lib/context/AuthContext'

/** Prevents pinch-to-zoom on iOS Safari (gesture events + aggressive touchmove) */
function ZoomLock() {
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault()

    // iOS Safari fires gesturestart / gesturechange for pinch gestures
    document.addEventListener('gesturestart',  prevent, { passive: false })
    document.addEventListener('gesturechange', prevent, { passive: false })
    document.addEventListener('gestureend',    prevent, { passive: false })

    // Fallback: block any multi-touch touchmove (catches pinch on older iOS)
    const preventMulti = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault()
    }
    document.addEventListener('touchmove', preventMulti, { passive: false })

    return () => {
      document.removeEventListener('gesturestart',  prevent)
      document.removeEventListener('gesturechange', prevent)
      document.removeEventListener('gestureend',    prevent)
      document.removeEventListener('touchmove', preventMulti)
    }
  }, [])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorProvider>
      <AuthProvider>
        <ZoomLock />
        {children}
      </AuthProvider>
    </ErrorProvider>
  )
}
