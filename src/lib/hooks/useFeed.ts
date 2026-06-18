'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGlobalError } from '@/lib/context/ErrorContext'
import { useAuth } from '@/lib/context/AuthContext'
import { notifyMentions } from '@/lib/hooks/useNotifications'
import type { FeedPost, FeedLike, FeedComment, Profile } from '@/lib/supabase/supabase/types'

type ProfileMini = Pick<Profile, 'name' | 'first_name' | 'last_name' | 'institution' | 'avatar_url'>

export type PostWithMeta = FeedPost & {
  likes:    FeedLike[]
  comments: (FeedComment & { profiles: ProfileMini | null })[]
  profiles: ProfileMini | null
}

const SELECT = [
  '*',
  'profiles!feed_posts_user_id_fkey(name, first_name, last_name, institution, avatar_url)',
  'likes:feed_likes(post_id, user_id, created_at)',
  'comments:feed_comments(id, post_id, user_id, text, created_at, profiles!feed_comments_user_id_fkey(name, first_name, last_name, avatar_url))',
].join(', ')

const PAGE_SIZE = 20

export function useFeed(userId: string | undefined) {
  const supabase      = useMemo(() => createClient(), [])
  const { pushError } = useGlobalError()
  const { refreshProfile, profile } = useAuth()
  const [posts,       setPosts]       = useState<PostWithMeta[]>([])
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,     setHasMore]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [page,        setPage]        = useState(0)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('feed_posts')
      .select(SELECT)
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1)
    if (error) { setError(error.message); pushError(error.message); setLoading(false); return }
    if (data) { setPosts(data as unknown as PostWithMeta[]); setHasMore(data.length === PAGE_SIZE); setPage(1) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const from = page * PAGE_SIZE
    const { data, error } = await supabase
      .from('feed_posts')
      .select(SELECT)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error) { pushError(error.message); setLoadingMore(false); return }
    if (data) {
      setPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id))
        return [...prev, ...(data as unknown as PostWithMeta[]).filter(p => !existingIds.has(p.id))]
      })
      setHasMore(data.length === PAGE_SIZE)
      setPage(p => p + 1)
    }
    setLoadingMore(false)
  }, [page, hasMore, loadingMore])

  const createPost = useCallback(async (
    text: string,
    media?: { type: 'image' | 'pdf'; url: string; name: string; urls?: string[] } | null,
    optimisticProfile?: ProfileMini
  ): Promise<string | null> => {
    if (!userId) return 'Not logged in'
    const row: Partial<FeedPost> & { text?: string | null } = { user_id: userId, text: text || null }
    if (media) {
      row.media_type = media.type; row.media_url = media.url; row.media_name = media.name
      // Plusieurs images → carrousel (au moins 2 pour stocker le tableau)
      if (media.urls && media.urls.length > 1) row.media_urls = media.urls
    }

    const tempId = `temp-${Date.now()}`
    const optimistic: PostWithMeta = {
      id: tempId, user_id: userId, text: text || null,
      media_type: media?.type ?? null, media_url: media?.url ?? null, media_name: media?.name ?? null,
      media_urls: (media?.urls && media.urls.length > 1) ? media.urls : null,
      created_at: new Date().toISOString(),
      likes: [], comments: [],
      profiles: optimisticProfile ?? null,
    }
    setPosts(prev => [optimistic, ...prev])

    const { data, error } = await supabase.from('feed_posts').insert(row).select(SELECT).single()
    if (error) { setPosts(prev => prev.filter(p => p.id !== tempId)); pushError(`Could not post: ${error.message}`); return error.message }
    if (data) {
      setPosts(prev => prev.map(p => p.id === tempId ? data as unknown as PostWithMeta : p))
      refreshProfile()
      if (text && text.includes('@') && optimisticProfile) {
        const fromName = `${optimisticProfile.first_name ?? ''} ${optimisticProfile.last_name ?? ''}`.trim() || optimisticProfile.name
        notifyMentions(supabase, text, fromName, 'feed', (data as unknown as PostWithMeta).id, userId).catch(() => {})
      }
    }
    return null
  }, [userId])

  const editPost = useCallback(async (postId: string, newText: string): Promise<string | null> => {
    if (!userId) return 'Not logged in'
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, text: newText } : p))
    const { error } = await supabase.from('feed_posts').update({ text: newText }).eq('id', postId).eq('user_id', userId)
    if (error) { pushError(`Could not edit post: ${error.message}`); fetchPosts(); return error.message }
    return null
  }, [userId, fetchPosts])

  const deletePost = useCallback(async (postId: string): Promise<string | null> => {
    if (!userId) return 'Not logged in'
    setPosts(prev => prev.filter(p => p.id !== postId))
    const { error } = await supabase.from('feed_posts').delete().eq('id', postId).eq('user_id', userId)
    if (error) { pushError(`Could not delete post: ${error.message}`); fetchPosts(); return error.message }
    refreshProfile()
    return null
  }, [userId, fetchPosts])

  const toggleLike = useCallback(async (postId: string) => {
    if (!userId) return
    const post = posts.find(p => p.id === postId)
    const hasLiked = post?.likes.some(l => l.user_id === userId)
    if (hasLiked) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: p.likes.filter(l => l.user_id !== userId) } : p))
      await supabase.from('feed_likes').delete().eq('post_id', postId).eq('user_id', userId)
    } else {
      const newLike: FeedLike = { post_id: postId, user_id: userId, created_at: new Date().toISOString() }
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: [...p.likes, newLike] } : p))
      await supabase.from('feed_likes').insert({ post_id: postId, user_id: userId })
    }
    refreshProfile()
  }, [userId, posts])

  const addComment = useCallback(async (postId: string, text: string, fromName?: string) => {
    if (!userId || !text.trim()) return
    const post = posts.find(p => p.id === postId)
    const postAuthorId = post?.user_id

    const { data } = await supabase.from('feed_comments')
      .insert({ post_id: postId, user_id: userId, text })
      .select('*, profiles(name, first_name, last_name)')
      .single()
    if (data) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: [...p.comments, data as FeedComment & { profiles: ProfileMini | null }] } : p))
      refreshProfile()
      if (text.includes('@') && fromName) {
        notifyMentions(supabase, text, fromName, 'feed', postId, userId).catch(() => {})
      }
    }

    if (postAuthorId && postAuthorId !== userId) {
      const commenterName = profile
        ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || profile.name || 'Someone'
        : fromName || 'Someone'
      supabase.from('notifications').insert({
        user_id: postAuthorId, from_name: commenterName,
        type: 'comment', source: 'feed', post_id: postId,
      }).then(() => {})
      fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: [postAuthorId],
          title: `${commenterName} commented on your post`,
          body: text.trim().slice(0, 120),
          url: '/feed', tag: 'feed-comment',
        }),
      }).catch(() => {})
    }
  }, [userId, posts, profile])

  return { posts, loading, loadingMore, hasMore, loadMore, error, createPost, toggleLike, addComment, deletePost, editPost }
}