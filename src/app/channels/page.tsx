'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useChannels } from '@/lib/hooks/useChannels'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSidebarData } from '@/lib/hooks/useSidebarData'
import type { Channel } from '@/lib/supabase/supabase/types'

// SVG icons for channel stats
const IcoPerson = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)
const IcoMsg = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)
const IcoFile = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
)
const IcoEye = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)
const IcoEyeOff = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>
  </svg>
)

type InviteUser = { id: string; name: string | null; first_name: string | null; last_name: string | null; institution: string | null }
function inviteDisplayName(u: InviteUser) {
  if (u.first_name || u.last_name) return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
  return u.name ?? 'Member'
}
function inviteInitials(u: InviteUser) {
  return inviteDisplayName(u).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

const EMOJI_OPTIONS = [
  // Communication & channels
  '💬','📢','📣','🗣️','🎙️','🎤','📨','📬','📩','✉️','📮','📯',
  // Ambiance & fun
  '😂','🤣','🎉','🥳','🔥','👏','✨','😄',
  // International & globe
  '🌍','🌎','🌏','🌐','🗺️','🧭','🌉','🌁','🗼','🏔️',
  // Voyages & mobilité
  '✈️','🛫','🛬','🚂','🚢','🛳️','🚁','🛸','🧳','🗺️','🎫','🏨','⛺','🏕️',
  // Éducation & académique
  '🎓','📚','📖','📝','📋','🔬','🔭','🏛️','🎒','✏️','📐','📏','🖊️','🖋️','📓','📔','📒','📃','🧪','🧫','🧬','⚗️','🔭','💻','🖥️','📡',
  // Pro & business
  '🤝','💼','📊','📈','📉','🎯','💡','🚀','⚡','🛠️','⚙️','🔧','🔑','🏆','🎖️','🥇','🏅','🎗️',
  // Collaboration & communauté
  '👥','👤','🫂','🤲','🌱','🌿','🍀','♻️','🔗','🔍','📁','🗂️','📂','🗃️','🗄️',
  // Drapeaux — Europe
  '🇪🇺','🇫🇷','🇩🇪','🇬🇧','🇮🇹','🇪🇸','🇵🇹','🇳🇱','🇧🇪','🇨🇭','🇦🇹','🇸🇪','🇳🇴','🇩🇰','🇫🇮','🇵🇱','🇨🇿','🇸🇰','🇭🇺','🇷🇴','🇧🇬','🇭🇷','🇸🇮','🇸🇷','🇷🇸','🇬🇷','🇨🇾','🇲🇹','🇱🇺','🇮🇪','🇮🇸','🇱🇮','🇲🇨','🇸🇲','🇻🇦','🇦🇩','🇲🇰','🇦🇱','🇧🇦','🇲🇪','🇽🇰','🇺🇦','🇲🇩','🇧🇾','🇷🇺','🇱🇹','🇱🇻','🇪🇪',
  // Drapeaux — Amériques
  '🇺🇸','🇨🇦','🇲🇽','🇧🇷','🇦🇷','🇨🇱','🇨🇴','🇵🇪','🇻🇪','🇪🇨','🇧🇴','🇵🇾','🇺🇾','🇬🇾','🇸🇷','🇬🇫','🇨🇺','🇯🇲','🇭🇹','🇩🇴','🇵🇷','🇬🇹','🇧🇿','🇸🇻','🇭🇳','🇳🇮','🇨🇷','🇵🇦','🇹🇹','🇧🇧','🇦🇬','🇱🇨','🇻🇨',
  // Drapeaux — Asie
  '🇨🇳','🇯🇵','🇰🇷','🇮🇳','🇮🇩','🇹🇭','🇻🇳','🇵🇭','🇲🇾','🇸🇬','🇧🇩','🇵🇰','🇳🇵','🇱🇰','🇲🇲','🇰🇭','🇱🇦','🇧🇳','🇹🇱','🇲🇻','🇧🇹','🇲🇳','🇰🇬','🇹🇯','🇺🇿','🇹🇲','🇰🇿','🇦🇲','🇬🇪','🇦🇿','🇮🇷','🇮🇶','🇸🇾','🇱🇧','🇮🇱','🇯🇴','🇸🇦','🇦🇪','🇶🇦','🇰🇼','🇧🇭','🇴🇲','🇾🇪','🇦🇫',
  // Drapeaux — Afrique
  '🇳🇬','🇪🇹','🇪🇬','🇩🇿','🇲🇦','🇿🇦','🇰🇪','🇹🇿','🇬🇭','🇨🇲','🇨🇮','🇸🇳','🇲🇱','🇧🇫','🇳🇪','🇹🇩','🇸🇩','🇸🇸','🇺🇬','🇷🇼','🇧🇮','🇲🇿','🇿🇲','🇿🇼','🇧🇼','🇳🇦','🇦🇴','🇨🇩','🇨🇬','🇬🇦','🇬🇳','🇸🇱','🇱🇷','🇹🇬','🇧🇯','🇬🇲','🇬🇼','🇬🇶','🇸🇹','🇨🇻','🇩🇯','🇸🇴','🇪🇷','🇱🇾','🇹🇳','🇲🇷','🇲🇬','🇲🇺','🇸🇨','🇲🇼','🇱🇸','🇸🇿',
  // Drapeaux — Océanie & autres
  '🇦🇺','🇳🇿','🇵🇬','🇫🇯','🇸🇧','🇻🇺','🇼🇸','🇹🇴','🇰🇮','🇫🇲','🇲🇭','🇵🇼','🇳🇷','🇹🇻','🇨🇰','🇵🇫','🇺🇳',
]

export default function ChannelsPage() {
  const router   = useRouter()
  const supabase = createClient()
  const { user, profile } = useAuth()
  const appRole = profile?.app_role ?? ''
  const canManage = ['admin', 'moderator'].includes(appRole)
  const fromName = profile
    ? (`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || profile.name || '')
    : ''

  const { channels, myChannelIds, joinChannel, leaveChannel, loading, createChannel, updateChannel } = useChannels(user?.id)
  const { unreadCounts } = useSidebarData(user?.id)

  type ChStats = { members: number; posts: number; files: number }
  const [chStats, setChStats] = useState<Record<string, ChStats>>({})

  useEffect(() => {
    if (!channels.length) return
    const ids = channels.map(c => c.id)
    Promise.all([
      supabase.from('channel_members').select('channel_id').in('channel_id', ids),
      supabase.from('channel_posts').select('channel_id').in('channel_id', ids),
      supabase.from('uploads').select('channel_id').in('channel_id', ids),
      // Also count files/PDFs attached directly to posts
      supabase.from('channel_posts').select('channel_id').in('channel_id', ids).not('media_url', 'is', null),
    ]).then(([{ data: mems }, { data: posts }, { data: uploads }, { data: postFiles }]) => {
      const stats: Record<string, ChStats> = {}
      ids.forEach(id => { stats[id] = { members: 0, posts: 0, files: 0 } })
      mems?.forEach((r: any) => { if (stats[r.channel_id]) stats[r.channel_id].members++ })
      posts?.forEach((r: any) => { if (stats[r.channel_id]) stats[r.channel_id].posts++ })
      uploads?.forEach((r: any) => { if (stats[r.channel_id]) stats[r.channel_id].files++ })
      postFiles?.forEach((r: any) => { if (stats[r.channel_id]) stats[r.channel_id].files++ })
      setChStats(stats)
    })
  }, [channels.length])

  // ── Create modal ──
  const [showCreate, setShowCreate] = useState(false)
  const [newEmoji, setNewEmoji]     = useState('💬')
  const [newName, setNewName]       = useState('')
  const [newDesc, setNewDesc]       = useState('')
  const [creating, setCreating]     = useState(false)
  const [createErr, setCreateErr]   = useState<string | null>(null)

  // ── Invite modal (shown after channel creation) ──
  const [inviteChannelId,   setInviteChannelId]   = useState<string | null>(null)
  const [inviteChannelName, setInviteChannelName] = useState('')
  const [inviteQuery,   setInviteQuery]   = useState('')
  const [inviteResults, setInviteResults] = useState<InviteUser[]>([])
  const [inviteSelected, setInviteSelected] = useState<InviteUser[]>([])
  const [inviting,      setInviting]      = useState(false)
  const [inviteSent,    setInviteSent]    = useState(false)
  const inviteDebounce  = useRef<NodeJS.Timeout | null>(null)

  const searchInviteUsers = useCallback(async (q: string) => {
    const safeQ = q.replace(/[%_(),'\\]/g, c => `\\${c}`)
    const { data } = await supabase
      .from('profiles')
      .select('id, name, first_name, last_name, institution')
      .or(`name.ilike.%${safeQ}%,first_name.ilike.%${safeQ}%,last_name.ilike.%${safeQ}%`)
      .neq('id', user?.id ?? '')
      .limit(5)
    setInviteResults((data ?? []) as InviteUser[])
  }, [user?.id])

  const handleInviteQueryChange = (q: string) => {
    setInviteQuery(q)
    if (inviteDebounce.current) clearTimeout(inviteDebounce.current)
    inviteDebounce.current = setTimeout(() => searchInviteUsers(q), 200)
  }

  const toggleInviteUser = (u: InviteUser) => {
    setInviteSelected(prev =>
      prev.find(x => x.id === u.id) ? prev.filter(x => x.id !== u.id) : [...prev, u]
    )
  }

  const sendInvites = async () => {
    if (!inviteChannelId || !inviteSelected.length) return
    setInviting(true)
    const rows = inviteSelected.map(u => ({
      user_id:      u.id,
      from_name:    fromName,
      type:         'invite',
      source:       'invite',
      channel_id:   inviteChannelId,
      channel_name: inviteChannelName,
      post_id:      null,
    }))
    await supabase.from('notifications').insert(rows)
    setInviting(false)
    setInviteSent(true)
    setTimeout(() => {
      setInviteChannelId(null); setInviteSelected([]); setInviteQuery(''); setInviteResults([]); setInviteSent(false)
    }, 1800)
  }

  // ── Channel request (members only) ──
  const [showRequest,  setShowRequest]  = useState(false)
  const [reqEmoji,     setReqEmoji]     = useState('💬')
  const [reqName,      setReqName]      = useState('')
  const [reqDesc,      setReqDesc]      = useState('')
  const [requesting,   setRequesting]   = useState(false)
  const [requestSent,  setRequestSent]  = useState(false)
  const [requestErr,   setRequestErr]   = useState<string | null>(null)
  // Emoji picker pagination — 40 per page (5 rows × 8 cols)
  const EMOJI_PER_PAGE = 40
  const [createEmojiPage, setCreateEmojiPage] = useState(0)
  const [reqEmojiPage,    setReqEmojiPage]    = useState(0)

  const handleRequest = async () => {
    if (!reqName.trim() || !user) return
    setRequesting(true); setRequestErr(null)
    const { error } = await supabase.from('channel_requests').insert({
      user_id: user.id, emoji: reqEmoji, name: reqName.trim(), description: reqDesc.trim() || null,
    })
    setRequesting(false)
    if (error) { setRequestErr(error.message); return }
    setRequestSent(true)
    setTimeout(() => { setShowRequest(false); setReqName(''); setReqDesc(''); setReqEmoji('💬'); setRequestSent(false) }, 2000)
  }

  const myChannels      = channels.filter(c => myChannelIds.includes(c.id))
  const exploreChannels = channels.filter(c => !myChannelIds.includes(c.id))

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true); setCreateErr(null)
    const channelId = newName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40)
    const err = await createChannel(newEmoji, newName.trim(), newDesc.trim())
    setCreating(false)
    if (err) { setCreateErr(err); return }
    const savedName = newName.trim()
    setShowCreate(false); setNewName(''); setNewDesc(''); setNewEmoji('💬')
    // Ouvre le modal d'invitation
    setInviteChannelId(channelId)
    setInviteChannelName(savedName)
  }

  const renderCard = (ch: Channel, joined: boolean) => {
    const unread = joined ? (unreadCounts[ch.id] ?? 0) : 0
    const inactive = ch.is_active === false
    return (
      <div key={ch.id}
        className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow cursor-pointer relative"
        style={inactive ? { opacity: 0.6 } : undefined}
        onClick={() => router.push(`/channels/${ch.id}`)}>
        {canManage && (
          <button
            onClick={e => { e.stopPropagation(); updateChannel(ch.id, { is_active: inactive }) }}
            title={inactive ? 'Reactivate — make visible to members' : 'Deactivate — hide from members'}
            className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            style={{ zIndex: 2 }}>
            {inactive ? <IcoEyeOff /> : <IcoEye />}
          </button>
        )}
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: '#eef6ff' }}>
              {ch.emoji ?? '💬'}
            </div>
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-white font-bold px-1"
                style={{ background: '#ef4444', fontSize: 10, lineHeight: '18px' }}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={`font-bold text-sm ${unread > 0 ? 'text-slate-900' : 'text-slate-800'}`}>#{ch.name}</p>
              {joined && <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2 py-0.5 font-semibold">Joined</span>}
              {inactive && <span className="text-xs bg-slate-100 text-slate-500 border border-slate-200 rounded-full px-2 py-0.5 font-semibold">Hidden</span>}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{ch.description}</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-1">
          {/* Stats chips — always show all 3 counts */}
          <div className="flex items-center gap-3">
            {(() => {
              const s = chStats[ch.id]
              if (!s) return <span className="text-slate-300" style={{ fontSize: 11 }}>…</span>
              return (
                <>
                  <span className="flex items-center gap-1 text-slate-400" style={{ fontSize: 11 }}>
                    <IcoPerson />{s.members}
                  </span>
                  <span className="flex items-center gap-1 text-slate-400" style={{ fontSize: 11 }}>
                    <IcoMsg />{s.posts}
                  </span>
                  <span className="flex items-center gap-1 text-slate-400" style={{ fontSize: 11 }}>
                    <IcoFile />{s.files}
                  </span>
                </>
              )
            })()}
          </div>
          {!joined && (
            <button
              onClick={e => { e.stopPropagation(); joinChannel(ch.id) }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border text-white border-transparent hover:opacity-90"
              style={{ background: '#1a3055' }}>
              + Join
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Channels</h1>
            <p className="text-xs text-slate-400 mt-0.5">{channels.length} channel{channels.length !== 1 ? 's' : ''} available</p>
          </div>
          <div className="flex gap-2">
            {/* Admin/Moderator → Create */}
            {canManage && (
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
                style={{ background: '#1a3055' }}>
                + Create channel
              </button>
            )}
            {/* Member → Request */}
            {!canManage && (
              <button onClick={() => setShowRequest(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">
                ✉️ Request a channel
              </button>
            )}
          </div>
        </div>

        {loading && <p className="text-center text-slate-400 py-12 text-sm">Loading…</p>}

        {/* My Channels — en premier */}
        {!loading && myChannels.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <span>💬</span> My Channels
              <span className="text-xs font-normal text-slate-400 ml-1">({myChannels.length})</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {myChannels.map(ch => renderCard(ch, true))}
            </div>
          </section>
        )}

        {/* Explore — en bas */}
        {!loading && exploreChannels.length > 0 && (
          <section className="mb-4">
            <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <span>🔍</span> All Channels
              <span className="text-xs font-normal text-slate-400 ml-1">({exploreChannels.length})</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {exploreChannels.map(ch => renderCard(ch, false))}
            </div>
          </section>
        )}

        {!loading && channels.length === 0 && (
          <div className="text-center py-12">
            <p className="text-3xl mb-2">💬</p>
            <p className="font-semibold text-slate-600">No channels yet</p>
            {canManage && <p className="text-xs text-slate-400 mt-1">Create the first channel above.</p>}
          </div>
        )}
      </div>

      {/* ── Invite Modal (after channel creation) ── */}
      {inviteChannelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            {inviteSent ? (
              <div className="text-center py-4">
                <p className="text-3xl mb-2">✅</p>
                <p className="font-bold text-slate-800">Invitations sent!</p>
                <p className="text-xs text-slate-400 mt-1">Members will receive a notification.</p>
              </div>
            ) : (
              <>
                <h2 className="text-base font-bold text-slate-800 mb-1">Invite members</h2>
                <p className="text-xs text-slate-400 mb-4">Channel <strong>#{inviteChannelName}</strong> created — invite people to join.</p>

                <input
                  value={inviteQuery}
                  onChange={e => handleInviteQueryChange(e.target.value)}
                  placeholder="Search a member…"
                  type="search" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-blue-300"
                  autoFocus
                />

                {/* Results */}
                {inviteResults.length > 0 && (
                  <div className="border border-slate-100 rounded-xl overflow-hidden mb-3">
                    {inviteResults.map(u => {
                      const selected = !!inviteSelected.find(x => x.id === u.id)
                      return (
                        <div key={u.id}
                          onClick={() => toggleInviteUser(u)}
                          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                          style={{ borderBottom: '1px solid #f8fafc', background: selected ? '#eff6ff' : undefined }}>
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ background: '#1a3055' }}>
                            {inviteInitials(u)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">{inviteDisplayName(u)}</p>
                            {u.institution && <p className="text-xs text-slate-400 truncate">{u.institution}</p>}
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
                            {selected && <span className="text-white text-xs">✓</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Selected chips */}
                {inviteSelected.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {inviteSelected.map(u => (
                      <span key={u.id} onClick={() => toggleInviteUser(u)}
                        className="flex items-center gap-1 bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 text-xs font-semibold cursor-pointer hover:bg-red-50 hover:text-red-500 transition-colors">
                        {inviteDisplayName(u)} ✕
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => { setInviteChannelId(null); setInviteSelected([]); setInviteQuery(''); setInviteResults([]) }}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50">
                    Skip
                  </button>
                  <button onClick={sendInvites} disabled={inviting || inviteSelected.length === 0}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                    style={{ background: '#1a3055' }}>
                    {inviting ? 'Sending…' : `Invite (${inviteSelected.length})`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Request Channel Modal (members) ── */}
      {showRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            {requestSent ? (
              <div className="text-center py-6">
                <p className="text-4xl mb-3">✅</p>
                <p className="font-bold text-slate-800 text-base">Request sent!</p>
                <p className="text-xs text-slate-400 mt-1">An admin will review your request.</p>
              </div>
            ) : (
              <>
                <h2 className="text-base font-bold text-slate-800 mb-1">Propose a channel</h2>
                <p className="text-xs text-slate-400 mb-4">Your request will be reviewed by an administrator.</p>

                <label className="block text-xs font-semibold text-slate-600 mb-1">Emoji</label>
                <div className="mb-4 bg-slate-50 rounded-xl p-2">
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJI_OPTIONS.slice(reqEmojiPage * EMOJI_PER_PAGE, (reqEmojiPage + 1) * EMOJI_PER_PAGE).map(e => (
                      <button key={e} onClick={() => setReqEmoji(e)}
                        className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${reqEmoji === e ? 'bg-blue-100 ring-2 ring-blue-400' : 'hover:bg-slate-200'}`}>
                        {e}
                      </button>
                    ))}
                  </div>
                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                    <button onClick={() => setReqEmojiPage(p => Math.max(0, p - 1))} disabled={reqEmojiPage === 0}
                      className="text-xs px-2 py-1 rounded-lg disabled:opacity-30 hover:bg-slate-200 transition-colors text-slate-600">← Prev</button>
                    <span className="text-xs text-slate-400">{reqEmojiPage + 1} / {Math.ceil(EMOJI_OPTIONS.length / EMOJI_PER_PAGE)}</span>
                    <button onClick={() => setReqEmojiPage(p => Math.min(Math.ceil(EMOJI_OPTIONS.length / EMOJI_PER_PAGE) - 1, p + 1))} disabled={(reqEmojiPage + 1) * EMOJI_PER_PAGE >= EMOJI_OPTIONS.length}
                      className="text-xs px-2 py-1 rounded-lg disabled:opacity-30 hover:bg-slate-200 transition-colors text-slate-600">Next →</button>
                  </div>
                </div>

                <label className="block text-xs font-semibold text-slate-600 mb-1">Channel name *</label>
                <input value={reqName} onChange={e => setReqName(e.target.value)}
                  placeholder="e.g. Partnerships LATAM"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-3 outline-none focus:ring-2 focus:ring-blue-300" />

                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <textarea value={reqDesc} onChange={e => setReqDesc(e.target.value)}
                  placeholder="What is this channel about?"
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-4 outline-none focus:ring-2 focus:ring-blue-300 resize-none" />

                {requestErr && <p className="text-xs text-red-500 mb-3">⚠️ {requestErr}</p>}

                <div className="flex gap-2">
                  <button onClick={() => { setShowRequest(false); setRequestErr(null) }}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50">
                    Cancel
                  </button>
                  <button onClick={handleRequest} disabled={requesting || !reqName.trim()}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                    style={{ background: '#1a3055' }}>
                    {requesting ? 'Sending…' : '✉️ Send request'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create Channel Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-base font-bold text-slate-800 mb-4">Create a new channel</h2>

            {/* Emoji picker — paginated */}
            <label className="block text-xs font-semibold text-slate-600 mb-1">Emoji</label>
            <div className="mb-4 bg-slate-50 rounded-xl p-2">
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_OPTIONS.slice(createEmojiPage * EMOJI_PER_PAGE, (createEmojiPage + 1) * EMOJI_PER_PAGE).map(e => (
                  <button key={e} onClick={() => setNewEmoji(e)}
                    className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${newEmoji === e ? 'bg-blue-100 ring-2 ring-blue-400' : 'hover:bg-slate-200'}`}>
                    {e}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                <button onClick={() => setCreateEmojiPage(p => Math.max(0, p - 1))} disabled={createEmojiPage === 0}
                  className="text-xs px-2 py-1 rounded-lg disabled:opacity-30 hover:bg-slate-200 transition-colors text-slate-600">← Prev</button>
                <span className="text-xs text-slate-400">{createEmojiPage + 1} / {Math.ceil(EMOJI_OPTIONS.length / EMOJI_PER_PAGE)}</span>
                <button onClick={() => setCreateEmojiPage(p => Math.min(Math.ceil(EMOJI_OPTIONS.length / EMOJI_PER_PAGE) - 1, p + 1))} disabled={(createEmojiPage + 1) * EMOJI_PER_PAGE >= EMOJI_OPTIONS.length}
                  className="text-xs px-2 py-1 rounded-lg disabled:opacity-30 hover:bg-slate-200 transition-colors text-slate-600">Next →</button>
              </div>
            </div>

            <label className="block text-xs font-semibold text-slate-600 mb-1">Channel name *</label>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Partnerships LATAM"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-3 outline-none focus:ring-2 focus:ring-blue-300" />

            <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
            <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)}
              placeholder="What is this channel about?"
              rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-4 outline-none focus:ring-2 focus:ring-blue-300 resize-none" />

            {createErr && <p className="text-xs text-red-500 mb-3">⚠️ {createErr}</p>}

            <div className="flex gap-2">
              <button onClick={() => { setShowCreate(false); setCreateErr(null) }}
                className="flex-1 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={creating || !newName.trim()}
                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                style={{ background: '#1a3055' }}>
                {creating ? 'Creating…' : `${newEmoji} Create`}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
