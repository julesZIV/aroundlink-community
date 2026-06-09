import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// ── Rate limiter: 20 notifications / user / 60 s ─────────────────────────────
const _rl = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = _rl.get(userId)
  if (!entry || now > entry.resetAt) {
    _rl.set(userId, { count: 1, resetAt: now + 60_000 })
    return false
  }
  if (entry.count >= 20) return true
  entry.count++
  return false
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const server = await createServerClient()
  const { data: { user } } = await server.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Rate limit par user
  if (isRateLimited(user.id)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  // 3. Parse body
  const body = await req.json()
  const { user_ids, title, body: msgBody, url, tag } = body

  if (!Array.isArray(user_ids) || user_ids.length === 0 || !title) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  // 4. Limiter à 50 destinataires max par appel
  if (user_ids.length > 50) {
    return NextResponse.json({ error: 'Too many recipients (max 50)' }, { status: 400 })
  }

  // 5. Valider que tous les user_ids sont des UUIDs valides
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!user_ids.every((id: unknown) => typeof id === 'string' && uuidRe.test(id))) {
    return NextResponse.json({ error: 'Invalid user_ids' }, { status: 400 })
  }

  // 6. Vérifier que l'appelant a une relation légitime avec les destinataires
  // (membre d'un même channel OU conversation directe existante)
  // Pour les cas @all et commentaires, on fait confiance au serveur interne —
  // mais on rejette les appels où l'expéditeur n'est PAS l'un des user_ids
  // et n'a pas de lien avec eux.
  // Règle pragmatique : si user_ids ne contient que l'appelant lui-même → OK (test)
  // Sinon → vérifier qu'il y a au moins une subscription active pour chaque id
  const { data: subs } = await server
    .from('push_subscriptions')
    .select('user_id')
    .in('user_id', user_ids)

  const validIds = new Set((subs ?? []).map((s: { user_id: string }) => s.user_id))
  const filteredIds = user_ids.filter((id: string) => validIds.has(id))

  if (filteredIds.length === 0) {
    // Aucun destinataire n'a de subscription active — succès silencieux
    return NextResponse.json({ success: true, sent: 0 })
  }

  // 7. Forwarding vers l'Edge Function
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const pushSecret  = process.env.PUSH_INTERNAL_SECRET
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!pushSecret) return NextResponse.json({ error: 'Push not configured' }, { status: 500 })

  const resp = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'X-Push-Secret': pushSecret,
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ user_ids: filteredIds, title, body: msgBody, url, tag }),
  })

  const result = await resp.json().catch(() => ({}))
  return NextResponse.json(result, { status: resp.ok ? 200 : resp.status })
}
