'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useStats } from '@/lib/hooks/useStats'
import { useSidebarData } from '@/lib/hooks/useSidebarData'
import { createClient } from '@/lib/supabase/client'
import { isPushSupported, markPushAsked, PUSH_PROMPT_KEY } from '@/lib/push'
import AvatarImg from '@/components/ui/AvatarImg'
import { QRCodeCanvas } from 'qrcode.react'

export default function ProfilePage() {
  const { user, profile, loading, emailVerified, updateProfile, signOut } = useAuth()
  const { myChannelIds } = useSidebarData(user?.id)
  const { stats } = useStats(user?.id)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const isLinkedInLinked = user?.identities?.some((i: any) => i.provider === 'linkedin_oidc') ?? false
  const isEmailVerified  = emailVerified

  const [linkedInError,   setLinkedInError]   = useState<string | null>(null)
  const [linkingLinkedIn, setLinkingLinkedIn] = useState(false)
  const [sendingVerif,    setSendingVerif]    = useState(false)
  const [verifSent,       setVerifSent]       = useState(false)
  const [verifError,      setVerifError]      = useState<string | null>(null)
  const [pushStatus,      setPushStatus]      = useState<'unknown' | 'granted' | 'denied' | 'unsupported'>('unknown')
  const [enablingPush,    setEnablingPush]    = useState(false)
  const [pushSuccess,     setPushSuccess]     = useState(false)
  const [hasDbSub,        setHasDbSub]        = useState(false)
  const [pushError,       setPushError]       = useState<string | null>(null)

  useEffect(() => {
    if (!isPushSupported()) { setPushStatus('unsupported'); return }
    const p = Notification.permission
    if (p === 'denied') { setPushStatus('denied'); return }
    // Check if subscription actually exists in DB
    if (!user?.id) return
    supabase.from('push_subscriptions').select('endpoint', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count }) => {
        const hasSub = (count ?? 0) > 0
        setHasDbSub(hasSub)
        if (p === 'granted' && hasSub) setPushStatus('granted')
        else setPushStatus('unknown')
      })
  }, [user?.id])

  const handleEnablePush = async () => {
    if (!user) return
    setEnablingPush(true)
    setPushError(null)
    localStorage.removeItem(PUSH_PROMPT_KEY)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setPushError(`Permission denied (${permission}). Please allow notifications in your settings.`)
        setPushStatus('denied')
        setEnablingPush(false)
        return
      }
      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        setPushError('Push notifications are not configured. Please contact support.')
        setEnablingPush(false)
        return
      }
      const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4)
      const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/')
      const raw = atob(base64)
      const applicationServerKey = Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      const { error } = await supabase.from('push_subscriptions').upsert(
        { user_id: user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
        { onConflict: 'user_id,endpoint' }
      )
      if (error) throw new Error(`DB: ${error.message}`)
      markPushAsked()
      setHasDbSub(true)
      setPushStatus('granted')
      setPushSuccess(true)
      setTimeout(() => setPushSuccess(false), 3000)
    } catch (e: any) {
      setPushError(`Erreur: ${e?.message ?? String(e)}`)
    } finally {
      setEnablingPush(false)
    }
  }

  const handleSendVerification = async () => {
    if (!user?.email) return
    setSendingVerif(true)
    setVerifError(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email: user.email })
    setSendingVerif(false)
    if (error) { setVerifError(error.message) }
    else { setVerifSent(true); setTimeout(() => setVerifSent(false), 5000) }
  }

  const handleLinkLinkedIn = async () => {
    setLinkedInError(null)
    setLinkingLinkedIn(true)
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'linkedin_oidc',
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/profile` }
      })
      if (error) {
        if (error.message.toLowerCase().includes('manual linking')) {
          setLinkedInError('Active "Allow manual linking" dans Supabase → Authentication → Settings')
        } else {
          setLinkedInError(error.message)
        }
      }
      // Si pas d'erreur : Supabase redirige automatiquement vers LinkedIn
    } catch (e: any) {
      setLinkedInError(e?.message ?? 'Unknown error')
    } finally {
      setLinkingLinkedIn(false)
    }
  }
  // Fetch live channel data for joined channels (not hardcoded constant)
  const [myChannels, setMyChannels] = useState<{ id: string; name: string; emoji: string | null }[]>([])
  useEffect(() => {
    if (!myChannelIds || myChannelIds.length === 0) return
    const ids = [...myChannelIds]
    supabase
      .from('channels')
      .select('id, name, emoji')
      .in('id', ids)
      .then(({ data }) => { if (data) setMyChannels(data) })
  }, [myChannelIds])

  const myRole = profile?.app_role ?? 'member'

  const [firstName,     setFirstName]     = useState('')
  const [lastName,      setLastName]      = useState('')
  const [institution,   setInstitution]   = useState('')
  const [universityId,  setUniversityId]  = useState<number | null>(null)
  const [role,          setRole]          = useState('')
  // personal_email removed
  const [editing,             setEditing]             = useState(false)
  const [saving,              setSaving]              = useState(false)
  const [saveError,           setSaveError]           = useState<string | null>(null)
  const [detectedInstitution, setDetectedInstitution] = useState<string | null>(null)
  const [institutionVerified, setInstitutionVerified] = useState(false)
  const [institutionSuggestions, setInstitutionSuggestions] = useState<{ id: number; display_name: string; city: string | null; country_name: string | null; flag: string | null }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [copied,        setCopied]        = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError,    setPhotoError]    = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Delete account
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')
  const [deletingAccount,   setDeletingAccount]   = useState(false)
  const [deleteError,       setDeleteError]       = useState<string | null>(null)
  const [deleteStep,        setDeleteStep]        = useState<'confirm' | 'done'>('confirm')

  const handleDeleteAccount = async () => {
    setDeleteError(null)
    if (deleteConfirmEmail.trim().toLowerCase() !== user?.email?.toLowerCase()) {
      setDeleteError('The email address does not match your account email.')
      return
    }
    setDeletingAccount(true)
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Deletion failed')
      }
      setDeleteStep('done')
      // Sign out après 3 s
      setTimeout(() => signOut(), 3000)
    } catch (e: any) {
      setDeleteError(e.message ?? 'An error occurred. Please try again.')
    } finally {
      setDeletingAccount(false)
    }
  }

  // supabase alias removed — using shared supabase instance

  const detectInstitutionFromEmail = async (email: string): Promise<{ name: string; domain: string; domainNorm: string } | null> => {
    try {
      const { normalizeDomain } = await import('@/lib/utils/normalizeDomain')
      const domain = email.split('@')[1]
      if (!domain) return null
      // Free/personal email providers — skip detection
      const freeProviders = ['gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','live.com','proton.me','protonmail.com','free.fr','orange.fr','sfr.fr','laposte.net']
      if (freeProviders.includes(domain.toLowerCase())) return null
      const domainNorm = normalizeDomain(domain)
      const res = await fetch(`https://universities.hipolabs.com/search?domain=${domain}`)
      if (!res.ok) return null
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0 && data[0].name) return { name: data[0].name as string, domain, domainNorm }
      // Not in hipolabs → still flag the domain so admin can see it
      return { name: '', domain, domainNorm }
    } catch {
      return null
    }
  }

  useEffect(() => {
    if (!profile) return
    setFirstName(profile?.first_name ?? profile.name?.split(' ')[0] ?? '')
    setLastName(profile?.last_name  ?? profile.name?.split(' ').slice(1).join(' ') ?? '')
    setInstitution(profile.institution ?? '')
    setUniversityId(profile?.university_id ?? null)
    setRole(profile?.role ?? '')

    // Already verified in DB → just reflect it
    if (profile?.institution_verified) {
      setInstitutionVerified(true)
    } else if (user?.email) {
      detectInstitutionFromEmail(user.email).then(async result => {
        if (!result) return
        const { name, domainNorm } = result

        if (name) {
          // Known university → auto-set + auto-save if institution was empty
          setDetectedInstitution(name)
          setInstitutionVerified(true)
          // Tente de rattacher aussi la fiche ROR (seulement si correspondance EXACTE,
          // pour ne jamais poser un mauvais university_id automatiquement).
          const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
          const { data: uniMatches } = await supabase.rpc('search_universities', { q: name, lim: 1 })
          const matchedUniId: number | null = uniMatches?.[0] && norm(uniMatches[0].display_name) === norm(name)
            ? uniMatches[0].id : null
          if (!profile.institution) {
            setInstitution(name)
            if (matchedUniId) setUniversityId(matchedUniId)
            await supabase.from('profiles').update({
              institution: name,
              university_id: matchedUniId,
              institution_verified: true,
              institution_domain: domainNorm,   // normalized: neoma-bs.fr → neoma-bs
            }).eq('id', user.id)
          } else if (profile.institution.toLowerCase() === name.toLowerCase()) {
            // Already set correctly → just mark verified
            await supabase.from('profiles').update({
              institution_verified: true,
              institution_domain: domainNorm,
            }).eq('id', user.id)
          }
        } else if (domainNorm) {
          // Institutional domain but not in hipolabs → store normalized domain
          await supabase.from('profiles').update({
            institution_domain: domainNorm,
          }).eq('id', user.id)
        }
      })
    }
  }, [profile])

  const fetchInstitutionSuggestions = async (q: string) => {
    if (!q.trim() || q.length < 2) { setInstitutionSuggestions([]); return }
    // Recherche ROR robuste : accent-insensible + multi-mots (RPC search_universities)
    const { data } = await supabase.rpc('search_universities', { q, lim: 8 })
    setInstitutionSuggestions((data ?? []) as typeof institutionSuggestions)
  }

  const handleSave = async () => {
    setSaveError(null)
    // On encourage à choisir dans la liste ROR (drapeau + dédoublonnage), mais le
    // texte libre est autorisé en secours pour les organisations hors ROR
    // (écoles, entreprises, ONG…) qui n'y figurent pas.
    setSaving(true)
    const fullName = `${firstName} ${lastName}`.trim()
    try {
      const result = await updateProfile({
        name: fullName,
        first_name: firstName,
        last_name: lastName,
        institution,
        university_id: universityId,
        institution_verified: institutionVerified,
        role,
      } as Partial<import('@/lib/supabase/supabase/types').Profile> & { institution_verified?: boolean })
      if (!result) {
        setSaveError('Could not save — please try again')
      } else {
        setEditing(false)
      }
    } catch (e: any) {
      setSaveError(e?.message ?? 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth')
  }

  const displayName = profile
    ? `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || profile.name
    : '—'
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  const links = profile?.links ?? 0
  const RANK_LABEL = links >= 500 ? '🏆 Expert' : links >= 300 ? '⭐ Contributor' : links >= 100 ? '🌱 Member' : '👋 Newcomer'

  // Referral
  const referralCode = profile?.referral_code ?? null
  type ReferredUser = { id: string; name: string | null; first_name: string | null; last_name: string | null; avatar_url: string | null; institution: string | null; created_at: string }
  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([])
  const [commentsCount, setCommentsCount] = useState(0)

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('referrals')
      .select('referee_id, profiles!referrals_referee_id_fkey(name, first_name, last_name, avatar_url, institution, created_at)')
      .eq('referrer_id', user.id)
      .then(({ data }) => {
        if (data) setReferredUsers(
          data.map((r: any) => r.profiles ? { id: r.referee_id, ...r.profiles } : null).filter(Boolean) as ReferredUser[]
        )
      })
    // Comments count
    supabase
      .from('channel_post_comments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => { if (count !== null) setCommentsCount(count) })
  }, [user?.id])
  const referralLink = referralCode
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://aroundlink.com'}/auth?ref=${referralCode}`
    : null
  const handleCopy = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // QR code d'affiliation — téléchargement en PNG (QR + code en dessous)
  const qrRef = useRef<HTMLDivElement>(null)
  const handleDownloadQr = () => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const exportCanvas = document.createElement('canvas')
    const padding = 24
    const labelHeight = 40
    exportCanvas.width = canvas.width + padding * 2
    exportCanvas.height = canvas.height + padding * 2 + labelHeight
    const ctx = exportCanvas.getContext('2d')
    if (!ctx) return
    // Fond blanc
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
    // QR code
    ctx.drawImage(canvas, padding, padding)
    // Code texte en dessous
    ctx.fillStyle = '#1a3055'
    ctx.font = 'bold 14px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(`Code: ${referralCode}`, exportCanvas.width / 2, canvas.height + padding + 24)
    // Téléchargement
    const link = document.createElement('a')
    link.download = `aroundlink-ref-${referralCode}.png`
    link.href = exportCanvas.toDataURL('image/png')
    link.click()
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('Only image files are allowed.')
      e.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image must be under 5 MB.')
      e.target.value = ''
      return
    }
    setUploadingPhoto(true)
    setPhotoError(null)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(`${user.id}/avatar.${ext}`, file, { upsert: true })
      if (error) {
        setPhotoError(error.message)
      } else {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(`${user.id}/avatar.${ext}`)
        await updateProfile({ avatar_url: urlData.publicUrl })
      }
    } catch (err: any) {
      setPhotoError(err?.message ?? 'Upload failed')
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
    }
  }

  // Profile completion
  const completionItems: { label: string; done: boolean; info?: string }[] = [
    { label: 'Full name',             done: !!(profile && (profile?.first_name || profile.name)) },
    { label: 'Professional email',    done: !!user?.email },
    { label: 'Institution',           done: !!profile?.institution },
    { label: 'Role',                  done: !!profile?.role },
    { label: 'LinkedIn',              done: isLinkedInLinked || !!profile?.linkedin },
    { label: 'Profile photo',         done: !!profile?.avatar_url },
  ]
  const completionPct = Math.round((completionItems.filter(i => i.done).length / completionItems.length) * 100)

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Profile Card (full width) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white overflow-hidden"
                style={{ background: '#1a3055' }}>
                <AvatarImg src={profile?.avatar_url} alt={displayName} fallback={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-slate-800">{displayName}</h1>
              <p className="text-sm text-slate-400">
                {[profile?.institution, profile?.role].filter(Boolean).join(' · ')}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
                  🔗 {links} Links
                </span>
                <span className="text-xs text-slate-400">{RANK_LABEL}</span>
                {profile?.linkedin && (
                  <a href={profile?.linkedin} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline">💼 LinkedIn</a>
                )}
              </div>
            </div>
            <button onClick={() => setEditing(e => !e)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 flex-shrink-0">
              {editing ? 'Cancel' : '✏️ Edit'}
            </button>
          </div>

          {/* Email */}
          <div className="bg-slate-50 rounded-xl px-4 py-3 mb-3">
            <div className="flex items-center gap-3">
              {/* Icône mail */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700">Email</p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
              {verifSent ? (
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 flex-shrink-0">✉️ Sent!</span>
              ) : !isEmailVerified ? (
                <button onClick={handleSendVerification} disabled={sendingVerif}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 flex-shrink-0">
                  {sendingVerif ? '…' : 'Verify email'}
                </button>
              ) : null}
            </div>
            {verifError && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 mt-2">⚠️ {verifError}</p>}
          </div>

          {/* LinkedIn linking */}
          <div className="bg-slate-50 rounded-xl px-4 py-3 mb-3">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2" style={{ flexShrink: 0 }}><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700">LinkedIn</p>
                <p className="text-xs text-slate-400">{isLinkedInLinked ? 'Account connected' : 'Not connected'}</p>
              </div>
              {isLinkedInLinked
                ? <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 flex-shrink-0">✓ Connected</span>
                : <button onClick={handleLinkLinkedIn} disabled={linkingLinkedIn}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50 flex-shrink-0 disabled:opacity-40">
                    {linkingLinkedIn ? '…' : '💼 Link LinkedIn'}
                  </button>
              }
            </div>
            {linkedInError && (
              <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 mt-2">⚠️ {linkedInError}</p>
            )}
          </div>

          {/* Push Notifications */}
          <div className="bg-slate-50 rounded-xl px-4 py-3 mb-3">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700">Notifications</p>
                <p className="text-xs text-slate-400">
                  {pushStatus === 'granted'     ? 'Enabled'
                  : pushStatus === 'denied'     ? 'Blocked in browser'
                  : pushStatus === 'unsupported'? 'Not supported on this device'
                  : 'Not enabled'}
                </p>
              </div>
              {pushStatus === 'granted' && (
                pushSuccess
                  ? <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 flex-shrink-0">✓ Enabled!</span>
                  : <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 flex-shrink-0">✓ Active</span>
              )}
              {pushStatus === 'denied' && (
                <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 flex-shrink-0">Blocked</span>
              )}
              {(pushStatus === 'unknown') && (
                <button onClick={handleEnablePush} disabled={enablingPush}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 flex-shrink-0">
                  {enablingPush ? '…' : '🔔 Enable'}
                </button>
              )}
            </div>
            {pushStatus === 'denied' && (
              <p className="text-xs text-orange-700 bg-orange-50 rounded-xl px-3 py-2 mt-2">
                ⚠️ Notifications are blocked. Go to your browser settings to re-enable them.
              </p>
            )}
            {pushError && (
              <p className="text-xs text-red-700 bg-red-50 rounded-xl px-3 py-2 mt-2 break-all">
                ⚠️ {pushError}
              </p>
            )}
          </div>

          {/* Profile Photo */}
          <div className="bg-slate-50 rounded-xl px-4 py-3 mb-3">
            <p className="text-xs text-slate-400 mb-2">Profile Photo</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black text-white overflow-hidden flex-shrink-0"
                style={{ background: '#1a3055' }}>
                <AvatarImg src={profile?.avatar_url} alt={displayName} fallback={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div>
                <input
                  type="file"
                  accept="image/*"
                  ref={photoInputRef}
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-50">
                  {uploadingPhoto ? 'Uploading…' : '📷 Change photo'}
                </button>
                {photoError && (
                  <p className="text-xs text-red-600 mt-1">⚠️ {photoError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Edit Form */}
          {editing && (
            <div className="space-y-3 mt-3 border-t border-slate-100 pt-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-500 block mb-1">First name</label>
                  <input value={firstName} onChange={e => setFirstName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-slate-300"
                    placeholder="Julie" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Last name</label>
                  <input value={lastName} onChange={e => setLastName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-slate-300"
                    placeholder="Renard" />
                </div>
              </div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-xs font-semibold text-slate-500">Institution</label>
                  {institutionVerified && (
                    <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">✓ Verified</span>
                  )}
                </div>
                <input
                  value={institution}
                  onChange={e => {
                    setInstitution(e.target.value)
                    setUniversityId(null) // reset if user types manually
                    setShowSuggestions(true)
                    fetchInstitutionSuggestions(e.target.value)
                  }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onFocus={() => { if (institution.length >= 2) setShowSuggestions(true) }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-slate-300"
                  placeholder="Search your university…" />
                {/* Autocomplete dropdown */}
                {showSuggestions && institutionSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 overflow-hidden" style={{ maxHeight: 240, overflowY: 'auto' }}>
                    {institutionSuggestions.map(u => (
                      <button key={u.id} type="button"
                        onMouseDown={() => {
                          setInstitution(u.display_name)
                          setUniversityId(u.id)
                          setShowSuggestions(false)
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-center gap-2">
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{u.flag ?? '🏛️'}</span>
                        <div style={{ minWidth: 0 }}>
                          <p className="text-sm font-semibold text-slate-800 truncate">{u.display_name}</p>
                          {(u.city || u.country_name) && (
                            <p className="text-xs text-slate-400 truncate">{[u.city, u.country_name].filter(Boolean).join(', ')}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {detectedInstitution && !profile?.institution && (
                  <p className="text-xs text-green-600 mt-1">✓ Automatically detected from your institutional email</p>
                )}
                {universityId !== null ? (
                  <p className="text-xs text-green-600 mt-1">✓ Linked to the official directory</p>
                ) : institution.trim().length >= 2 && (
                  <p className="text-xs text-slate-400 mt-1">💡 If your institution is in the list, pick it to add its flag — otherwise your text is saved as is.</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Role</label>
                <input value={role} onChange={e => setRole(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-slate-300"
                  placeholder="International Relations Officer" />
              </div>
              {saveError && (
                <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">⚠️ {saveError}</p>
              )}
              <button onClick={handleSave} disabled={saving}
                className="w-full py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50"
                style={{ background: '#1a3055' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {/* 2-column grid: Stats LEFT · Completion RIGHT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

          {/* LEFT — Stats */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-700 mb-3">📊 My statistics</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Feed posts',      value: stats.feed_posts,       icon: '📰' },
                { label: 'Messages',        value: stats.channel_messages, icon: '💬' },
                { label: 'Comments',         value: commentsCount,          icon: '🗨️' },
                { label: 'Files shared',    value: stats.files_shared,     icon: '📎' },
                { label: 'Likes given',     value: stats.likes_given,      icon: '👍' },
                { label: 'Referred',         value: referredUsers.length,   icon: '🤝' },
              ].map(item => (
                <div key={item.label} className="bg-slate-50 rounded-xl p-3 flex flex-col gap-1">
                  <span className="text-lg">{item.icon}</span>
                  <p className="text-lg font-black text-slate-800 leading-none">{item.value}</p>
                  <p className="text-xs text-slate-400 leading-tight">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — Profile Completion */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-700">🧩 Profile completion</h2>
              <span className="text-sm font-black" style={{ color: completionPct === 100 ? '#16a34a' : '#1a3055' }}>
                {completionPct}%
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${completionPct}%`, background: completionPct === 100 ? '#16a34a' : '#1a3055' }}/>
            </div>
            <div className="space-y-2">
              {completionItems.map(item => (
                <div key={item.label} className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-green-500' : 'border-2 border-slate-200'}`}>
                    {item.done && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                  <span className={`text-sm ${item.done ? 'text-slate-600' : 'text-slate-400'}`}>{item.label}</span>
                  {item.info && (
                    <div className="group relative ml-0.5">
                      <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-400 text-xs flex items-center justify-center cursor-help font-bold leading-none border border-slate-200">i</span>
                      <div className="absolute left-5 top-0 hidden group-hover:block bg-slate-800 text-white text-xs rounded-xl px-3 py-2 z-50 w-60 shadow-xl">
                        {item.info}
                      </div>
                    </div>
                  )}
                  {!item.done && (
                    <button onClick={() => setEditing(true)}
                      className="ml-auto text-xs font-semibold text-blue-600 hover:underline">
                      Add →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Referral */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
          <h2 className="text-sm font-bold text-slate-700 mb-1">🤝 Referral</h2>
          <p className="text-xs text-slate-400 mb-3">
            Share your unique link — you earn <span className="font-semibold text-amber-600">150 Links</span> for every new member who signs up through your link.
          </p>
          {referralLink ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div ref={qrRef} style={{ padding: 16, background: 'white', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                <QRCodeCanvas value={referralLink} size={180} level="M" marginSize={0} />
              </div>
              <p className="text-xs text-slate-400 text-center">
                Scan this QR code to join AroundLink Community
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleCopy}
                  className="px-3 py-2.5 rounded-xl text-xs font-bold border transition-all"
                  style={copied
                    ? { background: '#16a34a', color: 'white', borderColor: '#16a34a' }
                    : { background: 'white', color: '#1a3055', borderColor: '#e2e8f0' }}>
                  {copied ? '✓ Copied!' : '📋 Copy link'}
                </button>
                <button
                  onClick={handleDownloadQr}
                  className="px-3 py-2.5 rounded-xl text-xs font-bold border transition-all"
                  style={{ background: '#1a3055', color: 'white', borderColor: '#1a3055' }}>
                  ⬇ Download QR
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Code: <span className="font-mono font-semibold text-slate-600">{referralCode ?? '—'}</span>
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Your referral code is being generated…</p>
          )}

          {/* Referred members list */}
          {referredUsers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                👥 Referred members ({referredUsers.length})
              </p>
              <div className="space-y-2">
                {referredUsers.map((u, i) => {
                  const uName = u.first_name || u.last_name
                    ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
                    : u.name ?? 'Member'
                  const uInitials = uName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?'
                  return (
                    <button key={i} onClick={() => router.push(`/profile/${u.id}`)}
                      className="flex items-center gap-3 w-full text-left hover:bg-slate-50 rounded-xl px-1 py-1 -mx-1 transition-colors">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
                        style={{ background: '#1a3055' }}>
                        <AvatarImg src={u.avatar_url} alt={uName} fallback={uInitials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{uName}</p>
                        {u.institution && <p className="text-xs text-slate-400 truncate">{u.institution}</p>}
                      </div>
                      <p className="text-xs text-slate-400 flex-shrink-0">
                        {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Admin link */}
        {(myRole === 'admin' || myRole === 'moderator') && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-4">
            <button onClick={() => router.push('/admin')}
              className="w-full flex items-center gap-3 text-left">
              <span className="text-xl">⚙️</span>
              <div>
                <p className="text-sm font-bold text-slate-800">Member management</p>
                <p className="text-xs text-slate-400">Manage roles and permissions</p>
              </div>
              <span className="ml-auto text-slate-400 text-sm">→</span>
            </button>
          </div>
        )}

        {/* My channels */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
          <h2 className="text-sm font-bold text-slate-700 mb-3">💬 My channels <span className="text-slate-400 font-normal">({myChannels.length})</span></h2>
          {myChannels.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-slate-400">You haven't joined any channel yet</p>
              <button onClick={() => router.push('/channels')}
                className="mt-2 text-xs font-semibold text-blue-600 hover:underline">
                Explore channels →
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {myChannels.map(ch => (
                <button key={ch.id} onClick={() => router.push(`/channels/${ch.id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100">
                  {ch.emoji ?? null} #{ch.name}
                </button>
              ))}
              <button onClick={() => router.push('/channels')}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-600 hover:underline">
                + See more →
              </button>
            </div>
          )}
        </div>

        {/* Sign out */}
        <div className="text-center mb-6">
          <button onClick={handleSignOut}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-all">
            Sign out
          </button>
        </div>

        {/* ── Danger zone ── */}
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5 mb-6">
          <h2 className="text-sm font-bold text-red-500 mb-1 flex items-center gap-2">
            <span>⚠️</span> Danger zone
          </h2>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Deleting your account is permanent. Your profile and personal data will be removed. Your posts will remain anonymously in the community.
          </p>
          <button
            onClick={() => { setShowDeleteAccount(true); setDeleteStep('confirm'); setDeleteConfirmEmail(''); setDeleteError(null) }}
            className="w-full py-2.5 rounded-xl text-sm font-semibold border border-red-300 text-red-500 hover:bg-red-50 transition-all">
            Delete my account
          </button>
        </div>

      </div>

      {/* ── Modal suppression de compte ── */}
      {showDeleteAccount && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 24, padding: 32, maxWidth: 420, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
            {deleteStep === 'done' ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>✅</p>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1a3055', margin: '0 0 8px' }}>Account deleted</h2>
                <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                  Your account has been permanently deleted. A confirmation email has been sent to you. You will be signed out in a few seconds.
                </p>
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <p style={{ fontSize: 36, marginBottom: 8 }}>🗑️</p>
                  <h2 style={{ fontSize: 17, fontWeight: 800, color: '#dc2626', margin: '0 0 6px' }}>Delete your account?</h2>
                  <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                    This action is <strong>permanent and irreversible</strong>. Your profile and personal data will be deleted. Your posts will remain anonymously.
                  </p>
                </div>
                <div style={{ background: '#fef2f2', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', margin: '0 0 8px' }}>
                    To confirm, type your email address:
                  </p>
                  <input
                    value={deleteConfirmEmail}
                    onChange={e => setDeleteConfirmEmail(e.target.value)}
                    placeholder={user?.email ?? 'your@email.com'}
                    type="email"
                    autoComplete="off"
                    style={{ width: '100%', border: '1px solid #fca5a5', borderRadius: 10, padding: '8px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: 'white' }}
                  />
                </div>
                {deleteError && (
                  <p style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                    ⚠️ {deleteError}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowDeleteAccount(false)}
                    style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, border: '1px solid #e2e8f0', color: '#64748b', background: 'white', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount || !deleteConfirmEmail.trim()}
                    style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 700, border: 'none', color: 'white', background: '#dc2626', cursor: 'pointer', opacity: (deletingAccount || !deleteConfirmEmail.trim()) ? 0.5 : 1 }}>
                    {deletingAccount ? 'Deleting…' : 'Delete permanently'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </AppShell>
  )
}
