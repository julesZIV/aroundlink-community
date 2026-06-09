'use client'
import { useState } from 'react'

// Résolu côté client uniquement (composant 'use client')
function getSiteUrl() {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aroundlink.com'
}

interface PostData {
  text:        string | null
  mediaUrl?:   string | null
  mediaType?:  string | null
  mediaName?:  string | null
  authorName:  string
  institution?: string | null
  createdAt:   string
}

interface Props {
  postId?:  string           // si fourni → page OG dédiée pour LinkedIn
  text:     string
  postData?: PostData        // pour la carte image
}

// ── Génère une carte PNG du post ──────────────────────────────────────────────
async function generateCard(data: PostData): Promise<void> {
  // Import dynamique pour ne pas alourdir le bundle
  const { toPng } = await import('html-to-image')

  // 1. Construire un div off-screen stylisé
  const card = document.createElement('div')
  card.style.cssText = [
    'position:fixed', 'left:-9999px', 'top:0',
    'width:1200px', 'background:white',
    'border-radius:24px', 'overflow:hidden',
    'font-family:system-ui,-apple-system,sans-serif',
    'box-shadow:0 0 0 1px #e2e8f0',
  ].join(';')

  // Gradient header
  const header = document.createElement('div')
  header.style.cssText = 'background:linear-gradient(135deg,#1a3055,#2d6a9f);padding:28px 36px 24px'

  const logo = document.createElement('div')
  logo.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:20px'
  logo.innerHTML = `
    <div style="width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:white">AL</div>
    <div>
      <div style="font-size:16px;font-weight:900;color:white">AroundLink</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.65)">The IRO Community</div>
    </div>
  `

  const authorDiv = document.createElement('div')
  authorDiv.innerHTML = `
    <div style="font-size:22px;font-weight:800;color:white">${escHtml(data.authorName)}</div>
    ${data.institution ? `<div style="font-size:14px;color:rgba(255,255,255,0.7);margin-top:2px">${escHtml(data.institution)}</div>` : ''}
  `
  header.appendChild(logo)
  header.appendChild(authorDiv)

  // Body
  const body = document.createElement('div')
  body.style.cssText = 'padding:32px 36px'

  if (data.text) {
    const textEl = document.createElement('p')
    textEl.style.cssText = 'margin:0;font-size:26px;color:#1e293b;line-height:1.55;white-space:pre-wrap;word-break:break-word'
    textEl.textContent = data.text.slice(0, 500) + (data.text.length > 500 ? '…' : '')
    body.appendChild(textEl)
  }

  card.appendChild(header)
  card.appendChild(body)

  // Image post (si présente et chargeable)
  if (data.mediaUrl && data.mediaType === 'image') {
    try {
      const imgWrapper = document.createElement('div')
      imgWrapper.style.cssText = 'width:100%;max-height:480px;overflow:hidden;background:#f8f9fc'
      const img = document.createElement('img')
      img.crossOrigin = 'anonymous'
      img.src = data.mediaUrl
      img.style.cssText = 'width:100%;max-height:480px;object-fit:cover;display:block'
      await new Promise<void>((res, rej) => {
        img.onload  = () => res()
        img.onerror = () => res() // on continue même si l'image échoue
      })
      imgWrapper.appendChild(img)
      // Insérer entre header et body
      card.insertBefore(imgWrapper, body)
    } catch { /* skip */ }
  }

  // Footer
  const footer = document.createElement('div')
  footer.style.cssText = 'padding:16px 36px;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between'
  const dateStr = new Date(data.createdAt).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
  footer.innerHTML = `
    <span style="font-size:13px;color:#94a3b8">${dateStr}</span>
    <span style="font-size:13px;font-weight:700;color:#1a3055">aroundlink.com</span>
  `
  card.appendChild(footer)

  document.body.appendChild(card)

  try {
    const dataUrl = await toPng(card, {
      cacheBust: true,
      pixelRatio: 2,
      style: { borderRadius: '24px' },
    })
    // Téléchargement
    const a = document.createElement('a')
    a.download = 'aroundlink-post.png'
    a.href = dataUrl
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    document.body.removeChild(card)
  }
}

function escHtml(str: string) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// ── Composant ─────────────────────────────────────────────────────────────────
export default function ShareButton({ postId, text, postData }: Props) {
  const [open,      setOpen]      = useState(false)
  const [capturing, setCapturing] = useState(false)

  const SITE_URL = getSiteUrl()
  const postUrl = postId
    ? `${SITE_URL}/feed/${postId}`
    : SITE_URL

  const enc    = encodeURIComponent(text.slice(0, 200))
  const encUrl = encodeURIComponent(postUrl)

  const handleLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`, '_blank')
    setOpen(false)
  }

  const handleEmail = () => {
    window.open(`mailto:?subject=Post%20on%20AroundLink&body=${enc}%0A%0A${encUrl}`)
    setOpen(false)
  }

  const handleImage = async () => {
    if (!postData) return
    setOpen(false)
    setCapturing(true)
    try {
      await generateCard(postData)
    } catch (e) {
      console.error('Card generation failed', e)
    } finally {
      setCapturing(false)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-50 transition-all">
        {capturing ? '⏳' : '↗'} Share
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', right: 0, bottom: 'calc(100% + 4px)', zIndex: 50,
            background: 'white', border: '1px solid #e2e8f0', borderRadius: 14,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)', minWidth: 180, overflow: 'hidden',
          }}>
            {/* LinkedIn — partage le lien OG du post */}
            <button onClick={handleLinkedIn}
              className="flex items-center gap-2.5 w-full px-4 py-3 hover:bg-slate-50 transition-colors"
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#0a66c2', textAlign: 'left' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#0a66c2">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Share on LinkedIn
            </button>

            {/* Carte image PNG */}
            {postData && (
              <button onClick={handleImage}
                className="flex items-center gap-2.5 w-full px-4 py-3 hover:bg-slate-50 transition-colors"
                style={{ border: 'none', borderTop: '1px solid #f1f5f9', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151', textAlign: 'left' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                Download as image
              </button>
            )}

            {/* Email */}
            <button onClick={handleEmail}
              className="flex items-center gap-2.5 w-full px-4 py-3 hover:bg-slate-50 transition-colors"
              style={{ border: 'none', borderTop: '1px solid #f1f5f9', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151', textAlign: 'left' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              Send by email
            </button>
          </div>
        </>
      )}
    </div>
  )
}
