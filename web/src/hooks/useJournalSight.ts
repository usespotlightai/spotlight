import { type RefCallback, use, useCallback, useEffect, useRef } from 'react';
import { JournalDemandContext } from '@/lib/journal-demand';

export function useJournalSight(): (
  runIds: readonly string[],
) => RefCallback<HTMLElement> | undefined {
  const { want } = use(JournalDemandContext);
  const wantNow = useRef(want);
  const observer = useRef<IntersectionObserver | null>(null);
  const watched = useRef(new WeakMap<Element, readonly string[]>());
  const sights = useRef(new Map<string, RefCallback<HTMLElement>>());

  useEffect(() => {
    wantNow.current = want;
  });

  useEffect(
    () => () => {
      observer.current?.disconnect();
      observer.current = null;
    },
    [],
  );

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

      const observing =
        observer.current ??
        new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              wantNow.current(watched.current.get(entry.target) ?? []);
              observing.unobserve(entry.target);
            }
          }
        });
      observer.current = observing;
      watched.current.set(element, runIds);
      observing.observe(element);

      return () => observing.unobserve(element);
    };

    sights.current.set(key, sight);
    return sight;
  }, []);
}
