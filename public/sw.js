const CACHE_VERSION = 'abhiai-pwa-v1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/branding/abhiai-app-icon-light-512.png?v=20260904b',
  '/logo-icon.svg',
  '/logo.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('abhiai-pwa-') && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match('/')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone()).catch(() => undefined);
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response && response.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    })
    .catch(() => undefined);

  return cached || networkPromise || Response.error();
}

async function noVisibleClient() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return !clients.some((client) => client.visibilityState === 'visible');
}

async function notifyGenerationResponse(response, kind) {
  if (!response.ok || !(await noVisibleClient())) return;

  try {
    const data = await response.clone().json();
    if (data?.error) return;
    await self.registration.showNotification(kind === 'edit' ? 'AbhiAI image edit is ready' : 'AbhiAI image is ready', {
      body: kind === 'edit' ? 'Your image edit has completed.' : 'Your image generation has completed.',
      icon: '/branding/abhiai-app-icon-light-512.png?v=20260904b',
      badge: '/branding/abhiai-app-icon-light-512.png?v=20260904b',
      tag: `abhiai-${kind}-complete`,
      data: { url: '/' },
      renotify: true,
    });
  } catch {
    // Notification permission may be unavailable or the response may not be JSON.
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.method === 'POST' && (url.pathname === '/api/generate-image' || url.pathname === '/api/edit-image')) {
    event.respondWith(
      fetch(request).then((response) => {
        event.waitUntil(notifyGenerationResponse(response.clone(), url.pathname === '/api/edit-image' ? 'edit' : 'generation'));
        return response;
      })
    );
    return;
  }

  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'image' ||
    url.pathname.startsWith('/branding/') ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() || 'Your AbhiAI task is complete.' };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'AbhiAI is ready', {
      body: payload.body || 'Your generation has completed.',
      icon: '/branding/abhiai-app-icon-light-512.png?v=20260904b',
      badge: '/branding/abhiai-app-icon-light-512.png?v=20260904b',
      tag: payload.tag || 'abhiai-background-task',
      data: { url: payload.url || '/' },
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          if ('navigate' in client) await client.navigate(targetUrl).catch(() => undefined);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })
  );
});
