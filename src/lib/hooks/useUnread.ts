'use client'
import { useCallback, useEffect, useState } from 'react'
import type { ChannelPostWithProfile } from './useChannels'

const KEY = (channelId: string) => `al_last_read_${channelId}`

export function useUnread(posts: ChannelPostWithProfile[], myChannelIds: string[]) {
  const [lastRead, setLastRead] = useState<Record<string, string>>({})

  // Load from localStorage on mount
  useEffect(() => {
    const map: Record<string, string> = {}
    myChannelIds.forEach(id => {
      const v = localStorage.getItem(KEY(id))
      if (v) map[id] = v
    })
    setLastRead(map)
  }, [myChannelIds.join(',')])

  // Count unread per channel
  const unreadCounts: Record<string, number> = {}
  myChannelIds.forEach(channelId => {
    const since = lastRead[channelId]
    if (!since) {
      // Never visited — count all posts in that channel
      unreadCounts[channelId] = posts.filter(p => p.channel_id === channelId).length
    } else {
      unreadCounts[channelId] = posts.filter(
        p => p.channel_id === channelId && p.created_at > since
      ).length
    }
  })

  // Call this when user opens a channel
  const markAsRead = useCallback((channelId: string) => {
    const now = new Date().toISOString()
    localStorage.setItem(KEY(channelId), now)
    setLastRead(prev => ({ ...prev, [channelId]: now }))
  }, [])

  return { unreadCounts, markAsRead }
}
