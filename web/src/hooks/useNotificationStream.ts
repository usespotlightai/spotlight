import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';
import { useNavigate } from 'react-router';
import { inboxKeys } from '@/hooks/api/useInbox';
import { useBrowserPush } from '@/hooks/useBrowserNotifications';
import {
  type InboxNotification,
  NOTIFICATION_STREAM_URL,
  notificationsSupported,
} from '@/lib/notifications';

const notificationOf = (data: string): InboxNotification | null => {
  try {
    return JSON.parse(data) as InboxNotification;
  } catch {
    return null;
  }
};

export function useNotificationStream() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const browser = useBrowserPush();
  const pushed = Boolean(browser.data?.endpoint);

  const arrived = useEffectEvent((notification: InboxNotification) => {
    void queryClient.invalidateQueries({ queryKey: inboxKeys.all });

    if (
      pushed ||
      !notificationsSupported() ||
      Notification.permission !== 'granted'
    ) {
      return;
    }

    const shown = new Notification(notification.title, {
      body: notification.body ?? undefined,
      tag: notification.id,
      icon: '/email-logo.png',
    });

    shown.onclick = () => {
      window.focus();
      void navigate(notification.path);
      shown.close();
    };
  });

  useEffect(() => {
    if (typeof EventSource === 'undefined') {
      return;
    }

    const stream = new EventSource(NOTIFICATION_STREAM_URL, {
      withCredentials: true,
    });

    const listener = (event: MessageEvent<string>) => {
      const notification = notificationOf(event.data);

      if (notification) {
        arrived(notification);
      }
    };

    stream.addEventListener('notification', listener);

    return () => {
      stream.removeEventListener('notification', listener);
      stream.close();
    };
  }, []);
}
