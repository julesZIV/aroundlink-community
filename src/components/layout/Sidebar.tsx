'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSidebarData } from '@/lib/hooks/useSidebarData'
import { useState, useEffect } from 'react'
import { NavIcon } from '@/components/NavIcon'

const BASE_NAV = [
  { href: '/feed',     icon: 'feed'         as const, label: 'Feed'         },
  { href: '/agenda',   icon: 'agenda'       as const, label: 'Agenda'       },
  { href: '/network',  icon: 'institutions' as const, label: 'Institutions' },
  { href: '/channels', icon: 'channels'     as const, label: 'Channels'     },
  { href: '/messages', icon: 'messages'     as const, label: 'Messages'     },
]

function Logo({ size = 26, color = 'white' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="20" r="10" fill={color}/><circle cx="80" cy="38" r="8" fill={color}/>
      <circle cx="75" cy="68" r="10" fill={color}/><circle cx="50" cy="82" r="8" fill={color}/>
      <circle cx="25" cy="68" r="10" fill={color}/><circle cx="20" cy="38" r="8" fill={color}/>
      <circle cx="38" cy="50" r="6" fill={color} fillOpacity="0.5"/><circle cx="62" cy="50" r="6" fill={color} fillOpacity="0.5"/>
      <line x1="50" y1="20" x2="80" y2="38" stroke={color} strokeWidth="3"/>
      <line x1="80" y1="38" x2="75" y2="68" stroke={color} strokeWidth="3"/>
      <line x1="75" y1="68" x2="50" y2="82" stroke={color} strokeWidth="3"/>
      <line x1="50" y1="82" x2="25" y2="68" stroke={color} strokeWidth="3"/>
      <line x1="25" y1="68" x2="20" y2="38" stroke={color} strokeWidth="3"/>
      <line x1="20" y1="38" x2="50" y2="20" stroke={color} strokeWidth="3"/>
    </svg>
  )
}

