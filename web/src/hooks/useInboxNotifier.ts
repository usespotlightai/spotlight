import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

import { inboxKeys } from '@/hooks/api/useInbox';
import { useBrowserPush } from '@/hooks/useBrowserNotifications';
import { desktopApp } from '@/lib/desktop';
import {
  type InboxNotification,
  notificationsSupported,
} from '@/lib/notifications';

export function useInboxNotifier(): (notification: InboxNotification) => void {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const browser = useBrowserPush();
  const pushed = Boolean(browser.data?.endpoint);

  return useCallback(
    (notification: InboxNotification) => {
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
      });

      shown.onclick = () => {
        desktopApp()?.show();
        window.focus();
        void navigate(notification.path);
        shown.close();
      };
    },
    [queryClient, navigate, pushed],
  );
}
