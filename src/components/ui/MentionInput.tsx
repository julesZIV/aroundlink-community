'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type MentionUser = {
  id: string
  name: string | null
  first_name: string | null
  last_name: string | null
  institution: string | null
}

function getInitials(u: MentionUser) {
  const n = u.name ?? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() ?? '?'
  return n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

function getDisplayName(u: MentionUser) {
  if (u.first_name || u.last_name) return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
  return u.name ?? 'Member'
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface MentionInputProps {
  value: string
  onChange: (v: string) => void
  onSubmit?: () => void
  placeholder?: string
  rows?: number
  className?: string
  enableAll?: boolean   // affiche @all dans le dropdown (channels uniquement)
}

const ALL_QUERY_PATTERN = /^al?l?$/i  // correspond à "a", "al", "all"

// ── Component ─────────────────────────────────────────────────────────────────
export default function MentionInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Write something… use @ to mention someone',
  rows = 2,
  className = '',
  enableAll = false,
}: MentionInputProps) {
  const supabase = createClient()
  const ref = useRef<HTMLTextAreaElement>(null)

  const [showDrop,     setShowDrop]     = useState(false)
  const [results,      setResults]      = useState<MentionUser[]>([])
  const [mentionStart, setMentionStart] = useState(-1)
  const [searching,    setSearching]    = useState(false)
  const [query,        setQuery]        = useState('')
  const [activeIdx,    setActiveIdx]    = useState(-1)   // -1 = nothing highlighted
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const showAll = enableAll && (query === '' || ALL_QUERY_PATTERN.test(query))

  // items list: [@all?] + results  — used to resolve keyboard index
  // index 0 = @all (if showAll), else index 0 = first result
  const allOffset = showAll ? 1 : 0
  const totalItems = allOffset + results.length

  // Reset highlight whenever dropdown content changes
  useEffect(() => {
    setActiveIdx(-1)
  }, [showDrop, query])

  const search = useCallback(async (q: string) => {
    setQuery(q)
    if (q.length === 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, first_name, last_name, institution')
        .eq('is_anonymized', false)
        .not('name', 'is', null)
        .limit(3)
      setResults((data ?? []) as MentionUser[])
      return
    }
    setSearching(true)
    const safeQ = q.replace(/[%_(),'\\]/g, c => `\\${c}`)
    const { data } = await supabase
      .from('profiles')
      .select('id, name, first_name, last_name, institution')
      .eq('is_anonymized', false)
      .or(`name.ilike.%${safeQ}%,first_name.ilike.%${safeQ}%,last_name.ilike.%${safeQ}%`)
      .limit(3)
    setResults((data ?? []) as MentionUser[])
    setSearching(false)
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    const ta = ref.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    onChange(v)
    const cursor = e.target.selectionStart
    const before = v.slice(0, cursor)
    const m = before.match(/@([\wÀ-ſ]*)$/)
    if (m) {
      setMentionStart(cursor - m[0].length)
      setShowDrop(true)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => search(m[1]), 150)
    } else {
      setShowDrop(false)
      setQuery('')
    }
  }

  const pickUser = (user: MentionUser) => {
    if (!ref.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const name = getDisplayName(user)
    insertMention(`@${name} `)
  }

  const pickAll = () => {
    if (!ref.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    insertMention('@all ')
  }

  const pickActive = () => {
    if (activeIdx === -1) return false
    if (showAll && activeIdx === 0) { pickAll(); return true }
    const userIdx = activeIdx - allOffset
    if (results[userIdx]) { pickUser(results[userIdx]); return true }
    return false
  }

  const insertMention = (inserted: string) => {
    if (!ref.current) return
    const before = value.slice(0, mentionStart)
    const after  = value.slice(ref.current.selectionStart)
    const next   = `${before}${inserted}${after}`
    onChange(next)
    setShowDrop(false)
    setQuery('')
    setTimeout(() => {
      if (ref.current) {
        const pos = before.length + inserted.length
        ref.current.setSelectionRange(pos, pos)
        ref.current.focus()
      }
    }, 0)
  }

  // ── Keyboard handler ────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') { setShowDrop(false); return }

    if (showDrop && totalItems > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(prev => (prev + 1) % totalItems)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(prev => (prev <= 0 ? totalItems - 1 : prev - 1))
        return
      }
      if (e.key === 'Enter') {
        if (activeIdx >= 0 && pickActive()) {
          e.preventDefault()
          return
        }
        // If dropdown open but nothing selected → close and let normal submit happen
        if (activeIdx === -1) {
          // fall through to submit below
        }
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        if (activeIdx === -1) setActiveIdx(0)
        else pickActive()
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && !showDrop) {
      e.preventDefault()
      onSubmit?.()
    }
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const hasResults = results.length > 0 || showAll

  return (
    <div className={`relative ${className}`}>
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-slate-50 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none resize-none border border-transparent focus:border-slate-200 overflow-hidden"
      />

      {/* Mention dropdown */}
      {showDrop && (
        <div
          className="absolute bottom-full left-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden"
          style={{ minWidth: 280, maxWidth: 'min(360px, calc(100vw - 32px))' }}
        >
          {/* @all option — channels only */}
          {showAll && (
            <div
              onMouseDown={e => { e.preventDefault(); pickAll() }}
              onMouseEnter={() => setActiveIdx(0)}
              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-slate-100"
              style={{ background: activeIdx === 0 ? '#fffbeb' : undefined }}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: '#d97706' }}>
                📢
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-700">@all — the whole community</p>
                <p className="text-xs text-slate-400">Notifies all channel members</p>
              </div>
              {activeIdx === 0 && (
                <span className="ml-auto text-xs text-slate-300">↵</span>
              )}
            </div>
          )}

          {searching && (
            <div className="px-4 py-2.5 text-xs text-slate-400">Searching…</div>
          )}
          {!searching && !hasResults && (
            <div className="px-4 py-2.5 text-xs text-slate-400">No members found</div>
          )}
          {!searching && results.map((u, i) => {
            const idx = allOffset + i
            return (
              <div
                key={u.id}
                onMouseDown={e => { e.preventDefault(); pickUser(u) }}
                onMouseEnter={() => setActiveIdx(idx)}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                style={{ background: activeIdx === idx ? '#f1f5f9' : undefined }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: '#1a3055' }}
                >
                  {getInitials(u)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{getDisplayName(u)}</p>
                  {u.institution && (
                    <p className="text-xs text-slate-400 truncate">{u.institution}</p>
                  )}
                </div>
                {activeIdx === idx && (
                  <span className="text-xs text-slate-300">↵</span>
                )}
              </div>
            )
          })}

          {/* Keyboard hint */}
          {totalItems > 0 && (
            <div className="px-3 py-1.5 border-t border-slate-100 flex items-center gap-2">
              <span className="text-[10px] text-slate-300">↑↓ navigate</span>
              <span className="text-[10px] text-slate-300">·</span>
              <span className="text-[10px] text-slate-300">↵ select</span>
              <span className="text-[10px] text-slate-300">·</span>
              <span className="text-[10px] text-slate-300">Esc close</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
