'use client'
import { useState, type CSSProperties } from 'react'

const circleBtn: CSSProperties = {
  width: 30, height: 30, borderRadius: '50%',
  background: 'rgba(0,0,0,0.55)', color: 'white', border: 'none',
  cursor: 'pointer', fontSize: 18, lineHeight: 1, fontWeight: 700,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

/** Carrousel d'images pour un post du feed (plusieurs photos). */
export default function PostCarousel({ images, onOpen }: { images: string[]; onOpen?: (src: string) => void }) {
  const [i, setI] = useState(0)
  const n = images.length
  const go = (d: number) => setI(prev => (prev + d + n) % n)

  return (
    <div className="mt-2 relative rounded-xl overflow-hidden" style={{ background: '#f1f5f9' }}>
      <img
        src={images[i]}
        alt={`Image ${i + 1} / ${n}`}
        className="w-full object-cover"
        style={{ maxHeight: 380, display: 'block', cursor: onOpen ? 'zoom-in' : 'default' }}
        onClick={() => onOpen?.(images[i])}
      />
      {n > 1 && (
        <>
          <button aria-label="Previous" onClick={e => { e.stopPropagation(); go(-1) }}
            style={{ ...circleBtn, position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }}>‹</button>
          <button aria-label="Next" onClick={e => { e.stopPropagation(); go(1) }}
            style={{ ...circleBtn, position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>›</button>
          <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px' }}>
            {i + 1}/{n}
          </div>
          <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5 }}>
            {images.map((_, j) => (
              <span key={j} onClick={e => { e.stopPropagation(); setI(j) }}
                style={{ width: j === i ? 18 : 6, height: 6, borderRadius: 999, background: j === i ? 'white' : 'rgba(255,255,255,0.6)', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 0 2px rgba(0,0,0,0.3)' }} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
