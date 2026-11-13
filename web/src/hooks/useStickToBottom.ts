import { useEffect, useRef } from 'react';

import { togglesDisclosure } from '@/lib/disclosure';

const NEAR = 80;

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
      if (togglesDisclosure(event.target)) {
        unfollow();
      }
    };

    const grew = new ResizeObserver(() => {
      if (following.current) {
        el.scrollTop = el.scrollHeight;
        pinnedAt.current = el.scrollTop;
      }
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
