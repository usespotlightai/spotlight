import { useEffect, useRef } from 'react';
import { togglesDisclosure } from '@/lib/disclosure';

const NEAR = 80;

export function useStickToBottom<T extends HTMLElement>(jump?: unknown) {
  const ref = useRef<T>(null);
  const following = useRef(true);

  useEffect(() => {
    const el = ref.current;
    const content = el?.firstElementChild;
    if (!el || !content) {
      return;
    }

    const near = () => el.scrollHeight - el.scrollTop - el.clientHeight < NEAR;

    const onScroll = () => {
      following.current = near();
    };

    const onClick = (event: MouseEvent) => {
      if (togglesDisclosure(event.target)) {
        following.current = false;
      }
    };

    const grew = new ResizeObserver(() => {
      if (following.current) {
        el.scrollTop = el.scrollHeight;
      }
    });
    grew.observe(content);

    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('click', onClick, { capture: true });

    return () => {
      grew.disconnect();
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('click', onClick, { capture: true });
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a change of jump is the signal to go to the bottom
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    following.current = true;
    el.scrollTop = el.scrollHeight;
  }, [jump]);

  return ref;
}
