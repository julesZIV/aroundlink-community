'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [password,   setPassword]   = useState('')
  const [password2,  setPassword2]  = useState('')
  const [showPwd,    setShowPwd]    = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [done,       setDone]       = useState(false)
  const [error,      setError]      = useState('')
  const [ready,      setReady]      = useState(false)
  const [logoUrl,    setLogoUrl]    = useState<string | null>(null)

  // Fetch branding logo
  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'community_logo_url').single()
      .then(({ data }) => { if (data?.value) setLogoUrl(data.value) })
  }, [])

  // Wait for Supabase to confirm the recovery session
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true)
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== password2) { setError('Passwords do not match'); return }
    if (password.length < 8)    { setError('Minimum 8 characters'); return }
    setError(''); setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    setDone(true)
    setTimeout(() => router.push('/feed'), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">

        {/* Logo / Branding */}
        <div className="text-center mb-8">
          {logoUrl
            ? <img src={logoUrl} alt="AroundLink" className="h-20 w-auto mx-auto mb-4 object-contain" />
            : <div className="h-20 w-20 mx-auto mb-4 rounded-2xl bg-slate-100" />
          }
          <h1 className="text-xl font-black mb-1" style={{ color: '#1a3055' }}>AroundLink Community</h1>
          <p className="text-xs font-medium text-slate-400">The community for international relations in higher education</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-800 mb-1">Set a new password</h2>
          <p className="text-xs text-slate-400 mb-5">Choose a strong password to secure your account.</p>

          {done ? (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4 text-center">
              <p className="text-sm font-bold text-green-700">✓ Password updated!</p>
              <p className="text-xs text-green-500 mt-1">Redirecting you…</p>
            </div>
          ) : !ready ? (
            <div className="text-center py-6 text-slate-400 text-sm">Verifying link…</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">New password</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password} onChange={e => setPassword(e.target.value)}
                    required minLength={8} placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-slate-300"
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)} tabIndex={-1}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
                    {showPwd
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Confirm password</label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password2} onChange={e => setPassword2(e.target.value)}
                  required minLength={8} placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-slate-300"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">⚠️ {error}</p>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 mt-1"
                style={{ background: '#1a3055' }}>
                {loading ? 'Saving…' : 'Save new password'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          AroundLink · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
