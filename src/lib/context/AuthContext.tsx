'use client'
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/supabase/supabase/types'

type AuthCtx = {
  user:            User | null
  profile:         Profile | null
  loading:         boolean
  emailVerified:   boolean
  updateProfile:   (updates: Partial<Profile>) => Promise<Profile | null>
  signOut:         () => Promise<void>
  refreshProfile:  () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({
  user: null, profile: null, loading: true, emailVerified: false,
  updateProfile: async () => null,
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [user,    setUser]    = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles').select('*').eq('id', userId).single()
      if (data) setProfile(data as Profile)
    } catch (_) {}
    finally { setLoading(false) }
  }, [supabase])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [supabase, fetchProfile])

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) return null
    const { data } = await supabase
      .from('profiles').update(updates).eq('id', user.id).select().single()
    if (data) setProfile(data as Profile)
    return (data as Profile) ?? null
  }, [user])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null); setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id)
  }, [user])

  const isOAuthUser   = (user?.app_metadata?.provider ?? '') !== 'email'
  const emailVerified = isOAuthUser || !!user?.email_confirmed_at

  return (
    <AuthContext.Provider value={{ user, profile, loading, emailVerified, updateProfile, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
