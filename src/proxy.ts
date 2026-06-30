import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

// Routes accessibles sans être connecté
const PUBLIC_ROUTES = ['/auth', '/auth/callback', '/cgu', '/privacy']

// Routes réservées aux admins/modérateurs
const ADMIN_ROUTES = ['/admin']

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Laisser passer les assets, API routes, et routes publiques
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/manifest') ||
    pathname === '/sw.js' ||
    pathname === '/favicon.ico' ||
    PUBLIC_ROUTES.some(r => pathname.startsWith(r))
  ) {
    return NextResponse.next()
  }

  // Créer un client Supabase compatible middleware (lecture/écriture des cookies)
  let response = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          response = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          )
        },
      },
    }
  )

  // Vérifier la session (rafraîchit le token si nécessaire)
  const { data: { user } } = await supabase.auth.getUser()

  // Non connecté → redirection vers /auth
  if (!user) {
    const url = req.nextUrl.clone()
    url.pathname = '/auth'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Route admin → vérifier le rôle en DB
  if (ADMIN_ROUTES.some(r => pathname.startsWith(r))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('app_role')
      .eq('id', user.id)
      .single()

    const role = profile?.app_role ?? 'member'
    if (!['admin', 'moderator'].includes(role)) {
      return NextResponse.redirect(new URL('/feed', req.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Appliquer le proxy sur toutes les routes sauf les assets statiques :
     * _next/static, _next/image, favicon.ico, sw.js, et le manifeste PWA.
     * (Les routes /api sont en plus court-circuitées dans le corps de la fonction.)
     */
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest).*)',
  ],
}