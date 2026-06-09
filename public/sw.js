/* AroundLink Service Worker — Web Push Notifications */

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try { data = event.data.json() }
  catch { data = { title: 'AroundLink', body: event.data.text(), url: '/' } }

  const options = {
    body:      data.body  ?? 'Nouvelle activité',
    icon:      '/icon-192.png',
    badge:     '/icon-192.png',
    tag:       data.tag   ?? 'aroundlink',
    data:      { url: data.url ?? '/' },
    renotify:  true,
    vibrate:   [200, 100, 200],
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title ?? 'AroundLink', options),
      // Badge on app icon (iOS 16.4+ PWA, Chrome/Android)
      'setAppBadge' in navigator
        ? navigator.setAppBadge(data.badge ?? 1).catch(() => {})
        : Promise.resolve(),
    ])
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url ?? '/'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If the app is already open → focus + navigate
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus()
            if ('navigate' in client) client.navigate(targetUrl)
            return
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) return clients.openWindow(targetUrl)
      })
  )
})

// Keep service worker alive; no caching strategy needed for push-only SW
self.addEventListener('install',  () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()))
