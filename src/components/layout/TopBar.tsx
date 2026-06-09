'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import NotificationBell from '@/components/ui/NotificationBell'
import type { Profile } from '@/lib/supabase/supabase/types'
import type { useNotifications } from '@/lib/hooks/useNotifications'

const PAGE_TITLES: Record<string, string> = {
  '/feed': 'Feed', '/network': 'Network', '/channels': 'Channels',
  '/profile': 'My Profile', '/admin': 'Settings',
}

type UserResult = {
  id: string
  name: string | null
  first_name: string | null
  last_name: string | null
  institution: string | null
  avatar_url: string | null
}

function getDisplayName(u: UserResult) {
  if (u.first_name || u.last_name) return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
  return u.name ?? 'Member'
}
function getInitials(u: UserResult) {
  const n = getDisplayName(u)
  return n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export default function TopBar({
  globalSearch, onGlobalSearch, profile, notif, channels,
}: {
  globalSearch: string
  onGlobalSearch: (q: string) => void
  profile: Profile | null
  notif?: ReturnType<typeof useNotifications>
  channels?: { id: string; name: string; emoji: string | null }[]
}) {
  const pathname  = usePathname()
  const router    = useRouter()
  const supabase  = createClient()
  const title     = Object.entries(PAGE_TITLES).find(([k]) => pathname.startsWith(k))?.[1] ?? 'AroundLink'
  const firstName  = profile?.first_name ?? profile?.name?.split(' ')[0] ?? ''
  const lastName   = profile?.last_name  ?? profile?.name?.split(' ').slice(1).join(' ') ?? ''
  const displayName = `${firstName} ${lastName}`.trim() || profile?.name || 'My profile'
  const initials   = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  const isNetwork = pathname.startsWith('/network')
  const canAccessAdmin = ['admin', 'moderator'].includes(profile?.app_role ?? '')

  // ── User search dropdown ──────────────────────────────────────────────────
  const [userResults,  setUserResults]  = useState<UserResult[]>([])
  const [showResults,  setShowResults]  = useState(false)
  const [searching,    setSearching]    = useState(false)
  const [activeIdx,    setActiveIdx]    = useState(-1)
  const debounceRef    = useRef<NodeJS.Timeout | null>(null)
  const searchWrapRef  = useRef<HTMLDivElement>(null)

  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim()) { setUserResults([]); setShowResults(false); return }
    setSearching(true)
    setShowResults(true)
    const safeQ = q.replace(/[%_(),'\\]/g, c => `\\${c}`)
    const { data } = await supabase
      .from('profiles')
      .select('id, name, first_name, last_name, institution, avatar_url')
      .or(`name.ilike.%${safeQ}%,first_name.ilike.%${safeQ}%,last_name.ilike.%${safeQ}%`)
      .limit(6)
    setUserResults((data ?? []) as UserResult[])
    setSearching(false)
  }, [])

  const handleSearch = (q: string) => {
    onGlobalSearch(q)   // AppShell handles network redirect
    setActiveIdx(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchUsers(q), 200)
    if (!q.trim()) { setShowResults(false); setUserResults([]) }
  }

  const goToProfile = (id: string) => {
    setShowResults(false)
    onGlobalSearch('')
    setUserResults([])
    router.push(`/profile/${id}`)
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults || !userResults.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(prev => (prev + 1) % userResults.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(prev => (prev <= 0 ? userResults.length - 1 : prev - 1))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      goToProfile(userResults[activeIdx].id)
    } else if (e.key === 'Escape') {
      setShowResults(false)
    }
  }

  return (
    <header className="top-bar">
      {/* Title — hidden on mobile to give full width to search */}
      <h2 className="topbar-title" style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#1a3055', whiteSpace: 'nowrap', flexShrink: 0, minWidth: 100 }}>
        {title}
      </h2>

      {/* Search */}
      <div ref={searchWrapRef} style={{ flex: 1, maxWidth: 420, position: 'relative' }}>
        <input
          value={globalSearch}
          onChange={e => handleSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          onFocus={() => { if (globalSearch.trim() && userResults.length) setShowResults(true) }}
          placeholder={isNetwork ? 'Search universities, cities, domains…' : 'Search members…'}
          type="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          style={{
            width: '100%', padding: '7px 30px 7px 12px', border: '1px solid #e2e8f0',
            borderRadius: 10, fontSize: 13, background: '#f8f9fc', outline: 'none', color: '#1a3055',
          }}
        />
        {globalSearch && (
          <button onClick={() => { onGlobalSearch(''); setShowResults(false); setUserResults([]) }}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>
            ✕
          </button>
        )}

        {/* User search results dropdown */}
        {showResults && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            background: 'white', border: '1px solid #e2e8f0', borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)', zIndex: 200, overflow: 'hidden',
          }}>
            {searching && (
              <div style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8' }}>Searching…</div>
            )}
            {!searching && userResults.length === 0 && (
              <div style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8' }}>No members found for "{globalSearch}"</div>
            )}
            {!searching && userResults.map((u, i) => (
              <div
                key={u.id}
                onMouseDown={e => { e.preventDefault(); goToProfile(u.id) }}
                onMouseEnter={() => setActiveIdx(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', cursor: 'pointer',
                  background: activeIdx === i ? '#f1f5f9' : 'white',
                  borderBottom: i < userResults.length - 1 ? '1px solid #f1f5f9' : 'none',
                  transition: 'background 0.1s',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 32, height: 32, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
                  background: '#1a3055', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white',
                }}>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt={getDisplayName(u)} style={{ width: 32, height: 32, objectFit: 'cover' }} />
                    : getInitials(u)
                  }
                </div>
                {/* Info */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1a3055', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getDisplayName(u)}
                  </p>
                  {u.institution && (
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.institution}
                    </p>
                  )}
                </div>
                {/* CTA */}
                <span style={{ fontSize: 11, color: activeIdx === i ? '#1a3055' : '#cbd5e1', fontWeight: 500, flexShrink: 0 }}>
                  {activeIdx === i ? 'View profile →' : ''}
                </span>
              </div>
            ))}
            {/* Hint */}
            {userResults.length > 0 && (
              <div style={{ padding: '6px 12px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 10, color: '#cbd5e1' }}>↑↓ navigate</span>
                <span style={{ fontSize: 10, color: '#cbd5e1' }}>·</span>
                <span style={{ fontSize: 10, color: '#cbd5e1' }}>↵ open profile</span>
                <span style={{ fontSize: 10, color: '#cbd5e1' }}>·</span>
                <span style={{ fontSize: 10, color: '#cbd5e1' }}>Esc close</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
        {/* Notification bell */}
        {notif && (
          <NotificationBell
            totalUnread={notif.totalUnread}
            channelUnread={notif.channelUnread}
            channels={channels ?? []}
            mentions={notif.mentions}
            onMarkChannelRead={notif.markChannelRead}
            onMarkMentionRead={notif.markMentionRead}
            onMarkAllRead={notif.markAllRead}
          />
        )}

        {/* Settings — admin roles */}
        {canAccessAdmin && (
          <button
            onClick={() => router.push('/admin')}
            title="Settings"
            style={{
              background: pathname.startsWith('/admin') ? '#eef6ff' : 'none',
              border: pathname.startsWith('/admin') ? '1px solid #bfdbfe' : '1px solid transparent',
              borderRadius: 8, cursor: 'pointer', width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: pathname.startsWith('/admin') ? '#1a3055' : '#64748b',
              transition: 'all 0.15s',
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        )}

        {/* Leaderboard trophy */}
        {profile && (
          <button onClick={() => router.push('/leaderboard')}
            title="Leaderboard"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: pathname.startsWith('/leaderboard') ? '#fff8ed' : 'none',
              border: pathname.startsWith('/leaderboard') ? '1px solid #fed7aa' : '1px solid transparent',
              borderRadius: 8, width: 32, height: 32, cursor: 'pointer', flexShrink: 0,
              transition: 'all 0.15s',
            }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c2410c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
              <path d="M4 22h16"/>
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
            </svg>
          </button>
        )}

        {/* Profile chip */}
        <button onClick={() => router.push('/profile')} className="profile-chip">
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a3055', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: 'white', flexShrink: 0, overflow: 'hidden' }}>
            {profile?.avatar_url
              ? <img src={profile?.avatar_url} alt={displayName} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
              : initials}
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1a3055', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </span>
        </button>
      </div>
    </header>
  )
}
