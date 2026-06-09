'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppShell from '@/components/layout/AppShell'
import { useAuth } from '@/lib/hooks/useAuth'

type Member = {
  id: string
  name: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  institution: string | null
  links: number
}

type Institution = {
  name: string
  totalLinks: number
  memberCount: number
  topMembers: Member[]
}

function getDisplayName(m: Member) {
  if (m.first_name || m.last_name) return `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()
  return m.name ?? 'Member'
}
function getInitials(m: Member) {
  return getDisplayName(m).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

const MEDAL = ['🥇', '🥈', '🥉']
const PALETTE = ['#1a3055','#2d4f7f','#0f4c81','#1e6091','#184e77','#6b2737']

// Classic university building icon
function UniIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="3" y="34" width="34" height="3" rx="1.5" fill="white" opacity="0.7"/>
      <rect x="5" y="30" width="30" height="4" rx="1.5" fill="white" opacity="0.85"/>
      <rect x="7"  y="17" width="4" height="13" rx="1.5" fill="white"/>
      <rect x="14" y="17" width="4" height="13" rx="1.5" fill="white"/>
      <rect x="22" y="17" width="4" height="13" rx="1.5" fill="white"/>
      <rect x="29" y="17" width="4" height="13" rx="1.5" fill="white"/>
      <rect x="4" y="13" width="32" height="4" rx="1.5" fill="white"/>
      <path d="M20 3 L37 13 H3 Z" fill="white" opacity="0.9"/>
    </svg>
  )
}

export default function LeaderboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'members' | 'institutions'>('members')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('profiles')
        .select('id, name, first_name, last_name, avatar_url, institution, links')
        .not('links', 'is', null)
        .gt('links', 0)
        .order('links', { ascending: false })
        .limit(200)
      setMembers((data ?? []) as Member[])
      setLoading(false)
    }
    load()
  }, [])

  const myRank = members.findIndex(m => m.id === user?.id)

  // Compute institution ranking from member data
  const institutions = useMemo<Institution[]>(() => {
    const map: Record<string, Institution> = {}
    for (const m of members) {
      if (!m.institution?.trim()) continue
      const key = m.institution.trim()
      if (!map[key]) map[key] = { name: key, totalLinks: 0, memberCount: 0, topMembers: [] }
      map[key].totalLinks += m.links
      map[key].memberCount++
      if (map[key].topMembers.length < 3) map[key].topMembers.push(m)
    }
    return Object.values(map).sort((a, b) => b.totalLinks - a.totalLinks)
  }, [members])

  // My institution rank
  const myInstitution = user ? members.find(m => m.id === user.id)?.institution?.trim() : null
  const myInstRank = myInstitution ? institutions.findIndex(i => i.name === myInstitution) : -1

  const TrophyIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
    </svg>
  )

  return (
    <AppShell>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 80px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <TrophyIcon />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1e293b' }}>Leaderboard</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Most active members & institutions</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: '#f1f5f9', borderRadius: 12, padding: 4 }}>
          {([['members', '👤 Members'], ['institutions', '🏛️ Institutions']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 13, transition: 'all 0.15s',
                background: tab === key ? 'white' : 'transparent',
                color: tab === key ? '#1a3055' : '#94a3b8',
                boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}>
              {label}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 14 }}>
            Loading…
          </div>
        )}

        {/* ── MEMBRES TAB ── */}
        {!loading && tab === 'members' && (
          <>
            {/* My rank badge */}
            {myRank >= 0 && (
              <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12,
                padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
              }}>
                <span style={{ fontSize: 20 }}>{myRank < 3 ? MEDAL[myRank] : `#${myRank + 1}`}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1a3055' }}>Your rank</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                    {myRank === 0 ? "You're in the lead 🎉" : `Rank #${myRank + 1} of ${members.length}`}
                  </p>
                </div>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#f59e0b' }}>🔗 {members[myRank]?.links ?? 0}</span>
              </div>
            )}

            {members.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <p style={{ fontSize: 32 }}>🏆</p>
                <p style={{ fontSize: 14, color: '#94a3b8' }}>No scores yet.</p>
              </div>
            )}

            {/* Podium top 3 */}
            {members.length >= 3 && (
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
                {[1, 0, 2].map(rank => {
                  const m = members[rank]
                  if (!m) return null
                  const heights = [96, 120, 80]
                  const podiumH = heights[rank === 0 ? 1 : rank === 1 ? 0 : 2]
                  const isMe = m.id === user?.id
                  return (
                    <div key={m.id} onClick={() => router.push(`/profile/${m.id}`)}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                      <div style={{ position: 'relative', marginBottom: 6 }}>
                        <div style={{
                          width: rank === 0 ? 56 : 44, height: rank === 0 ? 56 : 44,
                          borderRadius: '50%', background: PALETTE[rank],
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: rank === 0 ? 15 : 12, fontWeight: 800, color: 'white', overflow: 'hidden',
                          border: isMe ? '3px solid #3b82f6' : `3px solid ${rank === 0 ? '#fbbf24' : rank === 1 ? '#94a3b8' : '#cd7c2e'}`,
                        }}>
                          {m.avatar_url ? <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(m)}
                        </div>
                        <span style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', fontSize: 16 }}>{MEDAL[rank]}</span>
                      </div>
                      <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: '#1a3055', textAlign: 'center', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {getDisplayName(m).split(' ')[0]}
                      </p>
                      <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: '#f59e0b' }}>🔗 {m.links}</p>
                      <div style={{
                        width: '100%', height: podiumH, borderRadius: '8px 8px 0 0',
                        background: rank === 0 ? 'linear-gradient(180deg,#fef9c3,#fde68a)' : rank === 1 ? 'linear-gradient(180deg,#f1f5f9,#e2e8f0)' : 'linear-gradient(180deg,#fef3e2,#fed7aa)',
                        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 10,
                        border: '1px solid', borderColor: rank === 0 ? '#fbbf24' : rank === 1 ? '#cbd5e1' : '#fdba74',
                      }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: rank === 0 ? '#92400e' : rank === 1 ? '#475569' : '#9a3412' }}>#{rank + 1}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Rest of list */}
            {members.length > 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {members.slice(3).map((m, i) => {
                  const rank = i + 3
                  const isMe = m.id === user?.id
                  return (
                    <div key={m.id} onClick={() => router.push(`/profile/${m.id}`)}
                      style={{
                        background: isMe ? '#eff6ff' : 'white',
                        border: isMe ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                        borderRadius: 14, padding: '10px 14px',
                        display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                      }}
                      onMouseEnter={e => { if (!isMe) (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
                      onMouseLeave={e => { if (!isMe) (e.currentTarget as HTMLElement).style.background = 'white' }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#94a3b8', minWidth: 24, textAlign: 'center' }}>#{rank + 1}</span>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: PALETTE[rank % PALETTE.length],
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 800, color: 'white', overflow: 'hidden',
                      }}>
                        {m.avatar_url ? <img src={m.avatar_url} alt="" style={{ width: 36, height: 36, objectFit: 'cover' }} /> : getInitials(m)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1a3055', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {getDisplayName(m)}{isMe && <span style={{ marginLeft: 6, fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>(you)</span>}
                        </p>
                        {m.institution && <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.institution}</p>}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', flexShrink: 0 }}>🔗 {m.links}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── INSTITUTIONS TAB ── */}
        {!loading && tab === 'institutions' && (
          <>
            {/* My institution badge */}
            {myInstRank >= 0 && myInstitution && (
              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12,
                padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
              }}>
                <span style={{ fontSize: 20 }}>{myInstRank < 3 ? MEDAL[myInstRank] : `#${myInstRank + 1}`}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1a3055', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {myInstitution}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                    {myInstRank === 0 ? "Your institution is leading 🎉" : `Rank #${myInstRank + 1} of ${institutions.length}`}
                  </p>
                </div>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#f59e0b', flexShrink: 0 }}>
                  🔗 {institutions[myInstRank]?.totalLinks ?? 0}
                </span>
              </div>
            )}

            {institutions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <p style={{ fontSize: 32 }}>🏛️</p>
                <p style={{ fontSize: 14, color: '#94a3b8' }}>No institutions yet.</p>
              </div>
            )}

            {/* Podium top 3 institutions */}
            {institutions.length >= 2 && (
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
                {[1, 0, 2].map(rank => {
                  const inst = institutions[rank]
                  if (!inst) return null
                  const heights = [96, 120, 80]
                  const podiumH = heights[rank === 0 ? 1 : rank === 1 ? 0 : 2]
                  const isMyInst = inst.name === myInstitution
                  return (
                    <div key={inst.name}
                      onClick={() => router.push(`/institution/${encodeURIComponent(inst.name)}`)}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                      <div style={{ position: 'relative', marginBottom: 6 }}>
                        <div style={{
                          width: rank === 0 ? 56 : 44, height: rank === 0 ? 56 : 44,
                          borderRadius: 16, background: PALETTE[rank % PALETTE.length],
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: isMyInst ? '3px solid #22c55e' : `3px solid ${rank === 0 ? '#fbbf24' : rank === 1 ? '#94a3b8' : '#cd7c2e'}`,
                        }}>
                          <UniIcon size={rank === 0 ? 28 : 22} />
                        </div>
                        <span style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', fontSize: 16 }}>{MEDAL[rank]}</span>
                      </div>
                      <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: '#1a3055', textAlign: 'center', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inst.name.split(' ')[0]}
                      </p>
                      <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: '#f59e0b' }}>🔗 {inst.totalLinks}</p>
                      <div style={{
                        width: '100%', height: podiumH, borderRadius: '8px 8px 0 0',
                        background: rank === 0 ? 'linear-gradient(180deg,#fef9c3,#fde68a)' : rank === 1 ? 'linear-gradient(180deg,#f1f5f9,#e2e8f0)' : 'linear-gradient(180deg,#fef3e2,#fed7aa)',
                        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 10,
                        border: '1px solid', borderColor: rank === 0 ? '#fbbf24' : rank === 1 ? '#cbd5e1' : '#fdba74',
                      }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: rank === 0 ? '#92400e' : rank === 1 ? '#475569' : '#9a3412' }}>#{rank + 1}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {institutions.map((inst, i) => {
                const isMyInst = inst.name === myInstitution
                const medal = i < 3 ? MEDAL[i] : null
                return (
                  <div key={inst.name}
                    onClick={() => router.push(`/institution/${encodeURIComponent(inst.name)}`)}
                    style={{
                      background: isMyInst ? '#f0fdf4' : 'white',
                      border: isMyInst ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                      borderRadius: 14, padding: '12px 14px',
                      display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                    }}
                    onMouseEnter={e => { if (!isMyInst) (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
                    onMouseLeave={e => { if (!isMyInst) (e.currentTarget as HTMLElement).style.background = 'white' }}
                  >
                    {/* Rank */}
                    <span style={{ fontSize: medal ? 20 : 13, fontWeight: 800, color: '#94a3b8', minWidth: 28, textAlign: 'center' }}>
                      {medal ?? `#${i + 1}`}
                    </span>

                    {/* Icon */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: PALETTE[i % PALETTE.length],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <UniIcon size={22} />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1a3055', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inst.name}
                        {isMyInst && <span style={{ marginLeft: 6, fontSize: 11, color: '#16a34a', fontWeight: 600 }}>(you)</span>}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        {/* Mini member avatars */}
                        <div style={{ display: 'flex' }}>
                          {inst.topMembers.map((m, mi) => (
                            <div key={m.id} style={{
                              width: 18, height: 18, borderRadius: '50%', border: '1.5px solid white',
                              marginLeft: mi > 0 ? -6 : 0, background: PALETTE[(i + mi) % PALETTE.length],
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 7, fontWeight: 800, color: 'white', overflow: 'hidden',
                              position: 'relative', zIndex: 3 - mi,
                            }}>
                              {m.avatar_url ? <img src={m.avatar_url} alt="" style={{ width: 18, height: 18, objectFit: 'cover' }} /> : getInitials(m)[0]}
                            </div>
                          ))}
                        </div>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          {inst.memberCount} member{inst.memberCount > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Score */}
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', flexShrink: 0 }}>
                      🔗 {inst.totalLinks}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
