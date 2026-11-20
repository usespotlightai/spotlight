import { useEffect, useLayoutEffect, useRef } from 'react';

import { changesInPlace } from '@/lib/disclosure';
import { prefersReducedMotion } from '@/lib/motion';

const NEAR = 80;

const BIG_BLOCK = 0.4;

const READ_ON = 0.6;

// How long after opening, or after a new message, content that fills in
// (run histories, images) keeps the view at the bottom instead of scrolling
// to it.
export const SETTLE_MS = 1_000;

export function useStickToBottom<T extends HTMLElement>(jump?: unknown) {
  const ref = useRef<T>(null);
  const following = useRef(true);
  const pinnedAt = useRef(0);
  const settling = useRef(true);

  useEffect(() => {
    const el = ref.current;
    const content = el?.firstElementChild;
    if (!el || !content) {
      return;
    }

    const near = () => el.scrollHeight - el.scrollTop - el.clientHeight < NEAR;

    const unfollow = () => {
      following.current = false;
      pinnedAt.current = Number.POSITIVE_INFINITY;
    };

    const onScroll = () => {
      if (near() || el.scrollTop >= pinnedAt.current) {
        following.current = true;
      } else {
        unfollow();
      }
    };

    const onClick = (event: MouseEvent) => {
      if (changesInPlace(event.target)) {
        unfollow();
      }
    };

    let height: number | null = null;

    const grew = new ResizeObserver(() => {
      const added = height === null ? 0 : el.scrollHeight - height;
      height = el.scrollHeight;
      if (!following.current) {
        return;
      }

      if (
        !settling.current &&
        el.clientHeight > 0 &&
        added > el.clientHeight * BIG_BLOCK
      ) {
        const top = Math.min(
          el.scrollTop + el.clientHeight * READ_ON,
          el.scrollHeight - el.clientHeight,
        );
        unfollow();
        el.scrollTo({
          top,
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
        return;
      }

      el.scrollTop = el.scrollHeight;
      pinnedAt.current = el.scrollTop;
    });
    grew.observe(el);
    grew.observe(content);

    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('click', onClick, { capture: true });

    return () => {
      grew.disconnect();
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('click', onClick, { capture: true });
    };
  }, []);

  // Before paint, so a thread never shows its top first and then scrolls down.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    following.current = true;
    settling.current = true;
    el.scrollTop = el.scrollHeight;
    pinnedAt.current = el.scrollTop;

    const settled = window.setTimeout(() => {
      settling.current = false;
    }, SETTLE_MS);
    return () => window.clearTimeout(settled);
  }, [jump]);

  return ref;
}
