'use client'
import AppShell from '@/components/layout/AppShell'
import { useFeed }  from '@/lib/hooks/useFeed'
import { useAuth }  from '@/lib/hooks/useAuth'
import { useState, useRef, useEffect } from 'react'

const IconImage = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
  </svg>
)
const IconFile = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
)
import { createClient } from '@/lib/supabase/client'
import MentionInput from '@/components/ui/MentionInput'
import { useRouter } from 'next/navigation'
import { renderMentions } from '@/components/ui/renderMentions'
import PostCarousel from '@/components/ui/PostCarousel'
import ImageLightbox from '@/components/ui/ImageLightbox'
import AvatarImg from '@/components/ui/AvatarImg'

export default function FeedPage() {
  const { user, profile } = useAuth()
  const { posts, loading, loadingMore, hasMore, loadMore, error: feedError, createPost, toggleLike, addComment, deletePost, editPost } = useFeed(user?.id)
  const router = useRouter()
  const [text,   setText]   = useState('')
  const [images, setImages] = useState<{ dataUrl: string; name: string }[]>([])
  const [pdf,    setPdf]    = useState<{ dataUrl: string; name: string } | null>(null)
  const hasMedia = images.length > 0 || !!pdf
  const [expanded,setExp]   = useState<Record<string,boolean>>({})
  const [cText,  setCText]  = useState<Record<string,string>>({})
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [lightboxSrc,  setLightboxSrc]  = useState<string | null>(null)
  const [lightboxName, setLightboxName] = useState<string>('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [menuOpen,      setMenuOpen]      = useState<string | null>(null)  // postId du menu ouvert
  const [editingId,     setEditingId]     = useState<string | null>(null)  // postId en cours d'édition
  const [editText,      setEditText]      = useState('')
  const [savingEdit,    setSavingEdit]    = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Affiche la modale d'onboarding si le profil est incomplet (1er login)
  useEffect(() => {
    if (!profile) return
    const key = `al_onboarded_${profile?.id}`
    const alreadySeen = localStorage.getItem(key)
    const isIncomplete = !profile?.first_name && !profile.name
    if (isIncomplete && !alreadySeen) {
      setShowOnboarding(true)
      localStorage.setItem(key, '1')
    }
  }, [profile])

  const readDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = ev => resolve(ev.target!.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const MAX_IMAGES = 10

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    const pdfs = files.filter(f => f.type === 'application/pdf')
    const imgs = files.filter(f => f.type.startsWith('image/'))
    // Mélange photos + PDF : un post ne peut pas contenir les deux → on garde les photos
    if (pdfs.length && imgs.length) {
      alert('A post can contain either photos or a PDF — not both. Keeping the photos; the PDF was skipped.')
    }
    // PDF seul (exclusif des images)
    else if (pdfs.length) {
      const f = pdfs[0]
      if (pdfs.length > 1) alert('Only one PDF per post — keeping the first one.')
      if (f.size > 20 * 1024 * 1024) { alert('PDF must be under 20 MB.'); return }
      setPdf({ dataUrl: await readDataUrl(f), name: f.name })
      setImages([])
      return
    }
    // Images (potentiellement plusieurs) — exclusives du PDF
    const oversized = imgs.filter(f => f.size > 5 * 1024 * 1024)
    if (oversized.length) alert(`Skipped (over 5 MB): ${oversized.map(f => f.name).join(', ')}`)
    const valid = imgs.filter(f => f.size <= 5 * 1024 * 1024)
    if (!valid.length) return
    const read = await Promise.all(valid.map(async f => ({ dataUrl: await readDataUrl(f), name: f.name })))
    setPdf(null)
    setImages(prev => {
      const merged = [...prev, ...read]
      if (merged.length > MAX_IMAGES) alert(`You can add up to ${MAX_IMAGES} photos per post — the extra ones were not added.`)
      return merged.slice(0, MAX_IMAGES)
    })
  }

  const uploadDataUrl = async (dataUrl: string, name: string): Promise<string | null> => {
    if (!user) return null
    const [header, base64] = dataUrl.split(',')
    const mime = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream'
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: mime })
    const ext = name.split('.').pop() ?? 'bin'
    const path = `${user.id}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`
    const { data } = await supabase.storage.from('feed-media').upload(path, blob, { contentType: mime })
    if (!data) return null
    return supabase.storage.from('feed-media').getPublicUrl(data.path).data.publicUrl
  }

  const submit = async () => {
    if (!text.trim() && !hasMedia) return
    setPosting(true)
    setPostError(null)
    let uploadedMedia: { type: 'image' | 'pdf'; url: string; name: string; urls?: string[] } | null = null
    try {
      if (pdf) {
        const url = await uploadDataUrl(pdf.dataUrl, pdf.name)
        if (url) uploadedMedia = { type: 'pdf', url, name: pdf.name }
      } else if (images.length) {
        const urls: string[] = []
        for (const img of images) {
          const url = await uploadDataUrl(img.dataUrl, img.name)
          if (url) urls.push(url)
        }
        if (urls.length) uploadedMedia = { type: 'image', url: urls[0], name: images[0].name, urls }
      }
    } catch (e) { console.error('Upload error', e) }
    const optimisticProfile = profile ? {
      name: profile.name ?? '',
      first_name: profile?.first_name ?? null,
      last_name:  profile?.last_name  ?? null,
      institution: profile.institution ?? null,
      avatar_url: profile.avatar_url ?? null,
    } : null
    const err = await createPost(text.trim(), uploadedMedia, optimisticProfile ?? undefined)
    if (err) setPostError(err)
    else { setText(''); setImages([]); setPdf(null) }
    setPosting(false)
  }

  const initials = (profile?.name ?? user?.email ?? '?').split(/[\s@]/)[0]?.slice(0, 2).toUpperCase() ?? '?'
  const myAvatar = profile?.avatar_url ?? null

  // "Say hello!" — visible tant que l'utilisateur n'a pas encore posté
  const hasPosted = posts.some(p => p.user_id === user?.id)

  function buildIntroTemplate() {
    const firstName  = profile?.first_name ?? profile?.name?.split(' ')[0] ?? 'me'
    const institution = profile?.institution ?? '[my institution]'
    const role        = profile?.role ?? '[my role]'
    return `Hi everyone! 👋 I'm ${firstName}, ${role} at ${institution}. I just joined the AroundLink community and I'm excited to connect with fellow IROs from around the world!\n\nFeel free to reach out if you'd like to exchange on partnerships, mobility, or anything international relations 🌍`
  }

  function handleUseTemplate() {
    setText(buildIntroTemplate())
    // Scroll vers le composer
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function Avatar({ name, avatarUrl, size = 10, rounded = 'xl' }: { name: string; avatarUrl?: string | null; size?: number; rounded?: string }) {
    const ini = (name ?? '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?'
    const px = size * 4
    return <AvatarImg src={avatarUrl} alt={name} fallback={<div style={{ width: px, height: px, borderRadius: rounded === 'full' ? '50%' : 12, background: '#1a3055', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: px * 0.32, fontWeight: 900, color: 'white', flexShrink: 0 }}>{ini}</div>} style={{ width: px, height: px, borderRadius: rounded === 'full' ? '50%' : 12, objectFit: 'cover', flexShrink: 0 }} />
  }

  return (
    <>
    <AppShell>

      {/* Onboarding modal */}
      {showOnboarding && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 24, padding: 32, maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>👋</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1a3055', margin: '0 0 8px' }}>Welcome to AroundLink!</h2>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: '0 0 20px' }}>
              The community for International Relations Officers. Start by completing your profile — it takes 2 minutes and helps other members find you.
            </p>
            <div style={{ background: '#f8f9fc', borderRadius: 14, padding: '12px 16px', marginBottom: 20, textAlign: 'left' }}>
              {[
                { icon: '🏛️', label: 'Your institution' },
                { icon: '💼', label: 'Your role' },
                { icon: '🔗', label: 'Your LinkedIn profile' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 13, color: '#475569' }}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => { setShowOnboarding(false); router.push('/profile') }}
              style={{ width: '100%', background: '#1a3055', color: 'white', border: 'none', borderRadius: 14, padding: '13px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
              Complete my profile →
            </button>
            <button
              onClick={() => setShowOnboarding(false)}
              style={{ width: '100%', background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer', padding: '6px 0' }}>
              I'll do it later
            </button>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Composer */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5"><Avatar name={profile?.name ?? ''} avatarUrl={myAvatar} size={9} rounded="full"/></div>
            <div className="flex-1">
              <MentionInput
                value={text}
                onChange={setText}
                onSubmit={submit}
                placeholder="Share something with the community… use @ to mention someone"
                rows={2}
              />
              {postError && (
                <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">⚠️ {postError}</p>
              )}
              {images.length > 0 && (
                <div className="mt-2 flex gap-2 flex-wrap">
                  {images.map((img, i) => (
                    <div key={i} className="relative">
                      <img src={img.dataUrl} alt={img.name} className="rounded-xl object-cover border border-slate-200" style={{ width: 80, height: 80 }}/>
                      <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1.5 -right-1.5 bg-white rounded-full w-5 h-5 text-slate-500 text-xs flex items-center justify-center shadow border border-slate-200">✕</button>
                    </div>
                  ))}
                  {images.length > 1 && <p className="w-full text-xs text-slate-400 mt-0.5">{images.length} photos — they'll show as a carousel</p>}
                </div>
              )}
              {pdf && (
                <div className="mt-2 relative">
                  <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-200"><span className="text-slate-400"><IconFile /></span><p className="text-sm font-semibold">{pdf.name}</p></div>
                  <button onClick={() => setPdf(null)} className="absolute top-2 right-2 bg-white rounded-full w-6 h-6 text-slate-500 text-xs flex items-center justify-center shadow border border-slate-200">✕</button>
                </div>
              )}
              <div className="flex items-center justify-between mt-2 gap-2">
                <div className="flex gap-1">
                  <input type="file" ref={fileRef} className="hidden" multiple accept="image/*,application/pdf" onChange={handleFile}/>
                  <button onClick={() => { if(fileRef.current){fileRef.current.accept='image/*';fileRef.current.multiple=true;fileRef.current.click()} }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs text-slate-500 hover:bg-slate-50 border border-slate-200"><IconImage /> Photo</button>
                  <button onClick={() => { if(fileRef.current){fileRef.current.accept='application/pdf';fileRef.current.multiple=false;fileRef.current.click()} }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs text-slate-500 hover:bg-slate-50 border border-slate-200"><IconFile /> PDF</button>
                </div>
                <div className="flex items-center gap-2">
                  {text.length > 1800 && (
                    <span className={`text-xs font-semibold tabular-nums ${text.length >= 2000 ? 'text-red-500' : 'text-amber-500'}`}>
                      {2000 - text.length}
                    </span>
                  )}
                  {(text.trim() || hasMedia) && (
                    <button onClick={submit} disabled={posting || text.length > 2000} className="px-4 py-1.5 rounded-xl text-white text-xs font-semibold disabled:opacity-50" style={{ background: '#1a3055' }}>
                      {posting ? '…' : 'Post 📰'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Posts */}
        {feedError && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-center">
            <p className="text-2xl mb-2">🚀</p>
            <p className="text-sm font-bold text-amber-800">It's getting busy in here!</p>
            <p className="text-sm text-amber-700 mt-1">
              Looks like everyone decided to post at the same time. The server is having a quick coffee break — try again in a minute!
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-1.5 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: '#1a3055' }}>
              ☕ I'm back, reload
            </button>
          </div>
        )}
        {loading && <p className="text-center text-sm text-slate-400 py-12">Loading feed…</p>}
        {posts.map(post => {
          const isMe = post.user_id === user?.id
          const liked = post.likes.some(l => l.user_id === user?.id)
          const showComments = expanded[post.id]
          return (
            <div key={post.id} className={`bg-white rounded-2xl border p-4 mb-3 shadow-sm fade-in ${isMe ? 'border-blue-100' : 'border-slate-100'}`}>
              <div className="flex items-start gap-3">
                <button onClick={() => post.user_id !== user?.id ? router.push(`/profile/${post.user_id}`) : undefined}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: post.user_id !== user?.id ? 'pointer' : 'default', flexShrink: 0 }}>
                  <Avatar name={post.profiles?.name ?? 'Member'} avatarUrl={post.profiles?.avatar_url} size={10}/>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => post.user_id !== user?.id && router.push(`/profile/${post.user_id}`)}
                      className={`text-sm font-bold text-slate-800 ${post.user_id !== user?.id ? 'hover:text-blue-600 hover:underline cursor-pointer' : 'cursor-default'}`}
                      style={{ background: 'none', border: 'none', padding: 0 }}>
                      {post.profiles?.name ?? 'Member'}
                    </button>
                    {isMe && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold">you</span>}
                    <span className="text-xs text-slate-400 ml-auto">
                      {new Date(post.created_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </span>
                    {isMe && (
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={() => setMenuOpen(menuOpen === post.id ? null : post.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', color: '#94a3b8', fontSize: 16, lineHeight: 1, borderRadius: 6 }}
                          className="hover:bg-slate-100 transition-colors">
                          ···
                        </button>
                        {menuOpen === post.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                            <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 50, background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 140, overflow: 'hidden' }}>
                              <button
                                onClick={() => { setMenuOpen(null); setEditingId(post.id); setEditText(post.text ?? '') }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#1e293b', textAlign: 'left' }}
                                className="hover:bg-slate-50">
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => { setMenuOpen(null); setDeleteConfirm(post.id) }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#ef4444', textAlign: 'left' }}
                                className="hover:bg-red-50">
                                🗑️ Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{post.profiles?.institution ?? ''}</p>
                  {editingId === post.id ? (
                    <div className="mt-2">
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={3}
                        autoFocus
                        className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400"
                        style={{ background: '#f8faff' }}
                      />
                      <div className="flex gap-2 mt-1.5">
                        <button
                          onClick={() => { setEditingId(null); setEditText('') }}
                          style={{ padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #e2e8f0', color: '#64748b', background: 'white', cursor: 'pointer' }}>
                          Cancel
                        </button>
                        <button
                          disabled={savingEdit || !editText.trim()}
                          onClick={async () => {
                            setSavingEdit(true)
                            await editPost(post.id, editText.trim())
                            setSavingEdit(false)
                            setEditingId(null)
                            setEditText('')
                          }}
                          style={{ padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', color: 'white', background: '#1a3055', cursor: 'pointer', opacity: savingEdit ? 0.6 : 1 }}>
                          {savingEdit ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    post.text && <p className="text-sm text-slate-700 mt-2 leading-relaxed whitespace-pre-wrap">{renderMentions(post.text)}</p>
                  )}
                  {post.media_type === 'image' && post.media_urls && post.media_urls.length > 1 ? (
                    <PostCarousel images={post.media_urls} onOpen={(src) => { setLightboxSrc(src); setLightboxName(post.media_name ?? 'image') }} />
                  ) : post.media_url && (
                    post.media_type === 'image'
                      ? <img src={post.media_url} alt={post.media_name ?? ''} className="mt-2 rounded-xl w-full object-cover" style={{ maxHeight: 280, cursor: 'zoom-in' }}
                          onClick={() => { setLightboxSrc(post.media_url!); setLightboxName(post.media_name ?? 'image') }}/>
                      : <div className="mt-2 flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                          onClick={() => post.media_url && downloadMedia(post.media_url, post.media_name ?? 'document.pdf')}>
                          <span className="text-slate-400"><IconFile /></span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700 truncate">{post.media_name}</p>
                            <p className="text-xs text-slate-400">PDF · Click to download</p>
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 flex-shrink-0">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                        </div>
                  )}
                  <div className="flex items-center gap-1 mt-3 border-t border-slate-50 pt-2">
                    <button onClick={() => toggleLike(post.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${liked ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                      👍 {post.likes.length}
                    </button>
                    <button onClick={() => setExp(e => ({ ...e, [post.id]: !e[post.id] }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${showComments ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:bg-slate-50'}`}>
                      💬 {post.comments.length}
                    </button>
                  </div>
                  {showComments && (
                    <div className="mt-2 space-y-2">
                      {post.comments.map((c,ci) => {
                        const goToCommentAuthor = () => c.user_id && c.user_id !== user?.id && router.push(`/profile/${c.user_id}`)
                        return (
                        <div key={ci} className="flex items-start gap-2">
                          <button onClick={goToCommentAuthor}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: c.user_id && c.user_id !== user?.id ? 'pointer' : 'default', flexShrink: 0 }}>
                            <Avatar name={c.profiles?.name ?? '?'} avatarUrl={c.profiles?.avatar_url} size={6} rounded="full"/>
                          </button>
                          <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
                            <span onClick={goToCommentAuthor}
                              className={`text-xs font-semibold text-slate-700 ${c.user_id && c.user_id !== user?.id ? 'cursor-pointer hover:underline' : ''}`}>
                              {c.profiles?.name}{' '}
                            </span>
                            <span className="text-xs text-slate-600 whitespace-pre-wrap">{renderMentions(c.text)}</span>
                          </div>
                        </div>
                        )
                      })}
                      <div className="flex gap-2 mt-1 items-end">
                        <div className="mb-1"><Avatar name={profile?.name ?? ''} avatarUrl={myAvatar} size={6} rounded="full"/></div>
                        <MentionInput
                          value={cText[post.id] ?? ''}
                          onChange={v => setCText(t => ({ ...t, [post.id]: v }))}
                          onSubmit={() => addComment(post.id, cText[post.id] ?? '').then(() => setCText(t => ({ ...t, [post.id]: '' })))}
                          placeholder="Add a comment… @ to mention"
                          rows={1}
                          className="flex-1"
                        />
                        <button
                          onClick={() => addComment(post.id, cText[post.id] ?? '').then(() => setCText(t => ({ ...t, [post.id]: '' })))}
                          className="px-3 py-1.5 rounded-xl text-white text-xs font-bold mb-0.5 flex-shrink-0" style={{ background: '#1a3055' }}>↑</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* "Say hello!" — affiché tant que l'utilisateur n'a pas encore posté */}
        {!loading && !hasPosted && (
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-slate-50 p-5 mb-4 shadow-sm">
            <div className="flex items-start gap-3 mb-4">
              <div className="text-3xl flex-shrink-0">👋</div>
              <div>
                <h2 className="text-base font-black text-slate-800 mb-0.5">Say hello to the community!</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  You haven't introduced yourself yet. Here's a ready-made template — just edit and post!
                </p>
              </div>
            </div>

            {/* Aperçu du template */}
            <div
              onClick={handleUseTemplate}
              className="bg-white rounded-xl border border-blue-100 px-4 py-3 mb-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <p className="text-xs text-slate-500 mb-1.5 font-semibold uppercase tracking-wide">Preview</p>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {buildIntroTemplate()}
              </p>
              <p className="text-xs text-blue-500 mt-2 font-semibold group-hover:underline">Click to use this template →</p>
            </div>

            <button
              onClick={handleUseTemplate}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: '#1a3055' }}>
              ✏️ Post my introduction
            </button>
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="text-center py-10">
            <p className="text-sm text-slate-400">No posts yet — be the first to share something above!</p>
          </div>
        )}

        {/* Load more */}
        {!loading && posts.length > 0 && (
          <div className="text-center py-4">
            {hasMore ? (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50">
                {loadingMore ? 'Loading…' : 'Load more posts'}
              </button>
            ) : (
              <p className="text-xs text-slate-300">You've reached the beginning 🎉</p>
            )}
          </div>
        )}
      </div>
    </AppShell>
    {lightboxSrc && (
      <ImageLightbox
        src={lightboxSrc}
        filename={lightboxName}
        onClose={() => { setLightboxSrc(null); setLightboxName('') }}
      />
    )}

    {/* Modal confirmation suppression de post */}
    {deleteConfirm && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🗑️</p>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1a3055', margin: '0 0 8px' }}>Delete this post?</h2>
          <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>This action is permanent. The post and its comments will be removed.</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setDeleteConfirm(null)}
              style={{ flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, border: '1px solid #e2e8f0', color: '#64748b', background: 'white', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={async () => { const id = deleteConfirm; setDeleteConfirm(null); await deletePost(id) }}
              style={{ flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 700, border: 'none', color: 'white', background: '#ef4444', cursor: 'pointer' }}>
              Delete
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

async function downloadMedia(url: string, filename: string) {
  try {
    const res  = await fetch(url)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl; a.download = filename
    document.body.appendChild(a); a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  } catch { window.open(url, '_blank') }
}
