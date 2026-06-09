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
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '0 0 env(safe-area-inset-bottom)',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px 24px 0 0',
        padding: '28px 24px 32px',
        width: '100%', maxWidth: 480,
        boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
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

        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1a3055', textAlign: 'center', margin: '0 0 8px' }}>
          Enable notifications
        </h2>
        <p style={{ fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 1.6, margin: '0 0 24px' }}>
          Receive a notification when you have a new message, a mention, or a comment on your post.
        </p>

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
