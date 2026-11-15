import { useEffect, useEffectEvent } from 'react';

import { tabPathOf } from '@/lib/app-tabs';

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

    const anchor = (event.target as Element | null)?.closest?.('a[href]');

    if (
      !(anchor instanceof HTMLAnchorElement) ||
      anchor.hasAttribute('download')
    ) {
      return;
    }

    const path = tabPathOf(anchor.href, window.location.origin, slug);

    if (path) {
      event.preventDefault();
      openAt(path);
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
