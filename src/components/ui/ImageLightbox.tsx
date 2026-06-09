'use client'
import { useEffect, useRef, useState } from 'react'

interface Props {
  src: string
  alt?: string
  filename?: string
  onClose: () => void
}

async function downloadFile(url: string, filename: string) {
  try {
    const res  = await fetch(url)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href     = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  } catch {
    // Fallback : ouvre dans un nouvel onglet
    window.open(url, '_blank')
  }
}

export default function ImageLightbox({ src, alt = '', filename, onClose }: Props) {
  const [scale, setScale]   = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const lastPos    = useRef({ x: 0, y: 0 })
  const lastDist   = useRef<number | null>(null)

  // Keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') setScale(s => Math.min(5, s + 0.25))
      if (e.key === '-') setScale(s => { const n = Math.max(1, s - 0.25); if (n === 1) setOffset({ x: 0, y: 0 }); return n })
    }
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [onClose])

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setScale(s => {
      const next = Math.min(5, Math.max(1, s - e.deltaY * 0.003))
      if (next === 1) setOffset({ x: 0, y: 0 })
      return next
    })
  }

  // Mouse drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return
    isDragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
    e.preventDefault()
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return
    setOffset(o => ({ x: o.x + e.clientX - lastPos.current.x, y: o.y + e.clientY - lastPos.current.y }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }
  const handleMouseUp = () => { isDragging.current = false }

  // Touch pinch zoom + drag
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastDist.current = Math.hypot(dx, dy)
    } else if (e.touches.length === 1 && scale > 1) {
      isDragging.current = true
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastDist.current !== null) {
      e.preventDefault()
      const dx   = e.touches[0].clientX - e.touches[1].clientX
      const dy   = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      const ratio = dist / lastDist.current
      setScale(s => {
        const next = Math.min(5, Math.max(1, s * ratio))
        if (next === 1) setOffset({ x: 0, y: 0 })
        return next
      })
      lastDist.current = dist
    } else if (e.touches.length === 1 && isDragging.current) {
      setOffset(o => ({
        x: o.x + e.touches[0].clientX - lastPos.current.x,
        y: o.y + e.touches[0].clientY - lastPos.current.y,
      }))
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }
  const handleTouchEnd = () => { isDragging.current = false; lastDist.current = null }

  const resetZoom = () => { setScale(1); setOffset({ x: 0, y: 0 }) }

  return (
    <div
      onClick={scale === 1 ? onClose : undefined}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        cursor: scale > 1 ? 'grab' : 'default',
        overflow: 'hidden',
        touchAction: 'none',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top-right controls */}
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10001, display: 'flex', gap: 8 }}>
        {/* Download */}
        <button
          onClick={e => { e.stopPropagation(); downloadFile(src, filename ?? alt ?? 'image') }}
          title="Download"
          style={{
            background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%',
            width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'white', backdropFilter: 'blur(4px)',
          }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        {/* Close */}
        <button onClick={onClose} title="Close" style={{
          background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%',
          width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'white', backdropFilter: 'blur(4px)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Zoom controls */}
      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 8, zIndex: 10001,
        background: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: '6px 12px',
        backdropFilter: 'blur(8px)',
      }}>
        <button onClick={() => setScale(s => Math.max(1, s - 0.5) === 1 ? (setOffset({ x: 0, y: 0 }), 1) : Math.max(1, s - 0.5))}
          style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>−</button>
        <span style={{ color: 'white', fontSize: 12, fontWeight: 600, minWidth: 36, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.min(5, s + 0.5))}
          style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>+</button>
        {scale > 1 && (
          <button onClick={resetZoom}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 600, borderRadius: 10, padding: '3px 8px', marginLeft: 4 }}>
            Reset
          </button>
        )}
      </div>

      {/* Image */}
      <img
        src={src}
        alt={alt}
        onMouseDown={handleMouseDown}
        onClick={e => e.stopPropagation()}
        draggable={false}
        style={{
          maxWidth: '95vw', maxHeight: '90vh',
          objectFit: 'contain',
          borderRadius: scale > 1 ? 0 : 12,
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          userSelect: 'none',
          transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
          transition: isDragging.current ? 'none' : 'transform 0.15s ease',
          cursor: scale > 1 ? 'grab' : 'default',
        }}
      />

      <style>{`
        @keyframes lbFadeIn { from { opacity: 0 } to { opacity: 1 } }
        .lb-wrap { animation: lbFadeIn 0.18s ease }
      `}</style>
    </div>
  )
}
