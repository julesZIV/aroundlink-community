'use client'
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

export type DMProfile = {
  name: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  institution: string | null
}

export type DirectMessage = {
  id: string
  conversation_id: string
  sender_id: string
  text: string
  read: boolean
  created_at: string
  media_url?: string | null
  media_type?: 'image' | 'pdf' | null
  media_name?: string | null
}

export type Conversation = {
  id: string
  user1_id: string
  user2_id: string
  last_message_at: string
  created_at: string
  other_profile: DMProfile | null
  other_user_id: string
  last_message?: string
  unread_count: number
}

export function displayName(p: DMProfile | null): string {
  if (!p) return 'Member'
  if (p.first_name || p.last_name) return `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
  return p.name ?? 'Member'
}

export function initials(p: DMProfile | null): string {
  return displayName(p).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

// ── Hook: liste des conversations ─────────────────────────────────────────────
export function useConversations(userId: string | undefined, realtimeId = 'global') {
  const supabase = useMemo(() => createClient(), [])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [totalUnread, setTotalUnread] = useState(0)

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return }

    const { data: convs } = await supabase
      .from('conversations')
      .select('*')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('last_message_at', { ascending: false })

    if (!convs) { setLoading(false); return }

    // Pour chaque conversation, charger le profil de l'autre user + unread count
    const enriched = await Promise.all(convs.map(async (c: any) => {
      const otherId = c.user1_id === userId ? c.user2_id : c.user1_id

      const [{ data: profile }, { data: lastMsgs }, { count }] = await Promise.all([
        supabase.from('profiles')
          .select('name, first_name, last_name, avatar_url, institution')
          .eq('id', otherId).single(),
        supabase.from('direct_messages')
          .select('text')
          .eq('conversation_id', c.id)
          .order('created_at', { ascending: false })
          .limit(1),
        supabase.from('direct_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', c.id)
          .eq('read', false)
          .neq('sender_id', userId),
      ])

      return {
        ...c,
        other_user_id: otherId,
        other_profile: profile as DMProfile | null,
        last_message: lastMsgs?.[0]?.text ?? '',
        unread_count: count ?? 0,
      } as Conversation
    }))

    setConversations(enriched)
    setTotalUnread(enriched.reduce((s, c) => s + c.unread_count, 0))
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  // Realtime: nouvelle conversation ou nouveau message → reload
  useEffect(() => {
    if (!userId) return
    const sub = supabase.channel(`dm-list-${userId}-${realtimeId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' },
        () => load())
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [userId, load, realtimeId])

  return { conversations, loading, totalUnread, reload: load }
}

// ── Hook: messages d'une conversation ────────────────────────────────────────
export function useMessages(
  conversationId: string | undefined,
  userId: string | undefined,
) {
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [otherProfile, setOtherProfile] = useState<DMProfile | null>(null)
  const [otherUserId, setOtherUserId]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const subRef = useRef<any>(null)

  const load = useCallback(async () => {
    if (!conversationId || !userId) { setLoading(false); return }

    const [{ data: conv }, { data: msgs }] = await Promise.all([
      supabase.from('conversations').select('*').eq('id', conversationId).single(),
      supabase.from('direct_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(100),
    ])

    if (conv) {
      const otherId = conv.user1_id === userId ? conv.user2_id : conv.user1_id
      setOtherUserId(otherId)
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, first_name, last_name, avatar_url, institution')
        .eq('id', otherId).single()
      setOtherProfile(profile as DMProfile | null)
    }

    if (msgs) setMessages(msgs as DirectMessage[])
    setLoading(false)

    // Marquer comme lus (messages de l'autre non encore lus)
    if (msgs?.length) {
      supabase.from('direct_messages')
        .update({ read: true })
        .eq('conversation_id', conversationId)
        .eq('read', false)
        .neq('sender_id', userId)
        .then(() => {})
    }
  }, [conversationId, userId])

  useEffect(() => {
    load()

    if (!conversationId) return
    if (subRef.current) supabase.removeChannel(subRef.current)

    subRef.current = supabase.channel(`dm-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'direct_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, payload => {
        const msg = payload.new as DirectMessage
        // Déduplique avec l'optimistic update (même texte, même sender, id temp)
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev
          const filtered = prev.filter(m =>
            !(m.id.startsWith('temp-') && m.sender_id === msg.sender_id && m.text === msg.text)
          )
          return [...filtered, msg]
        })
        // Mark read si message de l'autre user
        if (msg.sender_id !== userId) {
          supabase.from('direct_messages').update({ read: true }).eq('id', msg.id).then(() => {})
        }
      })
      .subscribe()

    return () => { if (subRef.current) supabase.removeChannel(subRef.current) }
  }, [conversationId, userId])

  const sendMessage = useCallback(async (
    text: string,
    media?: { url: string; type: 'image' | 'pdf'; name: string } | null
  ): Promise<boolean> => {
    if (!conversationId || !userId || (!text.trim() && !media)) return false

    const tempId = `temp-${Date.now()}`
    const optimistic: DirectMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: userId,
      text: text.trim(),
      read: false,
      created_at: new Date().toISOString(),
      media_url: media?.url ?? null,
      media_type: media?.type ?? null,
      media_name: media?.name ?? null,
    }
    setMessages(prev => [...prev, optimistic])

    const { data, error } = await supabase.from('direct_messages').insert({
      conversation_id: conversationId,
      sender_id: userId,
      text: text.trim(),
      media_url: media?.url ?? null,
      media_type: media?.type ?? null,
      media_name: media?.name ?? null,
    }).select().single()

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      return false
    }
    if (data) {
      setMessages(prev => prev.map(m => m.id === tempId ? data as DirectMessage : m))
    }
    return true
  }, [conversationId, userId])

  return { messages, otherProfile, otherUserId, loading, sendMessage }
}

// ── Helper: get or create conversation ───────────────────────────────────────
export async function getOrCreateConversation(
  supabase: ReturnType<typeof createClient>,
  otherUserId: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_or_create_conversation', { other_user_id: otherUserId })
  if (error) return null
  return data as string
}
