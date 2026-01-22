// Service Worker for Push Notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  if (!event.data) {
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'SSL Marketplace',
      body: event.data.text(),
    };
  }

  const options = {
    body: data.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      ...data.data
    },
    actions: data.actions || [],
    tag: data.tag || 'ssl-notification',
    requireInteraction: data.requireInteraction || false
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'SSL Marketplace', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  // Our app uses HashRouter (/#/route). Normalize URLs coming from payloads
  // like "/notifications" into "/#/notifications" so navigation works.
  const rawUrl = event.notification.data?.url || '/';
  const rawUrlStr = typeof rawUrl === 'string' ? rawUrl : '/';
  const isAbsolute = /^https?:\/\//i.test(rawUrlStr);

  let urlToOpen = rawUrlStr;
  if (!isAbsolute) {
    if (rawUrlStr.startsWith('/#')) {
      urlToOpen = rawUrlStr; // already hash-based
    } else if (rawUrlStr.startsWith('#/')) {
      urlToOpen = `/${rawUrlStr}`;
    } else if (rawUrlStr.startsWith('/')) {
      urlToOpen = `/#${rawUrlStr}`;
    } else {
      urlToOpen = `/#/${rawUrlStr}`;
    }
  }

  const targetUrl = new URL(urlToOpen, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          try {
            const clientUrl = new URL(client.url);
            const desiredUrl = new URL(targetUrl);
            const sameRoute = clientUrl.origin === desiredUrl.origin && clientUrl.hash === desiredUrl.hash;
            if (sameRoute && 'focus' in client) {
              return client.focus();
            }
          } catch (e) {
            // ignore
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});
