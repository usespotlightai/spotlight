import { useEffect, useEffectEvent } from 'react';

import { workspaceLinkAt } from '@/lib/app-tabs';

const MIDDLE_BUTTON = 1;

const asksForTab = (event: MouseEvent): boolean =>
  event.type === 'auxclick'
    ? event.button === MIDDLE_BUTTON
    : event.metaKey || event.ctrlKey;

export function useTabLinks(
  slug: string | undefined,
  openAt: (path: string) => void,
) {
  const clicked = useEffectEvent((event: MouseEvent) => {
    if (!slug || event.defaultPrevented || !asksForTab(event)) {
      return;
    }

    const link = workspaceLinkAt(
      event.target instanceof Element ? event.target : null,
      window.location.origin,
      slug,
    );

    if (link) {
      event.preventDefault();
      openAt(link.path);
    }
  });

  useEffect(() => {
    document.addEventListener('click', clicked);
    document.addEventListener('auxclick', clicked);

    return () => {
      document.removeEventListener('click', clicked);
      document.removeEventListener('auxclick', clicked);
    };
  }, []);
}
