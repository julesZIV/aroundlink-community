'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { normalizeDomain } from '@/lib/utils/normalizeDomain'

const FREE_PROVIDERS = new Set([
  'gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com',
  'live.com','proton.me','protonmail.com','free.fr','orange.fr',
  'sfr.fr','laposte.net','wanadoo.fr','bbox.fr','numericable.fr',
])

const STORAGE_KEY = 'al_inst_popup_dismissed'

type Props = {
  userId: string
  email: string | undefined
  institutionVerified: boolean
  currentInstitution: string | null | undefined
}

export default function InstitutionVerificationPopup({ userId, email, institutionVerified, currentInstitution }: Props) {
  const supabase = createClient()
  const [detected, setDetected] = useState<{ name: string; domain: string } | null>(null)
  const [visible,  setVisible]  = useState(false)
  const [step,     setStep]     = useState<'ask' | 'manual' | 'done'>('ask')
  const [manualInput, setManualInput] = useState(currentInstitution ?? '')
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    // Already verified → nothing to do
    if (institutionVerified) return
    // Already dismissed this session
    if (sessionStorage.getItem(STORAGE_KEY)) return
    if (!email) return

    const domain = email.split('@')[1]?.toLowerCase()
    if (!domain || FREE_PROVIDERS.has(domain)) return

    // Detect institution from email domain
    fetch(`https://universities.hipolabs.com/search?domain=${domain}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data) && data.length > 0 && data[0].name) {
          setDetected({ name: data[0].name, domain })
          setVisible(true)
        } else if (domain) {
          // Institutional domain but not in hipolabs → ask manually
          setDetected({ name: '', domain })
          setStep('manual')
          setVisible(true)
        }
      })
      .catch(() => {})
  }, [userId, email, institutionVerified])

  const dismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  const confirm = async () => {
    if (!detected) return
    setSaving(true)
    await supabase.from('profiles').update({
      institution: detected.name || manualInput.trim(),
      institution_verified: true,
      // Store normalized base domain so neoma-bs.fr and neoma-bs.com group together
      institution_domain: normalizeDomain(detected.domain),
    }).eq('id', userId)
    setSaving(false)
    setStep('done')
    setTimeout(() => setVisible(false), 1800)
  }

  const saveManual = async () => {
    if (!manualInput.trim()) return
    setSaving(true)
    await supabase.from('profiles').update({
      institution: manualInput.trim(),
      institution_domain: detected?.domain ? normalizeDomain(detected.domain) : null,
    }).eq('id', userId)
    setSaving(false)
    setStep('done')
    setTimeout(() => setVisible(false), 1800)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
      padding: 16,
    }}>
      <div style={{
        background: 'white', borderRadius: 24, padding: 28,
        maxWidth: 420, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        animation: 'popIn 0.2s ease',
      }}>

        {step === 'done' ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <p style={{ fontSize: 40, marginBottom: 10 }}>✅</p>
            <p style={{ fontWeight: 800, fontSize: 16, color: '#1a3055' }}>Institution confirmed!</p>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>Your profile is now verified.</p>
          </div>
        ) : step === 'ask' && detected?.name ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, background: '#eef6ff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, flexShrink: 0,
              }}>🏛️</div>
              <div>
                <p style={{ fontWeight: 800, fontSize: 15, color: '#1a3055', margin: 0 }}>Confirm your institution</p>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>Detected from your email</p>
              </div>
            </div>

            <div style={{
              background: '#f8fafc', borderRadius: 14, padding: '14px 16px',
              marginBottom: 20, border: '1px solid #e2e8f0',
            }}>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Do you belong to</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#1a3055', margin: '4px 0 0' }}>
                {detected.name}
              </p>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{detected.domain}</p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={dismiss}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12,
                  border: '1px solid #e2e8f0', background: 'white',
                  color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                No, not me
              </button>
              <button
                onClick={confirm}
                disabled={saving}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12,
                  border: 'none', background: '#1a3055',
                  color: 'white', fontSize: 13, fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}>
                {saving ? '…' : "✓ Yes, that's me!"}
              </button>
            </div>

            <button
              onClick={() => setStep('manual')}
              style={{
                width: '100%', marginTop: 10, background: 'none',
                border: 'none', color: '#94a3b8', fontSize: 12,
                cursor: 'pointer', textDecoration: 'underline',
              }}>
              My institution is different
            </button>
          </>
        ) : (
          /* Manual input — either unknown domain or user said "différente" */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, background: '#eef6ff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, flexShrink: 0,
              }}>🏛️</div>
              <div>
                <p style={{ fontWeight: 800, fontSize: 15, color: '#1a3055', margin: 0 }}>
                  {detected?.domain ? 'Unrecognized institution' : 'Your institution'}
                </p>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>
                  {detected?.domain
                    ? `Domaine : ${detected.domain}`
                    : 'Enter it to join your community'}
                </p>
              </div>
            </div>

            <input
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              placeholder="ex. Université Côte d'Azur"
              autoFocus
              style={{
                width: '100%', border: '1px solid #e2e8f0', borderRadius: 12,
                padding: '11px 14px', fontSize: 13, color: '#1a3055',
                outline: 'none', boxSizing: 'border-box', marginBottom: 16,
              }}
              onFocus={e => { e.target.style.borderColor = '#1a3055' }}
              onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={dismiss}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12,
                  border: '1px solid #e2e8f0', background: 'white',
                  color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                Later
              </button>
              <button
                onClick={saveManual}
                disabled={saving || !manualInput.trim()}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12,
                  border: 'none', background: '#1a3055',
                  color: 'white', fontSize: 13, fontWeight: 700,
                  cursor: saving || !manualInput.trim() ? 'not-allowed' : 'pointer',
                  opacity: saving || !manualInput.trim() ? 0.5 : 1,
                }}>
                {saving ? '…' : 'Confirm'}
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
