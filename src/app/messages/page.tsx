'use client'
import { useAuth } from '@/lib/hooks/useAuth'
import AppShell from '@/components/layout/AppShell'
import { useConversations, displayName, initials } from '@/lib/hooks/useDirectMessages'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateConversation } from '@/lib/hooks/useDirectMessages'
import AvatarImg from '@/components/ui/AvatarImg'

type SearchUser = { id: string; name: string | null; first_name: string | null; last_name: string | null; institution: string | null; avatar_url: string | null }

function userName(u: SearchUser) {
  if (u.first_name || u.last_name) return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
  return u.name ?? 'Member'
}

export default function MessagesPage() {
  const router   = useRouter()
  const supabase = createClient()
  const { user } = useAuth()
  const { conversations, loading } = useConversations(user?.id, 'page')

  const [searchQ, setSearchQ]       = useState('')
  const [searchRes, setSearchRes]   = useState<SearchUser[]>([])
  const [searching, setSearching]   = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  const handleSearch = async (q: string) => {
    setSearchQ(q)
    if (!q.trim()) { setSearchRes([]); return }
    setSearching(true)
    const safeQ = q.replace(/[%_(),'\\]/g, c => `\\${c}`)
    const { data } = await supabase.from('profiles')
      .select('id, name, first_name, last_name, institution, avatar_url')
      .or(`name.ilike.%${safeQ}%,first_name.ilike.%${safeQ}%,last_name.ilike.%${safeQ}%`)
      .neq('id', user?.id ?? '')
      .limit(6)
    setSearchRes((data ?? []) as SearchUser[])
    setSearching(false)
  }

  const startConversation = async (otherId: string) => {
    const convId = await getOrCreateConversation(supabase, otherId)
    if (convId) router.push(`/messages/${convId}`)
  }

  function timeAgo(iso: string) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000
    if (diff < 60)    return 'now'
    if (diff < 3600)  return `${Math.floor(diff / 60)}m`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    const d = Math.floor(diff / 86400)
    return d === 1 ? 'yesterday' : `${d}d`
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a3055', margin: 0 }}>Messages</h1>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>Private messages</p>
          </div>
          <button
            onClick={() => { setShowSearch(s => !s); setSearchQ(''); setSearchRes([]) }}
            style={{
              background: '#1a3055', color: 'white', border: 'none',
              borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>
            ✏️ New message
          </button>
        </div>

        {/* New conversation search */}
        {showSearch && (
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 16, marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>Search a member</p>
            <input
              value={searchQ}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Name, first name…"
              autoFocus
              style={{
                width: '100%', border: '1px solid #e2e8f0', borderRadius: 10,
                padding: '8px 12px', fontSize: 13, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searching && <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>Searching…</p>}
            {searchRes.map(u => {
              const inits = userName(u).split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'
              return (
                <div key={u.id}
                  onClick={() => startConversation(u.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 8px', cursor: 'pointer', borderRadius: 10,
                    marginTop: 4, transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                    background: '#1a3055', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', overflow: 'hidden',
                  }}>
                    <AvatarImg src={u.avatar_url} alt={userName(u)} fallback={<span style={{ fontSize: 12, fontWeight: 800, color: 'white' }}>{inits}</span>} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1a3055' }}>{userName(u)}</p>
                    {u.institution && <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>{u.institution}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Conversations list */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        )}

        {!loading && conversations.length === 0 && !showSearch && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>💬</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1a3055', marginBottom: 6 }}>No messages yet</p>
            <p style={{ fontSize: 13, color: '#94a3b8' }}>Start a conversation with a community member.</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {conversations.map(conv => {
            const p = conv.other_profile
            const dn = displayName(p)
            const ini = initials(p)
            return (
              <button key={conv.id}
                onClick={() => router.push(`/messages/${conv.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: 'white', border: '1px solid #f1f5f9',
                  borderRadius: 14, padding: '14px 16px',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  transition: 'all 0.1s', position: 'relative',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'white'; (e.currentTarget as HTMLElement).style.borderColor = '#f1f5f9' }}
              >
                {/* Avatar */}
                <div style={{
                  width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                  background: '#1a3055', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', overflow: 'hidden', position: 'relative',
                }}>
                  <AvatarImg src={p?.avatar_url} alt={dn} fallback={<span style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>{ini}</span>} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {conv.unread_count > 0 && (
                    <div style={{
                      position: 'absolute', top: -3, right: -3,
                      width: 12, height: 12, borderRadius: '50%',
                      background: '#ef4444', border: '2px solid white',
                    }}/>
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <p style={{
                      margin: 0, fontSize: 14, fontWeight: conv.unread_count > 0 ? 800 : 600,
                      color: '#1a3055', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{dn}</p>
                    <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0, marginLeft: 8 }}>
                      {timeAgo(conv.last_message_at)}
                    </span>
                  </div>
                  <p style={{
                    margin: 0, fontSize: 12,
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
                    borderRadius: 99, minWidth: 20, height: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, padding: '0 5px', flexShrink: 0,
                  }}>
                    {conv.unread_count}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}
