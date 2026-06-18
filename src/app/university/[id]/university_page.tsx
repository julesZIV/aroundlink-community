'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/client'
import type { University } from '@/lib/supabase/supabase/types'
import AvatarImg from '@/components/ui/AvatarImg'

const PALETTE = ['#1a3055','#2d4f7f','#0f4c81','#1e6091','#184e77','#1b4332','#6b2737','#7b3f00']

export default function UniversityPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [uni, setUni] = useState<University | null>(null)
  const [members, setMembers] = useState<{ id: string; name: string; first_name: string | null; last_name: string | null; avatar_url: string | null; role: string | null }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)

    Promise.all([
      supabase
        .from('universities')
        .select('*')
        .eq('id', Number(id))
        .single(),
      supabase
        .from('profiles')
        .select('id, name, first_name, last_name, avatar_url, role')
        .eq('university_id', Number(id))
        .eq('is_anonymized', false)
        .limit(20),
    ]).then(([{ data: uniData }, { data: memberData }]) => {
      setUni(uniData ?? null)
      setMembers(memberData ?? [])
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <p className="text-slate-400 text-sm">Loading…</p>
        </div>
      </AppShell>
    )
  }

  if (!uni) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-3xl mb-3">🏛</p>
          <p className="font-semibold text-slate-600">University not found</p>
          <button onClick={() => router.push('/network')}
            className="mt-4 text-sm text-blue-600 hover:underline">← Back to Network</button>
        </div>
      </AppShell>
    )
  }

  const abbr = (u: University) =>
    (u.acronyms?.[0] ?? u.display_name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 3)).toUpperCase()
  const color = PALETTE[uni.id % PALETTE.length]

  const getDisplayName = (m: typeof members[0]) => {
    if (m.first_name || m.last_name) return `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()
    return m.name
  }
  const getInitials = (m: typeof members[0]) =>
    getDisplayName(m).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

  const INFO_ROWS = [
    { label: 'Country', value: uni.country_name ? `${uni.flag ?? ''} ${uni.country_name}`.trim() : null },
    { label: 'City', value: uni.city },
    { label: 'Erasmus Code', value: uni.erasmus_code, mono: true },
    { label: 'SCHAC Domain', value: uni.schac_domain, mono: true },
    { label: 'Type', value: uni.types?.[0] ?? null },
    { label: 'Established', value: uni.established ? String(uni.established) : null },
    { label: 'Website', value: uni.website, link: true },
    { label: 'Erasmus', value: uni.is_erasmus ? '🇪🇺 Erasmus Partner' : '🌍 Non-Erasmus' },
  ].filter(r => r.value)

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Back */}
        <button onClick={() => router.back()}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-4">
          ← Back
        </button>

        {/* Hero */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-lg font-black text-white flex-shrink-0"
              style={{ background: color }}>
              {abbr(uni)}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-slate-800 leading-tight">{uni.display_name}</h1>
              <p className="text-sm text-slate-400 mt-1">
                {uni.flag} {uni.city}{uni.city && uni.country_name ? ', ' : ''}{uni.country_name}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  uni.is_erasmus ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                  {uni.is_erasmus ? '🇪🇺 Erasmus' : '🌍 Global'}
                </span>
                {uni.types?.[0] && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-500 border border-slate-200">
                    {uni.types[0]}
                  </span>
                )}
                {uni.established && (
                  <span className="text-xs text-slate-400">Est. {uni.established}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Members */}
        {members.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
            <h2 className="text-sm font-bold text-slate-700 mb-3">
              👥 Members on AroundLink ({members.length})
            </h2>
            <div className="flex flex-col gap-2">
              {members.map(m => (
                <button
                  key={m.id}
                  onClick={() => router.push(`/profile/${m.id}`)}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors text-left w-full"
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: color, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white',
                    overflow: 'hidden',
                  }}>
                    <AvatarImg src={m.avatar_url} alt={getDisplayName(m)} fallback={getInitials(m)} style={{ width: 36, height: 36, objectFit: 'cover' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{getDisplayName(m)}</p>
                    {m.role && <p className="text-xs text-slate-400 truncate">{m.role}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Info grid */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
          <h2 className="text-sm font-bold text-slate-700 mb-4">📋 Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {INFO_ROWS.map(row => (
              <div key={row.label} className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-400 mb-0.5">{row.label}</p>
                {row.link ? (
                  <a href={String(row.value).startsWith('http') ? row.value! : `https://${row.value}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-sm font-semibold text-blue-600 hover:underline truncate block">
                    {row.value}
                  </a>
                ) : (
                  <p className={`text-sm font-semibold text-slate-700 truncate ${row.mono ? 'font-mono' : ''}`}>
                    {row.value}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Acronyms */}
        {uni.acronyms && uni.acronyms.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
            <h2 className="text-sm font-bold text-slate-700 mb-3">🏷 Acronyms & Aliases</h2>
            <div className="flex flex-wrap gap-2">
              {[...uni.acronyms, ...(uni.aliases ?? [])].filter(Boolean).map((a, i) => (
                <span key={i} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-600">
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* EWP */}
        {(uni.ror_id || uni.schac_domain || uni.ewp_status) && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
            <h2 className="text-sm font-bold text-slate-700 mb-3">🔌 EWP / Technical</h2>
            <div className="space-y-2">
              {uni.ror_id && (
                <div className="bg-slate-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-slate-400 mb-0.5">ROR ID</p>
                  <p className="text-sm font-mono font-semibold text-slate-700">{uni.ror_id}</p>
                </div>
              )}
              {uni.schac_domain && (
                <div className="bg-slate-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-slate-400 mb-0.5">SCHAC Domain</p>
                  <p className="text-sm font-mono font-semibold text-slate-700">{uni.schac_domain}</p>
                </div>
              )}
              {uni.ewp_status && (
                <div className="bg-slate-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-slate-400 mb-0.5">EWP Status</p>
                  <p className="text-sm font-semibold text-slate-700">{uni.ewp_status}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {uni.website && (
            <a href={uni.website.startsWith('http') ? uni.website : `https://${uni.website}`}
              target="_blank" rel="noopener noreferrer"
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">
              🌐 Visit Website
            </a>
          )}
          <button onClick={() => router.push('/network')}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#1a3055' }}>
            🗺️ Back to Map
          </button>
        </div>

      </div>
    </AppShell>
  )
}
