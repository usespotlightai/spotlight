import { type RefObject, useEffect, useState } from 'react';

import { useStoredState } from '@/hooks/useStoredState';

const SIDEBAR_COLLAPSED_KEY = 'spotlight.sidebar-collapsed';

export function useCollapsedSidebar(paneRef: RefObject<HTMLElement | null>) {
  const [stored, store] = useStoredState(SIDEBAR_COLLAPSED_KEY, 'false');
  const collapsed = stored === 'true';
  const [peeking, setPeeking] = useState(false);

  useEffect(() => {
    if (!peeking) {
      return;
    }

    const leave = (event: PointerEvent) => {
      const pane = paneRef.current;
      if (
        pane &&
        event.clientX > pane.offsetLeft + pane.offsetWidth &&
        !pane.querySelector('[data-popup-open]')
      ) {
        setPeeking(false);
      }
    };
    document.addEventListener('pointermove', leave);

    return () => document.removeEventListener('pointermove', leave);
  }, [peeking, paneRef]);

  const collapse = (next: boolean) => {
    store(String(next));
    setPeeking(false);
  };

  return {
    collapsed,
    peeking: collapsed && peeking,
    peek: () => setPeeking(true),
    unpeek: () => setPeeking(false),
    collapse: () => collapse(true),
    expand: () => collapse(false),
  };
}
