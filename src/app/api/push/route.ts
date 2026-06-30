import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'

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

/**
 * Returns the subset of `targetIds` the caller is allowed to notify.
 * A relationship is legitimate when the caller:
 *   - notifies themselves, OR
 *   - shares an existing direct conversation with the target, OR
 *   - shares at least one channel membership with the target.
 * Computed server-side with the service-role client so it cannot be spoofed.
 */
async function authorizedRecipients(
  callerId: string,
  targetIds: string[]
): Promise<Set<string>> {
  const allowed = new Set<string>()
  const remaining = new Set(targetIds)

  // 0. Self is always allowed
  if (remaining.has(callerId)) {
    allowed.add(callerId)
    remaining.delete(callerId)
  }
  if (remaining.size === 0) return allowed

  const admin = createAdminClient()

  // 1. Direct conversations involving the caller
  const { data: convos } = await admin
    .from('conversations')
    .select('user1_id, user2_id')
    .or(`user1_id.eq.${callerId},user2_id.eq.${callerId}`)

  for (const c of convos ?? []) {
    const other = c.user1_id === callerId ? c.user2_id : c.user1_id
    if (remaining.has(other)) { allowed.add(other); remaining.delete(other) }
  }
  if (remaining.size === 0) return allowed

  // 2. Channel co-membership: channels the caller belongs to …
  const { data: myChannels } = await admin
    .from('channel_members')
    .select('channel_id')
    .eq('user_id', callerId)

  const channelIds = (myChannels ?? []).map((r) => r.channel_id)
  if (channelIds.length > 0) {
    // … then any of the remaining targets that are members of those channels
    const { data: coMembers } = await admin
      .from('channel_members')
      .select('user_id')
      .in('channel_id', channelIds)
      .in('user_id', Array.from(remaining))

    for (const m of coMembers ?? []) {
      if (remaining.has(m.user_id)) { allowed.add(m.user_id); remaining.delete(m.user_id) }
    }
  }

  return allowed
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

  // 6. Autorisation : ne garder que les destinataires avec qui l'appelant a un
  //    lien légitime (conversation directe, co-membre d'un channel, ou soi-même).
  //    Empêche un utilisateur d'envoyer des push arbitraires (spam/harcèlement).
  const allowed = await authorizedRecipients(user.id, user_ids as string[])
  if (allowed.size === 0) {
    return NextResponse.json({ error: 'Forbidden recipients' }, { status: 403 })
  }

  // 7. Parmi les destinataires autorisés, ne garder que ceux ayant une
  //    subscription push active.
  const allowedIds = Array.from(allowed)
  const { data: subs } = await server
    .from('push_subscriptions')
    .select('user_id')
    .in('user_id', allowedIds)

  const validIds = new Set((subs ?? []).map((s: { user_id: string }) => s.user_id))
  const filteredIds = allowedIds.filter((id) => validIds.has(id))

  if (filteredIds.length === 0) {
    // Aucun destinataire autorisé n'a de subscription active — succès silencieux
    return NextResponse.json({ success: true, sent: 0 })
  }

  // 8. Forwarding vers l'Edge Function
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
