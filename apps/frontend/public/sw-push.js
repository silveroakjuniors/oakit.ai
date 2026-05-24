// Service Worker — Push Notification Handler
// This file runs in the background even when the app is closed

self.addEventListener('push', function(event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'Oakit.ai';
    const options = {
      body: data.body || '',
      icon: data.icon || '/oakie-icon.png',
      badge: data.badge || '/oakie-icon.png',
      tag: data.tag || 'oakit-notification',
      data: data.data || {},
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    console.error('[SW] Push parse error:', err);
  }
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open a new window
      return clients.openWindow(url);
    })
  );
});

// Handle subscription change (browser refreshes the subscription)
self.addEventListener('pushsubscriptionchange', function(event) {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options).then(function(subscription) {
      // Re-register with backend
      return fetch('/api/v1/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
    })
  );
});
