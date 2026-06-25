'use client'
import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { useAuth } from '@/lib/hooks/useAuth'
import { useMessages, useConversations, displayName, initials } from '@/lib/hooks/useDirectMessages'
import { createClient } from '@/lib/supabase/client'
import ImageLightbox from '@/components/ui/ImageLightbox'
import AvatarImg from '@/components/ui/AvatarImg'
import { linkifyText } from '@/components/ui/renderMentions'

// Minimalist SVG icons
const IconImage = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)
const IconFile = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
)

export default function ConversationPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const { user } = useAuth()

  const { messages, otherProfile, otherUserId, loading, sendMessage } = useMessages(id, user?.id)
  const { conversations } = useConversations(user?.id, 'conv-page')
  const supabase = createClient()

  const [text, setText]       = useState('')
  const [sending, setSending] = useState(false)
  const [media, setMedia]     = useState<{ dataUrl: string; type: 'image' | 'pdf'; name: string } | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [kbHeight, setKbHeight] = useState(0)  // iOS keyboard height via visualViewport
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

  // Track iOS keyboard height so the composer stays glued to it
  useEffect(() => {
    const vv = (window.visualViewport ?? null) as VisualViewport | null
    if (!vv) return
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKbHeight(kb)
      // Keep scroll at bottom when keyboard opens
      if (kb > 0) bottomRef.current?.scrollIntoView({ block: 'end' })
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update) }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const isImg = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    if (!isImg && !isPdf) return
    const maxSize = isImg ? 5 * 1024 * 1024 : 20 * 1024 * 1024
    if (file.size > maxSize) {
      alert(isImg ? 'Image must be under 5 MB.' : 'PDF must be under 20 MB.')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = ev => setMedia({ type: isImg ? 'image' : 'pdf', dataUrl: ev.target!.result as string, name: file.name })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleSend = async () => {
    const t = text.trim()
    if (!t && !media || sending) return
    setSending(true)

    let uploadedMedia: { url: string; type: 'image' | 'pdf'; name: string } | null = null
    if (media && user) {
      try {
        const [header, base64] = media.dataUrl.split(',')
        const mime = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream'
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const ext = media.name.split('.').pop() ?? 'bin'
        const path = `dm/${user.id}/${Date.now()}.${ext}`
        const { data: stored } = await supabase.storage.from('channel-media').upload(path, new Blob([bytes], { type: mime }), { contentType: mime })
        if (stored) {
          const { data: { publicUrl } } = supabase.storage.from('channel-media').getPublicUrl(stored.path)
          uploadedMedia = { url: publicUrl, type: media.type, name: media.name }
        }
      } catch { /* silent */ }
    }

    setText('')
    setMedia(null)
    await sendMessage(t, uploadedMedia)
    setSending(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const dn  = displayName(otherProfile)
  const ini = initials(otherProfile)

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    const today     = new Date(); today.setHours(0,0,0,0)
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    const msgDate   = new Date(d); msgDate.setHours(0,0,0,0)
    if (msgDate.getTime() === today.getTime())     return "Today"
    if (msgDate.getTime() === yesterday.getTime()) return 'Yesterday'
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  }

  function timeAgo(iso: string) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000
    if (diff < 60)    return 'now'
    if (diff < 3600)  return `${Math.floor(diff / 60)}m`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    return `${Math.floor(diff / 86400)}d`
  }

  // Group messages by date
  const groups: { date: string; msgs: typeof messages }[] = []
  let currentDate = ''
  for (const m of messages) {
    const d = formatDate(m.created_at)
    if (d !== currentDate) { currentDate = d; groups.push({ date: d, msgs: [] }) }
    groups[groups.length - 1].msgs.push(m)
  }

  return (
    <>
    <AppShell>
      <div className="dm-outer-wrap" style={{
        display: 'flex',
        height: 'calc(100vh - 56px - 60px)',
        maxWidth: 1080,
        margin: '0 auto',
        gap: 0,
        background: 'white',
        borderRadius: 20,
        border: '1px solid #f1f5f9',
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}>

        {/* ── Left panel: conversation list ── */}
        <div style={{
          width: 300, flexShrink: 0,
          borderRight: '1px solid #f1f5f9',
          display: 'flex', flexDirection: 'column',
          background: '#fafbfc',
        }}
          className="hidden-mobile-msg"
        >
          {/* Panel header */}
          <div style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1a3055' }}>Messages</p>
            <button
              onClick={() => router.push('/messages')}
              title="New message"
              style={{
                background: '#1a3055', color: 'white', border: 'none',
                borderRadius: 8, width: 28, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 16,
              }}>✏️</button>
          </div>

          {/* Conversations */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversations.length === 0 && (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                No conversations
              </div>
            )}
            {conversations.map(conv => {
              const p   = conv.other_profile
              const dn2 = displayName(p)
              const ini2 = initials(p)
              const isActive = conv.id === id
              return (
                <button
                  key={conv.id}
                  onClick={() => router.push(`/messages/${conv.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '10px 14px',
                    background: isActive ? '#eef6ff' : 'transparent',
                    border: 'none', borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'background 0.1s',
                    borderLeft: isActive ? '3px solid #1a3055' : '3px solid transparent',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: '#1a3055', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', overflow: 'hidden', position: 'relative',
                  }}>
                    <AvatarImg src={p?.avatar_url} alt={dn2} fallback={<span style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>{ini2}</span>} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {conv.unread_count > 0 && (
                      <div style={{
                        position: 'absolute', top: -2, right: -2,
                        width: 10, height: 10, borderRadius: '50%',
                        background: '#ef4444', border: '2px solid white',
                      }}/>
                    )}
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <p style={{
                        margin: 0, fontSize: 13,
                        fontWeight: conv.unread_count > 0 ? 800 : 600,
                        color: '#1a3055',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{dn2}</p>
                      <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0, marginLeft: 6 }}>
                        {timeAgo(conv.last_message_at)}
                      </span>
                    </div>
                    <p style={{
                      margin: 0, fontSize: 11,
                      color: conv.unread_count > 0 ? '#475569' : '#94a3b8',
                      fontWeight: conv.unread_count > 0 ? 600 : 400,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {conv.last_message || 'Start a conversation…'}
                    </p>
                  </div>
                  {/* Unread badge */}
                  {conv.unread_count > 0 && (
                    <div style={{
                      background: '#1a3055', color: 'white',
                      borderRadius: 99, minWidth: 18, height: 18,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 800, padding: '0 4px', flexShrink: 0,
                    }}>
                      {conv.unread_count}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Right panel: active chat ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

          {/* Chat header — sticky so it never scrolls away */}
          <div className="dm-chat-header" style={{
            background: 'white', borderBottom: '1px solid #f1f5f9',
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
            flexShrink: 0, position: 'sticky', top: 0, zIndex: 5,
          }}>
            <button onClick={() => router.push('/messages')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, padding: 0, lineHeight: 1 }}
              className="show-mobile-msg">
              ←
            </button>
            <div
              onClick={() => otherUserId && router.push(`/profile/${otherUserId}`)}
              style={{
                width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                background: '#1a3055', display: 'flex', alignItems: 'center',
                justifyContent: 'center', overflow: 'hidden', cursor: otherUserId ? 'pointer' : 'default',
              }}>
              <AvatarImg src={otherProfile?.avatar_url} alt={dn} fallback={<span style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>{ini}</span>} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ flex: 1, cursor: otherUserId ? 'pointer' : 'default' }}
              onClick={() => otherUserId && router.push(`/profile/${otherUserId}`)}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#1a3055' }}>{loading ? '…' : dn}</p>
              {otherProfile?.institution && (
                <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>{otherProfile.institution}</p>
              )}
            </div>
            {otherUserId && (
              <button onClick={() => router.push(`/profile/${otherUserId}`)}
                style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                Profile →
              </button>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#f8f9fc' }}>
            {loading && (
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, paddingTop: 40 }}>Loading…</div>
            )}
            {!loading && messages.length === 0 && (
              <div style={{ textAlign: 'center', paddingTop: 60 }}>
                <p style={{ fontSize: 28, marginBottom: 8 }}>👋</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1a3055' }}>Start of conversation with {dn}</p>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Send your first message!</p>
              </div>
            )}

            {groups.map(group => (
              <div key={group.date}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 12px' }}>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }}/>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{group.date}</span>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }}/>
                </div>
                {group.msgs.map((msg, i) => {
                  const isMe = msg.sender_id === user?.id
                  const prevMsg = group.msgs[i - 1]
                  const sameAsPrev = prevMsg && prevMsg.sender_id === msg.sender_id
                  return (
                    <div key={msg.id} style={{
                      display: 'flex',
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                      marginBottom: sameAsPrev ? 2 : 8,
                      alignItems: 'flex-end', gap: 8,
                    }}>
                      {!isMe && (
                        <div style={{ width: 28, flexShrink: 0 }}>
                          {!sameAsPrev && (
                            <div style={{
                              width: 28, height: 28, borderRadius: 8,
                              background: '#1a3055', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', overflow: 'hidden',
                            }}>
                              <AvatarImg src={otherProfile?.avatar_url} alt={dn} fallback={<span style={{ fontSize: 10, fontWeight: 800, color: 'white' }}>{ini}</span>} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{ maxWidth: '68%' }}>
                        <div style={{
                          background: isMe ? '#1a3055' : 'white',
                          color: isMe ? 'white' : '#1a3055',
                          borderRadius: isMe
                            ? (sameAsPrev ? '14px 14px 4px 14px' : '14px 14px 4px 14px')
                            : (sameAsPrev ? '4px 14px 14px 14px' : '14px 14px 14px 4px'),
                          padding: msg.media_url && !msg.text ? '6px' : '9px 13px',
                          fontSize: 13, lineHeight: 1.5,
                          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                          border: isMe ? 'none' : '1px solid #f1f5f9',
                          wordBreak: 'break-word', overflow: 'hidden',
                        }}>
                          {msg.media_url && msg.media_type === 'image' && (
                            <img src={msg.media_url} alt={msg.media_name ?? ''} style={{ maxWidth: 240, maxHeight: 200, borderRadius: 10, display: 'block', objectFit: 'cover', cursor: 'zoom-in' }} onClick={() => setLightboxSrc(msg.media_url!)} />
                          )}
                          {msg.media_url && msg.media_type === 'pdf' && (
                            <a href={msg.media_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, color: isMe ? 'white' : '#1a3055', textDecoration: 'none' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{msg.media_name ?? 'Document'}</span>
                            </a>
                          )}
                          {msg.text && <span style={{ display: msg.media_url ? 'block' : 'inline', marginTop: msg.media_url ? 4 : 0, whiteSpace: 'pre-wrap' }}>{linkifyText(msg.text, { className: 'hover:opacity-80', style: { color: isMe ? '#fff' : '#2563eb', textDecoration: 'underline', wordBreak: 'break-word' } })}</span>}
                        </div>
                        {(i === group.msgs.length - 1 || group.msgs[i + 1]?.sender_id !== msg.sender_id) && (
                          <p style={{
                            margin: '2px 0 0', fontSize: 10, color: '#94a3b8',
                            textAlign: isMe ? 'right' : 'left',
                            paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0,
                          }}>
                            {formatTime(msg.created_at)}{isMe && (msg.read ? ' · Read' : '')}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div ref={bottomRef}/>
          </div>

          {/* Input */}
          <div style={{ background: 'white', borderTop: '1px solid #f1f5f9', padding: '10px 14px', flexShrink: 0, paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
            <input type="file" ref={fileRef} style={{ display: 'none' }} accept="image/*,application/pdf" onChange={handleFile} />
            {/* Media preview */}
            {media && (
              <div style={{ marginBottom: 8, position: 'relative', display: 'inline-block' }}>
                {media.type === 'image'
                  ? <img src={media.dataUrl} alt={media.name} style={{ maxHeight: 100, maxWidth: 200, borderRadius: 10, objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                  : <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f1f5f9', borderRadius: 10, padding: '6px 10px' }}>
                      <IconFile /><span style={{ fontSize: 12, color: '#475569', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{media.name}</span>
                    </div>}
                <button onClick={() => setMedia(null)} style={{ position: 'absolute', top: -6, right: -6, background: '#1a3055', color: 'white', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            )}
            {/* Row */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              {/* File buttons */}
              <button onClick={() => { if (fileRef.current) { fileRef.current.accept = 'image/*'; fileRef.current.click() } }}
                title="Photo" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#475569'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#94a3b8'}>
                <IconImage />
              </button>
              <button onClick={() => { if (fileRef.current) { fileRef.current.accept = 'application/pdf'; fileRef.current.click() } }}
                title="File" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#475569'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#94a3b8'}>
                <IconFile />
              </button>
              {/* Text input */}
              <textarea
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="Write a message… (Enter to send)"
                rows={1}
                style={{
                  flex: 1, background: '#f8f9fc', border: '1px solid transparent',
                  borderRadius: 12, padding: '9px 14px', fontSize: 13, color: '#1a3055',
                  resize: 'none', outline: 'none', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto',
                }}
                onFocus={e => { e.target.style.borderColor = '#e2e8f0' }}
                onBlur={e => { e.target.style.borderColor = 'transparent' }}
              />
              {/* Send */}
              <button onClick={handleSend} disabled={sending || (!text.trim() && !media)}
                style={{
                  background: '#1a3055', color: 'white', border: 'none', borderRadius: 12,
                  width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: sending || (!text.trim() && !media) ? 'not-allowed' : 'pointer',
                  opacity: sending || (!text.trim() && !media) ? 0.4 : 1,
                  flexShrink: 0, fontSize: 16, transition: 'opacity 0.15s',
                }}>↑</button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .hidden-mobile-msg { display: none !important; }

          /* Full-screen overlay — above topbar (z-index 45)
             100dvh = dynamic viewport height: shrinks automatically when the
             iOS keyboard opens, keeping the header always visible.            */
          .dm-outer-wrap {
            position: fixed !important;
            top: 0 !important; left: 0 !important; right: 0 !important;
            height: 100dvh !important;
            max-width: 100% !important;
            border-radius: 0 !important;
            border: none !important;
            box-shadow: none !important;
            flex-direction: column !important;
            z-index: 60 !important;
            margin: 0 !important;
            overflow: hidden !important;
          }

          /* Header: account for iPhone notch / Dynamic Island */
          .dm-chat-header {
            padding-top: calc(12px + env(safe-area-inset-top)) !important;
            position: sticky !important;
            top: 0 !important;
            z-index: 10 !important;
            flex-shrink: 0 !important;
          }
        }
        @media (min-width: 769px) {
          .show-mobile-msg { display: none !important; }
        }
      `}</style>
    </AppShell>
    {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </>
  )
}