export default function Sidebar({ dmUnread = 0 }: { dmUnread?: number }) {
  const pathname = usePathname()
  const { user, profile } = useAuth()
  const appRole = profile?.app_role ?? ''
  const isAdmin = appRole === 'admin'                          // toggle sections : admin seulement
  const canManage = ['admin', 'moderator'].includes(appRole)  // accès admin panel
  const { myChannelIds, unreadCounts, totalUnread } = useSidebarData(user?.id)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [communityName, setCommunityName] = useState('AroundLink')
  const [networkVisible, setNetworkVisible] = useState(true)
  const [myChannels, setMyChannels] = useState<{ id: string; name: string; emoji: string | null }[]>([])

  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      const client = createClient()
      client.from('app_settings').select('value').eq('key', 'community_logo_url').single()
        .then(({ data }) => { if (data?.value) setLogoUrl(data.value) })
      client.from('app_settings').select('value').eq('key', 'community_name').single()
        .then(({ data }) => { if (data?.value) setCommunityName(data.value) })
      client.from('app_settings').select('value').eq('key', 'section_network_visible').single()
        .then(({ data }) => {
          if (data?.value !== undefined) setNetworkVisible(data.value !== 'false' && data.value !== false)
        })
    })
  }, [])

  // Fetch all joined channels from DB (not the hardcoded CHANNELS constant)
  useEffect(() => {
    if (!myChannelIds || myChannelIds.length === 0) { setMyChannels([]); return }
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient()
        .from('channels')
        .select('id, name, emoji')
        .in('id', myChannelIds)
        .order('name')
        .then(({ data }) => { if (data) setMyChannels(data) })
    })
  }, [myChannelIds])

  const toggleNetwork = async () => {
    const next = !networkVisible
    setNetworkVisible(next)
    const { createClient } = await import('@/lib/supabase/client')
    await createClient().from('app_settings').upsert({ key: 'section_network_visible', value: String(next) }, { onConflict: 'key' })
  }

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Link href="/feed" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          {logoUrl
            ? <img src={logoUrl} style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} alt="Community logo" />
            : <Logo/>}
          <p style={{ fontWeight: 800, color: 'white', fontSize: 13, lineHeight: '1.2', margin: 0 }}>{communityName}</p>
        </Link>
      </div>

      {/* Main Nav */}
      <nav style={{ padding: '10px' }}>
        {BASE_NAV.map(item => {
          // Network visibility logic
          if (item.href === '/network') {
            if (!networkVisible && !isAdmin) return null
          }
          const active = pathname.startsWith(item.href) && (item.href !== '/channels' || pathname === '/channels')
          const badge  = item.href === '/channels' && totalUnread > 0 ? totalUnread
                       : item.href === '/messages' && dmUnread > 0   ? dmUnread : 0
          const dimmed = item.href === '/network' && isAdmin && !networkVisible
          return (
            <div key={item.href} style={{ display: 'flex', alignItems: 'center', opacity: dimmed ? 0.4 : 1 }}>
              <Link href={item.href} style={{ textDecoration: 'none', flex: 1 }}>
                <button className={`snav-btn ${active ? 'active' : ''}`} style={{ position: 'relative', width: '100%' }}>
                  <span style={{ display: 'flex', alignItems: 'center' }}><NavIcon name={item.icon} size={20} /></span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                  {badge > 0 && (
                    <span style={{
                      background: '#ef4444', color: 'white', borderRadius: '999px',
                      fontSize: 10, fontWeight: 800, padding: '1px 6px', minWidth: 18,
                      textAlign: 'center', lineHeight: '16px'
                    }}>{badge > 99 ? '99+' : badge}</span>
                  )}
                </button>
              </Link>
              {item.href === '/network' && isAdmin && (
                <button onClick={toggleNetwork} title={networkVisible ? 'Hide from members' : 'Show to members'}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 14, padding: '0 6px', flexShrink: 0 }}>
                  {networkVisible ? '👁' : '🚫'}
                </button>
              )}
            </div>
          )
        })}
      </nav>

      {/* My Channels shortcuts */}
      {myChannels.length > 0 && (
        <div style={{ padding: '0 10px', flex: 1, overflowY: 'auto' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 8px 4px' }}>
            My Channels
          </p>
          {myChannels.map(ch => {
            const unread = unreadCounts[ch.id] ?? 0
            const active = pathname === `/channels/${ch.id}`
            return (
              <Link key={ch.id} href={`/channels/${ch.id}`} style={{ textDecoration: 'none' }}>
                <button className={`snav-btn ${active ? 'active' : ''}`}
                  style={{ padding: '6px 8px', fontSize: 12, position: 'relative' }}>
                  <span style={{ fontSize: 13 }}>{ch.emoji ?? null}</span>
                  <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    #{ch.name}
                  </span>
                  {unread > 0 && (
                    <span style={{
                      background: '#ef4444', color: 'white', borderRadius: '999px',
                      fontSize: 9, fontWeight: 800, padding: '1px 5px', minWidth: 16,
                      textAlign: 'center', lineHeight: '14px', flexShrink: 0
                    }}>{unread > 99 ? '99+' : unread}</span>
                  )}
                </button>
              </Link>
            )
          })}
        </div>
      )}

      {/* Hidden sections bandeau — admin only */}
      {isAdmin && !networkVisible && (
        <div style={{ margin: '0 10px 6px', background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', flex: 1 }}>🌐 Network — hidden</span>
          <button onClick={toggleNetwork} title="Show section" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 14, padding: 0 }}>👁</button>
        </div>
      )}

      {/* Footer links */}
      <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 'auto' }}>
        <div style={{ display: 'flex', gap: 8, padding: '4px 8px' }}>
          <Link href="/privacy" style={{ textDecoration: 'none' }}>
            <span style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.03em', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}>
              Privacy
            </span>
          </Link>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>·</span>
          <Link href="/cgu" style={{ textDecoration: 'none' }}>
            <span style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.03em', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}>
              Terms
            </span>
          </Link>
        </div>
      </div>
    </aside>
  )
}
