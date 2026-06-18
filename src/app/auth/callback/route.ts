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

      // Avatar — LinkedIn renvoie une URL signée TEMPORAIRE (media.licdn.com)
      // qui expire en quelques semaines (→ HTTP 403, photo cassée). On télécharge
      // donc l'image une fois et on l'héberge sur Supabase pour qu'elle soit
      // permanente. Si le téléchargement échoue, on retombe sur l'URL brute.
      const incomingAvatar: string | null = meta.avatar_url ?? meta.picture ?? null
      if (incomingAvatar) {
        const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

        // L'avatar est-il déjà hébergé chez nous ? si oui, on n'y touche pas.
        const { data: current } = await supabase
          .from('profiles').select('avatar_url').eq('id', user.id).single()
        const alreadyHosted = !!current?.avatar_url
          && supabaseHost !== ''
          && current.avatar_url.startsWith(supabaseHost)
          && current.avatar_url.includes('/avatars/')

        const isRemote = typeof incomingAvatar === 'string'
          && incomingAvatar.startsWith('http')
          && (supabaseHost === '' || !incomingAvatar.startsWith(supabaseHost))

        if (alreadyHosted) {
          // garder l'avatar permanent existant — ne rien faire
        } else if (isRemote) {
          try {
            const controller = new AbortController()
            const timer = setTimeout(() => controller.abort(), 8000)
            const res = await fetch(incomingAvatar, { signal: controller.signal })
            clearTimeout(timer)
            if (res.ok) {
              const contentType = res.headers.get('content-type') ?? 'image/jpeg'
              const ext = contentType.includes('png') ? 'png'
                : contentType.includes('webp') ? 'webp' : 'jpg'
              const buf = new Uint8Array(await res.arrayBuffer())
              const path = `${user.id}/linkedin.${ext}`
              const { error: upErr } = await supabase.storage
                .from('avatars')
                .upload(path, buf, { contentType, upsert: true })
              if (!upErr) {
                const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
                updates.avatar_url = pub.publicUrl
              } else {
                updates.avatar_url = incomingAvatar // fallback : URL brute
              }
            } else {
              updates.avatar_url = incomingAvatar // fallback : URL brute
            }
          } catch {
            updates.avatar_url = incomingAvatar // fallback : URL brute
          }
        } else {
          updates.avatar_url = incomingAvatar
        }
      }

      // LinkedIn profile URL — available via OIDC `profile` claim or identity_data
      const linkedinUrl =
        meta.profile ??
        meta.linkedin ??
        user.identities?.find((i: any) => i.provider === 'linkedin_oidc')?.identity_data?.profile ??
        null

      if (linkedinUrl) updates.linkedin = linkedinUrl

      // GDPR consent proof — record ToS acceptance on the profile the first time we
      // have a session. Covers email-confirmation completion AND LinkedIn sign-up.
      // Email signup carries the real acceptance timestamp in metadata; for LinkedIn
      // the user ticked the box in the UI before the OAuth redirect, so we stamp now.
      const { data: termsRow } = await supabase
        .from('profiles').select('terms_accepted_at').eq('id', user.id).single()
      if (!termsRow?.terms_accepted_at) {
        updates.terms_version     = meta.terms_version ?? '1.0'
        updates.terms_accepted_at = meta.terms_accepted_at ?? new Date().toISOString()
      }

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
