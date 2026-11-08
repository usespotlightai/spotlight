import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePushKey } from '@/hooks/api/usePushKey';
import { subscribeToPush, unsubscribeFromPush } from '@/lib/api';
import { desktopApp } from '@/lib/desktop';
import {
  currentPushSubscription,
  keysOf,
  notificationsSupported,
  pushSupported,
  subscribedPush,
} from '@/lib/notifications';

export type BrowserNotificationState =
  | 'desktop'
  | 'unsupported'
  | 'blocked'
  | 'off'
  | 'on-while-open'
  | 'on';

const browserPushKeys = {
  all: ['browser-push'] as const,
};

const permission = (): NotificationPermission =>
  notificationsSupported() ? Notification.permission : 'denied';

export function useBrowserPush() {
  return useQuery({
    queryKey: browserPushKeys.all,
    queryFn: async () => {
      const subscription = await currentPushSubscription();

      return {
        permission: permission(),
        endpoint: subscription?.endpoint ?? null,
      };
    },
  });
}

const stateOf = (
  browser: { permission: NotificationPermission; endpoint: string | null },
  publicKey: string | null,
): BrowserNotificationState => {
  if (desktopApp()) {
    return 'desktop';
  }

  if (!notificationsSupported()) {
    return 'unsupported';
  }

  if (browser.permission === 'denied') {
    return 'blocked';
  }

  if (browser.permission !== 'granted') {
    return 'off';
  }

  if (publicKey && pushSupported()) {
    return browser.endpoint ? 'on' : 'off';
  }

  return 'on-while-open';
};

export function useBrowserNotifications() {
  const queryClient = useQueryClient();
  const key = usePushKey();
  const browser = useBrowserPush();
  const publicKey = key.data ?? null;

  const refreshed = () =>
    queryClient.invalidateQueries({ queryKey: browserPushKeys.all });

  const turnOn = useMutation({
    mutationFn: async () => {
      if ((await Notification.requestPermission()) !== 'granted') {
        return;
      }

      if (publicKey && pushSupported() && !desktopApp()) {
        await subscribeToPush({
          body: keysOf(await subscribedPush(publicKey)),
          throwOnError: true,
        });
      }
    },
    onSettled: refreshed,
  });

  const turnOff = useMutation({
    mutationFn: async () => {
      const subscription = await currentPushSubscription();

      if (!subscription) {
        return;
      }

      const { endpoint } = subscription;
      await subscription.unsubscribe();
      await unsubscribeFromPush({ body: { endpoint } });
    },
    onSettled: refreshed,
  });

  return {
    key,
    browser,
    state:
      key.data !== undefined && browser.data
        ? stateOf(browser.data, publicKey)
        : null,
    turnOn,
    turnOff,
  };
}
