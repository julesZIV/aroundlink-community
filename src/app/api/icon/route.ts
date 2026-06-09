import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Sert le logo communauté comme icône PWA stable (même URL, image dynamique)
export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'community_logo_url')
      .single()

    if (data?.value) {
      // Redirect vers l'URL Supabase Storage
      return NextResponse.redirect(data.value, { status: 302 })
    }
  } catch {}

  // Fallback : réponse vide 404
  return new NextResponse(null, { status: 404 })
}
