import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const ref   = searchParams.get('ref')   // referral code passed via OAuth redirectTo
  // Validate `next` to prevent open-redirect attacks
  const rawNext = searchParams.get('next') ?? '/feed'
  const next = rawNext.startsWith('/') && !rawNext.includes('://') ? rawNext : '/feed'
  const error = searchParams.get('error')

  if (error) {
    console.error('OAuth error:', error, searchParams.get('error_description'))
    return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(error)}`)
  }

  if (code) {
    const supabase = await createServerClient()
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError && data.user) {
      const user = data.user
      const meta = user.user_metadata ?? {}

      // Process referral from OAuth flow (ref passed in redirectTo URL)
      if (ref) {
        try {
          const { data: referrer } = await supabase
            .from('profiles')
            .select('id')
            .eq('referral_code', ref)
            .single()
          if (referrer && referrer.id !== user.id) {
            // Insert if not already tracked (ignore duplicates)
            await supabase.from('referrals').insert({
              referrer_id: referrer.id,
              referee_id:  user.id,
              confirmed:   !!user.email_confirmed_at,
            })
          }
        } catch (_) { /* silent */ }
      }

      // Attribution atomique des 150 Links au parrain (via SQL function → pas de race condition)
      if (user.email_confirmed_at) {
        try {
          await supabase.rpc('confirm_referral', { p_referee_id: user.id })
        } catch (err) {
          console.error('[callback] confirm_referral error:', err)
        }
      }

      // Sync profile data from auth metadata
      const updates: Record<string, any> = {}

      // Names — LinkedIn OIDC provides given_name / family_name
      // Email signup provides first_name / last_name directly in metadata
      if (meta.given_name || meta.family_name) {
        updates.first_name   = meta.given_name  ?? null
        updates.last_name    = meta.family_name ?? null
        updates.name         = [meta.given_name, meta.family_name].filter(Boolean).join(' ')
      } else if (meta.first_name || meta.last_name) {
        // Email signup metadata
        updates.first_name = meta.first_name ?? null
        updates.last_name  = meta.last_name  ?? null
        updates.name       = meta.name ?? [meta.first_name, meta.last_name].filter(Boolean).join(' ')
      } else if (meta.full_name || meta.name) {
        const full = meta.full_name ?? meta.name
        const parts = full.trim().split(' ')
        updates.first_name = parts[0] ?? null
        updates.last_name  = parts.slice(1).join(' ') || null
        updates.name       = full
      }

      // Avatar
      if (meta.avatar_url || meta.picture) {
        updates.avatar_url = meta.avatar_url ?? meta.picture
      }

      // LinkedIn profile URL — available via OIDC `profile` claim or identity_data
      const linkedinUrl =
        meta.profile ??
        meta.linkedin ??
        user.identities?.find((i: any) => i.provider === 'linkedin_oidc')?.identity_data?.profile ??
        null

      if (linkedinUrl) updates.linkedin = linkedinUrl

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=auth_failed`)
}
