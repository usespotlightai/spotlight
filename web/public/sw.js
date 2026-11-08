self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
