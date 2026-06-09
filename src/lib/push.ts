/**
 * Web Push helpers — AroundLink
 * Called from PushPrompt component (first login) and AppShell (SW registration).
 */

function getVapidKey(): string {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!key) throw new Error('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set')
  return key
}
/** Convert VAPID base64url key to Uint8Array (required by pushManager.subscribe) */
function urlBase64ToUint8Array(b64: string): BufferSource {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4)
  const base64  = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)))
}

/** Register the service worker (call once on app load) */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    return reg
  } catch {
    return null
  }
}

/** Whether the browser supports push at all */
export function isPushSupported(): boolean {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
}

/**
 * Request permission + subscribe + save subscription to Supabase.
 * Returns true on success.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const reg = await navigator.serviceWorker.ready
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(getVapidKey()),
    })

    const { endpoint, keys } = subscription.toJSON() as {
      endpoint: string
      keys: { p256dh: string; auth: string }
    }

    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { error } = await supabase.from('push_subscriptions').upsert(
      { user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'user_id,endpoint' }
    )

    return !error
  } catch {
    return false
  }
}

/** localStorage helpers so we only show the prompt once */
export const PUSH_PROMPT_KEY = 'al_push_asked'
export const hasPushBeenAsked = () =>
  typeof window !== 'undefined' && !!localStorage.getItem(PUSH_PROMPT_KEY)
export const markPushAsked = () =>
  typeof window !== 'undefined' && localStorage.setItem(PUSH_PROMPT_KEY, '1')
