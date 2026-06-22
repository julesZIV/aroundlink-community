'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AvatarImg from '@/components/ui/AvatarImg'

type Liker = {
  id: string
  name: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  is_anonymized: boolean | null
}

/** Liste des personnes ayant liké un post (feed ou channel). */
export default function LikersModal({ userIds, onClose }: { userIds: string[]; onClose: () => void }) {
  const supabase = createClient()
  const router = useRouter()
  const [likers, setLikers] = useState<Liker[] | null>(null)

  useEffect(() => {
    if (!userIds.length) { setLikers([]); return }
    supabase
      .from('profiles')
      .select('id, name, first_name, last_name, avatar_url, is_anonymized')
      .in('id', userIds)
      .then(({ data }) => setLikers((data ?? []) as Liker[]))
  }, [userIds.join(',')])

  const displayName = (l: Liker) =>
    l.is_anonymized ? 'Inactive Member'
      : (`${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || l.name || 'Member')

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 380, maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <p className="font-bold text-slate-800">👍 Liked by{likers ? ` (${likers.length})` : ''}</p>
          <button onClick={onClose} className="w-7 h-7 rounded-full text-slate-500 hover:bg-slate-100 flex items-center justify-center">✕</button>
        </div>
        <div className="p-2 overflow-y-auto">
          {!likers ? (
            <p className="text-sm text-slate-400 text-center py-6">Loading…</p>
          ) : likers.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No likes yet</p>
          ) : (
            likers.map(l => {
              const name = displayName(l)
              const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
              const clickable = !l.is_anonymized
              return (
                <button key={l.id} disabled={!clickable}
                  onClick={() => { if (clickable) { onClose(); router.push(`/profile/${l.id}`) } }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left ${clickable ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'}`}>
                  <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#1a3055' }}>
                    <AvatarImg src={l.avatar_url} alt={name} fallback={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 truncate">{name}</span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
