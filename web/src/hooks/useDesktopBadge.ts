import { useEffect } from 'react';

import { useInbox } from '@/hooks/api/useInbox';
import { desktopApp } from '@/lib/desktop';
import { unreadCountOf } from '@/lib/inbox';

export function useDesktopBadge(slug: string | undefined): void {
  const app = desktopApp();
  const { data } = useInbox(app ? slug : undefined);
  const unread = data && unreadCountOf(data);

  useEffect(() => {
    if (app && unread !== undefined) {
      app.setBadge(unread);
    }
  }, [app, unread]);

  useEffect(() => () => app?.setBadge(0), [app]);
}
