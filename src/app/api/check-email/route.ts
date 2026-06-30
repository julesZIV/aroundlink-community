import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * POST /api/check-email
 * Body: { email: string }
 * Returns: { exists: boolean }
 *
 * NOTE (security): the password-reset flow no longer calls this endpoint, to
 * avoid account enumeration — the UI now shows a neutral confirmation whether or
 * not the address is registered. This route is kept for internal/admin use only.
 *
 * Implementation: uses a server-side RPC (`email_exists`) instead of paging the
 * entire auth.users table via listUsers(), which did not scale and loaded every
 * user into memory. Rate limited to 5 checks / IP / 60 s.
 */

const attempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 })
    return false
  }
  if (entry.count >= 5) return true
  entry.count++
  return false
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  let email: string
  try {
    const body = await req.json()
    email = (body.email ?? '').trim().toLowerCase()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Targeted existence check via RPC (see migration email_exists_rpc.sql).
  // Falls back to a non-blocking "true" if the RPC is unavailable, so the
  // password-reset flow is never blocked by an infrastructure error.
  const { data, error } = await admin.rpc('email_exists', { p_email: email })
  if (error) {
    return NextResponse.json({ exists: true })
  }

  return NextResponse.json({ exists: !!data })
}
