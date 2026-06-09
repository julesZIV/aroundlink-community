'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { University } from '@/lib/supabase/supabase/types'

const PAGE_SIZE = 30

export default function DirectoryView({ externalSearch = '' }: { externalSearch?: string }) {
  const router   = useRouter()
  const supabase = createClient()
  const [unis,    setUnis]    = useState<University[]>([])
  const [filter,  setFilter]  = useState('all')
  const [country, setCountry] = useState('all')
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('universities')
      .select('id, display_name, country_code, country_name, city, flag, erasmus_code, schac_domain, ror_id, website, established, is_erasmus, acronyms, types')
      .order('display_name')
      .then(({ data }) => {
        setUnis((data ?? []) as unknown as University[])
        setLoading(false)
      })
  }, [])

  const countries = useMemo(() => {
    const m: Record<string, number> = {}
    unis.forEach(u => { if (u.country_name) m[u.country_name] = (m[u.country_name] ?? 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 60).map(([n, c]) => ({ n, c }))
  }, [unis])

  const filtered = useMemo(() => {
    const q = externalSearch.toLowerCase().trim()
    return unis.filter(u => {
      if (filter === 'erasmus'     && !u.is_erasmus) return false
      if (filter === 'non-erasmus' &&  u.is_erasmus) return false
      if (country !== 'all' && u.country_name !== country) return false
      if (!q) return true
      return [
        u.display_name, u.country_name, u.city, u.erasmus_code, u.schac_domain,
        ...(u.acronyms ?? []),
      ].some(v => v?.toLowerCase().includes(q))
    })
  }, [unis, externalSearch, filter, country])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1
  const pageData   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [externalSearch, filter, country])

  const PALETTE = ['#1a3055','#2d4f7f','#0f4c81','#1e6091','#184e77','#1b4332','#6b2737','#7b3f00']
  const abbr = (u: University) =>
    (u.acronyms?.[0] ?? u.display_name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 3)).toUpperCase()

  if (loading) return (
    <div className="max-w-7xl mx-auto px-6 py-16 text-center">
      <p className="text-slate-400 text-sm">Loading directory…</p>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex gap-2 flex-wrap mb-4">
        {[{ k: 'all', l: 'All' }, { k: 'erasmus', l: '🇪🇺 Erasmus' }, { k: 'non-erasmus', l: '🌍 Non-Erasmus' }].map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap border ${filter === f.k ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-600'}`}
            style={filter === f.k ? { background: '#1a3055' } : {}}>
            {f.l}
          </button>
        ))}
        <select value={country} onChange={e => setCountry(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs border border-slate-200 bg-white text-slate-600 focus:outline-none">
          <option value="all">🌍 All countries</option>
          {countries.map(c => <option key={c.n} value={c.n}>{c.n} ({c.c})</option>)}
        </select>
      </div>

      <p className="text-xs text-slate-400 mb-3">
        <span className="font-semibold text-slate-600">{filtered.length.toLocaleString()}</span> results
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {pageData.map(u => (
          <div key={u.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 card-hover cursor-pointer"
            onClick={() => router.push(`/university/${u.id}`)}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: PALETTE[u.id % PALETTE.length] }}>
                {abbr(u)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm leading-tight line-clamp-2">{u.display_name}</p>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {u.flag} {u.city}{u.city && u.country_name ? ', ' : ''}{u.country_name}
                </p>
                {u.erasmus_code && (
                  <p className="text-xs font-mono mt-0.5 truncate" style={{ color: '#1a3055' }}>{u.erasmus_code}</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${u.is_erasmus ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                {u.is_erasmus ? '🇪🇺 Erasmus' : '🌍 Global'}
              </span>
              <span className="text-xs font-semibold" style={{ color: '#1a3055' }}>View →</span>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-4 py-2 rounded-xl text-xs border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
            ← Prev
          </button>
          <span className="text-xs text-slate-500">{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="px-4 py-2 rounded-xl text-xs border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
