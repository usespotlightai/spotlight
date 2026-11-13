import {
  type RefCallback,
  type RefObject,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';

import { JournalDemandContext } from '@/lib/journal-demand';

export function useJournalSight(
  root?: RefObject<HTMLElement | null>,
): (runIds: readonly string[]) => RefCallback<HTMLElement> | undefined {
  const { want } = use(JournalDemandContext);
  const wantNow = useRef(want);
  const observer = useRef<IntersectionObserver | null>(null);
  const unseen = useRef(new Map<Element, readonly string[]>());
  const sights = useRef(new Map<string, RefCallback<HTMLElement>>());

  useLayoutEffect(() => {
    wantNow.current = want;
  });

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observing = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const runIds = unseen.current.get(entry.target);
          if (entry.isIntersecting && runIds) {
            unseen.current.delete(entry.target);
            observing.unobserve(entry.target);
            wantNow.current(runIds);
          }
        }
      },
      { root: root?.current ?? null, rootMargin: '100% 0px' },
    );
    observer.current = observing;
    for (const element of unseen.current.keys()) {
      observing.observe(element);
    }

    return () => {
      observing.disconnect();
      observer.current = null;
    };
  }, [root]);

  return useCallback((runIds: readonly string[]) => {
    if (runIds.length === 0) {
      return undefined;
    }

    const key = runIds.join(' ');
    const known = sights.current.get(key);

    if (known) {
      return known;
    }

    const sight: RefCallback<HTMLElement> = (element) => {
      if (!element) {
        return;
      }

      if (typeof IntersectionObserver === 'undefined') {
        wantNow.current(runIds);
        return;
      }

      unseen.current.set(element, runIds);
      observer.current?.observe(element);

      return () => {
        unseen.current.delete(element);
        observer.current?.unobserve(element);
      };
    };

    sights.current.set(key, sight);
    return sight;
  }, []);
}
