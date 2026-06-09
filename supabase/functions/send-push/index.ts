/**
 * send-push — AroundLink Edge Function
 * Web Push via WebCrypto API (no npm dependencies)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SERVICE_ROLE_KEY')!
const PUSH_SECRET   = Deno.env.get('PUSH_INTERNAL_SECRET')!

// ── Base64url helpers ─────────────────────────────────────────────────────────

function b64uDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = (4 - b64.length % 4) % 4
  return Uint8Array.from(atob(b64 + '='.repeat(pad)), c => c.charCodeAt(0))
}

function b64uEncode(buf: Uint8Array | ArrayBuffer): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// ── VAPID JWT (ES256) ─────────────────────────────────────────────────────────

async function makeVapidJWT(audience: string): Promise<string> {
  const pubBytes = b64uDecode(VAPID_PUBLIC) // 65 bytes: 0x04 + x(32) + y(32)
  const jwk = {
    kty: 'EC', crv: 'P-256',
    x: b64uEncode(pubBytes.slice(1, 33)),
    y: b64uEncode(pubBytes.slice(33, 65)),
    d: VAPID_PRIVATE,
    ext: true,
  }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])

  const enc     = new TextEncoder()
  const header  = b64uEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = b64uEncode(enc.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: 'mailto:contact@aroundlink.com',
  })))

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    enc.encode(`${header}.${payload}`)
  )
  return `${header}.${payload}.${b64uEncode(sig)}`
}

// ── Web Push encryption (aesgcm / RFC 8291) ───────────────────────────────────

async function encryptPayload(
  p256dh: string, auth: string, payload: string
): Promise<{ encrypted: Uint8Array; serverPub: Uint8Array; salt: Uint8Array }> {
  const enc = new TextEncoder()

  // Server ephemeral ECDH key pair
  const serverKP     = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKP.publicKey))
  const clientPubRaw = b64uDecode(p256dh)

  // ECDH shared secret
  const clientPub    = await crypto.subtle.importKey('raw', clientPubRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPub }, serverKP.privateKey, 256))

  const salt      = crypto.getRandomValues(new Uint8Array(16))
  const authBytes = b64uDecode(auth)

  // PRK = HKDF(ikm=sharedSecret, salt=auth, info="Content-Encoding: auth\0")
  const ssKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits'])
  const prk   = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authBytes, info: enc.encode('Content-Encoding: auth\0') },
    ssKey, 256
  )

  // context = "P-256\0" || uint16(65) || clientPub || uint16(65) || serverPub
  const context = new Uint8Array([
    ...enc.encode('P-256\0'),
    0, 65, ...clientPubRaw,
    0, 65, ...serverPubRaw,
  ])
  const cekInfo   = new Uint8Array([...enc.encode('Content-Encoding: aesgcm\0'), ...context])
  const nonceInfo = new Uint8Array([...enc.encode('Content-Encoding: nonce\0'),  ...context])

  // CEK (16 bytes) and Nonce (12 bytes) via HKDF
  const prkKey    = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveBits'])
  const cekBits   = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo },   prkKey, 128)
  const nonceBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo }, prkKey, 96)

  // AES-128-GCM encrypt: "\0\0" + payload (2-byte zero padding)
  const cekKey    = await crypto.subtle.importKey('raw', cekBits, 'AES-GCM', false, ['encrypt'])
  const plaintext = new Uint8Array([0, 0, ...enc.encode(payload)])
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonceBits }, cekKey, plaintext))

  return { encrypted, serverPub: serverPubRaw, salt }
}

// ── Send one push notification ─────────────────────────────────────────────────

async function pushOne(sub: { endpoint: string; p256dh: string; auth: string }, payloadStr: string): Promise<number> {
  const origin = new URL(sub.endpoint).origin
  const jwt    = await makeVapidJWT(origin)
  const { encrypted, serverPub, salt } = await encryptPayload(sub.p256dh, sub.auth, payloadStr)

  const resp = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization':    `vapid t=${jwt},k=${VAPID_PUBLIC}`,
      'Content-Encoding': 'aesgcm',
      'Content-Type':     'application/octet-stream',
      'Encryption':       `salt=${b64uEncode(salt)}`,
      'Crypto-Key':       `dh=${b64uEncode(serverPub)};p256ecdsa=${VAPID_PUBLIC}`,
      'TTL':              '86400',
    },
    body: encrypted,
  })
  return resp.status
}

// ── CORS headers (required on all responses for browser cross-origin calls) ────

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Push-Secret, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Request handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  const secret = req.headers.get('X-Push-Secret')
  if (secret !== PUSH_SECRET) {
    return new Response('Unauthorized', { status: 401, headers: CORS })
  }

  let body: { user_ids: string[]; title: string; body: string; url: string; tag?: string }
  try { body = await req.json() }
  catch { return new Response('Bad JSON', { status: 400, headers: CORS }) }

  const { user_ids, title, body: msgBody, url, tag } = body
  if (!user_ids?.length) return new Response('no user_ids', { status: 200, headers: CORS })

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id')
    .in('user_id', user_ids)

  if (error || !subs?.length) {
    return new Response(JSON.stringify({ error: error?.message ?? 'no subs' }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // Count unread notifications per user (badge number on app icon)
  const { data: unreadRows } = await supabase
    .from('notifications')
    .select('user_id')
    .in('user_id', user_ids)
    .eq('read', false)
  const badgeMap: Record<string, number> = {}
  for (const row of (unreadRows ?? [])) {
    badgeMap[row.user_id] = (badgeMap[row.user_id] ?? 0) + 1
  }

  const results = await Promise.allSettled(subs.map(s => {
    const badge = badgeMap[s.user_id] ?? 1
    const payload = JSON.stringify({ title, body: msgBody, url, tag: tag ?? 'aroundlink', badge })
    return pushOne(s, payload)
  }))

  // Remove expired subscriptions
  const expired = subs
    .filter((_, i) => {
      const r = results[i]
      return r.status === 'rejected' || (r.status === 'fulfilled' && [404, 410].includes((r as PromiseFulfilledResult<number>).value))
    })
    .map(s => s.endpoint)
  if (expired.length > 0) await supabase.from('push_subscriptions').delete().in('endpoint', expired)

  const sent = results.filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<number>).value < 300).length

  return new Response(JSON.stringify({ sent, total: subs.length }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
