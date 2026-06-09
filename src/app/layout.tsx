import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import './globals.css'

// Force toutes les pages en dynamique — évite le SSG qui plante sans env vars
export const dynamic = 'force-dynamic'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',   // enables env(safe-area-inset-*) for notch / Dynamic Island / home indicator
}

export const metadata: Metadata = {
  title: 'AroundLink Community',
  description: 'The community platform for international relations officers',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/api/icon', type: 'image/png' },
    ],
    apple: '/api/icon',
    shortcut: '/api/icon',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AroundLink Community',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/api/icon" type="image/png" />
        <link rel="apple-touch-icon" href="/api/icon" />
        <meta name="theme-color" content="#1a3055" />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
        {/* University data (8.7 MB) est chargé uniquement sur /network — voir network/page.tsx */}
      </body>
    </html>
  )
}
