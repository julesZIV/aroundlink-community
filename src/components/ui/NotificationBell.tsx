'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { MentionNotif } from '@/lib/hooks/useNotifications'

interface Props {
  totalUnread: number
  channelUnread: Record<string, number>
  channels: { id: string; name: string; emoji: string | null }[]
  mentions: MentionNotif[]
  onMarkChannelRead: (id: string) => void
  onMarkMentionRead: (id: string) => void
  onMarkAllRead: () => void
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return 'now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export default function NotificationBell({
  totalUnread, channelUnread, channels, mentions,
  onMarkChannelRead, onMarkMentionRead, onMarkAllRead,
}: Props) {
  const [open, setOpen] = useState(false)
  const [joining, setJoining] = useState<string | null>(null)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const router  = useRouter()
  const supabase = createClient()
  const ref      = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Adjust panel position so it doesn't overflow left edge on mobile
  useLayoutEffect(() => {
    if (!open || !panelRef.current) return
    const rect = panelRef.current.getBoundingClientRect()
    if (rect.left < 8) {
      // shift panel right so it stays 8px from left edge
      setPanelStyle({ right: rect.left - 8 })
    } else {
      setPanelStyle({})
    }
  }, [open])

  // Separate invites from mentions
  const invites   = mentions.filter(m => m.type === 'invite')
  const realMentions = mentions.filter(m => m.type !== 'invite')

  const unreadChannels = Object.entries(channelUnread)
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id, count]) => ({ id, count, channel: channels.find(c => c.id === id) }))
    .filter(x => x.channel)

  const hasAny = unreadChannels.length > 0 || mentions.length > 0

  const handleJoinInvite = async (notif: MentionNotif) => {
    if (!notif.channel_id) return
    setJoining(notif.id)
    await supabase.from('channel_members').insert({ channel_id: notif.channel_id, user_id: (await supabase.auth.getUser()).data.user?.id })
    onMarkMentionRead(notif.id)
    setJoining(null)
    setOpen(false)
    router.push(`/channels/${notif.channel_id}`)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        style={{
          position: 'relative',
          background: open ? '#eef6ff' : 'none',
          border: open ? '1px solid #bfdbfe' : '1px solid transparent',
          borderRadius: 8, cursor: 'pointer',
          width: 32, height: 32,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: open ? '#1a3055' : '#64748b',
          transition: 'all 0.15s',
        }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {totalUnread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#ef4444', color: 'white',
            fontSize: 9, fontWeight: 900, borderRadius: 99,
            minWidth: 16, height: 16, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', lineHeight: 1,
            border: '1.5px solid white',
          }}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div ref={panelRef} style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8,
          background: 'white', border: '1px solid #e2e8f0', borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 200,
          width: 320, maxWidth: 'calc(100vw - 16px)', maxHeight: 480, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          ...panelStyle,
        }}>
          {/* Header */}
          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#1a3055' }}>Notifications</p>
            {hasAny && (
              <button onClick={onMarkAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#64748b' }}>
                Mark all read
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {!hasAny && (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 24, marginBottom: 8 }}>🔔</p>
                <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>All up to date!</p>
              </div>
            )}

            {/* ── Invitations ── */}
            {invites.length > 0 && (
              <>
                <p style={{ margin: 0, padding: '10px 16px 6px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Invitations
                </p>
                {invites.map(notif => (
                  <div key={notif.id} style={{ padding: '10px 16px', borderBottom: '1px solid #f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: '#f0fdf4', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 18,
                      }}>
                        {channels.find(c => c.id === notif.channel_id)?.emoji ?? '💬'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12, color: '#1a3055', lineHeight: 1.4 }}>
                          <strong>{notif.from_name}</strong> invited you to join{' '}
                          <strong>#{notif.channel_name ?? notif.channel_id}</strong>
                        </p>
                        <p style={{ margin: '2px 0 8px', fontSize: 10, color: '#94a3b8' }}>
                          {timeAgo(notif.created_at)}
                        </p>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleJoinInvite(notif)}
                            disabled={joining === notif.id}
                            style={{
                              background: '#1a3055', color: 'white', border: 'none',
                              borderRadius: 8, padding: '5px 12px', fontSize: 11,
                              fontWeight: 700, cursor: 'pointer', opacity: joining === notif.id ? 0.6 : 1,
                            }}>
                            {joining === notif.id ? '…' : '✓ Join'}
                          </button>
                          <button
                            onClick={() => onMarkMentionRead(notif.id)}
                            style={{
                              background: '#f1f5f9', color: '#64748b', border: 'none',
                              borderRadius: 8, padding: '5px 12px', fontSize: 11,
                              fontWeight: 600, cursor: 'pointer',
                            }}>
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* ── Channels with unread posts ── */}
            {unreadChannels.length > 0 && (
              <>
                <p style={{ margin: 0, padding: '10px 16px 6px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', borderTop: invites.length > 0 ? '1px solid #f1f5f9' : 'none' }}>
                  New messages
                </p>
                {unreadChannels.map(({ id, count, channel }) => (
                  <button
                    key={id}
                    onClick={() => { onMarkChannelRead(id); router.push(`/channels/${id}`); setOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '10px 16px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      textAlign: 'left', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: '#f1f5f9', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 18,
                    }}>
                      {channel!.emoji ?? '💬'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1a3055', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {channel!.name}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: '#64748b', marginTop: 1 }}>
                        {count} new message{count > 1 ? 's' : ''}
                      </p>
                    </div>
                    <span style={{
                      background: '#1a3055', color: 'white',
                      fontSize: 10, fontWeight: 800, borderRadius: 99,
                      minWidth: 20, height: 20, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      padding: '0 5px', flexShrink: 0,
                    }}>
                      {count}
                    </span>
                  </button>
                ))}
              </>
            )}

            {/* ── Mentions ── */}
            {realMentions.length > 0 && (
              <>
                <p style={{ margin: 0, padding: '10px 16px 6px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', borderTop: (unreadChannels.length > 0 || invites.length > 0) ? '1px solid #f1f5f9' : 'none' }}>
                  Mentions
                </p>
                {realMentions.map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onMarkMentionRead(m.id)
                      if (m.source === 'channel' && m.channel_id) router.push(`/channels/${m.channel_id}`)
                      else router.push('/feed')
                      setOpen(false)
                    }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      width: '100%', padding: '10px 16px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      textAlign: 'left', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: '#eff6ff', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 16,
                    }}>
                      @
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, color: '#1a3055', lineHeight: 1.4 }}>
                        <strong>{m.from_name}</strong> mentioned you
                        {m.channel_name ? <span style={{ color: '#64748b' }}> in <strong>#{m.channel_name}</strong></span> : ' in the feed'}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 10, color: '#94a3b8' }}>{timeAgo(m.created_at)}</p>
                    </div>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: 4 }}/>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
