import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'

// Helper: verify caller is admin or moderator (reads from DB, not client-supplied value)
async function getCallerRole(): Promise<{ userId: string; role: string } | null> {
  const server = await createServerClient()
  const { data: { user } } = await server.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('app_role')
    .eq('id', user.id)
    .single()

  return { userId: user.id, role: profile?.app_role ?? 'member' }
}

export async function POST(req: NextRequest) {
  const caller = await getCallerRole()
  if (!caller || !['admin', 'moderator'].includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { action } = body
  const admin = createAdminClient()

  // ── change-role ─────────────────────────────────────────────────────────────
  if (action === 'change-role') {
    // Only admins can change roles
    if (caller.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { userId, newRole } = body
    if (!userId || !['admin', 'moderator', 'member'].includes(newRole)) {
      return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
    }
    const { error } = await admin.from('profiles').update({ app_role: newRole }).eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── set-institution (rattacher un membre à une université ROR) ───────────────
  if (action === 'set-institution') {
    // admins ET modérateurs (déjà filtrés en haut)
    const { userId, universityId } = body
    if (!userId) return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
    // Retrait de l'institution
    if (universityId == null) {
      const { error } = await admin.from('profiles')
        .update({ institution: null, university_id: null }).eq('id', userId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, institution: null, university_id: null })
    }
    // Rattachement : on prend le nom ROR canonique côté serveur (texte propre garanti)
    const { data: uni } = await admin.from('universities')
      .select('display_name').eq('id', universityId).single()
    if (!uni) return NextResponse.json({ error: 'Unknown university' }, { status: 400 })
    const { error } = await admin.from('profiles')
      .update({ institution: uni.display_name, university_id: universityId }).eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, institution: uni.display_name, university_id: universityId })
  }

  // ── anonymize ───────────────────────────────────────────────────────────────
  if (action === 'anonymize') {
    if (caller.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { userId } = body
    if (!userId) return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
    const { error } = await admin.rpc('anonymize_user', { p_user_id: userId })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── save-score ──────────────────────────────────────────────────────────────
  if (action === 'save-score') {
    if (caller.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { scoreId, points } = body
    if (!scoreId || typeof points !== 'number' || points < 0) {
      return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
    }
    const { error } = await admin
      .from('scoring_config')
      .update({ points, updated_at: new Date().toISOString(), updated_by: caller.userId })
      .eq('id', scoreId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── review-request ──────────────────────────────────────────────────────────
  if (action === 'review-request') {
    const { reqId, reqAction, channelData } = body
    if (!reqId || !['approved', 'rejected'].includes(reqAction)) {
      return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
    }
    if (reqAction === 'approved' && channelData) {
      const { error: insertErr } = await admin.from('channels').upsert(channelData, { onConflict: 'id', ignoreDuplicates: true })
      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }
    const { error } = await admin.from('channel_requests').update({
      status: reqAction, reviewed_by: caller.userId, reviewed_at: new Date().toISOString(),
    }).eq('id', reqId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── save-setting ────────────────────────────────────────────────────────────
  if (action === 'save-setting') {
    if (caller.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { key, value } = body
    const ALLOWED_KEYS = ['community_name', 'community_logo_url']
    if (!key || !ALLOWED_KEYS.includes(key)) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
    }
    const { error } = await admin.from('app_settings').upsert({ key, value }, { onConflict: 'key' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
