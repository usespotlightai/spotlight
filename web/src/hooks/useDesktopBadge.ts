import { useEffect } from 'react';

import { useInbox } from '@/hooks/api/useInbox';
import { desktopApp } from '@/lib/desktop';

export function useDesktopBadge(slug: string | undefined) {
  const app = desktopApp();
  const { data } = useInbox(app ? slug : undefined);
  const unread = data?.filter((each) => each.unread).length;

  useEffect(() => {
    if (app && unread !== undefined) {
      app.setBadge(unread);
    }
  }, [app, unread]);

  useEffect(() => () => app?.setBadge(0), [app]);
}
