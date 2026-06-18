'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import AppShell from '@/components/layout/AppShell'
import AvatarImg from '@/components/ui/AvatarImg'
import { useAuth } from '@/lib/hooks/useAuth'
import { useGlobalError } from '@/lib/context/ErrorContext'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type MemberRow = {
  id: string; name: string; email: string; institution: string | null
  institution_verified: boolean | null
  app_role: 'admin' | 'moderator' | 'member'; links: number; created_at: string
  is_anonymized: boolean
  avatar_url: string | null
}

type ScoringRow = {
  id: string; label: string; description: string | null
  points: number; category: string
}

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  admin:       { label: '⚙️ Admin',       color: '#1a3055', bg: '#eff6ff' },
  moderator:   { label: '🛡 Moderator',   color: '#0891b2', bg: '#ecfeff' },
  member:      { label: '👤 Member',      color: '#64748b', bg: '#f8fafc' },
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  onboarding: { label: 'Onboarding', icon: '🚀' },
  content:    { label: 'Content',    icon: '📝' },
  engagement: { label: 'Engagement', icon: '💬' },
}

export default function AdminPage() {
  const supabase = createClient()
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()
  const { pushError, pushSuccess } = useGlobalError()

  const [tab, setTab] = useState<'members' | 'scoring' | 'branding' | 'requests' | 'matching'>('members')

  // Channel requests state
  type ChannelRequest = { id: string; user_id: string; emoji: string; name: string; description: string | null; status: string; created_at: string; profiles: { name: string | null; first_name: string | null; last_name: string | null } | null }
  const [requests, setRequests] = useState<ChannelRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  // Members state
  const [members,   setMembers]   = useState<MemberRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,       setSaving]       = useState<string | null>(null)
  const [roleError,    setRoleError]    = useState<string | null>(null)
  const [search,       setSearch]       = useState('')
  const [confirmDelete, setConfirmDelete] = useState<MemberRow | null>(null)
  const [anonymizing,  setAnonymizing]  = useState(false)

  // Scoring state
  const [scoring,       setScoring]       = useState<ScoringRow[]>([])
  const [scoringLoading, setScoringLoading] = useState(true)
  const [editPoints,    setEditPoints]    = useState<Record<string, string>>({})
  const [savingScoring, setSavingScoring] = useState<string | null>(null)
  const [scoringMsg,    setScoringMsg]    = useState<string | null>(null)

  // Branding state
  const [currentLogoUrl,  setCurrentLogoUrl]  = useState<string | null>(null)
  const [savingLogo,      setSavingLogo]      = useState(false)
  const [logoSaved,       setLogoSaved]       = useState(false)
  const [logoError,       setLogoError]       = useState<string | null>(null)
  const [communityName,   setCommunityName]   = useState('AroundLink')
  const [savingName,      setSavingName]      = useState(false)
  const [nameSaved,       setNameSaved]       = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'community_logo_url').single()
      .then(({ data }) => { if (data?.value) setCurrentLogoUrl(data.value) })
    supabase.from('app_settings').select('value').eq('key', 'community_name').single()
      .then(({ data }) => { if (data?.value) setCommunityName(data.value) })
  }, [])

  const myRole = profile?.app_role ?? 'member'

  useEffect(() => {
    if (!authLoading && myRole !== 'admin' && myRole !== 'moderator') router.push('/feed')
  }, [authLoading, myRole])

  // Load members
  useEffect(() => {
    supabase.from('profiles')
      .select('id, name, email, institution, institution_verified, institution_domain, app_role, links, created_at, is_anonymized, avatar_url')
      .eq('is_anonymized', false)
      .order('app_role')
      .order('name')
      .then(({ data, error }) => {
        if (error) pushError(`Admin: could not load members — ${error.message}`)
        if (data) setMembers(data as MemberRow[])
        setLoading(false)
      })
  }, [])

  // Load scoring config
  useEffect(() => {
    supabase.from('scoring_config')
      .select('id, label, description, points, category')
      .order('category')
      .then(({ data, error }) => {
        if (error) pushError(`Scoring config error: ${error.message}`)
        if (data) {
          setScoring(data as ScoringRow[])
          const init: Record<string, string> = {}
          data.forEach((r: any) => { init[r.id] = String(r.points) })
          setEditPoints(init)
        }
        setScoringLoading(false)
      })
  }, [])

  // Shared helper — all sensitive admin ops go through the server-side API route
  const adminAction = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
      return { error }
    }
    return { error: null }
  }

  const changeRole = async (userId: string, newRole: 'admin' | 'moderator' | 'member') => {
    setSaving(userId)
    setRoleError(null)
    const { error } = await adminAction({ action: 'change-role', userId, newRole })
    if (error) {
      setRoleError(`Could not update role: ${error}`)
      pushError(`Role update failed: ${error}`)
    } else {
      setMembers(prev => prev.map(m => m.id === userId ? { ...m, app_role: newRole } : m))
      const memberName = members.find(m => m.id === userId)?.name ?? 'Member'
      pushSuccess(`${memberName} is now ${ROLE_LABELS[newRole]?.label ?? newRole}`)
    }
    setSaving(null)
  }

  const anonymizeUser = async (member: MemberRow) => {
    setAnonymizing(true)
    const { error } = await adminAction({ action: 'anonymize', userId: member.id })
    if (error) {
      pushError(`Could not delete account: ${error}`)
    } else {
      // Le compte est anonymisé → on le retire de la liste admin (les posts restent côté feed)
      setMembers(prev => prev.filter(m => m.id !== member.id))
      pushSuccess(`Account anonymized — content preserved.`)
    }
    setAnonymizing(false)
    setConfirmDelete(null)
  }

  const saveScore = useCallback(async (id: string) => {
    const val = parseInt(editPoints[id] ?? '', 10)
    if (isNaN(val) || val < 0) {
      pushError('Points must be a positive number', 'warn')
      return
    }
    setSavingScoring(id)
    setScoringMsg(null)
    const { error } = await adminAction({ action: 'save-score', scoreId: id, points: val })
    if (error) {
      pushError(`Scoring save failed: ${error}`)
    } else {
      setScoring(prev => prev.map(r => r.id === id ? { ...r, points: val } : r))
      setScoringMsg('Saved ✓')
      setTimeout(() => setScoringMsg(null), 2000)
    }
    setSavingScoring(null)
  }, [editPoints])

  // Load channel requests when tab is active
  useEffect(() => {
    if (tab !== 'requests') return
    setRequestsLoading(true)
    supabase.from('channel_requests')
      .select('*, profiles!channel_requests_user_id_fkey(name, first_name, last_name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setRequests(data as unknown as typeof requests); setRequestsLoading(false) })
  }, [tab])

  const handleReview = async (reqId: string, action: 'approved' | 'rejected') => {
    setReviewingId(reqId)
    const req = requests.find(r => r.id === reqId)
    if (!req) { setReviewingId(null); return }

    const channelData = action === 'approved' ? {
      id: req.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40),
      emoji: req.emoji, name: req.name, description: req.description,
      is_official: false, created_by: req.user_id,
    } : null

    const { error } = await adminAction({ action: 'review-request', reqId, reqAction: action, channelData })
    if (error) {
      pushError(`Error: ${error}`)
    } else {
      setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: action } : r))
      pushSuccess(action === 'approved' ? '✓ Channel created and approved' : '✓ Request rejected')
    }
    setReviewingId(null)
  }

  const filtered = members.filter(m =>
    !search || m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.email?.toLowerCase().includes(search.toLowerCase()) ||
    m.institution?.toLowerCase().includes(search.toLowerCase())
  )

  const counts = {
    admin:       members.filter(m => m.app_role === 'admin').length,
    moderator:   members.filter(m => m.app_role === 'moderator').length,
    member:      members.filter(m => m.app_role === 'member').length,
  }

  const groupedScoring = scoring.reduce<Record<string, ScoringRow[]>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = []
    acc[r.category].push(r)
    return acc
  }, {})

  // Block render until auth is confirmed — prevents flashing member data to non-admins
  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin"/>
    </div>
  )
  if (myRole !== 'admin' && myRole !== 'moderator') return null

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-black text-slate-800">⚙️ Settings</h1>
          <p className="text-sm text-slate-400 mt-0.5">Member management and community configuration</p>
        </div>

        {/* Tab toggle — scrollable on mobile */}
        <div className="mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-1.5 bg-white border border-slate-100 rounded-2xl p-1 shadow-sm overflow-x-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {([
              { key: 'members',  label: '👥 Members',      always: true },
              { key: 'scoring',  label: '🔗 Links',         always: false },
              { key: 'branding', label: '🎨 Branding',      always: false },
              { key: 'requests', label: '📬 Requests',      always: false },
              { key: 'matching', label: '🏛️ Institutions',  always: false },
            ] as const).filter(t => t.always || myRole === 'admin').map(t => {
              const pendingCount = t.key === 'requests' ? requests.filter(r => r.status === 'pending').length : 0
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`relative flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    tab === t.key ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {t.label}
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs w-4 h-4 flex items-center justify-center font-bold leading-none">
                      {pendingCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── MEMBERS TAB ── */}
        {tab === 'members' && (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {(['admin', 'moderator', 'member'] as const).map(role => {
                const r = ROLE_LABELS[role]
                return (
                  <div key={role} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
                    <p className="text-2xl font-black" style={{ color: r.color }}>{counts[role]}</p>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">{r.label}</p>
                  </div>
                )
              })}
            </div>

            {/* Search */}
            <div className="mb-4">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, email or institution…"
                type="search" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-slate-300 bg-white" />
            </div>

            {/* Role change error */}
            {roleError && (
              <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                <span>⚠️</span>
                <p className="text-xs text-red-700 font-medium flex-1">{roleError}</p>
                <button onClick={() => setRoleError(null)} className="text-slate-400 text-xs">✕</button>
              </div>
            )}

            {/* Members table */}
            {loading ? (
              <p className="text-center text-slate-400 py-12">Loading…</p>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-xs font-bold text-slate-400 text-left px-4 py-3">Member</th>
                      <th className="text-xs font-bold text-slate-400 text-left px-4 py-3">Institution</th>
                      <th className="text-xs font-bold text-slate-400 text-center px-4 py-3">Links</th>
                      <th className="text-xs font-bold text-slate-400 text-left px-4 py-3">Role</th>
                      {myRole === 'admin' && <th className="text-xs font-bold text-slate-400 text-left px-4 py-3">Change role</th>}
                      {myRole === 'admin' && <th className="px-4 py-3"/>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(m => {
                      const r = ROLE_LABELS[m.app_role]
                      const initials = (m.name ?? '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
                      const isMe = m.id === profile?.id
                      return (
                        <tr key={m.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${isMe ? 'bg-blue-50/50' : ''} ${m.is_anonymized ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => !m.is_anonymized && router.push(`/profile/${m.id}`)}
                              style={{ background: 'none', border: 'none', padding: 0, cursor: m.is_anonymized ? 'default' : 'pointer', textAlign: 'left' }}
                              className="flex items-center gap-3 group">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
                                style={{ background: m.is_anonymized ? '#94a3b8' : '#1a3055' }}>
                                {m.is_anonymized
                                  ? initials
                                  : <AvatarImg src={m.avatar_url} alt={m.name} fallback={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                              </div>
                              <div>
                                <p className={`text-sm font-semibold ${m.is_anonymized ? 'text-slate-400 italic' : 'text-slate-800 group-hover:underline'}`}>
                                  {m.name} {isMe && <span className="text-xs text-blue-500">(you)</span>}
                                  {m.is_anonymized && <span className="text-xs text-slate-400 ml-1">(deleted account)</span>}
                                </p>
                                <p className="text-xs text-slate-400">{m.is_anonymized ? '—' : m.email}</p>
                              </div>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{m.institution ?? '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm font-bold text-amber-600">🔗 {m.links ?? 0}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold"
                              style={{ color: r.color, background: r.bg }}>
                              {r.label}
                            </span>
                          </td>
                          {myRole === 'admin' && (
                            <td className="px-4 py-3">
                              {!m.is_anonymized && (
                                <select
                                  value={m.app_role}
                                  disabled={saving === m.id}
                                  onChange={e => changeRole(m.id, e.target.value as 'admin' | 'moderator' | 'member')}
                                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none disabled:opacity-40">
                                  <option value="member">👤 Member</option>
                                  <option value="moderator">🛡 Moderator</option>
                                  <option value="admin">⚙️ Admin</option>
                                </select>
                              )}
                            </td>
                          )}
                          {myRole === 'admin' && (
                            <td className="px-4 py-3 text-right">
                              {!isMe && !m.is_anonymized && (
                                <button
                                  onClick={() => setConfirmDelete(m)}
                                  className="text-xs font-semibold text-red-400 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50">
                                  🗑 Delete
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── SCORING TAB ── */}
        {tab === 'scoring' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">🔗 Links Scale</h2>
                <p className="text-xs text-slate-400 mt-0.5">Adjust the points awarded for each action. Changes are applied immediately for new actions.</p>
              </div>
              {scoringMsg && (
                <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded-xl px-3 py-1.5">
                  {scoringMsg}
                </span>
              )}
            </div>

            {scoringLoading ? (
              <p className="text-center text-slate-400 py-12">Loading…</p>
            ) : (
              <div className="space-y-6">
                {(['onboarding', 'content', 'engagement'] as const).map(cat => {
                  const rows = groupedScoring[cat] ?? []
                  if (!rows.length) return null
                  const meta = CATEGORY_LABELS[cat]
                  return (
                    <div key={cat} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                          {meta.icon} {meta.label}
                        </h3>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {rows.map(row => (
                          <div key={row.id} className="flex items-center gap-4 px-5 py-3.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800">{row.label}</p>
                              {row.description && (
                                <p className="text-xs text-slate-400 mt-0.5 truncate">{row.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                                <span className="pl-3 text-xs text-slate-400 font-bold select-none">🔗</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="9999"
                                  value={editPoints[row.id] ?? ''}
                                  onChange={e => setEditPoints(prev => ({ ...prev, [row.id]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter') saveScore(row.id) }}
                                  className="w-20 px-2 py-2 text-sm font-bold text-slate-800 bg-transparent focus:outline-none text-center"
                                />
                              </div>
                              <button
                                onClick={() => saveScore(row.id)}
                                disabled={
                                  savingScoring === row.id ||
                                  parseInt(editPoints[row.id] ?? '') === row.points
                                }
                                className="px-3 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-40"
                                style={{ background: '#1a3055' }}>
                                {savingScoring === row.id ? '…' : 'Save'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {/* Info box */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
                  <p className="text-xs font-bold text-amber-700 mb-1">💡 How does it work?</p>
                  <p className="text-xs text-amber-600 leading-relaxed">
                    Links are credited automatically for each action via Supabase triggers.
                    Changing these values only affects <strong>new actions</strong> — already-awarded Links are not recalculated.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BRANDING TAB ── */}
        {tab === 'branding' && (
          <div>
            <div className="mb-6">
              <h2 className="text-base font-bold text-slate-800">🎨 Community Branding</h2>
              <p className="text-xs text-slate-400 mt-0.5">Customize the look of your community.</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-lg">
              <p className="text-xs font-semibold text-slate-500 mb-3">Community Logo</p>

              {/* Current logo preview */}
              <div className="flex items-center gap-4 mb-5">
                <div style={{
                  width: 80, height: 80, borderRadius: 16, background: '#1a3055',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', border: '2px solid #e2e8f0', flexShrink: 0,
                }}>
                  {currentLogoUrl
                    ? <img src={currentLogoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    : <span style={{ fontSize: 32 }}>🌐</span>
                  }
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    {currentLogoUrl ? 'Logo uploaded ✓' : 'No logo yet'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">PNG, JPG — appears in the sidebar</p>
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={savingLogo}
                    className="mt-2 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                    {savingLogo ? 'Uploading…' : '📁 Choose image'}
                  </button>
                </div>
              </div>

              {/* Hidden file input */}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setLogoError(null)
                  setSavingLogo(true)
                  const ext = file.name.split('.').pop() ?? 'png'
                  const path = `community-logo.${ext}`
                  const { error: upErr } = await supabase.storage
                    .from('avatars')
                    .upload(path, file, { upsert: true })
                  if (upErr) { setLogoError(upErr.message); setSavingLogo(false); return }
                  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
                  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`
                  await adminAction({ action: 'save-setting', key: 'community_logo_url', value: publicUrl })
                  setCurrentLogoUrl(publicUrl)
                  setSavingLogo(false)
                  setLogoSaved(true)
                  setTimeout(() => setLogoSaved(false), 2000)
                  e.target.value = ''
                }}
              />

              {logoError && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3">⚠️ {logoError}</p>}
              {logoSaved && <p className="text-xs text-green-600 bg-green-50 rounded-xl px-3 py-2">✓ Logo updated successfully!</p>}
            </div>

            {/* Community Name */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-lg mt-4">
              <p className="text-xs font-semibold text-slate-500 mb-3">Community Name</p>
              <p className="text-xs text-slate-400 mb-3">Displayed in the sidebar and PWA app name.</p>
              <div className="flex gap-2">
                <input
                  value={communityName}
                  onChange={e => setCommunityName(e.target.value)}
                  placeholder="e.g. AroundLink"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-blue-400"
                />
                <button
                  disabled={savingName || !communityName.trim()}
                  onClick={async () => {
                    setSavingName(true)
                    await adminAction({ action: 'save-setting', key: 'community_name', value: communityName.trim() })
                    setSavingName(false)
                    setNameSaved(true)
                    setTimeout(() => setNameSaved(false), 2000)
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40 transition-all">
                  {savingName ? 'Saving…' : 'Save'}
                </button>
              </div>
              {nameSaved && <p className="text-xs text-green-600 bg-green-50 rounded-xl px-3 py-2 mt-2">✓ Name updated!</p>}
            </div>
          </div>
        )}

        {/* ── MATCHING / INSTITUTIONS TAB ── */}
        {tab === 'matching' && (() => {
          const verified   = members.filter(m => m.institution_verified)
          const unverified = members.filter(m => !m.institution_verified && m.institution)
          const noInst     = members.filter(m => !m.institution)
          const MemberRow2 = ({ m, badge }: { m: MemberRow; badge: React.ReactNode }) => (
            <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#1a3055' }}>
                {(m.name ?? '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{m.name}</p>
                <p className="text-xs text-slate-400 truncate">{m.institution ?? <em>—</em>}</p>
              </div>
              <div className="text-xs text-slate-400 hidden sm:block truncate max-w-[160px]">{m.email}</div>
              {badge}
            </div>
          )
          return (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-3 mb-2">
                {[
                  { label: '✅ Verified', count: verified.length, color: '#16a34a', bg: '#f0fdf4' },
                  { label: '⚠️ Unverified', count: unverified.length, color: '#d97706', bg: '#fffbeb' },
                  { label: '➖ No institution', count: noInst.length, color: '#64748b', bg: '#f8fafc' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border p-3 text-center" style={{ background: s.bg, borderColor: s.bg }}>
                    <p className="text-xl font-black" style={{ color: s.color }}>{s.count}</p>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Verified */}
              {verified.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-3">✅ Verified institutional email ({verified.length})</p>
                  {verified.map(m => <MemberRow2 key={m.id} m={m} badge={<span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 flex-shrink-0">✓ Verified</span>}/>)}
                </div>
              )}

              {/* Unverified — has institution but not email-matched */}
              {unverified.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3">⚠️ Institution set, not verified ({unverified.length})</p>
                  {unverified.map(m => <MemberRow2 key={m.id} m={m} badge={<span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 flex-shrink-0">Manual</span>}/>)}
                </div>
              )}

              {/* No institution */}
              {noInst.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">➖ No institution ({noInst.length})</p>
                  {noInst.map(m => <MemberRow2 key={m.id} m={m} badge={<span className="text-xs font-semibold text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5 flex-shrink-0">—</span>}/>)}
                </div>
              )}
            </div>
          )
        })()}

        {/* ── REQUESTS TAB ── */}
        {tab === 'requests' && (
          <div>
            <div className="mb-6">
              <h2 className="text-base font-bold text-slate-800">📬 Channel Requests</h2>
              <p className="text-xs text-slate-400 mt-0.5">Channel creation requests from members.</p>
            </div>

            {requestsLoading && <p className="text-sm text-slate-400">Loading…</p>}

            {!requestsLoading && requests.length === 0 && (
              <div className="text-center py-16">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm font-semibold text-slate-600">No requests yet</p>
              </div>
            )}

            {!requestsLoading && requests.length > 0 && (
              <div className="space-y-3">
                {requests.map(req => {
                  const p = req.profiles
                  const requesterName = p ? (`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.name || 'Member') : 'Member'
                  const isPending = req.status === 'pending'
                  return (
                    <div key={req.id} className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-4 ${
                      isPending ? 'border-slate-100' : req.status === 'approved' ? 'border-green-100 bg-green-50/30' : 'border-red-100 bg-red-50/20'
                    }`}>
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: '#eef6ff' }}>
                        {req.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm">#{req.name}</p>
                        {req.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{req.description}</p>}
                        <p className="text-xs text-slate-400 mt-1">
                          By <span className="font-semibold">{requesterName}</span> · {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        {isPending ? (
                          <>
                            <button
                              onClick={() => handleReview(req.id, 'rejected')}
                              disabled={reviewingId === req.id}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 transition-all">
                              ✕ Reject
                            </button>
                            <button
                              onClick={() => handleReview(req.id, 'approved')}
                              disabled={reviewingId === req.id}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-40 transition-all"
                              style={{ background: '#1a3055' }}>
                              {reviewingId === req.id ? '…' : '✓ Approve'}
                            </button>
                          </>
                        ) : (
                          <span className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
                            req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-500'
                          }`}>
                            {req.status === 'approved' ? '✓ Approved' : '✕ Rejected'}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Modale confirmation suppression ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <p className="text-lg font-black text-slate-800 mb-1">Delete this account?</p>
            <p className="text-sm text-slate-500 mb-4">
              Personal data of <strong>{confirmDelete.name}</strong> will be deleted.
              Their posts and comments will remain visible under the name <em>"Deleted member"</em>.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
              <p className="text-xs text-amber-700 font-semibold">⚠️ This action is irreversible.</p>
              <p className="text-xs text-amber-600 mt-0.5">The user will no longer be able to sign in.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={anonymizing}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                Cancel
              </button>
              <button
                onClick={() => anonymizeUser(confirmDelete)}
                disabled={anonymizing}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-40 transition-all">
                {anonymizing ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  )
}
