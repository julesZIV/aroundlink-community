import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control',  value: 'on' },
  { key: 'X-Frame-Options',         value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Scripts: self + Next.js inline scripts
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Styles: self + inline (Tailwind)
      "style-src 'self' 'unsafe-inline'",
      // Images: self + Supabase storage + Unsplash
      "img-src 'self' data: blob: https://qhcswcttvzahsrdpeqkl.supabase.co https://images.unsplash.com",
      // Fonts
      "font-src 'self'",
      // API calls: self + Supabase + university data APIs
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://universities.hipolabs.com https://api.resend.com",
      // Service worker + push
      "worker-src 'self' blob:",
      // Frames: none
      "frame-src 'none'",
      // Objects: none
      "object-src 'none'",
      // Base URI
      "base-uri 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'qhcswcttvzahsrdpeqkl.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
