'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { STORAGE } from '@/lib/storage'
import AppShell from '@/components/layout/AppShell'
import AvatarImg from '@/components/ui/AvatarImg'

function UniIcon({ size = 32, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="34" width="34" height="3" rx="1.5" fill={color} opacity="0.7"/>
      <rect x="5" y="30" width="30" height="4" rx="1.5" fill={color} opacity="0.85"/>
      <rect x="7"  y="17" width="4" height="13" rx="1.5" fill={color}/>
      <rect x="14" y="17" width="4" height="13" rx="1.5" fill={color}/>
      <rect x="22" y="17" width="4" height="13" rx="1.5" fill={color}/>
      <rect x="29" y="17" width="4" height="13" rx="1.5" fill={color}/>
      <rect x="4" y="13" width="32" height="4" rx="1.5" fill={color}/>
      <path d="M20 3 L37 13 H3 Z" fill={color} opacity="0.9"/>
    </svg>
  )
}

type Member = {
  id: string
  name: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  role: string | null
  institution: string | null
}

type UniMeta = {
  display_name: string
  flag: string | null
  city: string | null
  country_name: string | null
  website: string | null
  established: number | null
  erasmus_code: string | null
}

function getDisplayName(m: Member) {
  if (m.first_name || m.last_name) return `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()
  return m.name ?? 'Member'
}

function getInitials(m: Member) {
  const n = getDisplayName(m)
  return n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

const PALETTE = ['#1a3055','#2d4f7f','#0f4c81','#1e6091','#184e77','#1b4332','#6b2737','#7b3f00']

export default function InstitutionPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const { profile } = useAuth()
  const isAdmin = profile?.app_role === 'admin'

  const institutionName = decodeURIComponent(params.slug as string)
  const nameKey = institutionName.trim().toLowerCase()
  const [members, setMembers] = useState<Member[]>([])
  const [uniMeta, setUniMeta] = useState<UniMeta | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const logoInputRef = useRef<HTMLInputElement>(null)

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError(null)
    if (!file.type.startsWith('image/')) { setLogoError('Please choose an image file.'); return }
    if (file.size > 5 * 1024 * 1024) { setLogoError('Image must be under 5 MB.'); return }
    setUploadingLogo(true)
    try {
      const ext = file.name.split('.').pop() ?? 'png'
      const safe = encodeURIComponent(nameKey).replace(/%/g, '_')
      // Cache-bust the path so the new logo shows immediately
      const path = `${safe}/logo-${Date.now()}.${ext}`
      const publicUrl = await STORAGE.upload('org-logos', file, path)
      const { error } = await supabase.from('org_logos').upsert({
        name_key: nameKey,
        name: institutionName,
        logo_url: publicUrl,
        updated_by: profile?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      setLogoUrl(publicUrl)
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true)

      // Fetch members with this institution
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, first_name, last_name, avatar_url, role, institution, university_id')
        .ilike('institution', institutionName)

      const mems: Member[] = (profiles ?? []).map(p => ({
        id: p.id,
        name: p.name,
        first_name: p.first_name,
        last_name: p.last_name,
        avatar_url: p.avatar_url,
        role: p.role ?? null,
        institution: p.institution,
      }))
      setMembers(mems)

      // Fetch a custom org logo if an admin uploaded one
      const { data: logoRow } = await supabase
        .from('org_logos')
        .select('logo_url')
        .eq('name_key', nameKey)
        .maybeSingle()
      setLogoUrl(logoRow?.logo_url ?? null)

      // Fetch university meta from first member's university_id
      const uniId = (profiles ?? []).find(p => p.university_id)
      const uniIdVal = uniId ? uniId.university_id : null
      if (uniIdVal) {
        const { data: uni } = await supabase
          .from('universities')
          .select('display_name, flag, city, country_name, website, established, erasmus_code')
          .eq('id', uniIdVal)
          .single()
        if (uni) setUniMeta(uni as UniMeta)
      }

      setLoading(false)
    }
    load()
  }, [institutionName])

  const initIdx = (i: number) => PALETTE[i % PALETTE.length]

  return (
    <AppShell>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
        {/* Back */}
        <button onClick={() => router.push('/network')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, marginBottom: 20, padding: 0 }}>
          ← Institutions
        </button>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <p style={{ color: '#94a3b8', fontSize: 14 }}>Loading…</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              background: 'white', borderRadius: 20, border: '1px solid #e2e8f0',
              padding: '24px', marginBottom: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: 88, height: 88, borderRadius: 20,
                    background: logoUrl ? 'white' : PALETTE[0],
                    border: logoUrl ? '1px solid #e2e8f0' : 'none',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', overflow: 'hidden',
                  }}>
                    {logoUrl
                      ? <img src={logoUrl} alt={institutionName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      : <UniIcon size={52} color="white" />}
                  </div>
                  {uniMeta?.flag && (
                    <span style={{
                      position: 'absolute', bottom: -5, right: -8,
                      fontSize: 24, lineHeight: 1,
                      filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.25))',
                    }}>{uniMeta.flag}</span>
                  )}
                  {isAdmin && (
                    <>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        style={{ display: 'none' }}
                      />
                      <button
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadingLogo}
                        title={logoUrl ? 'Change the logo' : 'Add a logo'}
                        style={{
                          position: 'absolute', bottom: -8, left: -8,
                          width: 30, height: 30, borderRadius: '50%',
                          background: '#1a3055', color: 'white',
                          border: '2px solid white', cursor: uploadingLogo ? 'wait' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, boxShadow: '0 2px 6px rgba(0,0,0,0.2)', padding: 0,
                        }}>
                        {uploadingLogo ? '…' : '📷'}
                      </button>
                    </>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a3055', margin: '0 0 4px' }}>
                    {institutionName}
                  </h1>
                  {uniMeta && (
                    <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 8px' }}>
                      {[uniMeta.city, uniMeta.country_name].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{
                      background: '#f1f5f9', color: '#475569', borderRadius: 20,
                      fontSize: 12, fontWeight: 600, padding: '4px 12px',
                    }}>
                      {members.length} member{members.length > 1 ? 's' : ''}
                    </span>
                    {uniMeta?.erasmus_code && (
                      <span style={{
                        background: '#eff6ff', color: '#3b82f6', borderRadius: 20,
                        fontSize: 12, fontWeight: 600, padding: '4px 12px',
                        border: '1px solid #bfdbfe',
                      }}>
                        🇪🇺 {uniMeta.erasmus_code}
                      </span>
                    )}
                    {uniMeta?.established && (
                      <span style={{
                        background: '#f8fafc', color: '#94a3b8', borderRadius: 20,
                        fontSize: 12, fontWeight: 500, padding: '4px 12px',
                      }}>
                        Est. {uniMeta.established}
                      </span>
                    )}
                  </div>
                  {uniMeta?.website && (
                    <a href={uniMeta.website} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: '#1a3055', marginTop: 8, display: 'inline-block', textDecoration: 'none' }}>
                      🌐 {uniMeta.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  {isAdmin && (
                    <p style={{ fontSize: 11, color: logoError ? '#dc2626' : '#94a3b8', margin: '8px 0 0' }}>
                      {logoError
                        ? logoError
                        : uploadingLogo
                          ? 'Uploading logo…'
                          : '📷 Click the camera to set this organisation’s logo (admin)'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Members */}
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1a3055', marginBottom: 12 }}>
              Members
            </h2>
            {members.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 14 }}>No members yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {members.map((m, i) => (
                  <div
                    key={m.id}
                    onClick={() => router.push(`/profile/${m.id}`)}
                    style={{
                      background: 'white', border: '1px solid #e2e8f0', borderRadius: 14,
                      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                      cursor: 'pointer', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                      background: initIdx(i), display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 13, fontWeight: 700,
                      color: 'white', overflow: 'hidden',
                    }}>
                      <AvatarImg src={m.avatar_url} alt={getDisplayName(m)} fallback={getInitials(m)} style={{ width: 40, height: 40, objectFit: 'cover' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#1a3055', margin: 0 }}>
                        {getDisplayName(m)}
                      </p>
                      {m.role && (
                        <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.role}
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: 13, color: '#cbd5e1', flexShrink: 0 }}>→</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
