'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}

/** Registers a referral as "pending" — points are awarded upon email confirmation */
async function processReferral(supabase: ReturnType<typeof createClient>, referralCode: string, newUserId: string) {
  try {
    const { data: referrer } = await supabase
      .from('profiles')
      .select('id')
      .eq('referral_code', referralCode)
      .single()

    if (!referrer || referrer.id === newUserId) return

    await supabase
      .from('referrals')
      .insert({ referrer_id: referrer.id, referee_id: newUserId, confirmed: false })
      .throwOnError()
  } catch (_) {
    // Silent — don't block signup
  }
}

function AuthForm() {
  const supabase     = createClient()
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [hasRef,           setHasRef]           = useState(false)
  const [mode,             setMode]             = useState<'login' | 'signup'>('signup')
  const [email,            setEmail]            = useState('')
  const [password,         setPassword]         = useState('')
  const [firstName,        setFirstName]        = useState('')
  const [lastName,         setLastName]         = useState('')
  const [showPassword,     setShowPassword]     = useState(false)
  const [rememberMe,       setRememberMe]       = useState(true)
  const [error,            setError]            = useState('')
  const [loading,          setLoading]          = useState(false)
  const [linkedinLoading,  setLinkedinLoading]  = useState(false)
  const [forgotMode,       setForgotMode]       = useState(false)
  const [forgotEmail,      setForgotEmail]      = useState('')
  const [forgotSent,       setForgotSent]       = useState(false)
  const [checkEmail,       setCheckEmail]       = useState(false)
  const [logoUrl,          setLogoUrl]          = useState<string | null>(null)
  const [acceptedTerms,    setAcceptedTerms]    = useState(false)
  const [loginAttempts,    setLoginAttempts]    = useState(0)
  const [cooldownUntil,    setCooldownUntil]    = useState<number | null>(null)

  // Referral code from URL (?ref=CODE) or sessionStorage (after OAuth redirect)
  const refCode = searchParams.get('ref')
  useEffect(() => {
    if (refCode) sessionStorage.setItem('al_ref', refCode)
    // Safe sessionStorage read (only runs client-side)
    setHasRef(!!(refCode || sessionStorage.getItem('al_ref')))
  }, [refCode])

  // Handle OAuth errors from callback
  useEffect(() => {
    const err = searchParams.get('error')
    if (err) setError(decodeURIComponent(err))
  }, [searchParams])

  // Fetch community logo
  useEffect(() => {
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'community_logo_url')
      .single()
      .then(({ data }) => { if (data?.value) setLogoUrl(data.value) })
  }, [])

  async function handleLinkedIn() {
    setLinkedinLoading(true)
    setError('')
    try {
      const ref = sessionStorage.getItem('al_ref') ?? refCode ?? ''
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'linkedin_oidc',
        options: {
          redirectTo: `${window.location.origin}/auth/callback${ref ? `?ref=${ref}` : ''}`,
          scopes: 'openid profile email',
        },
      })
      if (error) { setError(error.message); setLinkedinLoading(false); return }
      // Explicit redirect — some PWA/mobile contexts don't auto-redirect
      if (data?.url) window.location.href = data.url
    } catch (e: any) {
      setError(e?.message ?? 'LinkedIn sign-in failed. Please try again.')
      setLinkedinLoading(false)
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')

    // Check if this email has an account via server-side API (bypasses RLS safely)
    try {
      const res = await fetch('/api/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      })
      const json = await res.json()
      if (res.status === 429) {
        setLoading(false)
        setError(json.error ?? 'Too many requests. Please wait a moment.')
        return
      }
      if (!json.exists) {
        setLoading(false)
        setError('No account found with this email. Please create an account first.')
        return
      }
    } catch {
      // If the check fails, allow the reset flow to proceed (graceful degradation)
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setForgotSent(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)

    // Cooldown check (client-side brute-force protection)
    if (cooldownUntil && Date.now() < cooldownUntil) {
      const secs = Math.ceil((cooldownUntil - Date.now()) / 1000)
      setError(`Too many failed attempts. Please wait ${secs}s before trying again.`)
      setLoading(false)
      return
    }

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          const newAttempts = loginAttempts + 1
          setLoginAttempts(newAttempts)
          if (newAttempts >= 5) {
            setCooldownUntil(Date.now() + 60_000) // 60s cooldown after 5 failures
            setLoginAttempts(0)
          }
          throw error
        }
        setLoginAttempts(0)
        setCooldownUntil(null)
        // If "Stay signed in" is unchecked, remove the persisted token so
        // the session only lives for this browser tab
        if (!rememberMe) {
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith('sb-') && k.endsWith('-auth-token')) localStorage.removeItem(k)
          })
        }
        router.push('/feed')
      } else {
        if (!firstName.trim() || !lastName.trim()) {
          throw new Error('Please enter your first and last name.')
        }
        if (!acceptedTerms) {
          throw new Error('You must accept the terms of use to create an account.')
        }
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: {
              first_name: firstName.trim(),
              last_name:  lastName.trim(),
              name:       `${firstName.trim()} ${lastName.trim()}`,
            }
          }
        })
        if (error) throw error

        // Duplicate account detection: Supabase returns identities=[] for duplicates
        if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
          throw new Error('An account already exists with this email. Please sign in instead.')
        }

        // Process referral if a code was present
        const code = sessionStorage.getItem('al_ref') ?? refCode ?? ''
        if (code && data.user) {
          await processReferral(supabase, code, data.user.id)
          sessionStorage.removeItem('al_ref')
        }

        if (data.session) {
          // Email confirmation disabled → active session → sync profile then redirect
          if (data.user) {
            await supabase.from('profiles').update({
              first_name: firstName.trim(),
              last_name:  lastName.trim(),
              name:       `${firstName.trim()} ${lastName.trim()}`,
            }).eq('id', data.user.id)
          }
          router.push('/feed')
        } else {
          // Email confirmation enabled → show "check your inbox" screen
          setCheckEmail(true)
        }
      }
    } catch (e: any) {
      setError(e.message ?? 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">

        {/* Logo / Branding */}
        <div className="text-center mb-8">
          {logoUrl
            ? <img src={logoUrl} alt="AroundLink" className="h-20 w-auto mx-auto mb-4 object-contain" />
            : (
              <div className="h-20 w-20 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #1a3055, #2d6a9f)' }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: 'white', letterSpacing: -1 }}>AL</span>
              </div>
            )
          }
          <h1 className="text-xl font-black mb-1" style={{ color: '#1a3055' }}>AroundLink Community</h1>
          <p className="text-xs font-medium text-slate-400">The community for international relations in higher education</p>
        </div>

        {/* Referral banner */}
        {hasRef && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-center">
            <p className="text-xs font-semibold text-amber-700">You've been referred!</p>
            <p className="text-xs text-amber-600 mt-0.5">Create your account to join the community.</p>
          </div>
        )}

        {/* Check your inbox screen */}
        {checkEmail ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
            <p className="text-4xl mb-3">📬</p>
            <h2 className="text-base font-bold text-slate-800 mb-2">Check your inbox</h2>
            <p className="text-sm text-slate-500 mb-1">
              A confirmation link has been sent to
            </p>
            <p className="text-sm font-semibold text-slate-700 mb-4">{email}</p>
            <p className="text-xs text-slate-400 mb-5">
              Click the link in the email to activate your account and get signed in automatically.
            </p>
            <button onClick={() => { setCheckEmail(false); setMode('login') }}
              className="text-xs font-semibold text-blue-600 hover:underline">
              ← Back to sign in
            </button>
          </div>
        ) : (

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          {/* Mode toggle */}
          <div className="flex gap-2 mb-5 bg-slate-50 rounded-xl p-1">
            {(['login', 'signup'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                style={mode === m
                  ? { background: 'white', color: '#1a3055', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                  : { color: '#64748b' }}>
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          {/* LinkedIn SSO */}
          <button
            onClick={handleLinkedIn}
            disabled={linkedinLoading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl text-sm font-bold border transition-all mb-4 disabled:opacity-50"
            style={{ background: '#0A66C2', color: 'white', border: 'none' }}>
            {linkedinLoading
              ? <span className="text-sm">Redirecting…</span>
              : <><LinkedInIcon />{mode === 'login' ? 'Continue with LinkedIn' : 'Sign up with LinkedIn'}</>
            }
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-slate-100"/>
            <span className="text-xs text-slate-400 font-medium">or with email</span>
            <div className="flex-1 h-px bg-slate-100"/>
          </div>

          {/* Forgot password mode */}
          {forgotMode ? (
            forgotSent ? (
              <div className="text-center py-2">
                <p className="text-2xl mb-2">📬</p>
                <p className="text-sm font-bold text-slate-700 mb-1">Email sent!</p>
                <p className="text-xs text-slate-400 mb-4">Check your inbox (and spam folder) to reset your password.</p>
                <button onClick={() => { setForgotMode(false); setForgotSent(false) }}
                  className="text-xs font-semibold text-blue-600 hover:underline">← Back to sign in</button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-3">
                <p className="text-xs text-slate-500 mb-1">Enter your email and we'll send you a link to reset your password.</p>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Email</label>
                  <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-slate-300"
                    placeholder="j.renard@university.edu" autoFocus/>
                </div>
                {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">⚠️ {error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50"
                  style={{ background: '#1a3055' }}>
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
                <button type="button" onClick={() => { setForgotMode(false); setError('') }}
                  className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600">
                  ← Back
                </button>
              </form>
            )
          ) : (
          /* Email form */
          <form onSubmit={submit} className="space-y-3">

            {/* First name + Last name — signup only */}
            {mode === 'signup' && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-500 block mb-1">First name</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required
                    autoComplete="given-name"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-slate-300"
                    placeholder="Julie"/>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Last name</label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required
                    autoComplete="family-name"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-slate-300"
                    placeholder="Renard"/>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                autoComplete="email"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-slate-300"
                placeholder="j.renard@university.edu"/>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-500">Password</label>
                {mode === 'login' && (
                  <button type="button" onClick={() => { setForgotMode(true); setForgotEmail(email); setError('') }}
                    className="text-xs text-blue-500 hover:underline font-medium">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={8}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-slate-300"
                  placeholder="••••••••"/>
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, lineHeight: 1 }}>
                  {showPassword
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {/* Stay signed in — login only */}
            {mode === 'login' && (
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  onClick={() => setRememberMe(v => !v)}
                  className="relative flex-shrink-0"
                  style={{ width: 18, height: 18 }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={() => setRememberMe(v => !v)}
                    className="sr-only"
                  />
                  <div
                    className="w-full h-full rounded-md border-2 transition-all flex items-center justify-center"
                    style={{
                      borderColor: rememberMe ? '#1a3055' : '#cbd5e1',
                      background:  rememberMe ? '#1a3055' : 'white',
                    }}>
                    {rememberMe && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-xs font-medium text-slate-500">Stay signed in</span>
              </label>
            )}

            {mode === 'signup' && (
              <>
                {/* CGU acceptance — required */}
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={e => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 flex-shrink-0 accent-[#1a3055]"
                    style={{ width: 15, height: 15 }}
                  />
                  <span className="text-xs text-slate-500 leading-relaxed">
                    I have read and accept the{' '}
                    <a href="/cgu" target="_blank" rel="noopener" style={{ color: '#1a3055', fontWeight: 600, textDecoration: 'underline' }}>
                      terms of use
                    </a>
                    {' '}and the{' '}
                    <a href="/privacy" target="_blank" rel="noopener" style={{ color: '#1a3055', fontWeight: 600, textDecoration: 'underline' }}>
                      privacy policy
                    </a>
                    . <span className="text-red-400">*</span>
                  </span>
                </label>
                <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-2.5 leading-relaxed">
                  💡 You can complete your profile (institution, LinkedIn…) once logged in from the <strong>My profile</strong> section.
                </p>
              </>
            )}

            {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">⚠️ {error}</p>}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50"
              style={{ background: '#1a3055' }}>
              {loading ? 'Loading…' : mode === 'login' ? 'Sign in' : 'Create my account'}
            </button>
          </form>
          )}
        </div>
        )} {/* end checkEmail */}

        <p className="text-center text-xs text-slate-400 mt-4">
          AroundLink · {new Date().getFullYear()} ·{' '}
          <a href="/privacy" className="hover:underline" style={{ color: '#94a3b8' }}>Privacy</a>
          {' '}·{' '}
          <a href="/cgu" className="hover:underline" style={{ color: '#94a3b8' }}>Terms</a>
        </p>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return <Suspense><AuthForm/></Suspense>
}
