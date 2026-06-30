import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Hôtes LinkedIn autorisés pour le téléchargement d'avatar (anti-SSRF).
// On n'accepte de fetch QUE des URLs servies par LinkedIn.
const ALLOWED_AVATAR_HOSTS = ['media.licdn.com', 'media-exp1.licdn.com', 'media-exp2.licdn.com']
// Taille max d'un avatar téléchargé : 5 Mo
const MAX_AVATAR_BYTES = 5 * 1024 * 1024

function isAllowedAvatarUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && ALLOWED_AVATAR_HOSTS.includes(u.hostname)
  } catch {
    return false
  }
}

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

      // ── Un seul SELECT sur le profil courant (au lieu de 3) ─────────────────
      // On récupère d'un coup tout ce dont on a besoin pour les décisions
      // ci-dessous : avatar déjà hébergé, nom/linkedin déjà personnalisés,
      // preuve de consentement déjà enregistrée.
      const { data: current } = await supabase
        .from('profiles')
        .select('avatar_url, name, linkedin, terms_accepted_at')
        .eq('id', user.id)
        .single()

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

      // ── Noms ────────────────────────────────────────────────────────────────
      // On ne renseigne le nom QUE si le profil n'en a pas encore un
      // personnalisé. Sinon, chaque reconnexion LinkedIn écraserait un nom
      // que l'utilisateur aurait édité manuellement.
      const hasCustomName = !!(current?.name && current.name.trim() && current.name !== 'Inactive Member')
      if (!hasCustomName) {
        if (meta.given_name || meta.family_name) {
          updates.first_name = meta.given_name  ?? null
          updates.last_name  = meta.family_name ?? null
          updates.name       = [meta.given_name, meta.family_name].filter(Boolean).join(' ')
        } else if (meta.first_name || meta.last_name) {
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
      }

      // ── Avatar ──────────────────────────────────────────────────────────────
      // LinkedIn renvoie une URL signée TEMPORAIRE (media.licdn.com) qui expire
      // en quelques semaines (→ HTTP 403, photo cassée). On télécharge donc
      // l'image une fois et on l'héberge sur Supabase. Sécurité : on ne fetch
      // que des hôtes LinkedIn (anti-SSRF), on plafonne la taille et on vérifie
      // que le contenu est bien une image.
      const incomingAvatar: string | null = meta.avatar_url ?? meta.picture ?? null
      const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
      const alreadyHosted = !!current?.avatar_url
        && supabaseHost !== ''
        && current.avatar_url.startsWith(supabaseHost)
        && current.avatar_url.includes('/avatars/')

      if (incomingAvatar && !alreadyHosted && isAllowedAvatarUrl(incomingAvatar)) {
        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 8000)
          const res = await fetch(incomingAvatar, { signal: controller.signal })
          clearTimeout(timer)

          const contentType = res.headers.get('content-type') ?? ''
          const declaredLen = Number(res.headers.get('content-length') ?? '0')

          // Le contenu doit être une image et ne pas dépasser la limite de taille
          const isImage = contentType.startsWith('image/')
          const tooLargeByHeader = declaredLen > MAX_AVATAR_BYTES

          if (res.ok && isImage && !tooLargeByHeader) {
            const buf = new Uint8Array(await res.arrayBuffer())
            if (buf.byteLength > 0 && buf.byteLength <= MAX_AVATAR_BYTES) {
              const ext = contentType.includes('png') ? 'png'
                : contentType.includes('webp') ? 'webp' : 'jpg'
              const path = `${user.id}/linkedin.${ext}`
              const { error: upErr } = await supabase.storage
                .from('avatars')
                .upload(path, buf, { contentType, upsert: true })
              if (!upErr) {
                const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
                updates.avatar_url = pub.publicUrl
              }
              // Si l'upload échoue : on NE retombe PAS sur l'URL LinkedIn brute
              // (elle expirera et cassera la photo). On laisse l'avatar inchangé.
            }
          }
        } catch {
          // timeout / réseau : on laisse l'avatar inchangé (pas d'URL temporaire)
        }
      } else if (incomingAvatar && !alreadyHosted && !current?.avatar_url
                 && incomingAvatar.startsWith(supabaseHost) && supabaseHost !== '') {
        // Avatar déjà servi par notre propre storage et pas encore enregistré
        updates.avatar_url = incomingAvatar
      }

      // ── LinkedIn profile URL ──────────────────────────────────────────────
      // Renseignée seulement si l'utilisateur n'en a pas déjà une (sinon une
      // URL éditée manuellement serait écrasée à chaque reconnexion).
      if (!current?.linkedin) {
        const linkedinUrl =
          meta.profile ??
          meta.linkedin ??
          user.identities?.find((i: any) => i.provider === 'linkedin_oidc')?.identity_data?.profile ??
          null
        if (linkedinUrl) updates.linkedin = linkedinUrl
      }

      // ── Preuve de consentement RGPD ───────────────────────────────────────
      // Enregistrée la première fois qu'on a une session (email confirmé OU
      // inscription LinkedIn). Réutilise le SELECT groupé ci-dessus.
      if (!current?.terms_accepted_at) {
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
