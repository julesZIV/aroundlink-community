import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'

/**
 * POST /api/account/delete
 * Supprime le compte de l'utilisateur connecté de façon sécurisée :
 * - Anonymise le profil (RGPD) : les posts restent mais l'auteur devient "Deleted Member"
 * - Change l'email et le mot de passe auth par des valeurs aléatoires (impossible de se reconnecter)
 * - Renvoie un email de confirmation via l'API admin
 */
export async function POST(req: NextRequest) {
  // 1. Vérifier que l'appelant est bien authentifié
  const server = await createServerClient()
  const { data: { user }, error: authError } = await server.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = user.id
  const userEmail = user.email ?? ''
  const admin = createAdminClient()

  // 2. Anonymiser le profil : garder la ligne en DB (les posts pointent vers cet id)
  //    Les données personnelles sont effacées → conformité RGPD
  await admin.from('profiles').update({
    name:           'Deleted Member',
    first_name:     null,
    last_name:      null,
    avatar_url:     null,
    institution:    null,
    university_id:  null,
    is_anonymized:  true,
  } as unknown as Record<string, unknown>).eq('id', userId)

  // 3. Rendre le compte auth inaccessible (email + mot de passe aléatoires)
  const rnd = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  await admin.auth.admin.updateUserById(userId, {
    email:    `deleted-${rnd()}@deleted.aroundlink.com`,
    password: rnd() + rnd(),
    email_confirm: true,
  })

  // 4. Envoyer un email de confirmation à l'adresse originale
  //    On utilise l'API admin Supabase pour envoyer un email custom
  //    (ou simplement log – à remplacer par un service email si besoin)
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY ?? ''}`,
      },
      body: JSON.stringify({
        from:    'AroundLink <no-reply@aroundlink.com>',
        to:      [userEmail],
        subject: 'Your AroundLink account has been deleted',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px">
            <h2 style="color:#1a3055">Account deleted</h2>
            <p>Your AroundLink account has been permanently deleted as requested.</p>
            <p>Your posts and contributions to the community have been kept anonymously.</p>
            <p>If you change your mind, you can create a new account at any time.</p>
            <p style="color:#94a3b8;font-size:12px;margin-top:32px">AroundLink · The IRO community</p>
          </div>
        `,
      }),
    })
  } catch {
    // L'email de confirmation est best-effort — on ne bloque pas la suppression
  }

  return NextResponse.json({ success: true })
}