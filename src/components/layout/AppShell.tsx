'use client'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import RightPanel from './RightPanel'
import BottomNav from './BottomNav'
import { useAuth } from '@/lib/hooks/useAuth'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { useChannels } from '@/lib/hooks/useChannels'
import { useConversations } from '@/lib/hooks/useDirectMessages'
import { useEffect, useState } from 'react'
import InstitutionVerificationPopup from '@/components/ui/InstitutionVerificationPopup'
import PushPrompt from '@/components/ui/PushPrompt'
import { registerServiceWorker, isPushSupported, hasPushBeenAsked } from '@/lib/push'

const RIGHT_PANEL_PAGES = ['/feed', '/channels']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { profile, loading, user, emailVerified, signOut } = useAuth()
  const [globalSearch, setGlobalSearch] = useState('')
  const [showPushPrompt, setShowPushPrompt] = useState(false)
  const notif = useNotifications(user?.id)
  const { channels } = useChannels(user?.id)
  const { totalUnread: dmUnread } = useConversations(user?.id)

  const showRp = RIGHT_PANEL_PAGES.some(p => pathname.startsWith(p))

  // Redirect dans un useEffect — jamais pendant le render
  useEffect(() => {
    if (loading) return
    if (!user && !pathname.startsWith('/auth')) {
      router.replace('/auth')
    }
  }, [loading, user, pathname])

  // Register service worker once user is logged in
  useEffect(() => {
    if (!user) return
    registerServiceWorker()
  }, [user?.id])

  // Sync app icon badge with total unread count (iOS 16.4+ PWA, Chrome/Android)
  const totalBadge = notif.totalUnread + dmUnread
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return
    if (totalBadge > 0) {
      navigator.setAppBadge(totalBadge).catch(() => {})
    } else {
      navigator.clearAppBadge().catch(() => {})
    }
  }, [totalBadge])

  // Show push prompt once after login (with a short delay so the app feels settled)
  useEffect(() => {
    if (!user || loading) return
    if (!isPushSupported()) return
    if (hasPushBeenAsked()) return
    const t = setTimeout(() => setShowPushPrompt(true), 3000)
    return () => clearTimeout(t)
  }, [user?.id, loading])

  const handleSearch = (q: string) => {
    setGlobalSearch(q)
    if (pathname.startsWith('/network') && q) {
      router.push(`/network?q=${encodeURIComponent(q)}`)
    } else if (pathname.startsWith('/network') && !q) {
      router.push('/network')
    }
  }

  // Spinner pendant le chargement initial
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8f9fc' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '2px solid #1a3055', borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite'
        }}/>
        <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>Loading AroundLink…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  // Pas connecté → écran blanc pendant la redirection (useEffect s'en charge)
  if (!user) return null

  // Email non vérifié (uniquement pour les comptes email, pas OAuth)
  if (!emailVerified && !pathname.startsWith('/profile') && !pathname.startsWith('/auth')) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8f9fc', padding: 24 }}>
        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', padding: 32, maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#1a3055', marginBottom: 8 }}>Verify your email address</h1>
          <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 16 }}>
            A confirmation email has been sent to <strong style={{ color: '#1a3055' }}>{user.email}</strong>.<br/>
            Click the link to activate your account.
          </p>
          <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 12, padding: '10px 16px', marginBottom: 20, fontSize: 12, color: '#92400e' }}>
            💡 Don't forget to check your spam folder.
          </div>
          <button onClick={() => router.push('/profile')}
            style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginRight: 8 }}>
            My profile
          </button>
          <button onClick={() => signOut().then(() => router.push('/auth'))}
            style={{ background: 'none', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#f8f9fc', minHeight: '100vh' }}>
      {/* Institution verification popup — shown once for unverified members */}
      {user && !profile?.institution_verified && (
        <InstitutionVerificationPopup
          userId={user.id}
          email={user.email}
          institutionVerified={profile?.institution_verified ?? false}
          currentInstitution={profile?.institution ?? null}
        />
      )}
      <Sidebar dmUnread={dmUnread}/>
      <TopBar globalSearch={globalSearch} onGlobalSearch={handleSearch} profile={profile} notif={notif} channels={channels}/>
      {showRp && <RightPanel profile={profile}/>}
      <div className={`main-wrap${showRp ? ' has-rp' : ''}`}>
        {children}
      </div>
      <BottomNav dmUnread={dmUnread}/>
      {/* Push notification opt-in prompt — shown once, 3 s after login */}
      {showPushPrompt && user && (
        <PushPrompt userId={user.id} onDone={() => setShowPushPrompt(false)} />
      )}
    </div>
  )
}
