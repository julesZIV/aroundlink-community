'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NavIcon } from '@/components/NavIcon'

type Props = { dmUnread?: number }

export default function BottomNav({ dmUnread = 0 }: Props) {
  const pathname = usePathname()

  // Hide completely on individual DM conversation pages (keyboard would push it up)
  // The regex matches /messages/<uuid> but not /messages (list)
  if (/^\/messages\/.+/.test(pathname)) return null

  const NAV = [
    { href: '/feed',     label: 'Feed',         icon: 'feed'         as const, badge: 0 },
    { href: '/agenda',   label: 'Agenda',        icon: 'agenda'       as const, badge: 0 },
    { href: '/network',  label: 'Institutions',  icon: 'institutions' as const, badge: 0 },
    { href: '/channels', label: 'Channels',      icon: 'channels'     as const, badge: 0 },
    { href: '/messages', label: 'Messages',      icon: 'messages'     as const, badge: dmUnread },
  ] as const

  return (
    <nav className="bottom-nav">
      {NAV.map(({ href, label, icon, badge }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link key={href} href={href} style={{ textDecoration: 'none', flex: 1 }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 3, paddingTop: 12, paddingBottom: 4,
            }}>
              <div style={{ position: 'relative', color: active ? '#1a3055' : '#94a3b8' }}>
                <NavIcon name={icon} size={22} />
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
