'use client'
import { useEffect, useState,useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGlobalError } from '@/lib/context/ErrorContext'

export type UserStats = {
  feed_posts: number
  channel_messages: number
  files_shared: number
  likes_given: number
}

export function useStats(userId: string | undefined) {
  const supabase = useMemo(() => createClient(), [])
  const { pushError } = useGlobalError()
  const [stats, setStats] = useState<UserStats>({ feed_posts: 0, channel_messages: 0, files_shared: 0, likes_given: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single()
      .then(({ data, error }) => {
        if (error && error.code !== 'PGRST116') {
          // PGRST116 = no rows found, which is expected for new users
          pushError(`Stats error: ${error.message}`, 'warn')
        }
        if (data) setStats({
          feed_posts: Number(data.feed_posts) || 0,
          channel_messages: Number(data.channel_messages) || 0,
          files_shared: Number(data.files_shared) || 0,
          likes_given: Number(data.likes_given) || 0,
        })
        setLoading(false)
      })
  }, [userId])

  return { stats, loading }
}
