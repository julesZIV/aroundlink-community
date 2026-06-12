'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, useMemo } from 'react'
import type { Profile } from '@/lib/supabase/supabase/types'
import AvatarImg from '@/components/ui/AvatarImg'

type Contributor = { id: string; name: string | null; first_name: string | null; last_name: string | null; institution: string | null; links: number; avatar_url: string | null }
type Institution = { name: string; totalLinks: number; memberCount: number }

const RANK_ICON = ['🥇','🥈','🥉']
const PALETTE = ['#1a3055','#2d4f7f','#0f4c81','#1e6091','#184e77']

function displayName(u: Contributor) {
  if (u.first_name || u.last_name) return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
  return u.name ?? 'Member'
}

function UniIcon({ size = 14 }: { size?: number }) {
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

export default function RightPanel({ profile }: { profile: Profile | null }) {
  const router = useRouter()
  const [contributors, setContributors] = useState<Contributor[]>([])

  useEffect(() => {
    createClient()
      .from('profiles')
      .select('id, name, first_name, last_name, institution, links, avatar_url')
      .order('links', { ascending: false })
      .gt('links', 0)
      .limit(100)
      .then(({ data }) => { if (data) setContributors(data as Contributor[]) })
  }, [])

  const institutions = useMemo<Institution[]>(() => {
    const map: Record<string, Institution> = {}
    for (const m of contributors) {
      if (!m.institution?.trim()) continue
      const key = m.institution.trim()
      if (!map[key]) map[key] = { name: key, totalLinks: 0, memberCount: 0 }
      map[key].totalLinks += m.links
      map[key].memberCount++
    }
    return Object.values(map).sort((a, b) => b.totalLinks - a.totalLinks)
  }, [contributors])

  return (
    <aside className="right-panel">
      <div style={{ padding: '16px 12px' }}>

        {/* Top Contributors */}
        <Section title="🏅 Top Contributors">
          {contributors.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">No activity yet.</p>
          ) : contributors.slice(0, 5).map((u, i) => {
            const initials = displayName(u).split(' ').map((w:string) => w[0]).join('').slice(0,2).toUpperCase()
            return (
              <Link key={u.id} href={`/profile/${u.id}`} className="flex items-center gap-2 p-1.5 rounded-xl mb-1 hover:bg-slate-50 transition-colors no-underline">
                <span className="text-xs w-4 font-bold text-center flex-shrink-0 text-slate-400">{RANK_ICON[i] ?? `#${i+1}`}</span>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden" style={{ background: '#1a3055' }}>
                  <AvatarImg src={u.avatar_url} alt={displayName(u)} fallback={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate leading-tight">{displayName(u)}</p>
                  <p className="text-xs text-slate-400 truncate" style={{ fontSize: 10 }}>{u.institution ?? '—'}</p>
                </div>
                <span className="text-xs font-bold flex-shrink-0 text-amber-600">🔗 {u.links}</span>
              </Link>
            )
          })}
        </Section>

        {/* Top Institutions */}
        <Section title="🏛️ Top Institutions">
          {institutions.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">No data yet.</p>
          ) : institutions.slice(0, 5).map((inst, i) => (
            <button key={inst.name}
              onClick={() => router.push(`/institution/${encodeURIComponent(inst.name)}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px', borderRadius: 12, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', marginBottom: 4 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 11, width: 16, fontWeight: 800, color: '#94a3b8', textAlign: 'center', flexShrink: 0 }}>{RANK_ICON[i] ?? `#${i+1}`}</span>
              <div style={{
                width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                background: PALETTE[i % PALETTE.length],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <UniIcon size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                  {inst.name}
                </p>
                <p style={{ margin: 0, fontSize: 10, color: '#94a3b8' }}>{inst.memberCount} member{inst.memberCount > 1 ? 's' : ''}</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', flexShrink: 0 }}>🔗 {inst.totalLinks}</span>
            </button>
          ))}
        </Section>

      </div>
    </aside>
  )
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>{title}</h3>
      {children}
    </div>
  )
}
