'use client'
import { useState, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useFeed } from '@/lib/hooks/useFeed'
import { STORAGE } from '@/lib/storage'
import type { Profile } from '@/lib/supabase/supabase/types'

interface Props {
  /** Called once the user has either posted their intro or skipped. */
  onDone: () => void
}

/**
 * Onboarding step 2/2 — invite a brand-new member to introduce themselves.
 * Picks one of 5 welcome templates at random, injects First name / Last name /
 * Organization, lets the user tweak the fields AND edit the message freely
 * before posting it to the feed.
 *
 * Two birds, one stone: posting also saves first name / last name / organization
 * back onto the profile (so the profile gets completed at the same time).
 *
 * Persistence: marks `onboarding_completed = true` on the profile (on BOTH post
 * and skip) so the modal never shows again.
 */

// [First name], [Last name] and [Organization] are ALWAYS injected.
const TEMPLATES: ((f: string, l: string, o: string) => string)[] = [
  (f, l, o) =>
    `Hey everyone! 👋\nI'm ${f} ${l} from ${o} 🎓\nThrilled to be part of IDW26 — looking forward to these few days of exchange and new connections! 🌍🤝`,
  (f, l, o) =>
    `Hello community! 🙌\n${f} ${l} here, representing ${o} 🌐\nSuper excited to connect with you all at IDW26 — see you around! 🚀✨`,
  (f, l, o) =>
    `Hi all! ✨\nI'm ${f} ${l}, joining from ${o} 🎓\nCan't wait to exchange ideas and meet new people during IDW26! 🌍📚`,
  (f, l, o) =>
    `Glad to join this community! 🤝\n${f} ${l} — ${o} 🌐\nIDW26 is going to be a great moment of sharing — looking forward to meeting you all! 🌎🎉`,
  (f, l, o) =>
    `Hello! 👋\n${f} ${l} from ${o} here 🎓\nReally happy to take part in IDW26 — excited to spend these days connecting across borders! ✈️🌍`,
]

