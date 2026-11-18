self.addEventListener('install', () => {
  self.skipWaiting();
});

const SHELL_CACHE = 'spotlight-shell-v1';
const SHELL_URL = '/index.html';

const withoutOldShells = async () => {
  const names = await caches.keys();

  await Promise.all(
    names
      .filter((name) => name.startsWith('spotlight-shell-'))
      .filter((name) => name !== SHELL_CACHE)
      .map((name) => caches.delete(name)),
  );
};

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([self.clients.claim(), withoutOldShells()]));
});

const servedByTheApp = (request) => {
  if (request.mode !== 'navigate' || request.method !== 'GET') {
    return false;
  }

  const url = new URL(request.url);

  return (
    url.origin === self.location.origin &&
    !url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/assets/') &&
    !/\.[a-z0-9]+$/i.test(url.pathname)
  );
};

const refreshedShell = async () => {
  const response = await fetch(SHELL_URL, { cache: 'no-cache' });

  if (response.ok) {
    const cache = await caches.open(SHELL_CACHE);
    await cache.put(SHELL_URL, response.clone());
  }

  return response;
};

const shellFor = async (event) => {
  const cached = await caches.match(SHELL_URL, { cacheName: SHELL_CACHE });
  const refreshing = refreshedShell();

  if (!cached) {
    return refreshing;
  }

  event.waitUntil(refreshing.catch(() => undefined));
  return cached;
};

self.addEventListener('fetch', (event) => {
  if (servedByTheApp(event.request)) {
    event.respondWith(shellFor(event));
  }
});

const notificationOf = (event) => {
  try {
    return event.data?.json() ?? null;
  } catch {
    return null;
  }
};

self.addEventListener('push', (event) => {
  const notification = notificationOf(event);

  if (!notification) {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(notification.title, {
      body: notification.body ?? undefined,
      tag: notification.id,
      icon: '/email-logo.png',
      data: { path: notification.path },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const path = event.notification.data?.path ?? '/';
  const target = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windows) => {
        const open = windows.find(
          (each) => new URL(each.url).origin === self.location.origin,
        );

        if (open) {
          return open.focus().then((focused) => focused.navigate(target));
        }

        return self.clients.openWindow(target);
      }),
  );
});
