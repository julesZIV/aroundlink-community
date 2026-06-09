import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * POST /api/check-email
 * Body: { email: string }
 * Returns: { exists: boolean }
 *
 * Uses the service-role client (bypasses RLS) to check whether an email
 * is registered — without exposing any user data to unauthenticated callers.
 * Simple in-memory rate limiter: 5 checks per IP per 60 s.
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

  // The admin auth API supports getUserByEmail in newer versions.
  // Fallback: search auth.users via a raw SQL function if needed.
  // For ~300 users, fetching all is fine; use the admin list API.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) {
    // Graceful degradation — don't block password reset flow
    return NextResponse.json({ exists: true })
  }

  const exists = data.users.some(u => u.email?.toLowerCase() === email)
  return NextResponse.json({ exists })
}
