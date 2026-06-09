'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

export type MentionNotif = {
  id: string
  from_name: string
  type: 'mention' | 'invite' | 'comment' | 'like' | 'system'
  source: 'channel' | 'feed' | 'invite'
  channel_id: string | null
  channel_name: string | null
  post_id: string | null
  read: boolean
  created_at: string
}

export function useNotifications(userId: string | undefined) {
  const supabase = useMemo(() => createClient(), [])
  const [channelUnread, setChannelUnread] = useState<Record<string, number>>({})
  const [mentions,      setMentions]      = useState<MentionNotif[]>([])

  const load = useCallback(async () => {
    if (!userId) return
    // Unread per channel via SQL function
    const { data: counts } = await supabase.rpc('get_channel_unread', { p_user_id: userId })
    if (counts) {
      const map: Record<string, number> = {}
      counts.forEach((r: any) => { if (r.unread > 0) map[r.channel_id] = Number(r.unread) })
      setChannelUnread(map)
    }
    // Mention notifications
    const { data: notifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(30)
    if (notifs) setMentions(notifs as MentionNotif[])
  }, [userId])

  useEffect(() => {
    load()
    if (!userId) return
    // Realtime — new mention arrives
    const sub = supabase.channel(`notif-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, payload => {
        setMentions(prev => [payload.new as MentionNotif, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [userId])

  // Called when entering a channel
  const markChannelRead = useCallback(async (channelId: string) => {
    if (!userId) return
    await supabase.from('channel_last_seen')
      .upsert({ user_id: userId, channel_id: channelId, last_seen_at: new Date().toISOString() },
               { onConflict: 'user_id,channel_id' })
    setChannelUnread(prev => { const n = { ...prev }; delete n[channelId]; return n })
  }, [userId])

  const markMentionRead = useCallback(async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setMentions(prev => prev.filter(m => m.id !== id))
  }, [])

  const markAllRead = useCallback(async () => {
    if (!userId) return
    await supabase.from('notifications').update({ read: true })
      .eq('user_id', userId).eq('read', false)
    setMentions([])
  }, [userId])

  const totalUnread =
    Object.values(channelUnread).filter(n => n > 0).length + mentions.length

  return { channelUnread, mentions, totalUnread, markChannelRead, markMentionRead, markAllRead, reload: load }
}

// ── Helper : crée des notifications de mention après un post ─────────────────
export async function notifyMentions(
  supabase: ReturnType<typeof createClient>,
  text: string,
  fromName: string,
  source: 'channel' | 'feed',
  postId: string,
  myUserId: string,
  channelId?: string | null,
  channelName?: string | null,
) {
  // Capture @Prénom ou @Prénom Nom (1-2 mots)
  const raw = text.match(/@([\wÀ-ſ]+(?:[ ][\wÀ-ſ]+)?)/g) ?? []
  const queries = [...new Set(raw.map(m => m.slice(1).trim()))]
  for (const q of queries) {
    const parts = q.split(' ')
    const filter = parts.length > 1
      ? `name.ilike.%${q}%`
      : `first_name.ilike.${q},name.ilike.${q}%`
    const { data } = await supabase.from('profiles')
      .select('id').or(filter).neq('id', myUserId).limit(2)
    if (!data?.length) continue
    for (const u of data) {
      await supabase.from('notifications').insert({
        user_id: u.id, from_name: fromName, source,
        channel_id: channelId ?? null,
        channel_name: channelName ?? null,
        post_id: postId,
      })
    }
  }
}
