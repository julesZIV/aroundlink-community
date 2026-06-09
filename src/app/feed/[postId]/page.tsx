import { createAdminClient } from '@/lib/supabase/server'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aroundlink.com'
const DEFAULT_OG = `${SITE_URL}/og-default.png`  // image générique AroundLink

// Next.js 15+ : params est une Promise
interface Props { params: Promise<{ postId: string }> }

async function getPost(postId: string) {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('feed_posts')
      .select('id, text, media_url, media_type, created_at, profiles!feed_posts_user_id_fkey(name, first_name, last_name, institution)')
      .eq('id', postId)
      .single()
    return data
  } catch { return null }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { postId } = await params
  const post = await getPost(postId)
  if (!post) {
    return { title: 'AroundLink — The IRO Community' }
  }

  const p = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles
  const author = p
    ? (`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.name || 'A member')
    : 'A member'
  const institution = p?.institution ? ` · ${p.institution}` : ''
  const title = `${author}${institution} on AroundLink`
  const description = post.text
    ? post.text.slice(0, 200) + (post.text.length > 200 ? '…' : '')
    : 'Shared a post on AroundLink'

  const ogImage = post.media_url && post.media_type === 'image'
    ? post.media_url
    : DEFAULT_OG

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/feed/${postId}`,
      siteName: 'AroundLink',
      type: 'article',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    other: {
      // LinkedIn specific
      'article:author': author,
    },
  }
}

// La page elle-même redirige vers le feed (l'app est une SPA)
// Les bots (LinkedIn, Twitter…) lisent les meta AVANT la redirection
export default async function FeedPostPage({ params }: Props) {
  const { postId } = await params
  const post = await getPost(postId)

  if (!post) redirect('/feed')

  const p = Array.isArray(post?.profiles) ? post.profiles[0] : post?.profiles
  const author = p ? (`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.name || 'Member') : 'Member'

  // Page minimaliste pour les navigateurs — les bots s'arrêtent aux meta
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f8f9fc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 600, width: '100%', margin: '40px 16px', background: 'white', borderRadius: 20, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          {/* Header */}
          <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#1a3055', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: 'white' }}>
              AL
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#1a3055' }}>{author}</p>
              {p?.institution && <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>{p.institution}</p>}
            </div>
          </div>

          {/* Content */}
          {post.text && (
            <p style={{ margin: '16px 24px', fontSize: 15, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {post.text}
            </p>
          )}

          {/* Image */}
          {post.media_url && post.media_type === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.media_url} alt="" style={{ width: '100%', maxHeight: 400, objectFit: 'cover', display: 'block' }} />
          )}

          {/* Footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>🌐 AroundLink · The IRO Community</span>
            <a href="/feed" style={{ fontSize: 12, fontWeight: 700, color: '#1a3055', textDecoration: 'none', background: '#eef6ff', padding: '6px 14px', borderRadius: 8 }}>
              Open in app →
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
