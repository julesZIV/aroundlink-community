'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { getOrCreateConversation } from '@/lib/hooks/useDirectMessages'

type PublicProfile = {
  id: string; name: string | null; first_name: string | null; last_name: string | null
  institution: string | null; role: string | null; linkedin: string | null
  avatar_url: string | null; links: number; created_at: string
}

type Stats = {
  feed_posts: number; channel_messages: number; files_shared: number; likes_given: number
}

type ReferredUser = {
  id: string; name: string | null; first_name: string | null; last_name: string | null
  institution: string | null; avatar_url: string | null; created_at: string
}

type Channel = { id: string; name: string; emoji: string | null }

/** Accepte uniquement http/https pour éviter javascript: ou data: en href */
function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return ['http:', 'https:'].includes(u.protocol) ? url : null
  } catch { return null }
}

function getDisplayName(p: { first_name: string | null; last_name: string | null; name: string | null } | null) {
  if (!p) return 'Member'
  return `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.name || 'Member'
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [profile,        setProfile]        = useState<PublicProfile | null>(null)
  const [stats,          setStats]          = useState<Stats | null>(null)
  const [commentsCount,  setCommentsCount]  = useState(0)
  const [referredCount,  setReferredCount]  = useState(0)
  const [referred,       setReferred]       = useState<ReferredUser[]>([])
  const [channels,       setChannels]       = useState<Channel[]>([])
  const [loading,        setLoading]        = useState(true)
  const [notFound,       setNotFound]       = useState(false)
  const [messaging,      setMessaging]      = useState(false)

  useEffect(() => {
    if (!id) return
    // Redirect to own profile page
    if (user?.id === id) { router.replace('/profile'); return }

    const fetchAll = async () => {
      // Profile
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('id, name, first_name, last_name, institution, role, linkedin, avatar_url, links, created_at')
        .eq('id', id)
        .single()

      if (error || !profileData) { setNotFound(true); setLoading(false); return }
      setProfile(profileData as PublicProfile)

      // Stats + extra counts in parallel
      const [{ data: statsData }, { count: cCount }, { count: rCount }] = await Promise.all([
        supabase.from('user_stats')
          .select('feed_posts, channel_messages, files_shared, likes_given')
          .eq('user_id', id).single(),
        supabase.from('channel_post_comments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', id),
        supabase.from('referrals')
          .select('*', { count: 'exact', head: true })
          .eq('referrer_id', id),
      ])
      if (statsData) setStats(statsData as Stats)
      setCommentsCount(cCount ?? 0)
      setReferredCount(rCount ?? 0)

      // Referred members (list for the card below)
      const { data: referrals } = await supabase
        .from('referrals')
        .select('referee_id, created_at')
        .eq('referrer_id', id)
        .order('created_at', { ascending: false })

      if (referrals && referrals.length > 0) {
        const refereeIds = referrals.map((r: any) => r.referee_id)
        const { data: refereeProfiles } = await supabase
          .from('profiles')
          .select('id, name, first_name, last_name, institution, avatar_url')
          .in('id', refereeIds)
        if (refereeProfiles) {
          const merged = referrals.map((r) => {
            const p = refereeProfiles.find(x => x.id === r.referee_id)
            return p ? { id: p.id, name: p.name, first_name: p.first_name, last_name: p.last_name, institution: p.institution, avatar_url: p.avatar_url, created_at: r.created_at } : null
          }).filter(Boolean) as ReferredUser[]
          setReferred(merged)
        }
      }

      // Channels
      const { data: memberRows } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', id)
      if (memberRows && memberRows.length > 0) {
        const cids = memberRows.map((r: any) => r.channel_id)
        const { data: chData } = await supabase
          .from('channels')
          .select('id, name, emoji')
          .in('id', cids)
        if (chData) setChannels(chData as Channel[])
      }

      setLoading(false)
    }

    fetchAll()
  }, [id, user?.id])

  const handleMessage = async () => {
    if (!profile) return
    setMessaging(true)
    const convId = await getOrCreateConversation(supabase, profile.id)
    if (convId) router.push(`/messages/${convId}`)
    setMessaging(false)
  }

  const displayName = getDisplayName(profile)
  const initials    = getInitials(displayName)
  const links       = profile?.links ?? 0
  const RANK_LABEL  = links >= 500 ? '🏆 Expert' : links >= 300 ? '⭐ Contributor' : links >= 100 ? '🌱 Member' : '👋 Newcomer'
  const memberSince = profile
    ? new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : ''

  return (
    <AppShell>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '64px 0' }}>Loading…</p>
        ) : notFound ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>🙈</p>
            <p style={{ color: '#64748b', fontWeight: 600 }}>Profile not found</p>
            <button onClick={() => router.back()} style={{ marginTop: 16, fontSize: 13, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}>← Go back</button>
          </div>
        ) : profile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── Back button ── */}
            <button onClick={() => router.back()} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'white', border: '1px solid #e2e8f0', borderRadius: 12,
              padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#475569',
              cursor: 'pointer', alignSelf: 'flex-start', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              ← Back
            </button>

            {/* ── Header card ── */}
            <div style={{ background: 'white', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div style={{ width: 72, height: 72, borderRadius: 18, background: '#1a3055', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900, color: 'white', flexShrink: 0, overflow: 'hidden' }}>
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a3055', margin: 0 }}>{displayName}</h1>
                  {(profile.institution || profile.role) && (
                    <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 6px' }}>
                      {[profile.institution, profile.role].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#b45309', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 999, padding: '2px 8px' }}>🔗 {links} Links</span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{RANK_LABEL}</span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>· Since {memberSince}</span>
                  </div>
                </div>
              </div>

              {/* LinkedIn */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {safeUrl(profile.linkedin) && (
                  <a href={safeUrl(profile.linkedin)!} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#eff6ff', borderRadius: 12, padding: '10px 14px', textDecoration: 'none', border: '1px solid #dbeafe' }}>
                    <span style={{ fontSize: 16 }}>💼</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#2563eb' }}>View LinkedIn profile</span>
                  </a>
                )}
              </div>

              {/* CTA */}
              <button onClick={handleMessage} disabled={messaging}
                style={{ width: '100%', marginTop: 16, padding: '11px 0', borderRadius: 14, background: '#1a3055', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: messaging ? 'not-allowed' : 'pointer', opacity: messaging ? 0.7 : 1 }}>
                {messaging ? '…' : '✉️ Send a message'}
              </button>
            </div>

            {/* ── Stats ── */}
            {stats && (
              <div style={{ background: 'white', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', padding: '18px 20px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>📊 Activity</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {[
                    { icon: '📝', label: 'Feed posts',    value: stats.feed_posts },
                    { icon: '💬', label: 'Messages',      value: stats.channel_messages },
                    { icon: '🗨️', label: 'Comments',      value: commentsCount },
                    { icon: '📎', label: 'Files shared',  value: stats.files_shared },
                    { icon: '👍', label: 'Likes given',   value: stats.likes_given },
                    { icon: '🤝', label: 'Referred',      value: referredCount },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 14px' }}>
                      <p style={{ fontSize: 20, fontWeight: 800, color: '#1a3055', margin: 0 }}>{s.value}</p>
                      <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{s.icon} {s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Referred members ── */}
            {referred.length > 0 && (
              <div style={{ background: 'white', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', padding: '18px 20px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  🤝 Referred members ({referred.length})
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {referred.map(r => {
                    const rName = getDisplayName(r)
                    const rInit = getInitials(rName)
                    return (
                      <button key={r.id} onClick={() => router.push(`/profile/${r.id}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, background: '#f8fafc', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1a3055', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0, overflow: 'hidden' }}>
                          {r.avatar_url
                            ? <img src={r.avatar_url} alt={rName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : rInit}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#1a3055', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rName}</p>
                          {r.institution && <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.institution}</p>}
                        </div>
                        <span style={{ fontSize: 11, color: '#cbd5e1', flexShrink: 0 }}>
                          {new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Channels ── */}
            {channels.length > 0 && (
              <div style={{ background: 'white', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', padding: '18px 20px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  # Channels ({channels.length})
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {channels.map(c => (
                    <button key={c.id} onClick={() => router.push(`/channels/${c.id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                      {c.emoji ?? '#'} {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}


          </div>
        )}
      </div>
    </AppShell>
  )
}
