'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Minimalist SVG icons
const IconFeed = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? '#1a3055' : '#94a3b8'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16M4 12h16M4 18h10"/>
  </svg>
)
const IconChannels = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? '#1a3055' : '#94a3b8'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)
const IconMessages = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? '#1a3055' : '#94a3b8'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
)
const IconNetwork = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? '#1a3055' : '#94a3b8'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const IconAgenda = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? '#1a3055' : '#94a3b8'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

type Props = { dmUnread?: number }

export default function BottomNav({ dmUnread = 0 }: Props) {
  const pathname = usePathname()

  // Hide completely on individual DM conversation pages (keyboard would push it up)
  // The regex matches /messages/<uuid> but not /messages (list)
  if (/^\/messages\/.+/.test(pathname)) return null

  const NAV = [
    { href: '/feed',     label: 'Feed',         Icon: IconFeed,     badge: 0 },
    { href: '/agenda',   label: 'Agenda',        Icon: IconAgenda,   badge: 0 },
    { href: '/network',  label: 'Institutions',  Icon: IconNetwork,  badge: 0 },
    { href: '/channels', label: 'Channels',      Icon: IconChannels, badge: 0 },
    { href: '/messages', label: 'Messages',      Icon: IconMessages, badge: dmUnread },
  ] as const

  return (
    <nav className="bottom-nav">
      {NAV.map(({ href, label, Icon, badge }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link key={href} href={href} style={{ textDecoration: 'none', flex: 1 }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 3, paddingTop: 12, paddingBottom: 4,
            }}>
              <div style={{ position: 'relative' }}>
                <Icon active={active} />
                {badge > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -6,
                    background: '#ef4444', color: 'white',
                    fontSize: 9, fontWeight: 800, borderRadius: 999,
                    minWidth: 16, height: 16, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                  }}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 10, fontWeight: active ? 700 : 500,
                color: active ? '#1a3055' : '#94a3b8',
              }}>{label}</span>
              {active && (
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#1a3055', marginTop: 1 }}/>
              )}
            </div>
          </Link>
        )
      })}
    </nav>
  )
}
