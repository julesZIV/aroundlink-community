'use client'
import { useState } from 'react'
import { subscribeToPush, markPushAsked } from '@/lib/push'

interface Props {
  userId: string
  onDone: () => void
}

export default function PushPrompt({ userId, onDone }: Props) {
  const [loading, setLoading] = useState(false)

  const handleEnable = async () => {
    setLoading(true)
    await subscribeToPush(userId)
    markPushAsked()
    onDone()
  }

  const handleSkip = () => {
    markPushAsked()
    onDone()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9990,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'white',
        borderRadius: 24,
        padding: '28px 24px 28px',
        width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        {/* Bell icon */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: '#eef2ff', display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 16px',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="#1a3055" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1a3055', textAlign: 'center', margin: '0 0 6px' }}>
          Stay in the loop during IDW26 🔔
        </h2>
        <p style={{ fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 1.6, margin: '0 0 18px' }}>
          Turn on notifications so you never miss a beat of the week:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '0 0 22px' }}>
          {[
            { icon: '📅', title: 'Agenda reminders', text: 'A nudge before each session starts' },
            { icon: '📣', title: 'Live news & announcements', text: 'Program changes and updates in real time' },
            { icon: '📎', title: 'Materials & supports', text: 'Get notified when slides and docs are shared' },
            { icon: '🤝', title: 'Stay connected', text: 'Messages from the people you meet here' },
          ].map(b => (
            <div key={b.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ fontSize: 20, lineHeight: 1.2, flexShrink: 0 }}>{b.icon}</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#1a3055' }}>{b.title}</p>
                <p style={{ margin: '1px 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.45 }}>{b.text}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleEnable}
          disabled={loading}
          style={{
            width: '100%', padding: '14px', borderRadius: 14,
            background: '#1a3055', color: 'white', border: 'none',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            marginBottom: 10, opacity: loading ? 0.7 : 1,
          }}>
          {loading ? 'Enabling…' : '🔔 Enable notifications'}
        </button>

        <button
          onClick={handleSkip}
          style={{
            width: '100%', padding: '12px', borderRadius: 14,
            background: 'transparent', color: '#94a3b8', border: 'none',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
          Later
        </button>
      </div>
    </div>
  )
}