export default function IntroPostModal({ onDone }: Props) {
  const { user, profile, updateProfile } = useAuth()
  const { createPost } = useFeed(user?.id)

  // Prefill from the profile when available
  const [firstName, setFirstName] = useState(profile?.first_name ?? '')
  const [lastName,  setLastName]  = useState(profile?.last_name ?? '')
  const [org,       setOrg]       = useState(profile?.institution ?? '')
  const [posting,   setPosting]   = useState(false)

  // Optional photo (camera or gallery on mobile)
  const [photoFile,    setPhotoFile]    = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoError,   setPhotoError]   = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoError(null)
    if (!file.type.startsWith('image/')) { setPhotoError('Please choose an image.'); return }
    if (file.size > 5 * 1024 * 1024) { setPhotoError('Image must be under 5 MB.'); return }
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const removePhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(null)
    setPhotoPreview(null)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  // Pick one template once, when the modal opens
  const [template] = useState(() => TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)])

  // The message auto-follows the fields until the user edits it by hand, then
  // their version takes over (so manual edits are never overwritten).
  const computed = template(firstName.trim() || 'there', lastName.trim(), org.trim() || 'my organization')
  const [message, setMessage] = useState('')
  const [edited,  setEdited]  = useState(false)
  const value = edited ? message : computed

  const handlePost = async () => {
    if (posting || (!value.trim() && !photoFile)) return
    setPosting(true)

    const first = firstName.trim()
    const last  = lastName.trim()
    const orgV  = org.trim()

    // Upload the optional photo first
    let media: { type: 'image'; url: string; name: string } | null = null
    if (photoFile && user) {
      try {
        const ext = photoFile.name.split('.').pop() || 'jpg'
        const url = await STORAGE.upload('feed-media', photoFile, `${user.id}/${Date.now()}.${ext}`)
        media = { type: 'image', url, name: photoFile.name }
      } catch {
        setPhotoError('Could not upload the photo. Posting without it.')
      }
    }

    // Post the intro, with an optimistic author reflecting the edited fields
    await createPost(value.trim(), media, {
      name: `${first} ${last}`.trim() || profile?.name || '',
      first_name: first || profile?.first_name || null,
      last_name:  last  || profile?.last_name  || null,
      institution: orgV || profile?.institution || null,
      avatar_url: profile?.avatar_url ?? null,
    })

    // Two birds, one stone: save the fields onto the profile + mark onboarding done
    const updates: Partial<Profile> = { onboarding_completed: true }
    if (first) updates.first_name = first
    if (last)  updates.last_name  = last
    if (first || last) updates.name = `${first} ${last}`.trim()
    if (orgV)  updates.institution = orgV
    await updateProfile(updates)

    setPosting(false)
    onDone()
  }

  const handleSkip = async () => {
    if (posting) return
    await updateProfile({ onboarding_completed: true })
    onDone()
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 700,
    color: '#475569', margin: '0 0 6px',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '11px 14px', borderRadius: 12,
    border: '1px solid #e2e8f0', background: '#f8fafc',
    fontSize: 14, color: '#1a3055', outline: 'none',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9991,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'white',
        borderRadius: 24,
        padding: '24px 24px 28px',
        width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        {/* Step indicator: ●▬ (step 1 done, step 2 active) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, margin: '0 0 18px' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a3055' }} />
          <span style={{ width: 22, height: 8, borderRadius: 4, background: '#1a3055' }} />
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1a3055', textAlign: 'center', margin: '0 0 6px' }}>
          Introduce yourself to the community 👋
        </h2>
        <p style={{ fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 1.6, margin: '0 0 22px' }}>
          Your welcome message will be posted in the feed
        </p>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
          <div>
            <label style={labelStyle}>First name</label>
            <input
              style={inputStyle}
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="First name"
              onFocus={e => (e.currentTarget.style.borderColor = '#1a3055')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
            />
          </div>
          <div>
            <label style={labelStyle}>Last name</label>
            <input
              style={inputStyle}
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Last name"
              onFocus={e => (e.currentTarget.style.borderColor = '#1a3055')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
            />
          </div>
          <div>
            <label style={labelStyle}>Organization</label>
            <input
              style={inputStyle}
              value={org}
              onChange={e => setOrg(e.target.value)}
              placeholder="Organization"
              onFocus={e => (e.currentTarget.style.borderColor = '#1a3055')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
            />
          </div>
        </div>

        {/* Editable message — auto-filled, fully editable before posting */}
        <label style={labelStyle}>Your message <span style={{ fontWeight: 500, color: '#94a3b8' }}>· edit it freely</span></label>
        <textarea
          value={value}
          onChange={e => { setEdited(true); setMessage(e.target.value) }}
          rows={5}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px 14px', borderRadius: 12,
            border: '1px solid #e2e8f0', background: '#eef2ff',
            fontSize: 14, color: '#1a3055', lineHeight: 1.55,
            resize: 'vertical', marginBottom: 14, fontFamily: 'inherit',
            outline: 'none',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = '#1a3055')}
          onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
        />

        {/* Optional photo — on mobile this opens the native camera / gallery picker */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoSelect}
          style={{ display: 'none' }}
        />
        {photoPreview ? (
          <div style={{ position: 'relative', marginBottom: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview}
              alt="Your photo"
              style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, display: 'block' }}
            />
            <button
              onClick={removePhoto}
              aria-label="Remove photo"
              style={{
                position: 'absolute', top: 8, right: 8,
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none',
                cursor: 'pointer', fontSize: 14, lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
          </div>
        ) : (
          <button
            onClick={() => photoInputRef.current?.click()}
            style={{
              width: '100%', padding: '12px', borderRadius: 12, marginBottom: 18,
              background: '#f8fafc', color: '#475569',
              border: '1px dashed #cbd5e1', cursor: 'pointer',
              fontSize: 13.5, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            📷 Add a photo
          </button>
        )}
        {photoError && (
          <p style={{ fontSize: 12, color: '#dc2626', margin: '-8px 0 14px' }}>{photoError}</p>
        )}

        {/* Actions */}
        <button
          onClick={handlePost}
          disabled={posting || (!value.trim() && !photoFile)}
          style={{
            width: '100%', padding: '14px', borderRadius: 14,
            background: '#1a3055', color: 'white', border: 'none',
            fontSize: 14, fontWeight: 700,
            cursor: posting || (!value.trim() && !photoFile) ? 'default' : 'pointer',
            marginBottom: 10, opacity: posting || (!value.trim() && !photoFile) ? 0.7 : 1,
          }}>
          {posting ? 'Posting…' : 'Post my intro'}
        </button>

        <button
          onClick={handleSkip}
          disabled={posting}
          style={{
            width: '100%', padding: '12px', borderRadius: 14,
            background: 'transparent', color: '#94a3b8', border: 'none',
            fontSize: 13, fontWeight: 600, cursor: posting ? 'default' : 'pointer',
          }}>
          Skip
        </button>
      </div>
    </div>
  )
}
