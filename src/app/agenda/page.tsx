'use client'

import { useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import {
  IDW_SESSIONS,
  IDW_TRACKS,
  IDW_DAYS,
  IDW_EVENT,
  Session,
  TrackId,
  SessionType,
} from '@/data/idw-agenda'

// ─── Type emoji mapping ───────────────────────────────────────────────────────
const TYPE_EMOJI: Record<SessionType, string> = {
  keynote:      '🎤',
  workshop:     '🛠️',
  roundtable:   '💬',
  break:        '☕',
  networking:   '🍸',
  opening:      '🎉',
  poster:       '📊',
  pitch:        '🚀',
  salon:        '🏛️',
  special:      '🌍',
  presentation: '📋',
  closing:      '🏁',
}

const TYPE_LABEL: Record<SessionType, string> = {
  keynote:      'Keynote',
  workshop:     'Workshop',
  roundtable:   'Round Table',
  break:        'Break',
  networking:   'Networking',
  opening:      'Opening',
  poster:       'Poster Session',
  pitch:        'Pitch',
  salon:        'Salon',
  special:      'Special Session',
  presentation: 'Presentation',
  closing:      'Closing',
}

// ─── Track colour map ─────────────────────────────────────────────────────────
const TRACK_COLOR: Record<TrackId, string> = {
  di:  '#378ADD',
  is:  '#BA7517',
  dte: '#D4537E',
}

function getSessionBorderColor(session: Session): string {
  if (session.common || session.tracks.length > 1) return '#1a3055'
  return TRACK_COLOR[session.tracks[0]]
}

// ─── Session Card ─────────────────────────────────────────────────────────────
function SessionCard({
  session,
  onClick,
}: {
  session: Session
  onClick: (s: Session) => void
}) {
  const isBreak = session.type === 'break' || session.type === 'networking'
  const borderColor = getSessionBorderColor(session)

  return (
    <div
      onClick={() => onClick(session)}
      style={{
        background: isBreak ? '#f8f9fc' : 'white',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        borderLeft: `4px solid ${borderColor}`,
        padding: '10px 12px',
        cursor: 'pointer',
        boxShadow: isBreak ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.15s, transform 0.15s',
        marginBottom: 8,
      }}
      onMouseEnter={e => {
        if (!isBreak) {
          ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
          ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = isBreak ? 'none' : '0 1px 4px rgba(0,0,0,0.06)'
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
      }}
    >
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
        {session.time_start} – {session.time_end}
      </div>
      <div style={{
        fontSize: 13,
        fontWeight: isBreak ? 500 : 600,
        color: isBreak ? '#64748b' : '#1e293b',
        lineHeight: 1.35,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {TYPE_EMOJI[session.type]} {session.title}
      </div>
      {session.speakers.length > 0 && (
        <div style={{ marginTop: 5, fontSize: 11, color: '#94a3b8' }}>
          {session.speakers.length === 1
            ? session.speakers[0].name
            : `${session.speakers.length} speakers`}
        </div>
      )}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function SessionModal({ session, onClose }: { session: Session; onClose: () => void }) {
  const borderColor = getSessionBorderColor(session)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15,23,42,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 20,
          borderTop: `5px solid ${borderColor}`,
          maxWidth: 560,
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: 28,
          position: 'relative',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: '#f1f5f9', border: 'none', borderRadius: 8,
            width: 32, height: 32, cursor: 'pointer',
            fontSize: 16, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>

        {/* Time */}
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 8, fontVariantNumeric: 'tabular-nums' }}>
          {session.time_start} – {session.time_end}
        </div>

        {/* Title */}
        <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700, color: '#1e293b', lineHeight: 1.35, paddingRight: 24 }}>
          {session.title}
        </h2>

        {/* Badges row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {/* Type badge */}
          <span style={{
            background: '#f1f5f9', borderRadius: 8,
            padding: '4px 10px', fontSize: 12, fontWeight: 600, color: '#1e293b',
          }}>
            {TYPE_EMOJI[session.type]} {TYPE_LABEL[session.type]}
          </span>

          {/* Language badge */}
          {session.language && (
            <span style={{
              background: '#fffbeb', borderRadius: 8,
              padding: '4px 10px', fontSize: 12, fontWeight: 600, color: '#92400e',
              border: '1px solid #fde68a',
            }}>
              🗣️ {session.language}
            </span>
          )}

          {/* Track badges (if not common) */}
          {!session.common && session.tracks.map(tid => {
            const track = IDW_TRACKS.find(t => t.id === tid)!
            return (
              <span key={tid} style={{
                background: TRACK_COLOR[tid] + '18',
                border: `1px solid ${TRACK_COLOR[tid]}44`,
                borderRadius: 8,
                padding: '4px 10px', fontSize: 11, fontWeight: 600, color: TRACK_COLOR[tid],
              }}>
                {track.label}
              </span>
            )
          })}
        </div>

        {/* Location */}
        {session.location && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 14 }}>📍</span>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{session.location}</span>
          </div>
        )}

        {/* Speakers */}
        {session.speakers.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Speakers
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {session.speakers.map((sp, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{sp.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {sp.role} · {sp.institution}
                  </div>
                  {sp.talk && (
                    <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginTop: 2 }}>
                      "{sp.talk}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {session.description && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Description
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#1e293b', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
              {session.description}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Desktop 3-column grid ────────────────────────────────────────────────────
function DesktopGrid({ sessions, onCardClick }: { sessions: Session[]; onCardClick: (s: Session) => void }) {
  // Group sessions by time_start
  const timeSlots = Array.from(new Set(sessions.map(s => s.time_start))).sort()

  return (
    <div>
      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 12,
        marginBottom: 16,
      }}>
        {IDW_TRACKS.map(track => (
          <div key={track.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px',
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            borderTop: `3px solid ${track.color}`,
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: track.color, flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', lineHeight: 1.3 }}>
              {track.label}
            </span>
          </div>
        ))}
      </div>

      {/* Time slots */}
      {timeSlots.map(timeStart => {
        const slotSessions = sessions.filter(s => s.time_start === timeStart)
        const commonSessions = slotSessions.filter(s => s.common)
        const trackSessions = slotSessions.filter(s => !s.common)

        return (
          <div key={timeStart} style={{ marginBottom: 4 }}>
            {/* Common (full-width) sessions */}
            {commonSessions.map(s => (
              <div key={s.id} style={{ marginBottom: 8 }}>
                <SessionCard session={s} onClick={onCardClick} />
              </div>
            ))}

            {/* Track-specific sessions in columns */}
            {trackSessions.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 12,
                marginBottom: 8,
              }}>
                {IDW_TRACKS.map(track => {
                  const col = trackSessions.filter(s => s.tracks.includes(track.id) && !s.common)
                  return (
                    <div key={track.id}>
                      {col.map(s => (
                        <SessionCard key={s.id} session={s} onClick={onCardClick} />
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Mobile list ──────────────────────────────────────────────────────────────
function MobileList({
  sessions,
  trackFilter,
  onCardClick,
}: {
  sessions: Session[]
  trackFilter: TrackId | 'all'
  onCardClick: (s: Session) => void
}) {
  const filtered = sessions.filter(s => {
    if (trackFilter === 'all') return true
    return s.tracks.includes(trackFilter) || s.common
  })

  return (
    <div>
      {filtered.map(s => (
        <SessionCard key={s.id} session={s} onClick={onCardClick} />
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AgendaPage() {
  const [activeDay, setActiveDay] = useState('2026-06-22')
  const [trackFilter, setTrackFilter] = useState<TrackId | 'all'>('all')
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  const handleCardClick = useCallback((s: Session) => setSelectedSession(s), [])
  const handleClose = useCallback(() => setSelectedSession(null), [])

  const daySessions = IDW_SESSIONS
    .filter(s => s.day === activeDay)
    .sort((a, b) => a.time_start.localeCompare(b.time_start))

  return (
    <AppShell>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: '#1e293b' }}>
            Agenda
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            {IDW_EVENT.name} · {IDW_EVENT.dates}
          </p>
        </div>

        {/* Day tabs */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 20,
          overflowX: 'auto', paddingBottom: 4,
        }}>
          {IDW_DAYS.map(day => {
            const isActive = day.date === activeDay
            return (
              <button
                key={day.date}
                onClick={() => setActiveDay(day.date)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 12,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  background: isActive ? '#1a3055' : 'white',
                  color: isActive ? 'white' : '#64748b',
                  boxShadow: isActive ? '0 2px 8px rgba(26,48,85,0.25)' : '0 1px 3px rgba(0,0,0,0.08)',
                  transition: 'all 0.15s',
                }}
              >
                {day.label}
              </button>
            )
          })}
        </div>

        {/* Mobile track filter pills */}
        <div style={{ display: 'block' }}>
          <style>{`
            @media (min-width: 769px) { .mobile-pills { display: none !important; } .desktop-grid { display: block !important; } .mobile-list { display: none !important; } }
            @media (max-width: 768px) { .mobile-pills { display: flex !important; } .desktop-grid { display: none !important; } .mobile-list { display: block !important; } }
          `}</style>

          <div className="mobile-pills" style={{
            display: 'none',
            gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4,
          }}>
            {([
              { id: 'all' as const, label: 'All', color: '#1a3055' },
              ...IDW_TRACKS.map(t => ({ id: t.id as TrackId | 'all', label: t.id.toUpperCase(), color: TRACK_COLOR[t.id] })),
            ]).map(pill => {
              const isActive = trackFilter === pill.id
              return (
                <button
                  key={pill.id}
                  onClick={() => setTrackFilter(pill.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 999,
                    border: `2px solid ${isActive ? pill.color : '#e2e8f0'}`,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    background: isActive ? pill.color : 'white',
                    color: isActive ? 'white' : '#64748b',
                    transition: 'all 0.15s',
                  }}
                >
                  {pill.id !== 'all' && (
                    <span style={{
                      display: 'inline-block',
                      width: 8, height: 8, borderRadius: '50%',
                      background: isActive ? 'rgba(255,255,255,0.7)' : pill.color,
                      marginRight: 6,
                    }} />
                  )}
                  {pill.label}
                </button>
              )
            })}
          </div>

          {/* Desktop grid */}
          <div className="desktop-grid" style={{ display: 'block' }}>
            <DesktopGrid sessions={daySessions} onCardClick={handleCardClick} />
          </div>

          {/* Mobile list */}
          <div className="mobile-list" style={{ display: 'none' }}>
            <MobileList sessions={daySessions} trackFilter={trackFilter} onCardClick={handleCardClick} />
          </div>
        </div>

        {/* Location footer */}
        <div style={{
          marginTop: 32, padding: '14px 18px',
          background: 'white', border: '1px solid #e2e8f0',
          borderRadius: 16, display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>📍</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>{IDW_EVENT.name}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{IDW_EVENT.location}</div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {selectedSession && (
        <SessionModal session={selectedSession} onClose={handleClose} />
      )}
    </AppShell>
  )
}
