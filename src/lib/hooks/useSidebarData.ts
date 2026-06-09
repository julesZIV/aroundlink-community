'use client'
import { useEffect, useState, useCallback,useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

const KEY = (channelId: string) => `al_last_read_${channelId}`

/**
 * Lightweight hook for the Sidebar.
 * Fetches ONLY channel_id + created_at (no full post text/profiles/uploads)
 * replacing the heavy useChannels(500 posts + 200 uploads) + useUnread combo.
 */
export function useSidebarData(userId: string | undefined) {
  const supabase = useMemo(() => createClient(), [])
  const [myChannelIds,  setMyChannelIds]  = useState<string[]>([])
  const [unreadCounts,  setUnreadCounts]  = useState<Record<string, number>>({})

  useEffect(() => {
    if (!userId) return

    supabase
      .from('channel_members')
      .select('channel_id')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (!data) return
        const ids = data.map(d => d.channel_id)
        setMyChannelIds(ids)

        // Read last-read timestamps from localStorage
        const readMap: Record<string, string> = {}
        ids.forEach(id => {
          const v = localStorage.getItem(KEY(id))
          if (v) readMap[id] = v
        })

        // Fetch only channel_id + created_at — past 30 days, no text/profiles
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        supabase
          .from('channel_posts')
          .select('channel_id, created_at')
          .in('channel_id', ids)
          .gte('created_at', monthAgo)
          .then(({ data: posts }) => {
            if (!posts) return
            const counts: Record<string, number> = {}
            ids.forEach(channelId => {
              const since = readMap[channelId]
              counts[channelId] = posts.filter(p =>
                p.channel_id === channelId && (!since || p.created_at > since)
              ).length
            })
            setUnreadCounts(counts)
          })
      })
  }, [userId])

  const markAsRead = useCallback((channelId: string) => {
    const now = new Date().toISOString()
    localStorage.setItem(KEY(channelId), now)
    setUnreadCounts(prev => ({ ...prev, [channelId]: 0 }))
  }, [])

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0)

  return { myChannelIds, unreadCounts, totalUnread, markAsRead }
}
