'use client'
import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { useChannels } from '@/lib/hooks/useChannels'
import { useUnread } from '@/lib/hooks/useUnread'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import MentionInput from '@/components/ui/MentionInput'
import { renderMentions } from '@/components/ui/renderMentions'
import ImageLightbox from '@/components/ui/ImageLightbox'
import AvatarImg from '@/components/ui/AvatarImg'

// Minimalist SVG icons (no emoji)
const IconImage = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
  </svg>
)
const IconFile = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
)


export default function ChannelDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, profile } = useAuth()
  const { channels, posts, uploads, myChannelIds, loading, joinChannel, leaveChannel, sendMessage, uploadDoc, toggleLike, addComment, deletePost, editPost, updateChannel } = useChannels(user?.id, profile, id)
  const { markAsRead } = useUnread(posts, myChannelIds)
  const supabase = createClient()

  // ── Load more older messages ──────────────────────────────────────────────
  const [olderPosts, setOlderPosts] = useState<typeof posts>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  // Reset on channel change
  useEffect(() => { setOlderPosts([]); setHasMore(true) }, [id])

  const loadMorePosts = async () => {
    if (loadingMore || !hasMore) return
    const allPosts = [...olderPosts, ...posts.filter(p => p.channel_id === id)]
    const oldest = allPosts[0]?.created_at
    if (!oldest) return
    setLoadingMore(true)
    const prevScrollHeight = scrollRef.current?.scrollHeight ?? 0
    const { data } = await supabase
      .from('channel_posts')
      .select([
        '*',
        'profiles!channel_posts_user_id_fkey(name, first_name, last_name, avatar_url)',
        'likes:channel_post_likes(post_id, user_id, created_at)',
        'comments:channel_post_comments(id, post_id, user_id, text, created_at, profiles!channel_post_comments_user_id_fkey(name, first_name, last_name, avatar_url))',
      ].join(', '))
      .eq('channel_id', id)
      .lt('created_at', oldest)
      .order('created_at', { ascending: false })
      .limit(50)
    setLoadingMore(false)
    if (!data || data.length === 0) { setHasMore(false); return }
    if (data.length < 50) setHasMore(false)
    const reversed = ([...data].reverse()) as unknown as typeof olderPosts
    setOlderPosts(prev => [...reversed, ...prev])
    // Restore scroll position so user stays at the same message
    requestAnimationFrame(() => {
      if (!scrollRef.current) return
      const newScrollHeight = scrollRef.current.scrollHeight
      scrollRef.current.scrollTop = newScrollHeight - prevScrollHeight
    })
  }

  // Combine older + current posts for display
  const allChannelPosts = [...olderPosts, ...posts.filter(p => p.channel_id === id)]

  // Capture l'ancienne last_seen_at PUIS met à jour — pour afficher le séparateur "New"
  const [prevLastSeenAt, setPrevLastSeenAt] = useState<string | null>(null)
  useEffect(() => {
    if (!user?.id || !id) return
    setPrevLastSeenAt(null)  // reset on channel change
    supabase.from('channel_last_seen')
      .select('last_seen_at')
      .eq('user_id', user.id)
      .eq('channel_id', id)
      .single()
      .then(({ data }) => {
        setPrevLastSeenAt(data?.last_seen_at ?? null)
        supabase.from('channel_last_seen')
          .upsert({ user_id: user.id, channel_id: id, last_seen_at: new Date().toISOString() },
                   { onConflict: 'user_id,channel_id' })
          .then(() => {})
      })
  }, [user?.id, id])

  const channel = channels.find(c => c.id === id)
  const [tab, setTab]         = useState<'messages' | 'documents' | 'members'>('messages')
  const [msgText, setMsgText] = useState('')
  const [msgMedia, setMsgMedia] = useState<{ type: 'image' | 'pdf'; dataUrl: string; name: string } | null>(null)
  const [sending, setSending]   = useState(false)
  const [sendError, setSendError]   = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)  // unused — kept for compat
  const [lightboxSrc,  setLightboxSrc]  = useState<string | null>(null)
  const [lightboxName, setLightboxName] = useState<string>('')
  const [deletePostConfirm, setDeletePostConfirm] = useState<string | null>(null)
  const [postMenuOpen,      setPostMenuOpen]      = useState<string | null>(null)
  const [editingPostId,     setEditingPostId]     = useState<string | null>(null)
  const [editPostText,      setEditPostText]      = useState('')
  const [savingEdit,        setSavingEdit]        = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  // Édition du channel (admin only)
  const isAdmin = profile?.app_role === 'admin'
  const [showEditChannel, setShowEditChannel] = useState(false)
  const [editEmoji, setEditEmoji] = useState('')
  const [editName,  setEditName]  = useState('')
  const [editDesc,  setEditDesc]  = useState('')
  const [savingChannel, setSavingChannel] = useState(false)
  const openEditChannel = () => {
    if (!channel) return
    setEditEmoji(channel.emoji ?? '💬')
    setEditName(channel.name ?? '')
    setEditDesc(channel.description ?? '')
    setShowEditChannel(true)
  }
  const saveChannelEdit = async () => {
    if (!editName.trim()) return
    setSavingChannel(true)
    await updateChannel(id, { emoji: editEmoji, name: editName.trim(), description: editDesc.trim() })
    setSavingChannel(false)
    setShowEditChannel(false)
  }
  // All media posts for this channel (Documents tab — unlimited, separate fetch)
  type MediaPost = { id: string; media_type: string; media_url: string; media_name: string | null; created_at: string; profiles: { name: string | null } | null }
  const [allMediaPosts, setAllMediaPosts] = useState<MediaPost[]>([])
  const [expanded, setExp]   = useState<Record<string, boolean>>({})  // expanded comments
  const [cText, setCText]    = useState<Record<string, string>>({})   // comment inputs
  const fileRef        = useRef<HTMLInputElement>(null)
  const docRef         = useRef<HTMLInputElement>(null)
  const bottomRef      = useRef<HTMLDivElement>(null)
  const scrollRef      = useRef<HTMLDivElement>(null)  // the scrollable messages container
  const newMsgRef      = useRef<HTMLDivElement>(null)  // premier message non lu
  const hasInitialScrolled = useRef<Record<string, boolean>>({})  // did we instant-scroll this channel yet?

  const isJoined      = myChannelIds.includes(id)
  const channelPosts   = posts.filter(p => p.channel_id === id)
  const channelUploads = uploads.filter(u => u.channel_id === id)
  const initials = (profile?.name ?? '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  // Calcule l'index du premier message non lu (après prevLastSeenAt)
  const firstUnreadIdx = prevLastSeenAt
    ? allChannelPosts.findIndex(p => p.created_at > prevLastSeenAt)
    : -1
  const unreadCount = firstUnreadIdx >= 0 ? allChannelPosts.length - firstUnreadIdx : 0

  // Membres du channel
  type Member = { user_id: string; profiles: { name: string | null; first_name: string | null; last_name: string | null; avatar_url: string | null; institution: string | null } | null }
  const [members, setMembers] = useState<Member[]>([])

  useEffect(() => {
    if (!id) return
    supabase.from('channel_members')
      .select('user_id, profiles!channel_members_user_id_fkey(name, first_name, last_name, avatar_url, institution)')
      .eq('channel_id', id)
      .limit(50)
      .then(({ data }) => { if (data) setMembers(data as unknown as Member[]) })
  }, [id])

  // Fetch ALL media posts for Documents tab (no limit)
  useEffect(() => {
    if (!id) return
    supabase.from('channel_posts')
      .select('id, media_type, media_url, media_name, created_at, profiles!channel_posts_user_id_fkey(name)')
      .eq('channel_id', id)
      .not('media_url', 'is', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setAllMediaPosts(data as unknown as typeof allMediaPosts) })
  }, [id])

  // ── Invite dans le channel ──
  type InviteUser = { id: string; name: string | null; first_name: string | null; last_name: string | null; institution: string | null }
  const [showInvite,    setShowInvite]    = useState(false)
  const [inviteQuery,   setInviteQuery]   = useState('')
  const [inviteResults, setInviteResults] = useState<InviteUser[]>([])
  const [inviteSelected, setInviteSelected] = useState<InviteUser[]>([])
  const [inviting,      setInviting]      = useState(false)
  const [inviteDone,    setInviteDone]    = useState(false)
  const inviteDebounce  = useRef<NodeJS.Timeout | null>(null)

  const memberIds = new Set(members.map(m => m.user_id))

  const searchInviteUsers = async (q: string) => {
    const safeQ = q.replace(/[%_(),'\\]/g, c => `\\${c}`)
    const { data } = await supabase
      .from('profiles')
      .select('id, name, first_name, last_name, institution')
      .or(`name.ilike.%${safeQ}%,first_name.ilike.%${safeQ}%,last_name.ilike.%${safeQ}%`)
      .neq('id', user?.id ?? '')
      .limit(6)
    const filtered = (data ?? []).filter((u: any) => !memberIds.has(u.id))
    setInviteResults(filtered as InviteUser[])
  }

  const handleInviteQueryChange = (q: string) => {
    setInviteQuery(q)
    if (inviteDebounce.current) clearTimeout(inviteDebounce.current)
    inviteDebounce.current = setTimeout(() => searchInviteUsers(q), 200)
  }

  const inviteGetName = (u: InviteUser) => {
    if (u.first_name || u.last_name) return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
    return u.name ?? 'Member'
  }
  const inviteGetInitials = (u: InviteUser) =>
    inviteGetName(u).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

  const toggleSelect = (u: InviteUser) =>
    setInviteSelected(prev => prev.find(x => x.id === u.id) ? prev.filter(x => x.id !== u.id) : [...prev, u])

  const fromName = profile
    ? (`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || profile.name || '')
    : ''

  const sendChannelInvites = async () => {
    if (!channel || !inviteSelected.length) return
    setInviting(true)
    const rows = inviteSelected.map(u => ({
      user_id:      u.id,
      from_name:    fromName,
      type:         'invite',
      source:       'invite',
      channel_id:   id,
      channel_name: channel.name,
      post_id:      null,
    }))
    await supabase.from('notifications').insert(rows)
    setInviting(false)
    setInviteDone(true)
    setTimeout(() => {
      setShowInvite(false); setInviteSelected([]); setInviteQuery(''); setInviteResults([]); setInviteDone(false)
    }, 1600)
  }

  useEffect(() => {
    if (!scrollRef.current || allChannelPosts.length === 0) return
    const el = scrollRef.current

    if (!hasInitialScrolled.current[id]) {
      // First posts loaded for this channel → instant jump (setTimeout lets DOM paint first)
      hasInitialScrolled.current[id] = true
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }, 0)
    } else {
      // Subsequent new messages → smooth scroll, only if already near the bottom
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      if (distanceFromBottom < 250) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      }
    }
    markAsRead(id)
  }, [channelPosts.length, id])

  // Loading state — évite le flash "not found" pendant le fetch initial
  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading…</div>
      </AppShell>
    )
  }

  if (!channel) {
    return (
      <AppShell>
        <div className="text-center py-16">
          <p className="text-3xl mb-2">🔍</p>
          <p className="font-semibold text-slate-600">Channel not found</p>
          <button onClick={() => router.push('/channels')} className="mt-4 text-sm text-blue-600 hover:underline">← Back to channels</button>
        </div>
      </AppShell>
    )
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const isImg = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    if (!isImg && !isPdf) return
    const maxSize = isImg ? 5 * 1024 * 1024 : 20 * 1024 * 1024 // 5MB images, 20MB PDFs
    if (file.size > maxSize) {
      alert(isImg ? 'Image must be under 5 MB.' : 'PDF must be under 20 MB.')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = ev => setMsgMedia({ type: isImg ? 'image' : 'pdf', dataUrl: ev.target!.result as string, name: file.name })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return
    setUploadError(null)
    try {
      const [header, base64] = await new Promise<[string, string]>(resolve => {
        const reader = new FileReader()
        reader.onload = ev => { const [h, b] = (ev.target!.result as string).split(','); resolve([h, b]) }
        reader.readAsDataURL(file)
      })
      const mime = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream'
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: mime })
      const ext = file.name.split('.').pop() ?? 'bin'
      const path = `${id}/${user.id}/${Date.now()}.${ext}`
      const { data, error: storageErr } = await supabase.storage.from('channel-media').upload(path, blob, { contentType: mime })
      if (storageErr) { setUploadError(`Storage error: ${storageErr.message}`) }
      else if (data) {
        const { data: { publicUrl } } = supabase.storage.from('channel-media').getPublicUrl(data.path)
        await uploadDoc(id, file.name, publicUrl, mime)
      }
    } catch (err: any) { setUploadError(`Upload failed: ${err?.message ?? 'Unknown error'}`) }
    e.target.value = ''
  }

  const handleSend = async () => {
    if (!msgText.trim() && !msgMedia) return
    setSending(true); setSendError(null)
    let uploadedMedia = null
    if (msgMedia && user) {
      try {
        const [header, base64] = msgMedia.dataUrl.split(',')
        const mime = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream'
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const blob = new Blob([bytes], { type: mime })
        const ext = msgMedia.name.split('.').pop() ?? 'bin'
        const path = `${id}/${user.id}/${Date.now()}.${ext}`
        const { data, error: storageErr } = await supabase.storage.from('channel-media').upload(path, blob, { contentType: mime })
        if (storageErr) { setSendError(`Media upload failed: ${storageErr.message}`); setSending(false); return }
        if (data) {
          const { data: { publicUrl } } = supabase.storage.from('channel-media').getPublicUrl(data.path)
          uploadedMedia = { type: msgMedia.type, url: publicUrl, name: msgMedia.name }
        }
      } catch (e: any) { setSendError(`Upload error: ${e?.message}`); setSending(false); return }
    }
    const { error } = await sendMessage(id, msgText.trim(), uploadedMedia)
    if (error) { setSendError(error) } else { setMsgText(''); setMsgMedia(null) }
    setSending(false)
  }

  const mediaPostsCount = channelPosts.filter(p => p.media_url).length

  // Top contributor — member with most posts in this channel
  const postCountByUser = channelPosts.reduce<Record<string, number>>((acc, p) => {
    acc[p.user_id] = (acc[p.user_id] ?? 0) + 1
    return acc
  }, {})
  const topContributorId = Object.entries(postCountByUser)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  // Volet info du channel (description, règles, etc.)
  const InfoPanel = () => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{channel.emoji ?? '💬'}</span>
        <div>
          <p className="font-bold text-slate-800 text-sm">#{channel.name}</p>
        </div>
      </div>

      {channel.description && (
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">About</p>
          <p className="text-xs text-slate-600 leading-relaxed">{channel.description}</p>
        </div>
      )}

      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Guidelines</p>
        <ul className="space-y-1">
          {['Stay on topic', 'Be respectful', 'Share useful resources', 'No spam'].map(rule => (
            <li key={rule} className="flex items-start gap-1.5 text-xs text-slate-500">
              <span className="text-green-500 flex-shrink-0 mt-0.5">✓</span>
              {rule}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Top 5 contributors ── */}
      {Object.keys(postCountByUser).length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">🏆 Top contributors</p>
          <div className="space-y-1.5">
            {Object.entries(postCountByUser)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([uid, count], idx) => {
                const m = members.find(x => x.user_id === uid)
                const p = m?.profiles
                const displayName = p ? (`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.name || 'Member') : 'Member'
                const initials2 = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?'
                const medals = ['🥇','🥈','🥉','4️⃣','5️⃣']
                return (
                  <button key={uid} onClick={() => router.push(`/profile/${uid}`)}
                    className="flex items-center gap-2 w-full text-left hover:bg-slate-50 rounded-lg px-1 py-0.5 transition-colors">
                    <span style={{ fontSize: 13, width: 18, flexShrink: 0, textAlign: 'center' }}>{medals[idx]}</span>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden" style={{ background: '#1a3055' }}>
                      <AvatarImg src={p?.avatar_url} alt={displayName} fallback={initials2} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <p className="text-xs font-semibold text-slate-700 truncate flex-1 leading-tight">{displayName}</p>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', flexShrink: 0 }}>{count} msg</span>
                  </button>
                )
              })}
          </div>
        </div>
      )}

      {/* Membres */}
      {members.length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              👥 Members <span className="font-normal normal-case">({members.length})</span>
            </p>
            {isJoined && (
              <button
                onClick={() => { setShowInvite(true); setInviteQuery(''); setInviteResults([]); setInviteSelected([]) }}
                title="Invite someone"
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white hover:opacity-80 transition-opacity flex-shrink-0"
                style={{ background: '#1a3055' }}>
                +
              </button>
            )}
          </div>
          <div className="space-y-1.5 pr-1">
            {members.slice(0, 8).map(m => {
              const p = m.profiles
              const displayName = p ? (`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.name || 'Member') : 'Member'
              const initials2 = displayName.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase() || '?'
              return (
                <button
                  key={m.user_id}
                  onClick={() => router.push(`/profile/${m.user_id}`)}
                  className="flex items-center gap-2 w-full text-left hover:bg-slate-50 rounded-lg px-1 py-0.5 transition-colors cursor-pointer">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden" style={{ background: '#1a3055' }}>
                    <AvatarImg src={p?.avatar_url} alt={displayName} fallback={initials2} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <p className="text-xs font-semibold text-slate-700 truncate leading-tight">{displayName}</p>
                      {m.user_id === topContributorId && postCountByUser[m.user_id] > 0 && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 999,
                          background: '#fef9c3', color: '#b45309', flexShrink: 0,
                          border: '1px solid #fde68a', lineHeight: '14px',
                        }}>⭐ Top</span>
                      )}
                    </div>
                    {p?.institution && <p className="text-xs text-slate-400 truncate" style={{ fontSize: 10 }}>{p.institution}</p>}
                  </div>
                  <span className="text-slate-300 text-xs flex-shrink-0">→</span>
                </button>
              )
            })}
          </div>
          {members.length > 8 && (
            <button
              onClick={() => setTab('members')}
              className="mt-2 w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-700 py-1.5 hover:bg-blue-50 rounded-lg transition-colors">
              View all {members.length} members →
            </button>
          )}
        </div>
      )}

    </div>
  )

  return (
    <>
    <AppShell>
      {/* Full-height sticky layout: header / feed+composer / right panel */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100vh - 56px)', overflow: 'hidden',
        padding: '12px 16px', gap: 10, maxWidth: 1200, margin: '0 auto',
        boxSizing: 'border-box', width: '100%',
      }}>

        {/* ── Header (fixed at top) ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ flexShrink: 0, padding: '10px 14px' }}>
          {/* Top row: back + channel info + join/leave */}
          <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
            <button onClick={() => router.push('/channels')} className="text-slate-400 hover:text-slate-600 text-lg flex-shrink-0">←</button>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: '#eef6ff' }}>
              {channel.emoji ?? '💬'}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-slate-800 text-sm">#{channel.name}</h1>
              <p className="text-xs text-slate-400 truncate">{channel.description}</p>
            </div>

            {/* Edit (admin) */}
            {isAdmin && (
              <button onClick={openEditChannel}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 flex-shrink-0">
                ✏️ Edit
              </button>
            )}

            {/* Leave / Join */}
            <button
              onClick={() => isJoined ? setShowLeaveConfirm(true) : joinChannel(id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex-shrink-0 ${
                isJoined ? 'border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-200'
                         : 'text-white border-transparent'
              }`}
              style={!isJoined ? { background: '#1a3055' } : {}}>
              {isJoined ? 'Leave' : '+ Join'}
            </button>
          </div>
          {/* Tab bar — separate scrollable row */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}
            className="hide-scrollbar">
            {([
              { key: 'messages', label: '💬 Messages' },
              { key: 'documents', label: `📎 Files${mediaPostsCount + channelUploads.length > 0 ? ` (${mediaPostsCount + channelUploads.length})` : ''}` },
              { key: 'members',  label: `👥 Members (${members.length})` },
            ] as const).map(t => (
              <button key={t.key}
                onClick={() => setTab(prev => prev === t.key && t.key !== 'messages' ? 'messages' : t.key as 'messages' | 'documents' | 'members')}
                className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                style={tab === t.key
                  ? { background: '#1a3055', color: 'white', borderColor: 'transparent' }
                  : { background: '#f8fafc', color: '#475569', borderColor: '#e2e8f0' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body row: feed column + right panel ── */}
        <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden', minHeight: 0 }}>

          {/* Feed column */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Messages Tab */}
            {tab === 'messages' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

                {/* Bannière "New messages" — visible si des messages non lus existent */}
                {unreadCount > 0 && (
                  <div style={{
                    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 12,
                    padding: '6px 12px', marginBottom: 6, gap: 10,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#e11d48' }}>
                      🔴 {unreadCount} new message{unreadCount !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => newMsgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                      style={{
                        fontSize: 11, fontWeight: 700, color: '#e11d48', background: 'white',
                        border: '1px solid #fecdd3', borderRadius: 8, padding: '3px 10px', cursor: 'pointer',
                      }}>
                      ↑ Jump to first new
                    </button>
                  </div>
                )}

                <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
                  {/* Load more older messages */}
                  {hasMore && allChannelPosts.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
                      <button
                        onClick={loadMorePosts}
                        disabled={loadingMore}
                        style={{
                          padding: '6px 16px', borderRadius: 20,
                          border: '1px solid #e2e8f0', background: 'white',
                          fontSize: 12, fontWeight: 600, color: '#64748b',
                          cursor: loadingMore ? 'default' : 'pointer',
                          opacity: loadingMore ? 0.6 : 1,
                        }}>
                        {loadingMore ? '…' : '↑ Load older messages'}
                      </button>
                    </div>
                  )}
                  {allChannelPosts.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-3xl mb-2">{channel.emoji ?? '💬'}</p>
                      <p className="font-semibold text-slate-600">No messages yet</p>
                      <p className="text-xs text-slate-400 mt-1">Start the conversation!</p>
                    </div>
                  )}
                  {allChannelPosts.map((post, idx) => {
                    const av = (post.profiles?.name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                    const liked = post.likes?.some(l => l.user_id === user?.id) ?? false
                    const showComments = !!expanded[post.id]
                    const isFirstUnread = idx === firstUnreadIdx
                    return (
                      <div key={post.id}>
                        {/* Séparateur "New messages" avant le premier message non lu */}
                        {isFirstUnread && (
                          <div ref={newMsgRef} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '2px 0 8px',
                          }}>
                            <div style={{ flex: 1, height: 1, background: '#fda4af' }}/>
                            <span style={{
                              fontSize: 10, fontWeight: 800, color: '#e11d48',
                              background: '#fff1f2', border: '1px solid #fecdd3',
                              borderRadius: 999, padding: '2px 10px', whiteSpace: 'nowrap',
                            }}>NEW</span>
                            <div style={{ flex: 1, height: 1, background: '#fda4af' }}/>
                          </div>
                        )}
                      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 fade-in">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => post.user_id !== user?.id ? router.push(`/profile/${post.user_id}`) : undefined}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: post.user_id !== user?.id ? 'pointer' : 'default', flexShrink: 0 }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white overflow-hidden"
                              style={{ background: '#1a3055' }}>
                              <AvatarImg src={post.profiles?.avatar_url} alt={post.profiles?.name ?? ''} fallback={av} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <button
                                onClick={() => post.user_id !== user?.id && router.push(`/profile/${post.user_id}`)}
                                className={`text-xs font-bold text-slate-800 ${post.user_id !== user?.id ? 'hover:underline cursor-pointer' : 'cursor-default'}`}>
                                {post.profiles?.name ?? 'Member'}
                                {post.user_id === user?.id && <span className="ml-1 text-slate-400 font-normal">(you)</span>}
                              </button>
                              <span className="text-xs text-slate-400">
                                {new Date(post.created_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                              </span>
                              <div className="ml-auto flex items-center gap-1">
                                {post.user_id === user?.id && (
                                  <div style={{ position: 'relative' }}>
                                    <button
                                      onClick={() => setPostMenuOpen(postMenuOpen === post.id ? null : post.id)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', color: '#94a3b8', fontSize: 16, lineHeight: 1, borderRadius: 6 }}
                                      className="hover:bg-slate-100 transition-colors">
                                      ···
                                    </button>
                                    {postMenuOpen === post.id && (
                                      <>
                                        <div className="fixed inset-0 z-40" onClick={() => setPostMenuOpen(null)} />
                                        <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 50, background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 140, overflow: 'hidden' }}>
                                          <button
                                            onClick={() => { setPostMenuOpen(null); setEditingPostId(post.id); setEditPostText(post.text ?? '') }}
                                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#1e293b', textAlign: 'left' }}
                                            className="hover:bg-slate-50">
                                            ✏️ Edit
                                          </button>
                                          <button
                                            onClick={() => { setPostMenuOpen(null); setDeletePostConfirm(post.id) }}
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
                            </div>
                            {editingPostId === post.id ? (
                              <div className="mt-1">
                                <textarea
                                  value={editPostText}
                                  onChange={e => setEditPostText(e.target.value)}
                                  rows={2}
                                  autoFocus
                                  className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400"
                                  style={{ background: '#f8faff' }}
                                />
                                <div className="flex gap-2 mt-1">
                                  <button onClick={() => { setEditingPostId(null); setEditPostText('') }}
                                    style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #e2e8f0', color: '#64748b', background: 'white', cursor: 'pointer' }}>
                                    Cancel
                                  </button>
                                  <button
                                    disabled={savingEdit || !editPostText.trim()}
                                    onClick={async () => {
                                      setSavingEdit(true)
                                      await editPost(post.id, editPostText.trim())
                                      setSavingEdit(false)
                                      setEditingPostId(null)
                                      setEditPostText('')
                                    }}
                                    style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', color: 'white', background: '#1a3055', cursor: 'pointer', opacity: savingEdit ? 0.6 : 1 }}>
                                    {savingEdit ? 'Saving…' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              post.text && <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{renderMentions(post.text)}</p>
                            )}
                            {post.media_url && (
                              post.media_type === 'image'
                                ? <img src={post.media_url} alt={post.media_name ?? ''} className="rounded-2xl w-full object-cover border border-slate-100 hover:opacity-95 transition-opacity mt-2" style={{ maxHeight: 360, cursor: 'zoom-in' }}
                                    onClick={() => { setLightboxSrc(post.media_url!); setLightboxName(post.media_name ?? 'image') }} />
                                : <div className="mt-2 flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => downloadChannelMedia(post.media_url!, post.media_name ?? 'document.pdf')}>
                                    <span className="text-xl">📄</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-slate-700 truncate">{post.media_name}</p>
                                      <p className="text-xs text-blue-500">PDF · Click to download</p>
                                    </div>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 flex-shrink-0">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                    </svg>
                                  </div>
                            )}
                            {/* Like + Comment bar */}
                            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-50">
                              <button onClick={() => toggleLike(post.id)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all ${liked ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                                👍 {post.likes?.length ?? 0}
                              </button>
                              <button onClick={() => setExp(e => ({ ...e, [post.id]: !e[post.id] }))}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all ${showComments ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:bg-slate-50'}`}>
                                💬 {post.comments?.length ?? 0}
                              </button>
                            </div>
                            {/* Comments section */}
                            {showComments && (
                              <div className="mt-2 space-y-2">
                                {(post.comments ?? []).map((c, ci) => {
                                  const cAv = (c.profiles?.name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                                  const goToCommentAuthor = () => c.user_id && c.user_id !== user?.id && router.push(`/profile/${c.user_id}`)
                                  return (
                                    <div key={ci} className="flex items-start gap-2">
                                      <button onClick={goToCommentAuthor}
                                        style={{ background: 'none', border: 'none', padding: 0, cursor: c.user_id && c.user_id !== user?.id ? 'pointer' : 'default', flexShrink: 0 }}>
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden"
                                          style={{ background: '#1a3055' }}>
                                          <AvatarImg src={c.profiles?.avatar_url} alt={c.profiles?.name ?? ''} fallback={cAv} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                      </button>
                                      <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
                                        <span onClick={goToCommentAuthor}
                                          className={`text-xs font-semibold text-slate-700 ${c.user_id && c.user_id !== user?.id ? 'cursor-pointer hover:underline' : ''}`}>
                                          {c.profiles?.name ?? 'Member'}{' '}
                                        </span>
                                        <span className="text-xs text-slate-600 whitespace-pre-wrap">{renderMentions(c.text)}</span>
                                      </div>
                                    </div>
                                  )
                                })}
                                <div className="flex gap-2 mt-1 items-end">
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                    style={{ background: '#1a3055' }}>{initials}</div>
                                  <div className="flex-1">
                                    <MentionInput
                                      value={cText[post.id] ?? ''}
                                      onChange={v => setCText(t => ({ ...t, [post.id]: v }))}
                                      onSubmit={() => addComment(post.id, cText[post.id] ?? '').then(() => setCText(t => ({ ...t, [post.id]: '' })))}
                                      placeholder="Add a comment… @ to mention"
                                      rows={1}
                                    />
                                  </div>
                                  <button
                                    onClick={() => addComment(post.id, cText[post.id] ?? '').then(() => setCText(t => ({ ...t, [post.id]: '' })))}
                                    className="px-3 py-1.5 rounded-xl text-white text-xs font-bold flex-shrink-0 mb-0.5"
                                    style={{ background: '#1a3055' }}>↑</button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </div>

                {/* Composer — sticky at bottom */}
                {isJoined ? (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm channel-composer" style={{ flexShrink: 0, padding: '10px 12px' }}>
                    <input type="file" ref={fileRef} className="hidden" accept="image/*,application/pdf" onChange={handleFile} />
                    {/* Media preview */}
                    {msgMedia && (
                      <div className="mb-2 relative">
                        {msgMedia.type === 'image'
                          ? <img src={msgMedia.dataUrl} alt={msgMedia.name} className="rounded-xl object-cover border border-slate-100" style={{ maxHeight: 120, maxWidth: '100%' }} />
                          : <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-2 border border-slate-200">
                              <span>📄</span>
                              <p className="text-xs font-semibold truncate">{msgMedia.name}</p>
                            </div>}
                        <button onClick={() => setMsgMedia(null)}
                          className="absolute top-1 right-1 bg-white rounded-full w-5 h-5 text-slate-500 text-xs flex items-center justify-center shadow border border-slate-200">✕</button>
                      </div>
                    )}
                    {sendError && <p className="mb-2 text-xs text-red-600 bg-red-50 rounded-xl px-3 py-1.5">⚠️ {sendError}</p>}
                    {/* Input row with avatar + text + action buttons */}
                    <div className="flex items-center gap-2">
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
                        style={{ background: '#1a3055' }}>
                        <AvatarImg src={profile?.avatar_url} alt={initials} fallback={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      {/* Text input */}
                      <div className="flex-1 min-w-0">
                        <MentionInput value={msgText} onChange={setMsgText} onSubmit={handleSend}
                          placeholder={`Message #${channel.name}…`} enableAll />
                      </div>
                      {/* Action buttons — right of text */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => { if(fileRef.current){ fileRef.current.accept='image/*'; fileRef.current.click() } }}
                          title="Photo"
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                          <IconImage />
                        </button>
                        <button
                          onClick={() => { if(fileRef.current){ fileRef.current.accept='application/pdf'; fileRef.current.click() } }}
                          title="File"
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                          <IconFile />
                        </button>
                        {(msgText.trim() || msgMedia) && (
                          <button onClick={handleSend} disabled={sending}
                            className="w-8 h-8 rounded-xl text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center"
                            style={{ background: '#1a3055' }}>
                            {sending ? '…' : '↑'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-center" style={{ flexShrink: 0 }}>
                    <p className="text-sm text-slate-500">Join this channel to participate</p>
                    <button onClick={() => joinChannel(id)}
                      className="mt-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
                      style={{ background: '#1a3055' }}>+ Join Channel</button>
                  </div>
                )}
              </div>
            )}

            {/* Documents Tab */}
            {tab === 'documents' && (() => {
              const mediaPosts = allMediaPosts
              const totalDocs  = mediaPosts.length + channelUploads.length
              return (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <div className="mb-4">
                    <span className="text-xs text-slate-400">{totalDocs} file{totalDocs !== 1 ? 's' : ''} shared in this channel</span>
                  </div>
                  {totalDocs === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-3xl mb-2">📂</p>
                      <p className="font-semibold text-slate-600">No files yet</p>
                      {isJoined && <p className="text-xs text-slate-400 mt-1">Share photos or documents in the discussion</p>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {mediaPosts.filter(p => p.media_type === 'image').length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">🖼️ Photos</p>
                          <div className="grid grid-cols-3 gap-2 mb-4">
                            {mediaPosts.filter(p => p.media_type === 'image').map(p => (
                              <img key={p.id} src={p.media_url!} alt={p.media_name ?? ''} className="w-full h-24 object-cover rounded-xl border border-slate-100 hover:opacity-90 transition-opacity" style={{ cursor: 'zoom-in' }} onClick={() => setLightboxSrc(p.media_url!)} />
                            ))}
                          </div>
                        </div>
                      )}
                      {(mediaPosts.filter(p => p.media_type === 'pdf').length > 0 || channelUploads.length > 0) && (
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">📄 Documents</p>
                          <div className="space-y-2">
                            {mediaPosts.filter(p => p.media_type === 'pdf').map(p => (
                              <div key={p.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 flex items-center gap-3">
                                <span className="text-2xl flex-shrink-0">📕</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-700 truncate">{p.media_name ?? 'Document'}</p>
                                  <p className="text-xs text-slate-400">{p.profiles?.name ?? 'Member'} · {new Date(p.created_at).toLocaleDateString('en-GB')}</p>
                                </div>
                                <a href={p.media_url!} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-600 hover:underline flex-shrink-0">View →</a>
                              </div>
                            ))}
                            {channelUploads.map(doc => (
                              <div key={doc.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 flex items-center gap-3">
                                <span className="text-2xl flex-shrink-0">
                                  {doc.name.endsWith('.pdf') ? '📕' : doc.name.match(/\.docx?$/) ? '📘' : '📄'}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-700 truncate">{doc.name}</p>
                                  <p className="text-xs text-slate-400">{new Date(doc.created_at).toLocaleDateString('en-GB')}</p>
                                </div>
                                {doc.file_url && (
                                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-600 hover:underline flex-shrink-0">View →</a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Members Tab */}
            {tab === 'members' && (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {members.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-3xl mb-2">👥</p>
                    <p className="font-semibold text-slate-600">No members yet</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
                    {members.map(m => {
                      const p = m.profiles
                      const displayName = p ? (`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.name || 'Member') : 'Member'
                      const initials2 = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?'
                      const isTop = m.user_id === topContributorId && (postCountByUser[m.user_id] ?? 0) > 0
                      return (
                        <button key={m.user_id} onClick={() => router.push(`/profile/${m.user_id}`)}
                          className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden" style={{ background: '#1a3055' }}>
                            <AvatarImg src={p?.avatar_url} alt={displayName} fallback={initials2} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
                              {isTop && (
                                <span style={{
                                  fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                                  background: '#fef9c3', color: '#b45309', flexShrink: 0,
                                  border: '1px solid #fde68a',
                                }}>⭐ Top contributor</span>
                              )}
                            </div>
                            {p?.institution && <p className="text-xs text-slate-400 truncate">{p.institution}</p>}
                          </div>
                          <span className="text-slate-300 text-sm flex-shrink-0">→</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {isJoined && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => { setShowInvite(true); setInviteQuery(''); setInviteResults([]); setInviteSelected([]) }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                      style={{ background: '#1a3055' }}>
                      + Invite a member
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right panel — desktop only, independent scroll ── */}
          <div className="hidden lg:flex" style={{ width: 260, flexShrink: 0, overflowY: 'auto', flexDirection: 'column' }}>
            <InfoPanel />
          </div>

        </div>{/* end body row */}
      </div>{/* end outer container */}
      <style>{`
        @media (max-width: 768px) {
          .channel-composer {
            padding-bottom: calc(10px + env(safe-area-inset-bottom)) !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </AppShell>
    {lightboxSrc && (
      <ImageLightbox
        src={lightboxSrc}
        filename={lightboxName}
        onClose={() => { setLightboxSrc(null); setLightboxName('') }}
      />
    )}

    {/* Modal confirmation suppression de message */}
    {deletePostConfirm && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🗑️</p>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1a3055', margin: '0 0 8px' }}>Delete this message?</h2>
          <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>This action is permanent and cannot be undone.</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setDeletePostConfirm(null)}
              style={{ flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, border: '1px solid #e2e8f0', color: '#64748b', background: 'white', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={async () => { const id = deletePostConfirm; setDeletePostConfirm(null); await deletePost(id) }}
              style={{ flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 700, border: 'none', color: 'white', background: '#ef4444', cursor: 'pointer' }}>
              Delete
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Invite modal — rendered at root level so it works on mobile too ── */}
    {showInvite && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 20, maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          {inviteDone ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>✅</p>
              <p style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>Invitations sent!</p>
              <button onClick={() => { setShowInvite(false); setInviteDone(false) }}
                style={{ marginTop: 16, fontSize: 13, color: '#1a3055', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>Invite to #{channel?.name}</h2>
              <input
                value={inviteQuery}
                onChange={e => handleInviteQueryChange(e.target.value)}
                placeholder="Search a member…"
                autoComplete="off"
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 12, padding: '8px 12px', fontSize: 14, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }}
              />
              {inviteResults.length > 0 && (
                <div style={{ border: '1px solid #f1f5f9', borderRadius: 12, overflow: 'hidden', marginBottom: 12, maxHeight: 200, overflowY: 'auto' }}>
                  {inviteResults.map(u => {
                    const sel = !!inviteSelected.find(x => x.id === u.id)
                    return (
                      <div key={u.id} onClick={() => toggleSelect(u)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f8fafc', background: sel ? '#eff6ff' : 'white' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0, background: '#1a3055' }}>
                          {inviteGetInitials(u)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inviteGetName(u)}</p>
                          {u.institution && <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.institution}</p>}
                        </div>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${sel ? '#3b82f6' : '#cbd5e1'}`, background: sel ? '#3b82f6' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {sel && <span style={{ color: 'white', fontSize: 9, fontWeight: 700 }}>✓</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {inviteSelected.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {inviteSelected.map(u => (
                    <span key={u.id} onClick={() => toggleSelect(u)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#eff6ff', color: '#1d4ed8', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {inviteGetName(u)} ✕
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowInvite(false)}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, border: '1px solid #e2e8f0', color: '#64748b', background: 'white', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={sendChannelInvites} disabled={inviting || inviteSelected.length === 0}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, color: 'white', background: '#1a3055', cursor: 'pointer', opacity: (inviting || inviteSelected.length === 0) ? 0.5 : 1 }}>
                  {inviting ? 'Sending…' : `Invite (${inviteSelected.length})`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}

    {/* Leave confirmation modal */}
    {showLeaveConfirm && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>👋</div>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1a3055', margin: '0 0 8px' }}>Leave #{channel?.name}?</h2>
          <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>
            You will no longer receive messages from this channel. You can rejoin at any time.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setShowLeaveConfirm(false)}
              style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              onClick={() => { leaveChannel(id); setShowLeaveConfirm(false); router.push('/channels') }}
              style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', background: '#ef4444', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Leave
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Edit channel modal (admin) */}
    {showEditChannel && channel && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 24, maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1a3055', margin: '0 0 16px' }}>Edit channel</h2>

          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', margin: '0 0 6px' }}>Emoji</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {['💬','📢','🎙️','🎤','😂','🎉','🥳','🌍','🌐','🎓','📚','🤝','💡','🚀','🔥','✨','🇪🇺','🇫🇷','✈️','🏛️'].map(e => (
              <button key={e} onClick={() => setEditEmoji(e)}
                style={{ width: 34, height: 34, borderRadius: 10, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  border: editEmoji === e ? '2px solid #1a3055' : '1px solid #e2e8f0', background: editEmoji === e ? '#eef6ff' : 'white' }}>{e}</button>
            ))}
          </div>

          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', margin: '0 0 6px' }}>Name</label>
          <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Channel name"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14, color: '#1a3055', outline: 'none', marginBottom: 16 }} />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', margin: '0 0 6px' }}>Description</label>
          <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} placeholder="What's this channel about?"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14, color: '#1a3055', outline: 'none', resize: 'vertical', fontFamily: 'inherit', marginBottom: 20 }} />

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowEditChannel(false)} disabled={savingChannel}
              style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={saveChannelEdit} disabled={savingChannel || !editName.trim()}
              style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', background: '#1a3055', color: 'white', fontSize: 13, fontWeight: 700, cursor: savingChannel || !editName.trim() ? 'default' : 'pointer', opacity: savingChannel || !editName.trim() ? 0.6 : 1 }}>
              {savingChannel ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

async function downloadChannelMedia(url: string, filename: string) {
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
