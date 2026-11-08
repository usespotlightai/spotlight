import { settingsPath } from '@/lib/settings';

export interface InboxNotification {
  readonly id: string;
  readonly kind: 'task' | 'notice';
  readonly title: string;
  readonly body: string | null;
  readonly path: string;
  readonly at: string;
}

export const notificationsPath = (slug: string): string =>
  `${settingsPath(slug)}/account/notifications`;

export const NOTIFICATION_STREAM_URL = '/api/me/notifications/stream';

const WORKER_URL = '/sw.js';

export const pushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export const notificationsSupported = (): boolean =>
  typeof window !== 'undefined' && 'Notification' in window;

const keyBytesOf = (base64url: string): Uint8Array<ArrayBuffer> => {
  const padded = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));

  for (let at = 0; at < raw.length; at += 1) {
    bytes[at] = raw.charCodeAt(at);
  }

  return bytes;
};

const worker = (): Promise<ServiceWorkerRegistration> =>
  navigator.serviceWorker.register(WORKER_URL);

export const currentPushSubscription =
  async (): Promise<PushSubscription | null> => {
    if (!pushSupported()) {
      return null;
    }

    const registration =
      await navigator.serviceWorker.getRegistration(WORKER_URL);

    return (await registration?.pushManager.getSubscription()) ?? null;
  };

export const subscribedPush = async (
  publicKey: string,
): Promise<PushSubscription> => {
  const registration = await worker();
  const existing = await registration.pushManager.getSubscription();

  return (
    existing ??
    registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytesOf(publicKey),
    })
  );
};

export const keysOf = (
  subscription: PushSubscription,
): { endpoint: string; keys: { p256dh: string; auth: string } } => {
  const json = subscription.toJSON();

  return {
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
  };
};
