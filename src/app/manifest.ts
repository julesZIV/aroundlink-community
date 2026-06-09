import type { MetadataRoute } from 'next'
import { createServerClient } from '@/lib/supabase/server'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  // Récupère le logo et le nom dynamique depuis app_settings
  let logoUrl: string | null = null
  let communityName = 'AroundLink'
  try {
    const supabase = await createServerClient()
    const { data: logoData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'community_logo_url')
      .single()
    if (logoData?.value) logoUrl = logoData.value
    const { data: nameData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'community_name')
      .single()
    if (nameData?.value) communityName = nameData.value
  } catch {}

  // On pointe toujours vers /api/icon (URL stable, image dynamique)
  const icons: MetadataRoute.Manifest['icons'] = logoUrl
    ? [
        { src: '/api/icon', sizes: '192x192', type: 'image/png' },
        { src: '/api/icon', sizes: '512x512', type: 'image/png' },
      ]
    : []

  return {
    name: communityName,
    short_name: communityName.split(' ')[0],
    description: 'The community platform for international relations officers',
    start_url: '/feed',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1a3055',
    icons,
  }
}
