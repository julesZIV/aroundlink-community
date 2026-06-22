'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AvatarImg from '@/components/ui/AvatarImg'
import { isAroundLinkOrg } from '@/lib/isAroundLink'

type Member = {
  id: string
  name: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

type Institution = {
  name: string
  slug: string
  flag: string | null
  city: string | null
  country_name: string | null
  university_id: number | null
  logo_url: string | null
  members: Member[]
  count: number
}

function getDisplayName(m: Member) {
  if (m.first_name || m.last_name) return `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()
  return m.name ?? ''
}

function getInitials(m: Member) {
  const n = getDisplayName(m)
  return n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

function slugify(name: string) {
  return encodeURIComponent(name.trim())
}

const PALETTE = ['#1a3055','#2d4f7f','#0f4c81','#1e6091','#184e77','#1b4332','#6b2737','#7b3f00']

// Classic university building icon (columns + pediment)
function UniIcon({ size = 24, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Steps / base */}
      <rect x="3" y="34" width="34" height="3" rx="1.5" fill={color} opacity="0.7"/>
      <rect x="5" y="30" width="30" height="4" rx="1.5" fill={color} opacity="0.85"/>
      {/* Columns */}
      <rect x="7"  y="17" width="4" height="13" rx="1.5" fill={color}/>
      <rect x="14" y="17" width="4" height="13" rx="1.5" fill={color}/>
      <rect x="22" y="17" width="4" height="13" rx="1.5" fill={color}/>
      <rect x="29" y="17" width="4" height="13" rx="1.5" fill={color}/>
      {/* Entablature */}
      <rect x="4" y="13" width="32" height="4" rx="1.5" fill={color}/>
      {/* Pediment (triangle) */}
      <path d="M20 3 L37 13 H3 Z" fill={color} opacity="0.9"/>
    </svg>
  )
}

export default function InstitutionsView({ externalSearch = '' }: { externalSearch?: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      // Fetch all profiles with an institution
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, first_name, last_name, avatar_url, institution, university_id')
        .not('institution', 'is', null)
        .neq('institution', '')

      if (!profiles?.length) { setLoading(false); return }

      // Group by institution name
      const grouped: Record<string, { members: Member[]; university_id: number | null }> = {}
      for (const p of profiles) {
        const key = (p.institution ?? '').trim()
        if (!key) continue
        if (isAroundLinkOrg(key)) continue  // organisateur exclu de l'annuaire/classement
        if (!grouped[key]) grouped[key] = { members: [], university_id: p.university_id ?? null }
        grouped[key].members.push({
          id: p.id,
          name: p.name,
          first_name: p.first_name,
          last_name: p.last_name,
          avatar_url: p.avatar_url,
        })
      }

      // Fetch flag/city/country for institutions that have a university_id
      const uniIds = [...new Set(
        Object.values(grouped).map(g => g.university_id).filter(Boolean)
      )] as number[]

      let uniMeta: Record<number, { flag: string | null; city: string | null; country_name: string | null }> = {}
      if (uniIds.length) {
        const { data: unis } = await supabase
          .from('universities')
          .select('id, flag, city, country_name')
          .in('id', uniIds)
        for (const u of unis ?? []) {
          uniMeta[u.id] = { flag: u.flag, city: u.city, country_name: u.country_name }
        }
      }

      // Custom logos uploaded by admins, keyed by normalised institution name
      const { data: logoRows } = await supabase
        .from('org_logos')
        .select('name_key, logo_url')
      const logoByKey: Record<string, string> = {}
      for (const l of logoRows ?? []) logoByKey[l.name_key] = l.logo_url

      const result: Institution[] = Object.entries(grouped)
        .map(([name, { members, university_id }]) => {
          const meta = university_id ? uniMeta[university_id] : null
          return {
            name,
            slug: slugify(name),
            flag: meta?.flag ?? null,
            city: meta?.city ?? null,
            country_name: meta?.country_name ?? null,
            university_id,
            logo_url: logoByKey[name.trim().toLowerCase()] ?? null,
            members,
            count: members.length,
          }
        })
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

      setInstitutions(result)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = externalSearch.toLowerCase().trim()
    if (!q) return institutions
    return institutions.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.city ?? '').toLowerCase().includes(q) ||
      (i.country_name ?? '').toLowerCase().includes(q)
    )
  }, [institutions, externalSearch])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <p style={{ color: '#94a3b8', fontSize: 14 }}>Loading institutions…</p>
    </div>
  )

  if (!filtered.length) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 8 }}>
      <p style={{ fontSize: 28 }}>🏛️</p>
      <p style={{ color: '#94a3b8', fontSize: 14 }}>
        {externalSearch ? `No institution for "${externalSearch}"` : 'No institutions yet.'}
      </p>
      {!externalSearch && (
        <p style={{ color: '#cbd5e1', fontSize: 12 }}>Members must fill in their institution in their profile.</p>
      )}
    </div>
  )

  return (
    <div style={{ padding: '16px' }}>
      <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
        <span style={{ fontWeight: 700, color: '#475569' }}>{filtered.length}</span> institution{filtered.length > 1 ? 's' : ''}
        {externalSearch ? ` pour "${externalSearch}"` : ''}
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 12,
      }}>
        {filtered.map((inst, idx) => (
          <div
            key={inst.name}
            onClick={() => router.push(`/institution/${inst.slug}`)}
            style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: 16,
              cursor: 'pointer',
              transition: 'box-shadow 0.15s, transform 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.10)'
              ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = 'none'
              ;(e.currentTarget as HTMLElement).style.transform = 'none'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: 14,
                  background: inst.logo_url ? 'white' : PALETTE[idx % PALETTE.length],
                  border: inst.logo_url ? '1px solid #e2e8f0' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                }}>
                  {inst.logo_url
                    ? <img src={inst.logo_url} alt={inst.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <UniIcon size={34} color="white" />}
                </div>
                {inst.flag && (
                  <span style={{
                    position: 'absolute', bottom: -4, right: -6,
                    fontSize: 16, lineHeight: 1,
                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))',
                  }}>{inst.flag}</span>
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#1a3055', lineHeight: 1.3, marginBottom: 2 }}
                  className="line-clamp-2">{inst.name}</p>
                {(inst.city || inst.country_name) && (
                  <p style={{ fontSize: 11, color: '#94a3b8' }}>
                    {[inst.city, inst.country_name].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </div>

            {/* Member avatars */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', marginRight: 4 }}>
                {inst.members.slice(0, 4).map((m, i) => (
                  <div key={m.id} style={{
                    width: 28, height: 28, borderRadius: '50%',
                    border: '2px solid white',
                    marginLeft: i > 0 ? -8 : 0,
                    background: PALETTE[(idx + i) % PALETTE.length],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: 'white',
                    overflow: 'hidden', flexShrink: 0,
                    zIndex: 4 - i,
                    position: 'relative',
                  }}>
                    <AvatarImg src={m.avatar_url} alt={getDisplayName(m)} fallback={getInitials(m)} style={{ width: 28, height: 28, objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                {inst.count} member{inst.count > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
