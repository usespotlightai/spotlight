import { useEffect, useRef } from 'react';

import { changesInPlace } from '@/lib/disclosure';
import { prefersReducedMotion } from '@/lib/motion';

const NEAR = 80;

const BIG_BLOCK = 0.4;

const READ_ON = 0.6;

export function useStickToBottom<T extends HTMLElement>(jump?: unknown) {
  const ref = useRef<T>(null);
  const following = useRef(true);
  const pinnedAt = useRef(0);

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

      if (el.clientHeight > 0 && added > el.clientHeight * BIG_BLOCK) {
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

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    following.current = true;
    el.scrollTop = el.scrollHeight;
    pinnedAt.current = el.scrollTop;
  }, [jump]);

  return ref;
}
