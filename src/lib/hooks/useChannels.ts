'use client'
import { useEffect, useState, useCallback, useMemo} from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGlobalError } from '@/lib/context/ErrorContext'
import { notifyMentions } from '@/lib/hooks/useNotifications'
import type { Channel, Upload } from '@/lib/supabase/supabase/types'

export type ChannelPostLike = { post_id: string; user_id: string; created_at: string }
export type ChannelPostComment = {
  id: string; post_id: string; user_id: string; text: string; created_at: string
  profiles: { name: string | null; first_name: string | null; last_name: string | null; avatar_url: string | null } | null
}
export type ChannelPostWithProfile = {
  id: string; channel_id: string; user_id: string; text: string | null
  media_type: string | null; media_url: string | null; media_name: string | null
  created_at: string
  profiles: { name: string; first_name: string | null; last_name: string | null; avatar_url: string | null } | null
  likes: ChannelPostLike[]
  comments: ChannelPostComment[]
}

/**
 * channelId — si fourni, charge uniquement les posts de ce channel (50 max).
 * Si absent (liste / resources), aucun post n'est chargé → pas de requête lourde.
 *
 * userProfile — attaché aux messages envoyés pour affichage optimiste immédiat.
 */
export function useChannels(
  userId: string | undefined,
  userProfile?: { name?: string | null; first_name?: string | null; last_name?: string | null } | null,
  channelId?: string,
) {
  const supabase = useMemo(() => createClient(), [])
  const { pushError } = useGlobalError()
  const [channels,     setChannels] = useState<Channel[]>([])
  const [myChannelIds, setMyIds]    = useState<Set<string>>(new Set())
  const [posts,        setPosts]    = useState<ChannelPostWithProfile[]>([])
  const [uploads,      setUploads]  = useState<Upload[]>([])
  const [loading,      setLoading]  = useState(true)

  useEffect(() => {
    // Always fetch channel list + membership
    supabase.from('channels').select('*').order('name')
      .then(({ data, error }) => {
        if (error) pushError(`Channels list error: ${error.message}`)
        if (data) setChannels(data)
      })

    if (!userId) { setLoading(false); return }

    supabase.from('channel_members').select('channel_id').eq('user_id', userId)
      .then(({ data, error }) => {
        if (error) pushError(`Channel membership error: ${error.message}`)
        if (data) setMyIds(new Set(data.map(d => d.channel_id)))
      })

    // Posts — chargés uniquement si on est dans un channel spécifique
    if (channelId) {
      supabase.from('channel_posts')
        .select([
          '*',
          'profiles!channel_posts_user_id_fkey(name, first_name, last_name, avatar_url)',
          'likes:channel_post_likes(post_id, user_id, created_at)',
          'comments:channel_post_comments(id, post_id, user_id, text, created_at, profiles!channel_post_comments_user_id_fkey(name, first_name, last_name, avatar_url))',
        ].join(', '))
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })   // newest first → reverse below for chat order
        .limit(80)
        .then(({ data, error }) => {
          if (error) pushError(`Channel messages error: ${error.message}`)
          if (data) setPosts([...(data as unknown as typeof posts)].reverse())  // oldest→newest for display
        })
    }

    // Uploads — chargés dans tous les cas (légers, utilisés pour Resources)
    supabase.from('uploads').select('*').order('created_at', { ascending: false }).limit(200)
      .then(({ data, error }) => {
        if (error) pushError(`Uploads error: ${error.message}`)
        if (data) setUploads(data)
        setLoading(false)
      })
  }, [userId, channelId])

  const getPostsForChannel   = (id: string) => posts.filter(p => p.channel_id === id)
  const getUploadsForChannel = (id: string) => uploads.filter(u => u.channel_id === id)

  const joinChannel = useCallback(async (cId: string) => {
    if (!userId) return
    const { error } = await supabase.from('channel_members').insert({ channel_id: cId, user_id: userId })
    if (error) { pushError(`Could not join: ${error.message}`); return }
    setMyIds(prev => new Set([...prev, cId]))
  }, [userId])

  const leaveChannel = useCallback(async (cId: string) => {
    if (!userId) return
    const { error } = await supabase.from('channel_members').delete().eq('channel_id', cId).eq('user_id', userId)
    if (error) { pushError(`Could not leave: ${error.message}`); return }
    setMyIds(prev => { const s = new Set(prev); s.delete(cId); return s })
  }, [userId])

  const sendMessage = useCallback(async (
    cId: string, text: string, media?: { type: 'image'|'pdf'; url: string; name: string } | null
  ): Promise<{ data: any; error: string | null }> => {
    if (!userId) return { data: null, error: 'Not logged in' }
    const row: any = { channel_id: cId, user_id: userId, text: text || null }
    if (media) { row.media_type = media.type; row.media_url = media.url; row.media_name = media.name }
    const { data, error } = await supabase.from('channel_posts').insert(row).select().single()
    if (error) { pushError(`Message not sent: ${error.message}`); return { data: null, error: error.message } }
    if (data) {
      const withProfile: ChannelPostWithProfile = {
        ...data,
        profiles: userProfile
          ? { name: userProfile.name ?? '', first_name: userProfile.first_name ?? null, last_name: userProfile.last_name ?? null }
          : null,
        likes: [],
        comments: [],
      }
      setPosts(prev => [...prev, withProfile])

      if (text && text.includes('@')) {
        const fromName = userProfile
          ? `${userProfile.first_name ?? ''} ${userProfile.last_name ?? ''}`.trim() || userProfile.name || ''
          : ''
        const channel = channels.find(c => c.id === cId)

        // @all → notifie tous les membres du channel
        if (text.includes('@all')) {
          supabase
            .from('channel_members')
            .select('user_id')
            .eq('channel_id', cId)
            .neq('user_id', userId)
            .then(({ data: members }) => {
              if (!members?.length) return
              const rows = members.map(m => ({
                user_id:      m.user_id,
                from_name:    fromName,
                source:       'channel',
                channel_id:   cId,
                channel_name: channel?.name ?? null,
                post_id:      data.id,
              }))
              supabase.from('notifications').insert(rows).then(() => {})
            })
        }

        // Mentions individuelles (async, ne bloque pas l'UI)
        notifyMentions(supabase, text, fromName, 'channel', data.id, userId, cId, channel?.name ?? null)
          .catch(() => {/* silent */})
      }
    }
    return { data, error: null }
  }, [userId, userProfile, channels])

  const uploadDoc = useCallback(async (name: string, cId: string, fileUrl?: string, fileType?: string) => {
    if (!userId) return null
    const { data, error } = await supabase.from('uploads')
      .insert({ channel_id: cId, user_id: userId, name, file_url: fileUrl ?? null, file_type: fileType ?? null })
      .select().single()
    if (error) { pushError(`File upload failed: ${error.message}`); return null }
    if (data) setUploads(prev => [data, ...prev])
    return data
  }, [userId])

  const createChannel = useCallback(async (emoji: string, name: string, description: string): Promise<string | null> => {
    if (!userId) return 'Not logged in'
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40)
    const { data, error } = await supabase.from('channels')
      .insert({ id, emoji, name, description, is_official: false, created_by: userId })
      .select().single()
    if (error) { pushError(`Channel creation error: ${error.message}`); return error.message }
    if (data) setChannels(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return null
  }, [userId])

  const updateChannel = useCallback(async (channelId: string, fields: { emoji?: string; name?: string; description?: string }): Promise<string | null> => {
    const { data, error } = await supabase.from('channels').update(fields).eq('id', channelId).select().single()
    if (error) { pushError(`Channel update error: ${error.message}`); return error.message }
    if (data) setChannels(prev => prev.map(c => c.id === channelId ? data : c).sort((a, b) => a.name.localeCompare(b.name)))
    return null
  }, [])

  const editPost = useCallback(async (postId: string, newText: string): Promise<string | null> => {
    if (!userId) return 'Not logged in'
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, text: newText } : p))
    const { error } = await supabase
      .from('channel_posts')
      .update({ text: newText })
      .eq('id', postId)
      .eq('user_id', userId)
    if (error) {
      pushError(`Could not edit message: ${error.message}`)
      return error.message
    }
    return null
  }, [userId])

  const deletePost = useCallback(async (postId: string): Promise<string | null> => {
    if (!userId) return 'Not logged in'
    setPosts(prev => prev.filter(p => p.id !== postId))
    const { error } = await supabase
      .from('channel_posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', userId)
    if (error) {
      pushError(`Could not delete message: ${error.message}`)
      return error.message
    }
    return null
  }, [userId])

  const toggleLike = useCallback(async (postId: string) => {
    if (!userId) return
    const post = posts.find(p => p.id === postId)
    const hasLiked = post?.likes.some(l => l.user_id === userId)
    if (hasLiked) {
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, likes: p.likes.filter(l => l.user_id !== userId) } : p))
      await supabase.from('channel_post_likes').delete().eq('post_id', postId).eq('user_id', userId)
    } else {
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, likes: [...p.likes, { post_id: postId, user_id: userId, created_at: new Date().toISOString() }] } : p))
      await supabase.from('channel_post_likes').insert({ post_id: postId, user_id: userId })
    }
  }, [userId, posts])

  const addComment = useCallback(async (postId: string, text: string) => {
    if (!userId || !text.trim()) return

    // Find post author before insert
    const post = posts.find(p => p.id === postId)
    const postAuthorId = post?.user_id

    const { data } = await supabase.from('channel_post_comments')
      .insert({ post_id: postId, user_id: userId, text: text.trim() })
      .select('*, profiles!channel_post_comments_user_id_fkey(name, first_name, last_name, avatar_url)')
      .single()
    if (data) {
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, comments: [...p.comments, data as unknown as typeof p.comments[0]] } : p))
    }

    // Push notification to post author (skip if same user)
    if (postAuthorId && postAuthorId !== userId && post?.channel_id) {
      const commenterName = userProfile
        ? `${userProfile.first_name ?? ''} ${userProfile.last_name ?? ''}`.trim() || userProfile.name || 'Someone'
        : 'Someone'
      // Insert notification row so badge count is accurate
      supabase.from('notifications').insert({
        user_id: postAuthorId, from_name: commenterName,
        type: 'comment', source: 'channel',
        channel_id: post.channel_id, post_id: postId,
      }).then(() => {})
      fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: [postAuthorId],
          title: `${commenterName} commented on your message`,
          body: text.trim().slice(0, 120),
          url: `/channels/${post.channel_id}`,
          tag: 'channel-comment',
        }),
      }).catch(() => { /* fire-and-forget */ })
    }
  }, [userId, userProfile, posts])

  const subscribeToChannel = useCallback((cId: string, onNewPost: (p: ChannelPostWithProfile) => void) => {
    const sub = supabase.channel(`ch-${cId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'channel_posts',
        filter: `channel_id=eq.${cId}`
      }, payload => onNewPost(payload.new as ChannelPostWithProfile))
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  return {
    channels, myChannelIds: Array.from(myChannelIds), posts, uploads, loading,
    getPostsForChannel, getUploadsForChannel,
    joinChannel, leaveChannel, sendMessage, uploadDoc, subscribeToChannel, createChannel, updateChannel,
    toggleLike, addComment, deletePost, editPost,
  }
}