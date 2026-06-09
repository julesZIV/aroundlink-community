'use client'
import { useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import { useChannels } from '@/lib/hooks/useChannels'
import { useAuth } from '@/lib/hooks/useAuth'

export default function ResourcesPage() {
  const { user } = useAuth()
  const { channels, uploads } = useChannels(user?.id)
  const [activeFolder, setActiveFolder] = useState<string | null>(null)

  // Folders = live channels from DB (includes any channel created after launch)
  const folders = channels.map(ch => ({
    ...ch,
    docs: uploads.filter(u => u.channel_id === ch.id),
  }))

  const activeChannel = folders.find(f => f.id === activeFolder)
  const TOTAL_DOCS = uploads.length

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">📁 Resources</h1>
          <p className="text-sm text-slate-400 mt-0.5">{TOTAL_DOCS} document{TOTAL_DOCS !== 1 ? 's' : ''} shared across all channels</p>
        </div>

        <div className="flex gap-4">
          {/* Folder sidebar */}
          <div className="w-48 flex-shrink-0">
            <div className="space-y-1">
              <button
                onClick={() => setActiveFolder(null)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                  !activeFolder ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'
                }`}>
                <span>📁</span> All Documents
                <span className="ml-auto text-xs text-slate-400">{TOTAL_DOCS}</span>
              </button>
              {folders.map(f => (
                <button key={f.id}
                  onClick={() => setActiveFolder(f.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                    activeFolder === f.id ? 'text-white' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                  style={activeFolder === f.id ? { background: '#1a3055' } : {}}>
                  <span>{f.emoji ?? '💬'}</span>
                  <span className="truncate">#{f.name}</span>
                  {f.docs.length > 0 && (
                    <span className={`ml-auto text-xs flex-shrink-0 ${activeFolder === f.id ? 'text-blue-200' : 'text-slate-400'}`}>
                      {f.docs.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Document list */}
          <div className="flex-1 min-w-0">
            {activeChannel && (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-lg">{activeChannel.emoji ?? '💬'}</span>
                <h2 className="font-bold text-slate-800">#{activeChannel.name}</h2>
                {activeChannel.description && (
                  <p className="text-xs text-slate-400 ml-1">— {activeChannel.description}</p>
                )}
                <Link href={`/channels/${activeChannel.id}`}
                  className="ml-auto text-xs font-semibold text-blue-600 hover:underline">
                  Open channel →
                </Link>
              </div>
            )}

            {(() => {
              const docs = activeFolder
                ? uploads.filter(u => u.channel_id === activeFolder)
                : uploads

              if (docs.length === 0) {
                return (
                  <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-3xl mb-2">📂</p>
                    <p className="font-semibold text-slate-600">No documents yet</p>
                    <p className="text-xs text-slate-400 mt-1">Upload files in any channel to see them here</p>
                  </div>
                )
              }

              return (
                <div className="space-y-2">
                  {docs.map(doc => {
                    const ch = channels.find(c => c.id === doc.channel_id)
                    const ext = doc.name.split('.').pop()?.toLowerCase()
                    const icon = ext === 'pdf' ? '📕' : ext === 'docx' || ext === 'doc' ? '📘' : ext === 'xlsx' || ext === 'xls' ? '📗' : '📄'
                    return (
                      <div key={doc.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 flex items-center gap-3 hover:shadow-md transition-shadow">
                        <span className="text-2xl flex-shrink-0">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700 truncate">{doc.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {ch && (
                              <Link href={`/channels/${ch.id}`} className="text-xs text-blue-500 hover:underline font-medium">
                                #{ch.name}
                              </Link>
                            )}
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs text-slate-400">{new Date(doc.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          </div>
                        </div>
                        {doc.file_url && (
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">
                            View →
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
