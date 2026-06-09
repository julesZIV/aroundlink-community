import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth check — must be a signed-in admin or moderator ──────────────
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('app_role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'moderator', 'super_admin'].includes(profile.app_role ?? '')) {
      return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
    }

    // ── 2. Validate payload ──────────────────────────────────────────────────
    const { userId, amount, reason } = await req.json()

    if (!userId || typeof amount !== 'number' || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (amount < 1 || amount > 9999) {
      return NextResponse.json({ error: 'Amount must be between 1 and 9999' }, { status: 400 })
    }

    // ── 3. Award chips via admin client (bypasses RLS safely) ────────────────
    const admin = createAdminClient()

    const { error } = await admin.from('chips_transactions').insert({
      user_id: userId,
      amount,
      reason,
    })

    if (error) {
      console.error('[chips/award] insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[chips/award] admin=${user.id} awarded ${amount} chips to ${userId} — reason: ${reason}`)
    return NextResponse.json({ success: true, awarded: amount })

  } catch (e: any) {
    console.error('[chips/award] unexpected error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
