import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import { isAppPath, NAVIGATE_EVENT } from '@/lib/settings-page-element';

// Opens the path that a settings page element asks for with a spotlight-navigate event. It opens only paths of this app, never another origin. Give the ref to the element once it shows.
export function useNavigateRequests<T extends HTMLElement>(shown: boolean) {
  const ref = useRef<T>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const element = ref.current;

    if (!shown || !element) {
      return;
    }

    const onNavigate = (event: Event) => {
      const to = (event as CustomEvent<{ to?: unknown } | null>).detail?.to;

      if (isAppPath(to)) {
        void navigate(to);
      }
    };

    element.addEventListener(NAVIGATE_EVENT, onNavigate);
    return () => element.removeEventListener(NAVIGATE_EVENT, onNavigate);
  }, [shown, navigate]);

  return ref;
}
